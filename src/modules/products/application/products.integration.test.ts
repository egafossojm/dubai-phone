/**
 * @vitest-environment node
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { requireDatabaseForIntegration } from "@/lib/test/database-available";
import { GET as getProducts, POST as createProduct } from "@/app/api/products/route";
import { GET as getProduct, PATCH as patchProduct, DELETE as deleteProduct } from "@/app/api/products/[id]/route";
import { POST as registerSerial } from "@/app/api/products/[id]/serials/route";
import { POST as reactivateProduct } from "@/app/api/products/[id]/reactivate/route";
import { PATCH as patchVariant } from "@/app/api/products/variants/[variantId]/route";
import { POST as addVariant } from "@/app/api/products/[id]/variants/route";

const cookieJar = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "dp_session" && cookieJar.token
        ? { name, value: cookieJar.token }
        : undefined,
    set: () => undefined,
    delete: () => {
      cookieJar.token = undefined;
    },
  }),
}));

async function attachSession(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const token = createSessionToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  cookieJar.token = token;
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

const databaseAvailable = await requireDatabaseForIntegration();

describe.skipIf(!databaseAvailable)("product catalog APIs", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    cookieJar.token = undefined;
    await prisma.$disconnect();
  });

  it("lists products for a salesperson without exposing cost", async () => {
    await attachSession("caisse@dubai-phone.local");
    const response = await getProducts(
      jsonRequest("http://localhost/api/products?q=Galaxy", "GET"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { items: Array<{ name: string; costPriceXaf: string | null; sku: string }> };
    };
    expect(payload.data.items.length).toBeGreaterThan(0);
    expect(payload.data.items[0]?.costPriceXaf).toBeNull();
  });

  it("forbids a salesperson from creating a product", async () => {
    await attachSession("caisse@dubai-phone.local");
    const response = await createProduct(
      jsonRequest("http://localhost/api/products", "POST", {
        name: "Interdit",
        brandId: "11111111-1111-4111-8111-111111111111",
        categoryId: "22222222-2222-4222-8222-222222222222",
        isSerialized: false,
        variant: {
          sku: `FORBID-${randomBytes(3).toString("hex")}`,
          name: "Std",
          sellingPriceXaf: 1000,
          costPriceXaf: 100,
        },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects a duplicate SKU", async () => {
    await attachSession("manager@dubai-phone.local");
    const response = await createProduct(
      jsonRequest("http://localhost/api/products", "POST", {
        name: "Doublon SKU",
        brandId: "11111111-1111-4111-8111-111111111111",
        categoryId: "22222222-2222-4222-8222-222222222222",
        isSerialized: false,
        variant: {
          sku: "SAM-A16-128-BLK",
          name: "Noir",
          sellingPriceXaf: 1000,
          costPriceXaf: 100,
        },
      }),
    );
    expect(response.status).toBe(409);
  });

  it("creates a product without stock and refuses catalog IMEI registration", async () => {
    await attachSession("manager@dubai-phone.local");
    const sku = `TEST-${randomBytes(4).toString("hex").toUpperCase()}`;
    const created = await createProduct(
      jsonRequest("http://localhost/api/products", "POST", {
        name: "Téléphone test IMEI",
        brandId: "11111111-1111-4111-8111-111111111111",
        categoryId: "22222222-2222-4222-8222-222222222222",
        isSerialized: true,
        variant: {
          sku,
          name: "Noir",
          sellingPriceXaf: 99000,
          costPriceXaf: 70000,
          warrantyMonths: 12,
        },
      }),
    );
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as {
      data: { id: string; quantityOnHand: number; variants: Array<{ id: string }> };
    };
    expect(createdPayload.data.quantityOnHand).toBe(0);
    const productId = createdPayload.data.id;

    const serialResponse = await registerSerial(
      jsonRequest(`http://localhost/api/products/${productId}/serials`, "POST", {
        variantId: createdPayload.data.variants[0].id,
        imei1: `35${Date.now().toString().slice(-13)}`,
      }),
      { params: Promise.resolve({ id: productId }) },
    );
    expect(serialResponse.status).toBe(422);
    const serialPayload = (await serialResponse.json()) as {
      error?: { code: string };
    };
    expect(serialPayload.error?.code).toBe("BUSINESS_RULE_ERROR");
    expect(
      await prisma.productSerial.count({
        where: { variant: { productId } },
      }),
    ).toBe(0);
  });

  it("lets a manager deactivate then view and reactivate a product", async () => {
    await attachSession("manager@dubai-phone.local");
    const sku = `OFF-${randomBytes(4).toString("hex").toUpperCase()}`;
    const created = await createProduct(
      jsonRequest("http://localhost/api/products", "POST", {
        name: "Produit à désactiver",
        brandId: "11111111-1111-4111-8111-111111111111",
        categoryId: "33333333-3333-4333-8333-333333333333",
        isSerialized: false,
        variant: {
          sku,
          name: "Std",
          sellingPriceXaf: 5000,
          costPriceXaf: 2000,
        },
      }),
    );
    const productId = ((await created.json()) as { data: { id: string } }).data.id;
    const ctx = { params: Promise.resolve({ id: productId }) };

    const deactivated = await deleteProduct(
      jsonRequest(`http://localhost/api/products/${productId}`, "DELETE"),
      ctx,
    );
    expect(deactivated.status).toBe(200);

    const viewed = await getProduct(
      jsonRequest(`http://localhost/api/products/${productId}`, "GET"),
      ctx,
    );
    expect(viewed.status).toBe(200);
    const viewedPayload = (await viewed.json()) as {
      data: { status: string };
    };
    expect(viewedPayload.data.status).toBe("INACTIVE");

    const listed = await getProducts(
      jsonRequest("http://localhost/api/products?status=INACTIVE", "GET"),
    );
    const listedPayload = (await listed.json()) as {
      data: { items: Array<{ id: string }> };
    };
    expect(listedPayload.data.items.some((item) => item.id === productId)).toBe(true);

    const reactivated = await reactivateProduct(
      jsonRequest(`http://localhost/api/products/${productId}/reactivate`, "POST"),
      ctx,
    );
    expect(reactivated.status).toBe(200);
    const again = await getProduct(
      jsonRequest(`http://localhost/api/products/${productId}`, "GET"),
      ctx,
    );
    const againPayload = (await again.json()) as { data: { status: string } };
    expect(againPayload.data.status).toBe("ACTIVE");
  });

  it("forbids a salesperson from registering an IMEI", async () => {
    await attachSession("caisse@dubai-phone.local");
    const response = await registerSerial(
      jsonRequest(
        "http://localhost/api/products/44444444-4444-4444-8444-444444444444/serials",
        "POST",
        { variantId: "00000000-0000-4000-8000-000000000000", imei1: "350000000000099" },
      ),
      { params: Promise.resolve({ id: "44444444-4444-4444-8444-444444444444" }) },
    );
    expect(response.status).toBe(403);
  });

  it("does not let a salesperson deactivate a product", async () => {
    await attachSession("caisse@dubai-phone.local");
    const response = await deleteProduct(
      jsonRequest(
        "http://localhost/api/products/44444444-4444-4444-8444-444444444444",
        "DELETE",
      ),
      { params: Promise.resolve({ id: "44444444-4444-4444-8444-444444444444" }) },
    );
    expect(response.status).toBe(403);
  });

  it("rejects deactivating a product via PATCH", async () => {
    await attachSession("manager@dubai-phone.local");
    const response = await patchProduct(
      jsonRequest(
        "http://localhost/api/products/44444444-4444-4444-8444-444444444444",
        "PATCH",
        { status: "INACTIVE" },
      ),
      { params: Promise.resolve({ id: "44444444-4444-4444-8444-444444444444" }) },
    );
    expect(response.status).toBe(400);
  });

  it("does not let inventory reactivate a product via PATCH", async () => {
    await attachSession("manager@dubai-phone.local");
    const sku = `RACT-${randomBytes(4).toString("hex").toUpperCase()}`;
    const created = await createProduct(
      jsonRequest("http://localhost/api/products", "POST", {
        name: "Produit réactivation PATCH",
        brandId: "11111111-1111-4111-8111-111111111111",
        categoryId: "22222222-2222-4222-8222-222222222222",
        isSerialized: false,
        variant: {
          sku,
          name: "Std",
          sellingPriceXaf: 5000,
          costPriceXaf: 2000,
        },
      }),
    );
    const productId = ((await created.json()) as { data: { id: string } }).data.id;
    const ctx = { params: Promise.resolve({ id: productId }) };
    await deleteProduct(
      jsonRequest(`http://localhost/api/products/${productId}`, "DELETE"),
      ctx,
    );

    await attachSession("stock@dubai-phone.local");
    const response = await patchProduct(
      jsonRequest(`http://localhost/api/products/${productId}`, "PATCH", {
        status: "ACTIVE",
      }),
      ctx,
    );
    expect(response.status).toBe(403);
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    expect(product.status).toBe("INACTIVE");
  });

  it("does not let inventory create a product with selling prices", async () => {
    await attachSession("stock@dubai-phone.local");
    const response = await createProduct(
      jsonRequest("http://localhost/api/products", "POST", {
        name: "Prix interdit stock",
        brandId: "11111111-1111-4111-8111-111111111111",
        categoryId: "22222222-2222-4222-8222-222222222222",
        isSerialized: false,
        variant: {
          sku: `STK-${randomBytes(3).toString("hex").toUpperCase()}`,
          name: "Std",
          sellingPriceXaf: 15000,
          costPriceXaf: 9000,
        },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("does not let inventory add a variant with selling prices", async () => {
    await attachSession("stock@dubai-phone.local");
    const phone = await prisma.product.findFirstOrThrow({
      where: { variants: { some: { sku: "SAM-A16-128-BLK" } } },
    });
    const response = await addVariant(
      jsonRequest(`http://localhost/api/products/${phone.id}/variants`, "POST", {
        sku: `STKV-${randomBytes(3).toString("hex").toUpperCase()}`,
        name: "Variante stock",
        sellingPriceXaf: 18000,
        costPriceXaf: 10000,
      }),
      { params: Promise.resolve({ id: phone.id }) },
    );
    expect(response.status).toBe(403);
  });

  it("does not let inventory change selling prices", async () => {
    await attachSession("stock@dubai-phone.local");
    const phone = await prisma.productVariant.findUniqueOrThrow({
      where: { sku: "SAM-A16-128-BLK" },
    });
    const response = await patchVariant(
      jsonRequest(`http://localhost/api/products/variants/${phone.id}`, "PATCH", {
        sellingPriceXaf: 199000,
      }),
      { params: Promise.resolve({ variantId: phone.id }) },
    );
    expect(response.status).toBe(403);
  });

  it("does not let inventory reactivate a product", async () => {
    await attachSession("stock@dubai-phone.local");
    const response = await reactivateProduct(
      jsonRequest(
        "http://localhost/api/products/44444444-4444-4444-8444-444444444444/reactivate",
        "POST",
      ),
      { params: Promise.resolve({ id: "44444444-4444-4444-8444-444444444444" }) },
    );
    expect(response.status).toBe(403);
  });
});
