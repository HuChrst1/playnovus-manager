import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FORGOT_PASSWORD_PATH } from "@/lib/auth/constants";
import { ResetPasswordClient } from "@/app/reset-password/ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md items-center justify-center px-2">
      <Card className="w-full border-slate-200/75 bg-white/95 py-0">
        <CardHeader className="border-b border-slate-200/70 py-7">
          <CardTitle className="text-2xl text-slate-900">Nouveau mot de passe</CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Renseigne un nouveau mot de passe pour finaliser la reinitialisation.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 py-7">
          <ResetPasswordClient />

          <div className="text-center text-sm">
            <Link href={FORGOT_PASSWORD_PATH} className="font-medium text-slate-700 underline">
              Revenir a la demande de lien
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
