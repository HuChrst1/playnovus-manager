#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const SRC_DIR = "src";
const ALLOWED_IMG_FILES = new Set([
  "src/components/catalogue/set-image.tsx",
  "src/app/catalogue/page.tsx",
  "src/components/catalogue/edit-photo-button.tsx",
]);

const TEXT_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const IMG_TAG_PATTERN = /<img\b/g;

async function walkFiles(dir, result = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(fullPath, result);
      continue;
    }
    if (TEXT_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      result.push(fullPath);
    }
  }
  return result;
}

function toPosixRelative(absolutePath) {
  return path.relative(process.cwd(), absolutePath).split(path.sep).join("/");
}

function findImgLineNumbers(content) {
  const lines = content.split(/\r?\n/);
  const lineNumbers = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (IMG_TAG_PATTERN.test(lines[i])) {
      lineNumbers.push(i + 1);
    }
    IMG_TAG_PATTERN.lastIndex = 0;
  }
  return lineNumbers;
}

async function run() {
  const srcDirAbsolute = path.join(process.cwd(), SRC_DIR);
  const sourceFiles = await walkFiles(srcDirAbsolute);

  const violations = [];
  for (const filePath of sourceFiles) {
    const relativePath = toPosixRelative(filePath);
    if (ALLOWED_IMG_FILES.has(relativePath)) {
      continue;
    }

    const content = await fs.readFile(filePath, "utf8");
    const lineNumbers = findImgLineNumbers(content);
    if (lineNumbers.length > 0) {
      violations.push({ file: relativePath, lines: lineNumbers });
    }
  }

  if (violations.length > 0) {
    console.error(
      "[lint:next-img-guard] <img> detecte hors allowlist. Utilise next/image ou ajuste explicitement la liste autorisee."
    );
    for (const violation of violations) {
      console.error(
        `- ${violation.file}:${violation.lines.join(",")}`
      );
    }
    process.exit(1);
  }

  console.log("[lint:next-img-guard] OK - aucune nouvelle occurrence <img> hors allowlist.");
}

run().catch((error) => {
  console.error("[lint:next-img-guard] Erreur inattendue:", error);
  process.exit(1);
});
