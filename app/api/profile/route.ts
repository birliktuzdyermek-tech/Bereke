import { djangoProxy } from "@/lib/django-proxy";

export const dynamic = "force-dynamic";
export const PATCH = (request: Request) => djangoProxy(request, "profile");
