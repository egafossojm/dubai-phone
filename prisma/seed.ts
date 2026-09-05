import { PrismaClient, CreditStatus, DeviceStatus, PaymentMethod, ProductStatus, PurchaseOrderStatus, SaleKind, SaleStatus, UserStatus } from "@prisma/client";
import { xaf } from "../src/lib/money";
import { hashPassword } from "../src/lib/auth/password";
import { getSeedUserPassword } from "../src/lib/auth/dev-credentials";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "../src/lib/auth/permissions";

const prisma = new PrismaClient();

async function seedPermissions() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: {
        code: permission.code,
        description: permission.description,
      },
    });
  }
}

async function seedRoles() {
  const roles = [
    { code: "SUPER_ADMINISTRATOR", name: "Super administrateur", maxDiscountBps: 10000 },
    { code: "MANAGER", name: "Manager", maxDiscountBps: 1500 },
    { code: "SALES_PERSON", name: "Vendeur / Caissier", maxDiscountBps: 500 },
    { code: "INVENTORY_MANAGER", name: "Responsable stock", maxDiscountBps: 0 },
  ];

  for (const role of roles) {
    const saved = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, maxDiscountBps: role.maxDiscountBps },
      create: role,
    });

    const codes = ROLE_PERMISSIONS[role.code as keyof typeof ROLE_PERMISSIONS] ?? [];
    const permissions = await prisma.permission.findMany({
      where: { code: { in: codes } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: saved.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: saved.id,
        permissionId: permission.id,
      })),
    });
  }

  const catalogCodes = PERMISSIONS.map((permission) => permission.code);
  await prisma.rolePermission.deleteMany({
    where: { permission: { code: { notIn: [...catalogCodes] } } },
  });
  await prisma.permission.deleteMany({
    where: { code: { notIn: [...catalogCodes] } },
  });
}

async function seedUsers() {
  const users = [
    {
      email: "admin@dubai-phone.local",
      fullName: "Amina Super Admin",
      role: "SUPER_ADMINISTRATOR",
    },
    {
      email: "manager@dubai-phone.local",
      fullName: "Jean Manager",
      role: "MANAGER",
    },
    {
      email: "caisse@dubai-phone.local",
      fullName: "Marie Caissière",
      role: "SALES_PERSON",
    },
    {
      email: "stock@dubai-phone.local",
      fullName: "Paul Stock",
      role: "INVENTORY_MANAGER",
    },
  ];

  const passwordHash = await hashPassword(getSeedUserPassword());

  for (const user of users) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: user.role } });
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: { fullName: user.fullName, status: UserStatus.ACTIVE, passwordHash },
      create: {
        email: user.email,
        fullName: user.fullName,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: saved.id, roleId: role.id } },
      update: {},
      create: { userId: saved.id, roleId: role.id },
    });
  }
}

async function seedSettings() {
  const settings: Record<string, string> = {
    "store.name": "Dubai Phone",
    "store.address": "Marché central, boutiques électroniques",
    "store.city": "Douala",
    "store.country": "CM",
    "store.phone": "+237 600 000 000",
    "store.email": "contact@dubai-phone.local",
    "currency.code": "XAF",
    "currency.label": "FCFA",
    "returns.maxDays": "7",
    "credit.minDownPaymentBps": "1000",
    "stock.lowStockThreshold": "3",
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.storeSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  const year = 2026;
  const sequences: { documentType: "SALE" | "RECEIPT" | "PURCHASE_ORDER" | "GOODS_RECEIPT" | "RETURN" | "WARRANTY" | "CREDIT"; prefix: string }[] =
    [
      { documentType: "SALE", prefix: "V" },
      { documentType: "RECEIPT", prefix: "R" },
      { documentType: "PURCHASE_ORDER", prefix: "PO" },
      { documentType: "GOODS_RECEIPT", prefix: "GR" },
      { documentType: "RETURN", prefix: "RT" },
      { documentType: "WARRANTY", prefix: "W" },
      { documentType: "CREDIT", prefix: "CR" },
    ];

  for (const sequence of sequences) {
    await prisma.numberSequence.upsert({
      where: {
        documentType_year: { documentType: sequence.documentType, year },
      },
      update: { prefix: sequence.prefix },
      create: { ...sequence, year, currentValue: 0 },
    });
  }
}

async function seedCatalogAndDemo() {
  const brand = await prisma.brand.upsert({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    update: { name: "Samsung" },
    create: { id: "11111111-1111-4111-8111-111111111111", name: "Samsung" },
  });

  const phones = await prisma.category.upsert({
    where: { id: "22222222-2222-4222-8222-222222222222" },
    update: { name: "Smartphones" },
    create: { id: "22222222-2222-4222-8222-222222222222", name: "Smartphones" },
  });

  const accessories = await prisma.category.upsert({
    where: { id: "33333333-3333-4333-8333-333333333333" },
    update: { name: "Accessoires" },
    create: { id: "33333333-3333-4333-8333-333333333333", name: "Accessoires" },
  });

  const phoneProduct = await prisma.product.upsert({
    where: { id: "44444444-4444-4444-8444-444444444444" },
    update: { name: "Galaxy A16 128 Go", status: ProductStatus.ACTIVE, isSerialized: true },
    create: {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Galaxy A16 128 Go",
      brandId: brand.id,
      categoryId: phones.id,
      isSerialized: true,
      status: ProductStatus.ACTIVE,
    },
  });

  const cableProduct = await prisma.product.upsert({
    where: { id: "55555555-5555-4555-8555-555555555555" },
    update: { name: "Câble USB-C", status: ProductStatus.ACTIVE, isSerialized: false },
    create: {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Câble USB-C",
      brandId: brand.id,
      categoryId: accessories.id,
      isSerialized: false,
      status: ProductStatus.ACTIVE,
    },
  });

  const phoneVariant = await prisma.productVariant.upsert({
    where: { sku: "SAM-A16-128-BLK" },
    update: {
      sellingPriceXaf: xaf(165000),
      costPriceXaf: xaf(120000),
      warrantyMonths: 12,
      status: ProductStatus.ACTIVE,
    },
    create: {
      productId: phoneProduct.id,
      sku: "SAM-A16-128-BLK",
      barcode: "8801234567890",
      name: "Noir",
      sellingPriceXaf: xaf(165000),
      costPriceXaf: xaf(120000),
      warrantyMonths: 12,
      status: ProductStatus.ACTIVE,
    },
  });

  const cableVariant = await prisma.productVariant.upsert({
    where: { sku: "CBL-USBC-1M" },
    update: {
      sellingPriceXaf: xaf(3500),
      costPriceXaf: xaf(1500),
      status: ProductStatus.ACTIVE,
    },
    create: {
      productId: cableProduct.id,
      sku: "CBL-USBC-1M",
      barcode: "2000000000014",
      name: "1 mètre",
      sellingPriceXaf: xaf(3500),
      costPriceXaf: xaf(1500),
      warrantyMonths: 0,
      status: ProductStatus.ACTIVE,
    },
  });

  const supplier = await prisma.supplier.upsert({
    where: { id: "66666666-6666-4666-8666-666666666666" },
    update: { name: "Fournisseur Demo Douala" },
    create: {
      id: "66666666-6666-4666-8666-666666666666",
      name: "Fournisseur Demo Douala",
      phone: "670000001",
    },
  });

  const existingCustomer = await prisma.customer.findFirst({
    where: { phone: "690000001", deletedAt: null },
  });
  const customer =
    existingCustomer ??
    (await prisma.customer.create({
      data: {
        fullName: "Client Demo",
        phone: "690000001",
      },
    }));
  if (existingCustomer) {
    await prisma.customer.update({
      where: { id: existingCustomer.id },
      data: { fullName: "Client Demo" },
    });
  }

  const stockUser = await prisma.user.findUniqueOrThrow({
    where: { email: "stock@dubai-phone.local" },
  });
  const cashier = await prisma.user.findUniqueOrThrow({
    where: { email: "caisse@dubai-phone.local" },
  });

  const existingPo = await prisma.purchaseOrder.findUnique({
    where: { reference: "PO-2026-000001" },
  });
  if (existingPo) {
    await syncPurchaseSequences();
    return { phoneVariant, cableVariant, customer, cashier };
  }

  await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: {
        reference: "PO-2026-000001",
        supplierId: supplier.id,
        status: PurchaseOrderStatus.RECEIVED,
        createdById: stockUser.id,
        orderedAt: new Date("2026-01-10T09:00:00.000Z"),
        items: {
          create: [
            {
              variantId: phoneVariant.id,
              quantityOrdered: 2,
              quantityReceived: 2,
              unitCostXaf: xaf(120000),
            },
            {
              variantId: cableVariant.id,
              quantityOrdered: 10,
              quantityReceived: 10,
              unitCostXaf: xaf(1500),
            },
          ],
        },
      },
      include: { items: true },
    });

    const phonePoItem = po.items.find((item) => item.variantId === phoneVariant.id)!;
    const cablePoItem = po.items.find((item) => item.variantId === cableVariant.id)!;

    const receipt = await tx.goodsReceipt.create({
      data: {
        reference: "GR-2026-000001",
        purchaseOrderId: po.id,
        status: "POSTED",
        idempotencyKey: "seed-gr-2026-000001",
        receivedAt: new Date("2026-01-12T10:00:00.000Z"),
        postedAt: new Date("2026-01-12T10:05:00.000Z"),
        postedById: stockUser.id,
        items: {
          create: [
            {
              purchaseOrderItemId: phonePoItem.id,
              variantId: phoneVariant.id,
              quantityReceived: 2,
              unitCostXaf: xaf(120000),
            },
            {
              purchaseOrderItemId: cablePoItem.id,
              variantId: cableVariant.id,
              quantityReceived: 10,
              unitCostXaf: xaf(1500),
            },
          ],
        },
      },
      include: { items: true },
    });

    const phoneReceiptItem = receipt.items.find((item) => item.variantId === phoneVariant.id)!;
    const cableReceiptItem = receipt.items.find((item) => item.variantId === cableVariant.id)!;

    const serialA = await tx.productSerial.create({
      data: {
        variantId: phoneVariant.id,
        imei1: "350000000000001",
        serialNumber: "SN-A16-0001",
        status: DeviceStatus.IN_STOCK,
        goodsReceiptItemId: phoneReceiptItem.id,
      },
    });
    const serialB = await tx.productSerial.create({
      data: {
        variantId: phoneVariant.id,
        imei1: "350000000000002",
        serialNumber: "SN-A16-0002",
        status: DeviceStatus.IN_STOCK,
        goodsReceiptItemId: phoneReceiptItem.id,
      },
    });

    await tx.stockMovement.createMany({
      data: [
        {
          type: "PURCHASE_RECEIPT",
          variantId: phoneVariant.id,
          quantity: 1,
          productSerialId: serialA.id,
          goodsReceiptId: receipt.id,
          goodsReceiptItemId: phoneReceiptItem.id,
          recordedById: stockUser.id,
        },
        {
          type: "PURCHASE_RECEIPT",
          variantId: phoneVariant.id,
          quantity: 1,
          productSerialId: serialB.id,
          goodsReceiptId: receipt.id,
          goodsReceiptItemId: phoneReceiptItem.id,
          recordedById: stockUser.id,
        },
        {
          type: "PURCHASE_RECEIPT",
          variantId: cableVariant.id,
          quantity: 10,
          goodsReceiptId: receipt.id,
          goodsReceiptItemId: cableReceiptItem.id,
          recordedById: stockUser.id,
        },
      ],
    });

    await tx.productVariant.update({
      where: { id: phoneVariant.id },
      data: { quantityOnHand: 2 },
    });
    await tx.productVariant.update({
      where: { id: cableVariant.id },
      data: { quantityOnHand: 10 },
    });
  });

  await syncPurchaseSequences();
  return { phoneVariant, cableVariant, customer, cashier };
}

async function syncPurchaseSequences() {
  const year = 2026;
  await prisma.numberSequence.updateMany({
    where: { documentType: "PURCHASE_ORDER", year, currentValue: { lt: 1 } },
    data: { currentValue: 1 },
  });
  await prisma.numberSequence.updateMany({
    where: { documentType: "GOODS_RECEIPT", year, currentValue: { lt: 1 } },
    data: { currentValue: 1 },
  });
}

async function seedRepresentativeSale(input: {
  cableVariant: { id: string; sellingPriceXaf: bigint };
  cashier: { id: string };
}) {
  const existing = await prisma.sale.findUnique({
    where: { reference: "V-2026-000001" },
  });
  if (existing) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        reference: "V-2026-000001",
        clientTxnId: "seed-sale-cash-000001",
        kind: SaleKind.IMMEDIATE,
        status: SaleStatus.COMPLETED,
        soldById: input.cashier.id,
        subtotalXaf: xaf(3500),
        discountTotalXaf: xaf(0),
        totalXaf: xaf(3500),
        completedAt: new Date("2026-01-15T14:00:00.000Z"),
        items: {
          create: {
            variantId: input.cableVariant.id,
            quantity: 1,
            unitPriceXaf: input.cableVariant.sellingPriceXaf,
            discountXaf: xaf(0),
            lineTotalXaf: xaf(3500),
          },
        },
      },
      include: { items: true },
    });

    await tx.payment.create({
      data: {
        idempotencyKey: "seed-pay-000001",
        method: PaymentMethod.CASH,
        amountXaf: xaf(3500),
        saleId: sale.id,
        recordedById: input.cashier.id,
      },
    });

    await tx.receipt.create({
      data: {
        saleId: sale.id,
        reference: "R-2026-000001",
      },
    });

    await tx.stockMovement.create({
      data: {
        type: "SALE",
        variantId: input.cableVariant.id,
        quantity: -1,
        saleId: sale.id,
        saleItemId: sale.items[0].id,
        recordedById: input.cashier.id,
      },
    });

    await tx.productVariant.update({
      where: { id: input.cableVariant.id },
      data: { quantityOnHand: { decrement: 1 } },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.cashier.id,
        action: "sale.complete",
        entityType: "Sale",
        entityId: sale.id,
        afterJson: JSON.stringify({ reference: sale.reference, totalXaf: "3500" }),
      },
    });
  });
}

async function seedCreditExample(input: {
  phoneVariant: { id: string; sellingPriceXaf: bigint };
  customer: { id: string };
  cashier: { id: string };
}) {
  const existing = await prisma.sale.findUnique({
    where: { reference: "V-2026-000002" },
  });
  if (existing) {
    return;
  }

  const serial = await prisma.productSerial.findUniqueOrThrow({
    where: { imei1: "350000000000001" },
  });

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        reference: "V-2026-000002",
        clientTxnId: "seed-sale-credit-000002",
        kind: SaleKind.INSTALLMENT,
        status: SaleStatus.COMPLETED,
        customerId: input.customer.id,
        soldById: input.cashier.id,
        subtotalXaf: xaf(165000),
        discountTotalXaf: xaf(0),
        totalXaf: xaf(165000),
        completedAt: new Date("2026-01-16T11:00:00.000Z"),
        items: {
          create: {
            variantId: input.phoneVariant.id,
            quantity: 1,
            unitPriceXaf: input.phoneVariant.sellingPriceXaf,
            discountXaf: xaf(0),
            lineTotalXaf: xaf(165000),
          },
        },
      },
      include: { items: true },
    });

    await tx.productSerial.update({
      where: { id: serial.id },
      data: {
        status: DeviceStatus.SOLD,
        saleItemId: sale.items[0].id,
        customerId: input.customer.id,
      },
    });

    await tx.payment.create({
      data: {
        idempotencyKey: "seed-pay-down-000002",
        method: PaymentMethod.ORANGE_MONEY,
        amountXaf: xaf(45000),
        operatorReference: "OM-SEED-001",
        saleId: sale.id,
        recordedById: input.cashier.id,
      },
    });

    await tx.customerCredit.create({
      data: {
        reference: "CR-2026-000001",
        saleId: sale.id,
        customerId: input.customer.id,
        totalAmountXaf: xaf(165000),
        downPaymentXaf: xaf(45000),
        remainingXaf: xaf(120000),
        status: CreditStatus.PARTIALLY_PAID,
        installments: {
          create: [
            {
              sequence: 1,
              dueDate: new Date("2026-02-16T00:00:00.000Z"),
              amountDueXaf: xaf(40000),
            },
            {
              sequence: 2,
              dueDate: new Date("2026-03-16T00:00:00.000Z"),
              amountDueXaf: xaf(40000),
            },
            {
              sequence: 3,
              dueDate: new Date("2026-04-16T00:00:00.000Z"),
              amountDueXaf: xaf(40000),
            },
          ],
        },
      },
    });

    await tx.warranty.create({
      data: {
        reference: "W-2026-000001",
        saleId: sale.id,
        saleItemId: sale.items[0].id,
        productSerialId: serial.id,
        customerId: input.customer.id,
        startsAt: new Date("2026-01-16T11:00:00.000Z"),
        endsAt: new Date("2027-01-16T11:00:00.000Z"),
      },
    });

    await tx.receipt.create({
      data: { saleId: sale.id, reference: "R-2026-000002" },
    });

    await tx.stockMovement.create({
      data: {
        type: "SALE",
        variantId: input.phoneVariant.id,
        quantity: -1,
        productSerialId: serial.id,
        saleId: sale.id,
        saleItemId: sale.items[0].id,
        recordedById: input.cashier.id,
      },
    });

    await tx.productVariant.update({
      where: { id: input.phoneVariant.id },
      data: { quantityOnHand: { decrement: 1 } },
    });

    await tx.syncTransaction.create({
      data: {
        clientTxnId: sale.clientTxnId,
        status: "SYNCED",
        payloadJson: JSON.stringify({ reference: sale.reference }),
        saleId: sale.id,
        syncedAt: new Date("2026-01-16T11:01:00.000Z"),
      },
    });

    await tx.idempotencyRecord.create({
      data: {
        scope: "complete-sale",
        key: sale.clientTxnId,
        resourceType: "Sale",
        resourceId: sale.id,
      },
    });
  });
}

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PROD_SEED !== "1"
  ) {
    throw new Error(
      "Seed refusé en production. Définir ALLOW_PROD_SEED=1 uniquement pour un bootstrap contrôlé (jamais avec les comptes démo en go-live).",
    );
  }
  await seedPermissions();
  await seedRoles();
  await seedUsers();
  await seedSettings();
  const demo = await seedCatalogAndDemo();
  await seedRepresentativeSale(demo);
  await seedCreditExample(demo);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
