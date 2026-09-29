import { NextRequest } from "next/server";
import { jsonOk, requireUser, toErrorResponse } from "@/lib/auth/http";
import { maybeProxy } from "@/lib/bff/proxy";

export async function GET(request: NextRequest) {
  const proxied = await maybeProxy(request);
  if (proxied) {
    return proxied;
  }
  try {
    const user = await requireUser();
    return jsonOk(user);
  } catch (error) {
    return toErrorResponse(error);
  }
}
