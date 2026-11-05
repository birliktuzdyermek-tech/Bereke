declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    DJANGO_API_URL?: string;
    BEREKE_PROXY_SECRET?: string;
  }
}
