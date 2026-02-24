#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const SRC_DIR = "src";
const TEXT_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const NATIVE_DIALOG_PATTERNS = [
  { label: "window.confirm(", regex: /\bwindow\.confirm\s*\(/ },
  { label: "confirm(", regex: /(^|[^\w$.])confirm\s*\(/ },
  { label: "window.alert(", regex: /\bwindow\.alert\s*\(/ },
  { label: "alert(", regex: /(^|[^\w$.])alert\s*\(/ },
];

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

function findNativeDialogOccurrences(content) {
  const lines = content.split(/\r?\n/);
  const occurrences = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of NATIVE_DIALOG_PATTERNS) {
      if (pattern.regex.test(line)) {
        occurrences.push({ lineNumber: i + 1, pattern: pattern.label });
      }
    }
  }

  return occurrences;
}

async function run() {
  const srcDirAbsolute = path.join(process.cwd(), SRC_DIR);
  const sourceFiles = await walkFiles(srcDirAbsolute);

  const violations = [];
  for (const filePath of sourceFiles) {
    const relativePath = toPosixRelative(filePath);
    const content = await fs.readFile(filePath, "utf8");
    const occurrences = findNativeDialogOccurrences(content);
    if (occurrences.length > 0) {
      violations.push({ file: relativePath, occurrences });
    }
  }

  if (violations.length > 0) {
    console.error(
      "[lint:native-dialog-guard] Dialogs navigateur detectes. Utilise AlertDialog/messages UI applicatifs."
    );
    for (const violation of violations) {
      for (const occurrence of violation.occurrences) {
        console.error(
          `- ${violation.file}:${occurrence.lineNumber} (${occurrence.pattern})`
        );
      }
    }
    process.exit(1);
  }

  console.log("[lint:native-dialog-guard] OK - aucun dialog natif detecte.");
}

run().catch((error) => {
  console.error("[lint:native-dialog-guard] Erreur inattendue:", error);
  process.exit(1);
});
