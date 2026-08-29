import { jsonOk, requireUser, toErrorResponse } from "@/lib/auth/http";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk(user);
  } catch (error) {
    return toErrorResponse(error);
  }
}
