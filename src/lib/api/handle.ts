import type { NextRequest } from "next/server";
import { toErrorResponse } from "@/lib/auth/http";
import { assertMutatingOrigin } from "@/lib/auth/origin";
import { maybeProxy } from "@/lib/bff/proxy";

type RouteHandler = (request: NextRequest, context?: unknown) => Promise<Response>;

export function handleRoute(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      const proxied = await maybeProxy(request);
      if (proxied) {
        return proxied;
      }
      assertMutatingOrigin(request);
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
