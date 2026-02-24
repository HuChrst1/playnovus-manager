"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

type TurnstileApi = {
  render: (container: string | HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileFieldProps = {
  inputName?: string;
  action?: string;
  className?: string;
  onTokenChange?: (token: string) => void;
};

const TURNSTILE_SCRIPT_ID = "playnovus-turnstile-script";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function getRuntimeHostLabel(): string {
  if (typeof window === "undefined") return "host_inconnu";
  return window.location.hostname || "host_inconnu";
}

function getRuntimeEnvLabel(): string {
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercelEnv && vercelEnv.trim().length > 0) {
    return vercelEnv.trim().toLowerCase();
  }
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

function buildNonProdDiagnosticHint(): string {
  const envLabel = getRuntimeEnvLabel();
  if (envLabel === "production") {
    return "";
  }

  const hostLabel = getRuntimeHostLabel();
  return ` (env=${envLabel}, hostname=${hostLabel})`;
}

function ensureTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("turnstile_script_load_failed")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile_script_load_failed"));
    document.head.appendChild(script);
  });
}

export function TurnstileField({
  inputName = "captchaToken",
  action = "auth_form",
  className,
  onTokenChange,
}: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const siteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();

  useEffect(() => {
    onTokenChange?.(captchaToken);
  }, [captchaToken, onTokenChange]);

  useEffect(() => {
    let cancelled = false;

    if (!siteKey) {
      setClientError(
        "Verification anti-bot indisponible: NEXT_PUBLIC_TURNSTILE_SITE_KEY manquante." +
          buildNonProdDiagnosticHint()
      );
      setCaptchaToken("");
      return;
    }

    async function mountWidget() {
      try {
        await ensureTurnstileScript();

        if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) {
          return;
        }

        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => {
            setCaptchaToken(token);
            setClientError(null);
          },
          "expired-callback": () => {
            setCaptchaToken("");
            setClientError(
              "Verification anti-bot expiree. Complete a nouveau le CAPTCHA." +
                buildNonProdDiagnosticHint()
            );
          },
          "error-callback": () => {
            setCaptchaToken("");
            setClientError(
              "Verification anti-bot echouee. Recharge la page puis reessaie. " +
                "Si le probleme persiste, verifie la configuration des hostnames Turnstile." +
                buildNonProdDiagnosticHint()
            );
          },
        });

        widgetIdRef.current = widgetId;
      } catch (error) {
        if (!cancelled) {
          const isScriptLoadError =
            error instanceof Error &&
            error.message === "turnstile_script_load_failed";
          setClientError(
            isScriptLoadError
              ? "Impossible de charger le script Turnstile. " +
                "Verifie le reseau, les bloqueurs de scripts et les politiques de contenu." +
                buildNonProdDiagnosticHint()
              : "Impossible d'initialiser le CAPTCHA Turnstile. " +
                "Verifie la cle publique et les hostnames autorises." +
                buildNonProdDiagnosticHint()
          );
        }
      }
    }

    void mountWidget();

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Best effort cleanup.
        }
        widgetIdRef.current = null;
      }
    };
  }, [action, siteKey]);

  return (
    <div className={className ?? "space-y-2"}>
      <div ref={containerRef} />
      <input type="hidden" name={inputName} value={captchaToken} />
      {clientError ? (
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {clientError}
        </p>
      ) : null}
    </div>
  );
}
