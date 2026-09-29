import { NextRequest } from "next/server";
import { logout } from "@/lib/auth/service";
import { jsonOk, toErrorResponse } from "@/lib/auth/http";
import { maybeProxy } from "@/lib/bff/proxy";

export async function POST(request: NextRequest) {
  const proxied = await maybeProxy(request);
  if (proxied) {
    return proxied;
  }
  try {
    await logout(request);
    return jsonOk({ loggedOut: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
