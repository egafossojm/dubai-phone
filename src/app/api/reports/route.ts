import { protectedGet } from "@/lib/auth/permission-route";

export const GET = protectedGet("reports.read", async () => ({
  message: "Rapports détaillés : phase ultérieure",
}));
