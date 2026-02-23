import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { logoutCurrentSession } from "@/app/login/actions";
import { changePasswordAction } from "@/app/compte/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readAuthSessionFromCookies } from "@/lib/auth/session";
import { createSupabaseAuthClient } from "@/lib/auth/supabase-auth";
import { supabaseServer } from "@/lib/supabase-server";

type RawCompteSearchParams = Record<string, string | string[] | undefined>;

type ComptePageProps = {
  searchParams?: Promise<RawCompteSearchParams>;
};

type AdminAccount = {
  id: string;
  displayName: string | null;
  email: string;
  lastSignInAt: string | null;
};

export const dynamic = "force-dynamic";

function getFirstParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function readMetadataValue(metadata: unknown, key: string): string | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveUserDisplayName(user: User): string | null {
  const userMetadata = user.user_metadata;
  const appMetadata = user.app_metadata;

  return (
    readMetadataValue(userMetadata, "display_name") ??
    readMetadataValue(userMetadata, "full_name") ??
    readMetadataValue(userMetadata, "name") ??
    readMetadataValue(userMetadata, "alias") ??
    readMetadataValue(userMetadata, "username") ??
    readMetadataValue(userMetadata, "preferred_username") ??
    readMetadataValue(appMetadata, "display_name") ??
    readMetadataValue(appMetadata, "alias")
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "Non disponible";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Non disponible";
  }

  return date.toLocaleString("fr-FR");
}

function getPasswordFeedback(searchParams: RawCompteSearchParams): {
  tone: "success" | "error";
  message: string;
} | null {
  const passwordState = getFirstParamValue(searchParams.password);
  if (passwordState === "updated") {
    return {
      tone: "success",
      message: "Mot de passe mis a jour. Tu peux te reconnecter avec le nouveau mot de passe.",
    };
  }

  const errorCode = getFirstParamValue(searchParams.password_error);
  switch (errorCode) {
    case "missing_fields":
      return { tone: "error", message: "Renseigne tous les champs du formulaire." };
    case "weak_password":
      return { tone: "error", message: "Le nouveau mot de passe doit contenir au moins 8 caracteres." };
    case "mismatch":
      return { tone: "error", message: "La confirmation du mot de passe ne correspond pas." };
    case "same_password":
      return { tone: "error", message: "Le nouveau mot de passe doit etre different de l'actuel." };
    case "invalid_current_password":
      return { tone: "error", message: "Mot de passe actuel incorrect." };
    case "session_invalid":
      return { tone: "error", message: "Session invalide. Reconnecte-toi puis reessaie." };
    case "configuration_error":
      return { tone: "error", message: "Configuration indisponible. Contacte un administrateur." };
    case "rate_limited":
      return { tone: "error", message: "Trop de tentatives. Patiente quelques minutes avant de reessayer." };
    case "update_failed":
      return { tone: "error", message: "Impossible de mettre a jour le mot de passe pour le moment." };
    default:
      return null;
  }
}

async function listAdminAccounts(): Promise<{ accounts: AdminAccount[]; error: string | null }> {
  const perPage = 200;
  const maxPages = 10;
  const users: User[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({ page, perPage });

    if (error) {
      return {
        accounts: [],
        error: "Impossible de charger la liste des comptes admins.",
      };
    }

    const currentPageUsers = data?.users ?? [];
    users.push(...currentPageUsers);

    if (currentPageUsers.length < perPage) {
      break;
    }
  }

  const accounts = users
    .map((user) => ({
      id: user.id,
      displayName: resolveUserDisplayName(user),
      email: user.email ?? user.id,
      lastSignInAt: user.last_sign_in_at ?? null,
    }))
    .sort((a, b) => a.email.localeCompare(b.email, "fr", { sensitivity: "base" }));

  return { accounts, error: null };
}

async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const snapshot = readAuthSessionFromCookies(cookieStore);

  if (!snapshot.accessToken) {
    return null;
  }

  const supabaseAuth = createSupabaseAuthClient();
  if (!supabaseAuth) {
    return null;
  }

  const { data, error } = await supabaseAuth.auth.getUser(snapshot.accessToken);
  if (error || !data.user?.id) {
    return null;
  }

  return data.user.id;
}

export default async function ComptePage({ searchParams }: ComptePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const feedback = getPasswordFeedback(resolvedSearchParams);
  const [{ accounts, error: accountsError }, currentUserId] = await Promise.all([
    listAdminAccounts(),
    getCurrentUserId(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-2 pb-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Compte / Parametres</h1>
        <p className="text-sm text-slate-600">
          Reglages essentiels du compte et gestion de la session active.
        </p>
      </header>

      {feedback ? (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={
            feedback.tone === "error"
              ? "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          }
        >
          {feedback.message}
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="border-slate-200/80 bg-white/95 py-0">
          <CardHeader className="border-b border-slate-200/70 py-6">
            <CardTitle className="text-lg text-slate-900">Reglages &gt; Comptes</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Vue en lecture seule des comptes admins existants.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 py-6">
            {accountsError ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {accountsError}
              </p>
            ) : accounts.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Aucun compte admin trouve.
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <article
                    key={account.id}
                    className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-slate-900">
                          {account.displayName ?? account.email}
                          {currentUserId === account.id ? " (session active)" : ""}
                        </p>
                        <p className="text-xs text-slate-600">{account.email}</p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                        Admin
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Derniere connexion:{" "}
                      <span className="tabular-nums text-slate-700">{formatDateTime(account.lastSignInAt)}</span>
                    </p>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/95 py-0">
          <CardHeader className="border-b border-slate-200/70 py-6">
            <CardTitle className="text-lg text-slate-900">Securite</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Change le mot de passe du compte connecte.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-6">
            <form action={changePasswordAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="********"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextPassword">Nouveau mot de passe</Label>
                <Input
                  id="nextPassword"
                  name="nextPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="********"
                  minLength={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="********"
                  minLength={8}
                  required
                />
              </div>

              <p className="text-xs text-slate-500">Minimum 8 caracteres.</p>

              <Button type="submit" className="h-10 w-full text-sm">
                Mettre a jour le mot de passe
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <Card className="border-slate-200/80 bg-white/95 py-0">
        <CardHeader className="border-b border-slate-200/70 py-6">
          <CardTitle className="text-lg text-slate-900">Session</CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Deconnexion de la session active uniquement.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3 py-6">
          <p className="text-sm text-slate-600">Cette action te redirige vers l&apos;ecran de connexion.</p>
          <form action={logoutCurrentSession}>
            <Button type="submit" variant="outline" className="h-10 text-sm">
              Se deconnecter (cette session)
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
