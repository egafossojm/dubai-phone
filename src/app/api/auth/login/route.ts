import { NextRequest } from "next/server";
import { login } from "@/lib/auth/service";
import { jsonOk, toErrorResponse } from "@/lib/auth/http";

export async function POST(request: NextRequest) {
  try {
    const user = await login(request);
    return jsonOk(user);
  } catch (error) {
    return toErrorResponse(error);
  }
}
