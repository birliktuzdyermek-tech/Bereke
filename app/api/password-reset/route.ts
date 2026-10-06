import { djangoProxy } from "@/lib/django-proxy";

export const dynamic = "force-dynamic";
export const POST = (request: Request) => djangoProxy(request, "password-reset");
