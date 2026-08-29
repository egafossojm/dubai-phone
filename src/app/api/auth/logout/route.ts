import { NextRequest } from "next/server";
import { logout } from "@/lib/auth/service";
import { jsonOk, toErrorResponse } from "@/lib/auth/http";

export async function POST(request: NextRequest) {
  try {
    await logout(request);
    return jsonOk({ loggedOut: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
