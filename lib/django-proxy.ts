import { env } from "cloudflare:workers";

const configuredBackend = env.DJANGO_API_URL || process.env.DJANGO_API_URL || "http://127.0.0.1:8011";
const backend = /^https?:\/\//.test(configuredBackend) ? configuredBackend : `http://${configuredBackend}`;

export async function djangoProxy(request: Request, resource: "auth" | "profile" | "finance" | "budgets" | "password-reset" | "password-reset/confirm" | "email-verification") {
  const url = new URL(`/api/${resource}${new URL(request.url).search}`, backend);
  const headers = new Headers();
  for (const name of ["content-type", "cookie", "origin", "x-csrftoken"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      cache: "no-store",
      redirect: "manual",
    });
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
