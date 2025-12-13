"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Truck, ShoppingCart, Boxes, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isAppro = pathname.startsWith("/approvisionnement");
  const isSales = pathname.startsWith("/ventes");
  const isCatalogue = pathname.startsWith("/catalogue");
  const isStock = pathname.startsWith("/stock");
  

  const itemClass = "app-sidebar-item";

  return (
    <aside className="hidden md:flex app-sidebar">
      {/* Haut : logo + icônes principales */}
      <div className="flex flex-col items-center gap-4">
        {/* Logo PlayNovus minimal */}
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[0_10px_25px_rgba(15,23,42,0.25)]">
          <Image
            src="/playnovus-logo.svg"
            alt="PlayNovus"
            width={50}
            height={50}
            className="object-contain"
            priority
          />
        </div>

        {/* Navigation principale */}
        <nav className="mt-6 flex flex-col items-center gap-3">
          {/* 1. Home (placeholder pour l’instant) */}
          <Link
            href="/"
            aria-label="Accueil"
            className={cn(itemClass, isHome && "app-sidebar-item--active")}
          >
            <Home className="h-4 w-4" />
          </Link>

          {/* 2. Approvisionnements */}
          <Link
            href="/approvisionnement"
            aria-label="Approvisionnements"
            className={cn(itemClass, isAppro && "app-sidebar-item--active")}
          >
            <Truck className="h-4 w-4" />
          </Link>

          {/* 3. Ventes */}
          <Link
            href="/ventes"
            aria-label="Ventes"
            className={cn(itemClass, isSales && "app-sidebar-item--active")}
          >
            <ShoppingCart className="h-4 w-4" />
          </Link>

          {/* 4. Stock */}
          <Link
            href="/stock"
            aria-label="Stock"
            className={cn(itemClass, isStock && "app-sidebar-item--active")}
          >
            <Boxes className="h-4 w-4" />
          </Link>

          {/* 5. Catalogue */}
          <Link
            href="/catalogue"
            aria-label="Catalogue"
            className={cn(itemClass, isCatalogue && "app-sidebar-item--active")}
          >
            <BookOpen className="h-4 w-4" />
          </Link>
        </nav>
      </div>

      {/* Bas : paramètres / aide */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          className={itemClass}
          aria-label="Paramètres"
        >
          <span className="text-[16px]">⚙️</span>
        </button>
        <button
          type="button"
          className={itemClass}
          aria-label="Aide"
        >
          <span className="text-[16px]">?</span>
        </button>
      </div>
    </aside>
  );
}

export default AppSidebar;