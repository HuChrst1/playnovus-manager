// src/app/api/sets/[setId]/bom-stock/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import {
  getAuthSessionErrorMessage,
  requireActiveSession,
} from "@/lib/auth/require-active-session";
import { buildCorsHeaders, isOriginAllowed, resolveAllowedOrigins } from "@/lib/security/cors";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const API_BOM_STOCK_RATE_LIMIT = {
  scope: "api_bom_stock_read",
  limit: 120,
  windowMs: 5 * 60 * 1000,
} as const;

type BomStockRow = {
  piece_ref: string;
  piece_name: string | null;
  bom_qty: number;
  stock_qty: number;
  avg_unit_cost: number | null;
  total_value: number | null;
  missing_qty: number;
};

function getRequestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin?.trim()) return null;
  return origin.trim();
}

function getRequestIpKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return request.headers.get("host") ?? "unknown-host";
}

function jsonWithCors(
  body: Record<string, unknown>,
  init: { status: number },
  corsHeaders: Headers
): NextResponse {
  const response = NextResponse.json(body, init);
  for (const [headerName, headerValue] of corsHeaders.entries()) {
    response.headers.set(headerName, headerValue);
  }
  return response;
}

function createCorsContext(request: Request): {
  requestOrigin: string | null;
  originAllowed: boolean;
  corsHeaders: Headers;
} {
  const requestOrigin = getRequestOrigin(request);
  const allowedOrigins = resolveAllowedOrigins();
  const originAllowed = isOriginAllowed(requestOrigin, allowedOrigins);
  const corsHeaders = buildCorsHeaders({
    requestOrigin,
    allowedOrigins,
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  });

  return { requestOrigin, originAllowed, corsHeaders };
}

export async function OPTIONS(req: Request) {
  const cors = createCorsContext(req);
  if (cors.requestOrigin && !cors.originAllowed) {
    return jsonWithCors({ error: "Origin non autorisee." }, { status: 403 }, cors.corsHeaders);
  }

  const response = new NextResponse(null, { status: 204 });
  for (const [headerName, headerValue] of cors.corsHeaders.entries()) {
    response.headers.set(headerName, headerValue);
  }
  return response;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  const cors = createCorsContext(req);
  if (cors.requestOrigin && !cors.originAllowed) {
    return jsonWithCors({ error: "Origin non autorisee." }, { status: 403 }, cors.corsHeaders);
  }

  let actorUserId = "anonymous";
  try {
    const actor = await requireActiveSession();
    actorUserId = actor.userId;
  } catch (error) {
    return jsonWithCors(
      { error: getAuthSessionErrorMessage(error) },
      { status: 401 },
      cors.corsHeaders
    );
  }

  const rateLimit = enforceRateLimit(
    API_BOM_STOCK_RATE_LIMIT.scope,
    `${actorUserId}:${getRequestIpKey(req)}`,
    API_BOM_STOCK_RATE_LIMIT.limit,
    API_BOM_STOCK_RATE_LIMIT.windowMs
  );

  if (!rateLimit.allowed) {
    return jsonWithCors(
      {
        error: `Rate limit depasse. Reessaie dans ${rateLimit.retryAfterSeconds}s.`,
        retryAfter: rateLimit.retryAfterSeconds,
      },
      { status: 429 },
      cors.corsHeaders
    );
  }

  const { setId } = await params;

  const normalizedSetId = typeof setId === "string" ? setId.trim() : "";
  if (!normalizedSetId || !/^[A-Za-z0-9_-]+$/.test(normalizedSetId)) {
    return jsonWithCors({ error: "setId manquant ou invalide." }, { status: 400 }, cors.corsHeaders);
  }

  // 1) BOM
  const { data: bom, error: bomError } = await supabaseServer
    .from("sets_bom")
    .select("piece_ref, piece_name, quantity")
    .eq("set_id", normalizedSetId);

  if (bomError) {
    return jsonWithCors({ error: bomError.message }, { status: 500 }, cors.corsHeaders);
  }

  const bomRows = (bom ?? []).map((r) => ({
    piece_ref: r.piece_ref,
    piece_name: r.piece_name,
    bom_qty: Number(r.quantity ?? 0),
  }));

  if (bomRows.length === 0) {
    return jsonWithCors(
      { set_id: normalizedSetId, pieces: [], note: "Aucune BOM trouvée pour ce set." },
      { status: 200 },
      cors.corsHeaders
    );
  }

  // 2) Stock (view stock_per_piece)
  const pieceRefs = Array.from(new Set(bomRows.map((r) => r.piece_ref)));

  const { data: stock, error: stockError } = await supabaseServer
    .from("stock_per_piece")
    .select("piece_ref, total_quantity, avg_unit_cost, total_value")
    .in("piece_ref", pieceRefs);

  if (stockError) {
    return jsonWithCors({ error: stockError.message }, { status: 500 }, cors.corsHeaders);
  }

  const stockByRef = new Map(
    (stock ?? []).map((s) => [
      String(s.piece_ref ?? ""),
      {
        stock_qty: Number(s.total_quantity ?? 0),
        avg_unit_cost: s.avg_unit_cost ?? null,
        total_value: s.total_value ?? null,
      },
    ])
  );

  // 3) Merge BOM + stock
  const pieces: BomStockRow[] = bomRows.map((r) => {
    const st = stockByRef.get(r.piece_ref) ?? {
      stock_qty: 0,
      avg_unit_cost: null,
      total_value: null,
    };

    const missing = Math.max(0, Number(r.bom_qty) - Number(st.stock_qty));

    return {
      piece_ref: r.piece_ref,
      piece_name: r.piece_name,
      bom_qty: r.bom_qty,
      stock_qty: st.stock_qty,
      avg_unit_cost: st.avg_unit_cost,
      total_value: st.total_value,
      missing_qty: missing,
    };
  });

  return jsonWithCors({ set_id: normalizedSetId, pieces }, { status: 200 }, cors.corsHeaders);
}
