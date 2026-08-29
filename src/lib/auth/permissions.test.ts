import { describe, expect, it } from "vitest";
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/auth/permissions";

describe("RBAC matrix", () => {
  it("gives the super administrator every permission", () => {
    expect(ROLE_PERMISSIONS.SUPER_ADMINISTRATOR).toContain("permissions.write");
    expect(ROLE_PERMISSIONS.SUPER_ADMINISTRATOR).toContain("sales.refund");
  });

  it("forbids a salesperson from refunds, stock adjustments and user admin", () => {
    const sales = ROLE_PERMISSIONS.SALES_PERSON;
    expect(hasPermission(sales, "sales.create")).toBe(true);
    expect(hasPermission(sales, "sales.refund")).toBe(false);
    expect(hasPermission(sales, "inventory.adjust")).toBe(false);
    expect(hasPermission(sales, "users.update")).toBe(false);
    expect(hasPermission(sales, "audit.read")).toBe(false);
  });

  it("forbids inventory manager from sales, refunds and product creation", () => {
    const inventory = ROLE_PERMISSIONS.INVENTORY_MANAGER;
    expect(hasPermission(inventory, "purchases.receive")).toBe(true);
    expect(hasPermission(inventory, "products.update")).toBe(true);
    expect(hasPermission(inventory, "products.create")).toBe(false);
    expect(hasPermission(inventory, "products.delete")).toBe(false);
    expect(hasPermission(inventory, "sales.create")).toBe(false);
    expect(hasPermission(inventory, "sales.refund")).toBe(false);
    expect(hasPermission(inventory, "users.create")).toBe(false);
  });

  it("forbids manager from creating users or editing permissions", () => {
    const manager = ROLE_PERMISSIONS.MANAGER;
    expect(hasPermission(manager, "users.read")).toBe(true);
    expect(hasPermission(manager, "users.create")).toBe(false);
    expect(hasPermission(manager, "permissions.write")).toBe(false);
    expect(hasPermission(manager, "sales.refund")).toBe(true);
  });
});
