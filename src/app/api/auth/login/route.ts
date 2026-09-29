import { NextRequest } from "next/server";
import { login } from "@/lib/auth/service";
import { jsonOk, toErrorResponse } from "@/lib/auth/http";
import { maybeProxy } from "@/lib/bff/proxy";

export async function POST(request: NextRequest) {
  const proxied = await maybeProxy(request);
  if (proxied) {
    return proxied;
  }
  try {
    const user = await login(request);
    return jsonOk(user);
  } catch (error) {
    return toErrorResponse(error);
  }
}
