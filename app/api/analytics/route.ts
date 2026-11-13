import { djangoProxy } from "@/lib/django-proxy";

export const dynamic = "force-dynamic";
export const GET = (request: Request) => djangoProxy(request, "analytics");
