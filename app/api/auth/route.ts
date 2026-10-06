import { djangoProxy } from "@/lib/django-proxy";

export const dynamic = "force-dynamic";
export const GET = (request: Request) => djangoProxy(request, "auth");
export const POST = (request: Request) => djangoProxy(request, "auth");
export const DELETE = (request: Request) => djangoProxy(request, "auth");
