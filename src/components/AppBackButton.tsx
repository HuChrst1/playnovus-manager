"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isAuthStandalonePath } from "@/lib/auth/constants";

export function AppBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const hideBackButton = isAuthStandalonePath(pathname);

  if (hideBackButton) {
    return null;
  }

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <Button
      type="button"
      variant="icon"
      onClick={handleGoBack}
      className="app-topbar-icon app-global-back h-9 w-9 text-slate-700 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[2.2] [&_svg]:text-slate-700"
      aria-label="Retour"
      title="Retour"
    >
      <ArrowLeft className="shrink-0" />
    </Button>
  );
}

export default AppBackButton;
