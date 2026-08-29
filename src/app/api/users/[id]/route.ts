import { protectedPost } from "@/lib/auth/permission-route";

export const PATCH = protectedPost("users.update");
