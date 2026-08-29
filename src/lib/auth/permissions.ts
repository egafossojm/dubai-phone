export const PERMISSIONS = [
  { code: "dashboard.read", description: "Consulter le tableau de bord" },
  { code: "products.read", description: "Consulter les produits" },
  { code: "products.create", description: "Créer un produit" },
  { code: "products.update", description: "Modifier un produit" },
  { code: "products.delete", description: "Désactiver un produit" },
  { code: "sales.read", description: "Consulter les ventes" },
  { code: "sales.create", description: "Créer une vente" },
  { code: "sales.cancel", description: "Annuler une vente brouillon" },
  { code: "sales.refund", description: "Rembourser une vente" },
  { code: "inventory.read", description: "Consulter le stock" },
  { code: "inventory.adjust", description: "Ajuster le stock" },
  { code: "purchases.read", description: "Consulter les achats" },
  { code: "purchases.create", description: "Créer une commande d'achat" },
  { code: "purchases.receive", description: "Réceptionner un achat" },
  { code: "customers.read", description: "Consulter les clients" },
  { code: "customers.create", description: "Créer un client" },
  { code: "credit.read", description: "Consulter les crédits" },
  { code: "credit.payment", description: "Enregistrer un paiement d'échéance" },
  { code: "reports.read", description: "Consulter les rapports" },
  { code: "users.read", description: "Consulter les utilisateurs" },
  { code: "users.create", description: "Créer un utilisateur" },
  { code: "users.update", description: "Modifier un utilisateur" },
  { code: "audit.read", description: "Consulter le journal d'audit" },
  { code: "settings.write", description: "Modifier les paramètres" },
  { code: "permissions.write", description: "Gérer les rôles et permissions" },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

export const ALL_PERMISSION_CODES: PermissionCode[] = PERMISSIONS.map(
  (permission) => permission.code,
);

export type RoleCode =
  | "SUPER_ADMINISTRATOR"
  | "MANAGER"
  | "SALES_PERSON"
  | "INVENTORY_MANAGER";

export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  SUPER_ADMINISTRATOR: [...ALL_PERMISSION_CODES],
  MANAGER: [
    "dashboard.read",
    "products.read",
    "products.create",
    "products.update",
    "products.delete",
    "sales.read",
    "sales.create",
    "sales.cancel",
    "sales.refund",
    "inventory.read",
    "inventory.adjust",
    "purchases.read",
    "purchases.create",
    "purchases.receive",
    "customers.read",
    "customers.create",
    "credit.read",
    "credit.payment",
    "reports.read",
    "users.read",
    "audit.read",
    "settings.write",
  ],
  SALES_PERSON: [
    "dashboard.read",
    "products.read",
    "sales.read",
    "sales.create",
    "customers.read",
    "customers.create",
    "credit.read",
    "credit.payment",
    "inventory.read",
  ],
  INVENTORY_MANAGER: [
    "dashboard.read",
    "products.read",
    "products.update",
    "inventory.read",
    "inventory.adjust",
    "purchases.read",
    "purchases.create",
    "purchases.receive",
    "customers.read",
    "reports.read",
  ],
};

export function isPermissionCode(value: string): value is PermissionCode {
  return ALL_PERMISSION_CODES.includes(value as PermissionCode);
}

export function hasPermission(
  granted: readonly string[],
  required: PermissionCode,
): boolean {
  return granted.includes(required);
}
