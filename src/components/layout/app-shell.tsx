import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import type { AuthUser } from "@/lib/auth/session";

type AppShellProps = {
  children: ReactNode;
  user: AuthUser;
};

export function AppShell({ children, user }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--muted-foreground)]">
        Dubai Phone — Gestion retail électronique · Cameroun · FCFA
      </footer>
    </div>
  );
}
