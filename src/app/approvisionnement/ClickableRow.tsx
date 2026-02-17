"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

type ClickableRowProps = {
  href: string;
  children: ReactNode;
};

function isInteractiveTarget(target: HTMLElement) {
  return (
    target.closest("a") ||
    target.closest("button") ||
    target.closest("[data-row-action='true']") ||
    target.closest("input") ||
    target.closest("select") ||
    target.closest("textarea") ||
    target.closest("[role='button']") ||
    target.closest("[role='menuitem']")
  );
}

export function ClickableRow({ href, children }: ClickableRowProps) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement;
    if (isInteractiveTarget(target)) {
      return;
    }

    router.push(href);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    const target = event.target as HTMLElement;
    if (isInteractiveTarget(target)) {
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
