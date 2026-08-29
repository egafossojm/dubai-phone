"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type NavItem = {
  href: string;
  label: string;
};

type MobileNavProps = {
  items: NavItem[];
  userName: string;
};

export function MobileNav({ items, userName }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </Button>
      {open ? (
        <div
          id="mobile-nav"
          className="absolute left-0 right-0 top-14 z-40 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm"
        >
          <p className="mb-2 text-sm text-[var(--muted-foreground)]">{userName}</p>
          <nav aria-label="Navigation mobile">
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-md px-2 py-2 text-sm hover:bg-[var(--muted)]"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
