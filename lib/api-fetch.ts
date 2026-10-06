"use client";

function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function apiFetch(url: string, init: RequestInit = {}) {
  const method = (init.method || "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return fetch(url, init);
  if (!csrfToken()) await fetch("/api/auth", { cache: "no-store" });
  const headers = new Headers(init.headers);
  headers.set("X-CSRFToken", csrfToken());
  return fetch(url, { ...init, headers });
}
