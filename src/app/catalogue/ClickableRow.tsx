"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

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
      target.closest("[data-row-action='true']")
    ) {
      return;
    }

    router.push(href);
  };

  return (
    <tr
      onClick={handleClick}
      className="group border-t border-border cursor-pointer"
    >
      {children}
    </tr>
  );
}
