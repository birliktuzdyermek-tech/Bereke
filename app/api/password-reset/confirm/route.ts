import { djangoProxy } from "@/lib/django-proxy";

export const dynamic = "force-dynamic";
export const GET = (request: Request) => djangoProxy(request, "password-reset/confirm");
export const POST = (request: Request) => djangoProxy(request, "password-reset/confirm");
