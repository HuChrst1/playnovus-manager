import { redirect } from "next/navigation";

export default function NouvelleVentePage() {
  redirect("/ventes?new=1");
}
