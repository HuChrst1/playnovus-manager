"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  BookOpen,
  Boxes,
  Home,
  LogOut,
  Menu,
  ShoppingCart,
  Truck,
  UserRound,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { isAuthStandalonePath } from "@/lib/auth/constants";
import { logoutCurrentSession } from "@/app/login/actions";
import { ReportDialog } from "@/components/report/ReportDialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const hideNavigation = isAuthStandalonePath(pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (hideNavigation) {
    return null;
  }

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

        <Button
          type="button"
          variant="icon"
          onClick={() => setMobileOpen((previous) => !previous)}
          className="app-topbar-icon sm:hidden"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {mobileOpen ? (
            <X className="h-4 w-4 text-slate-700 [stroke-width:2.1]" />
          ) : (
            <Menu className="h-4 w-4 text-slate-700 [stroke-width:2.1]" />
          )}
        </Button>

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

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="icon"
              className="app-topbar-icon text-slate-700 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[2.1] [&_svg]:text-slate-700"
              aria-label="Compte"
              title="Compte"
            >
              <UserRound className="shrink-0" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            sideOffset={10}
            className="w-64 rounded-[22px] border border-white/75 bg-white/96 p-3 shadow-[0_16px_36px_rgba(15,23,42,0.12)]"
          >
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Compte</p>
            <form action={logoutCurrentSession}>
              <Button
                type="submit"
                variant="outline"
                className="h-9 w-full justify-start gap-2 text-xs text-slate-700"
              >
                <LogOut className="h-4 w-4" />
                Se deconnecter (cette session)
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}

export default AppSidebar;
