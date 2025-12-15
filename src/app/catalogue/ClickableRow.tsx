"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, KeyboardEvent, ReactNode } from "react";

type ClickableRowProps = {
  href: string;
  children: ReactNode;
};

export function ClickableRow({ href, children }: ClickableRowProps) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement;

    // Si on clique sur un lien, un bouton ou un élément marqué comme action,
    // on NE déclenche PAS la navigation de la ligne.
    if (
      target.closest("a") ||
      target.closest("button") ||
      target.closest("[data-row-action='true']") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea") ||
      target.closest("[role='button']") ||
      target.closest("[role='menuitem']")
    ) {
      return;
    }

    router.push(href);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    // Navigation clavier : Enter ou Barre espace
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    const target = event.target as HTMLElement;

    if (
      target.closest("a") ||
      target.closest("button") ||
      target.closest("[data-row-action='true']") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea") ||
      target.closest("[role='button']") ||
      target.closest("[role='menuitem']")
    ) {
      return;
    }

    router.push(href);
  };

  return (
    <tr
      className="app-table-row cursor-pointer"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {children}
    </tr>
  );
}
