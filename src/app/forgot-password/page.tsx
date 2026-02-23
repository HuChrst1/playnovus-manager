import Link from "next/link";
import { requestPasswordReset } from "@/app/forgot-password/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOGIN_PATH } from "@/lib/auth/constants";

type RawForgotPasswordSearchParams = Record<string, string | string[] | undefined>;

type ForgotPasswordPageProps = {
  searchParams?: Promise<RawForgotPasswordSearchParams>;
};

function getFirstParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getErrorMessage(errorCode: string | undefined): string | null {
  switch (errorCode) {
    case "missing_email":
      return "Renseigne ton email pour recevoir un lien de reinitialisation.";
    case "configuration_error":
      return "Configuration indisponible. Contacte un administrateur.";
    default:
      return null;
  }
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const sent = getFirstParamValue(resolvedSearchParams.sent) === "1";
  const errorCode = getFirstParamValue(resolvedSearchParams.error);
  const errorMessage = getErrorMessage(errorCode);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md items-center justify-center px-2">
      <Card className="w-full border-slate-200/75 bg-white/95 py-0">
        <CardHeader className="border-b border-slate-200/70 py-7">
          <CardTitle className="text-2xl text-slate-900">Mot de passe oublie</CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Saisis ton email. Si un compte existe, tu recevras un lien de reinitialisation.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 py-7">
          {sent ? (
            <p
              role="status"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              Si un compte correspond a cet email, un lien de reinitialisation vient d&apos;etre envoye.
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

          <form action={requestPasswordReset} className="space-y-4">
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

            <Button type="submit" variant="default" className="h-10 w-full text-sm">
              Envoyer le lien
            </Button>
          </form>

          <div className="text-center text-sm">
            <Link href={LOGIN_PATH} className="font-medium text-slate-700 underline">
              Retour a la connexion
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
