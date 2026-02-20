import { redirect } from "next/navigation";
import {
  getDashboardExecutiveData,
  normalizeDashboardExecutiveQuery,
  type DashboardExecutiveFilterInput,
} from "@/lib/dashboard";
import { DashboardExecutiveView } from "@/components/dashboard/DashboardExecutiveView";
import { supabaseServer as supabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type RawDashboardSearchParams = Record<string, string | string[] | undefined>;

type DashboardPageProps = {
  searchParams?: Promise<RawDashboardSearchParams>;
};

function getFirstParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toIncomingSupportedParams(raw: RawDashboardSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  const preset = getFirstParamValue(raw.preset);
  const from = getFirstParamValue(raw.from);
  const to = getFirstParamValue(raw.to);

  if (typeof preset === "string") params.set("preset", preset);
  if (typeof from === "string") params.set("from", from);
  if (typeof to === "string") params.set("to", to);

  return params;
}

export default async function HomePage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const rawInput: DashboardExecutiveFilterInput = {
    preset: getFirstParamValue(resolvedSearchParams.preset),
    from: getFirstParamValue(resolvedSearchParams.from),
    to: getFirstParamValue(resolvedSearchParams.to),
  };

  const normalized = normalizeDashboardExecutiveQuery(rawInput);
  const incoming = toIncomingSupportedParams(resolvedSearchParams).toString();

  if (incoming !== normalized.canonicalQuery) {
    redirect(`/?${normalized.canonicalQuery}`);
  }

  const dashboard = await getDashboardExecutiveData(supabase, rawInput);

  return <DashboardExecutiveView dashboard={dashboard} />;
}
