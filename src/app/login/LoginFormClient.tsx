"use client";

import Link from "next/link";
import { useState } from "react";
import { TurnstileField } from "@/components/security/TurnstileField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORGOT_PASSWORD_PATH } from "@/lib/auth/constants";

type LoginFormClientProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function LoginFormClient({ action }: LoginFormClientProps) {
  const [captchaToken, setCaptchaToken] = useState("");
  const isCaptchaValidated = captchaToken.length > 0;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="admin@playnovus.local"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="********"
          required
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-slate-600" htmlFor="remember">
          <input
            id="remember"
            name="remember"
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-sky-500"
          />
          <span>Se souvenir de moi</span>
        </label>

        <Link href={FORGOT_PASSWORD_PATH} className="text-sm font-medium text-slate-700 underline">
          Mot de passe oublie ?
        </Link>
      </div>

      <TurnstileField action="login_password" onTokenChange={setCaptchaToken} />

      {!isCaptchaValidated ? (
        <p className="text-sm text-slate-600">Complete le CAPTCHA pour activer la connexion.</p>
      ) : null}

      <Button
        type="submit"
        variant="default"
        className="h-10 w-full text-sm"
        disabled={!isCaptchaValidated}
      >
        Se connecter
      </Button>
    </form>
  );
}
