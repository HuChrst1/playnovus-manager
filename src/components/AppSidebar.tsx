"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  BookOpen,
  Boxes,
  Home,
  Menu,
  ShoppingCart,
  Truck,
  UserRound,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ReportDialog } from "@/components/report/ReportDialog";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: Home,
    match: (pathname) => pathname === "/",
  },
  {
    href: "/approvisionnement",
    label: "Appro",
    icon: Truck,
    match: (pathname) => pathname.startsWith("/approvisionnement"),
  },
  {
    href: "/ventes",
    label: "Ventes",
    icon: ShoppingCart,
    match: (pathname) => pathname.startsWith("/ventes"),
  },
  {
    href: "/stock",
    label: "Stock",
    icon: Boxes,
    match: (pathname) => pathname.startsWith("/stock") || pathname.startsWith("/historique-stock"),
  },
  {
    href: "/catalogue",
    label: "Catalogue",
    icon: BookOpen,
    match: (pathname) => pathname.startsWith("/catalogue"),
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="app-topbar">
      <div className="relative flex min-w-0 items-center gap-3">
        <Link href="/" className="app-topbar-brand">
          <Image
            src="/playnovus-logo.svg"
            alt="PlayNovus"
            width={22}
            height={22}
            className="h-5 w-5 object-contain"
            priority
          />
          <span className="truncate">PlayNovus</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen((previous) => !previous)}
          className="app-topbar-icon sm:hidden"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        {mobileOpen ? (
          <nav className="app-topbar-mobile-menu space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.match(pathname);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex w-full items-center justify-between rounded-full px-3 py-2 text-sm",
                    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <span>{item.label}</span>
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>

      <nav className="app-topbar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="app-topbar-nav-item"
              data-active={isActive}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="app-topbar-actions">
        <ReportDialog triggerClassName="app-filter-trigger h-9 px-4 text-xs" />

        <button type="button" className="app-topbar-icon" aria-label="Profil utilisateur">
          <UserRound className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export default AppSidebar;
