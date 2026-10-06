import { djangoProxy } from "@/lib/django-proxy";

export const dynamic = "force-dynamic";
export const GET = (request: Request) => djangoProxy(request, "finance");
export const POST = (request: Request) => djangoProxy(request, "finance");
export const PATCH = (request: Request) => djangoProxy(request, "finance");
export const DELETE = (request: Request) => djangoProxy(request, "finance");
