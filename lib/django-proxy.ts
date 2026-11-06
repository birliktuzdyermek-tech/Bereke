// process.env works in both runtimes: Node (`vinext start`) and workerd, where
// nodejs_compat fills process.env from the Worker's vars and secrets.
const configuredBackend = process.env.DJANGO_API_URL || "http://127.0.0.1:8011";
const backend = /^https?:\/\//.test(configuredBackend) ? configuredBackend : `http://${configuredBackend}`;
const proxySecret = process.env.BEREKE_PROXY_SECRET || "";

// The browser never talks to Django directly, so Django sees this server's IP.
// Pass the visitor's IP along; Django trusts it only with the shared secret.
function clientIp(request: Request) {
  const direct = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip");
  if (direct) return direct.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "";
}

export async function djangoProxy(request: Request, resource: "auth" | "profile" | "finance" | "budgets" | "password-reset" | "password-reset/confirm" | "email-verification") {
  const url = new URL(`/api/${resource}${new URL(request.url).search}`, backend);
  const headers = new Headers();
  for (const name of ["content-type", "cookie", "origin", "x-csrftoken"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const ip = clientIp(request);
  if (proxySecret && ip) {
    headers.set("x-bereke-client-ip", ip);
    headers.set("x-bereke-proxy-secret", proxySecret);
  }
  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      cache: "no-store",
      redirect: "manual",
    });
    // The API only speaks JSON. Anything else on an error status is an infrastructure page
    // (Render's "waking up"/502 page, a bare Django 500) that the browser could not parse.
    if (upstream.status >= 400 && !/json/i.test(upstream.headers.get("content-type") || "")) {
      console.error("Django API returned a non-JSON error", upstream.status);
      void upstream.body?.cancel();
      return upstream.status >= 500
        ? Response.json({ error: "Сервер қазір оянып жатыр. Бір минуттан кейін қайталаңыз." }, { status: 503, headers: { "cache-control": "no-store" } })
        : Response.json({ error: "Әрекет орындалмады" }, { status: upstream.status, headers: { "cache-control": "no-store" } });
    }
    const responseHeaders = new Headers();
    for (const name of ["content-type", "cache-control"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", cookie);
    responseHeaders.set("cache-control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    console.error("Django API unavailable", error);
    return Response.json({ error: "Дерекқор серверіне қосылу мүмкін болмады" }, { status: 503 });
  }
}
