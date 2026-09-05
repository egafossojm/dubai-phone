import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { AuthUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";

const NAV_ITEMS = [
  { href: "/", label: "Tableau de bord", permission: "dashboard.read" },
  { href: "/pos", label: "Caisse", permission: "sales.create" },
  { href: "/sync", label: "Sync", permission: "sales.create" },
  { href: "/ventes", label: "Ventes", permission: "sales.read" },
  { href: "/retours", label: "Retours", permission: "sales.read" },
  { href: "/produits", label: "Produits", permission: "products.read" },
  { href: "/stock", label: "Stock", permission: "inventory.read" },
  { href: "/achats", label: "Achats", permission: "purchases.read" },
  { href: "/clients", label: "Clients", permission: "customers.read" },
  { href: "/credits", label: "Crédits", permission: "credit.read" },
] as const;

type AppHeaderProps = {
  user: AuthUser;
};

export function AppHeader({ user }: AppHeaderProps) {
  const items = NAV_ITEMS.filter((item) =>
    hasPermission(user.permissions, item.permission),
  );

  return (
    <header className="relative border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Dubai Phone
          </Link>
          <nav aria-label="Navigation principale" className="hidden sm:block">
            <ul className="flex items-center gap-4">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-[var(--muted-foreground)] sm:inline">
            {user.fullName}
          </span>
          <LogoutButton />
          <MobileNav items={items} userName={user.fullName} />
        </div>
      </div>
    </header>
  );
}
