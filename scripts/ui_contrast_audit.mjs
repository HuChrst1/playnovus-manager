#!/usr/bin/env node

/**
 * F5.5 UI Contrast Audit
 * Checks the canonical design-system color pairs used by buttons, cards and fields.
 * Enforces WCAG AA thresholds.
 */

const palette = {
  white: "#ffffff",
  slate950: "#020617",
  slate900: "#0f172a",
  slate800: "#1e293b",
  slate700: "#334155",
  slate600: "#475569",
  slate500: "#64748b",
  slate300: "#cbd5e1",
  sky900: "#0c4a6e",
  sky800: "#075985",
  sky700: "#0369a1",
  sky600: "#0284c7",
  sky500: "#0ea5e9",
  sky200: "#bae6fd",
  sky100: "#e0f2fe",
  red800: "#991b1b",
  red700: "#b91c1c",
  red600: "#dc2626",
  rose50: "#fff1f2",
};

const checks = [
  {
    id: "btn.default.text",
    fg: "white",
    bg: "slate900",
    minRatio: 4.5,
    category: "text",
  },
  {
    id: "btn.outline.text",
    fg: "slate700",
    bg: "white",
    minRatio: 4.5,
    category: "text",
  },
  {
    id: "btn.ghost.text",
    fg: "slate700",
    bg: "white",
    minRatio: 4.5,
    category: "text",
  },
  {
    id: "btn.secondary.text",
    fg: "sky900",
    bg: "sky100",
    minRatio: 4.5,
    category: "text",
  },
  {
    id: "btn.destructive.text",
    fg: "white",
    bg: "red600",
    minRatio: 4.5,
    category: "text",
  },
  {
    id: "field.text",
    fg: "slate700",
    bg: "white",
    minRatio: 4.5,
    category: "text",
  },
  {
    id: "field.placeholder.text",
    fg: "slate500",
    bg: "white",
    minRatio: 4.5,
    category: "text",
  },
  {
    id: "icon.soft.on.white",
    fg: "slate600",
    bg: "white",
    minRatio: 3.0,
    category: "non-text",
  },
  {
    id: "focus.ring.on.white",
    fg: "sky600",
    bg: "white",
    minRatio: 3.0,
    category: "non-text",
  },
  {
    id: "danger.icon.on.soft",
    fg: "red700",
    bg: "rose50",
    minRatio: 3.0,
    category: "non-text",
  },
];

function normalizeHex(hex) {
  if (!hex || typeof hex !== "string") {
    throw new Error(`Invalid color: ${String(hex)}`);
  }
  const trimmed = hex.trim().replace(/^#/, "");
  if (trimmed.length === 3) {
    return `#${trimmed
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  if (trimmed.length !== 6) {
    throw new Error(`Unsupported hex format: ${hex}`);
  }
  return `#${trimmed}`;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex).replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function srgbToLinear(channel) {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color) {
  const { r, g, b } = hexToRgb(color);
  const rLin = srgbToLinear(r);
  const gLin = srgbToLinear(g);
  const bLin = srgbToLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const results = checks.map((check) => {
  const fgHex = palette[check.fg];
  const bgHex = palette[check.bg];
  if (!fgHex || !bgHex) {
    throw new Error(`Unknown palette color in check ${check.id}`);
  }

  const ratio = contrastRatio(fgHex, bgHex);
  const pass = ratio >= check.minRatio;

  return {
    ...check,
    ratio,
    pass,
    fgHex,
    bgHex,
  };
});

const hasFailures = results.some((result) => !result.pass);

console.log("UI contrast audit (WCAG AA strict)\n");
for (const result of results) {
  const status = result.pass ? "PASS" : "FAIL";
  const ratio = result.ratio.toFixed(2);
  const min = result.minRatio.toFixed(2);
  console.log(
    `${status}  ${result.id.padEnd(26)} ratio=${ratio}:1  min=${min}:1  fg=${result.fgHex} bg=${result.bgHex}`
  );
}

if (hasFailures) {
  console.error(
    "\nContrast audit failed: at least one canonical UI pair is below the required AA threshold."
  );
  process.exit(1);
}

console.log("\nContrast audit passed.");
