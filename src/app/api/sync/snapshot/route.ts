import { jsonOk, requirePermission } from "@/lib/auth/http";
import { handleRoute } from "@/lib/api/handle";
import { getSyncSnapshotUseCase } from "@/modules/sales/application/sync-snapshot";

export const GET = handleRoute(async () => {
  await requirePermission("sales.create");
  return jsonOk(await getSyncSnapshotUseCase());
});
