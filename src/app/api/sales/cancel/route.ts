import { protectedPost } from "@/lib/auth/permission-route";

export const POST = protectedPost("sales.cancel");
