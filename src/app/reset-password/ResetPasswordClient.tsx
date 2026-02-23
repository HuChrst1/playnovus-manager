"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from "@/lib/auth/constants";
import { createSupabaseBrowserRecoveryClient } from "@/lib/auth/supabase-auth";

type RecoveryState = "checking" | "ready" | "invalid";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordClient() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserRecoveryClient(), []);

  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!supabase) {
      setRecoveryState("invalid");
      setFeedback("Configuration de connexion indisponible. Contacte un administrateur.");
      return;
    }

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (data.session) {
        setRecoveryState("ready");
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setRecoveryState("ready");
        setFeedback(null);
      }
    });

    checkSession();

    const timeoutId = window.setTimeout(() => {
      if (!isMounted) return;

      setRecoveryState((current) => {
        if (current === "ready") return current;
        setFeedback("Lien invalide ou expire. Demande un nouveau lien de reinitialisation.");
        return "invalid";
      });
    }, 1500);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || recoveryState !== "ready") {
      setFeedback("Lien invalide ou expire. Demande un nouveau lien.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
    const confirmPassword =
      typeof formData.get("confirmPassword") === "string" ? String(formData.get("confirmPassword")) : "";

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFeedback("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setFeedback("Les deux mots de passe doivent etre identiques.");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setFeedback("Lien invalide ou expire. Demande un nouveau lien de reinitialisation.");
      setIsSubmitting(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace(`${LOGIN_PATH}?reset=success`);
  };

  if (recoveryState === "checking") {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Validation du lien de reinitialisation en cours...
        </p>
      </div>
    );
  }

  if (recoveryState === "invalid") {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {feedback ?? "Lien invalide ou expire. Demande un nouveau lien."}
        </p>
        <div className="text-center text-sm">
          <Link href={FORGOT_PASSWORD_PATH} className="font-medium text-slate-700 underline">
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {feedback ? (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {feedback}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="********"
          required
          minLength={MIN_PASSWORD_LENGTH}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="********"
          required
          minLength={MIN_PASSWORD_LENGTH}
        />
      </div>

      <Button type="submit" variant="default" className="h-10 w-full text-sm" disabled={isSubmitting}>
        {isSubmitting ? "Mise a jour..." : "Mettre a jour le mot de passe"}
      </Button>
    </form>
  );
}
