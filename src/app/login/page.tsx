import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { loginWithPassword } from "@/app/login/actions";
import Link from "next/link";
import {
  FORGOT_PASSWORD_PATH,
  LOGIN_NOTICE_LOGOUT_SUCCESS,
  LOGIN_NOTICE_QUERY_PARAM,
  LOGIN_NOTICE_SESSION_EXPIRED,
} from "@/lib/auth/constants";

type RawLoginSearchParams = Record<string, string | string[] | undefined>;

type LoginPageProps = {
  searchParams?: Promise<RawLoginSearchParams>;
};

function getFirstParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getLoginErrorMessage(errorCode: string | undefined): string | null {
  switch (errorCode) {
    case "missing_fields":
      return "Saisis ton email et ton mot de passe pour te connecter.";
    case "invalid_credentials":
      return "Email ou mot de passe incorrect. Verifie tes informations puis reessaie.";
    case "configuration_error":
      return "Configuration de connexion indisponible. Contacte un administrateur.";
    default:
      return null;
  }
}

function getLoginNoticeMessage(noticeCode: string | undefined): {
  tone: "success" | "warning";
  message: string;
} | null {
  switch (noticeCode) {
    case LOGIN_NOTICE_LOGOUT_SUCCESS:
      return {
        tone: "success",
        message: "Tu as ete deconnecte de cette session.",
      };
    case LOGIN_NOTICE_SESSION_EXPIRED:
      return {
        tone: "warning",
        message: "Ta session a expire. Reconnecte-toi pour continuer.",
      };
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorCode = getFirstParamValue(resolvedSearchParams.error);
  const errorMessage = getLoginErrorMessage(errorCode);
  const noticeCode = getFirstParamValue(resolvedSearchParams[LOGIN_NOTICE_QUERY_PARAM]);
  const notice = getLoginNoticeMessage(noticeCode);
  const resetSuccess = getFirstParamValue(resolvedSearchParams.reset) === "success";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md items-center justify-center px-2">
      <Card className="w-full border-slate-200/75 bg-white/95 py-0">
        <CardHeader className="border-b border-slate-200/70 py-7">
          <CardTitle className="text-2xl text-slate-900">Connexion</CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Entre ton email et ton mot de passe pour acceder a l&apos;interface metier.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 py-7">
          {resetSuccess ? (
            <p
              role="status"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              Mot de passe mis a jour. Connecte-toi avec ton nouveau mot de passe.
            </p>
          ) : null}

          {notice ? (
            <p
              role="status"
              className={
                notice.tone === "success"
                  ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                  : "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              }
            >
              {notice.message}
            </p>
          ) : null}

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {errorMessage}
            </p>
          ) : null}

          <form action={loginWithPassword} className="space-y-4">
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

            <Button type="submit" variant="default" className="h-10 w-full text-sm">
              Se connecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
