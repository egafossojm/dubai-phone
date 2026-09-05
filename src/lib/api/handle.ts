import type { NextRequest } from "next/server";
import { toErrorResponse } from "@/lib/auth/http";
import { assertMutatingOrigin } from "@/lib/auth/origin";

type RouteHandler = (request: NextRequest, context?: unknown) => Promise<Response>;

export function handleRoute(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      assertMutatingOrigin(request);
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
