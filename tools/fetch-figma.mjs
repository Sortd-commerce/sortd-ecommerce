#!/usr/bin/env node
/**
 * Download Figma design data locally via the free REST API (no MCP quota).
 *
 * Setup (one time):
 *   1. Figma → Settings → Security → Personal access tokens → Generate
 *   2. set FIGMA_ACCESS_TOKEN=figd_...   (PowerShell: $env:FIGMA_ACCESS_TOKEN="figd_...")
 *
 * Usage:
 *   node tools/fetch-figma.mjs --url "https://www.figma.com/design/4Fw509oJ8c0ENkjmCrVHvc/sortd--Copy-?node-id=566-5951"
 *   node tools/fetch-figma.mjs --file 4Fw509oJ8c0ENkjmCrVHvc --node 566:5951
 *   node tools/fetch-figma.mjs --file 4Fw509oJ8c0ENkjmCrVHvc --full
 */

import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "design", "figma");

function parseArgs(argv) {
  const args = { url: "", file: "", node: "", full: false, scale: 2, depth: 4, pngOnly: false };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--url") {
      args.url = val;
      i += 1;
    } else if (key === "--file") {
      args.file = val;
      i += 1;
    } else if (key === "--node") {
      args.node = val.replace("-", ":");
      i += 1;
    } else if (key === "--full") {
      args.full = true;
    } else if (key === "--png-only") {
      args.pngOnly = true;
    } else if (key === "--scale") {
      args.scale = Number(val);
      i += 1;
    } else if (key === "--depth") {
      args.depth = Number(val);
      i += 1;
    } else if (key === "--help" || key === "-h") {
      console.log(`Usage:
  node tools/fetch-figma.mjs --url "<figma design url>"
  node tools/fetch-figma.mjs --file <fileKey> --node <566:5951>
  node tools/fetch-figma.mjs --file <fileKey> --node <566:5951> --png-only
  node tools/fetch-figma.mjs --file <fileKey> --full

Env: FIGMA_ACCESS_TOKEN (required)`);
      process.exit(0);
    }
  }
  return args;
}

function parseFigmaUrl(url) {
  const fileMatch = url.match(/figma\.com\/design\/([0-9a-zA-Z]+)/);
  const nodeMatch = url.match(/node-id=([0-9]+)-([0-9]+)/);
  if (!fileMatch) throw new Error("Could not parse file key from URL.");
  const file = fileMatch[1];
  const node = nodeMatch ? `${nodeMatch[1]}:${nodeMatch[2]}` : "";
  return { file, node };
}

function requestBuffer(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "http:" ? http : https;
    const req = lib.request(
      parsed,
      { method: "GET", headers, timeout: 60000 },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (redirects >= 5) {
            reject(new Error(`Too many redirects for ${url}`));
            res.resume();
            return;
          }
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          resolve(requestBuffer(next, headers, redirects + 1));
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error(`Request timed out: ${url}`)));
    req.on("error", reject);
    req.end();
  });
}

async function requestJson(url, headers = {}) {
  const res = await requestBuffer(url, headers);
  const text = res.body.toString("utf8");
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (res.status < 200 || res.status >= 300) {
    const detail = body.message || body.err || text.slice(0, 200) || `HTTP ${res.status}`;
    throw new Error(`${res.status}: ${detail}`);
  }
  return body;
}

async function figmaFetch(token, endpoint) {
  return requestJson(`https://api.figma.com/v1${endpoint}`, {
    "X-Figma-Token": token,
    Accept: "application/json",
  });
}

async function downloadBinary(url, dest, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await requestBuffer(url);
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
      await writeFile(dest, res.body);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, attempt * 500));
    }
  }
  throw new Error(`Download failed after ${retries} tries: ${lastError?.message || lastError}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const token = process.env.FIGMA_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error("Missing FIGMA_ACCESS_TOKEN.");
    console.error("Create one at Figma → Settings → Security → Personal access tokens");
    process.exit(1);
  }

  let { file, node } = args;
  if (args.url) {
    const parsed = parseFigmaUrl(args.url);
    file = parsed.file;
    node = node || parsed.node;
  }
  if (!file) {
    console.error("Provide --url or --file.");
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);

  if (args.full) {
    console.log(`Fetching full file ${file}…`);
    const data = await figmaFetch(token, `/files/${file}?depth=${args.depth}`);
    const out = path.join(OUT_DIR, `${file}-full-${stamp}.json`);
    await writeFile(out, JSON.stringify(data, null, 2));
    console.log(`Saved ${out}`);
    return;
  }

  if (!node) {
    console.error("Provide --node or a URL with node-id=… (or use --full).");
    process.exit(1);
  }

  const nodeSlug = node.replace(":", "-");
  let nodes = null;

  if (!args.pngOnly) {
    console.log(`Fetching node ${node} from ${file}…`);
    nodes = await figmaFetch(token, `/files/${file}/nodes?ids=${encodeURIComponent(node)}`);
    const jsonOut = path.join(OUT_DIR, `${file}-${nodeSlug}-${stamp}.json`);
    await writeFile(jsonOut, JSON.stringify(nodes, null, 2));
    console.log(`Saved ${jsonOut}`);
  }

  console.log("Rendering PNG…");
  const pngOut = path.join(OUT_DIR, `${file}-${nodeSlug}-${stamp}.png`);
  let imageUrl = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const images = await figmaFetch(
        token,
        `/images/${file}?ids=${encodeURIComponent(node)}&format=png&scale=${args.scale}`,
      );
      imageUrl = images.images?.[node] || null;
      if (imageUrl) break;
      console.warn("No PNG URL returned (node may be empty or inaccessible).");
      break;
    } catch (err) {
      const retryable = /500|502|503|429/.test(String(err.message));
      if (retryable && attempt < 3) {
        console.warn(`PNG API error (attempt ${attempt}/3): ${err.message}`);
        await new Promise((r) => setTimeout(r, attempt * 1000));
        continue;
      }
      console.warn(`PNG export failed: ${err.message}`);
      break;
    }
  }

  if (imageUrl) {
    try {
      await downloadBinary(imageUrl, pngOut);
      console.log(`Saved ${pngOut}`);
    } catch (err) {
      console.warn(`PNG download failed: ${err.message}`);
      imageUrl = null;
    }
  }

  if (!imageUrl) {
    const thumbUrl = nodes?.nodes?.[node]?.document?.thumbnailUrl || nodes?.thumbnailUrl;
    if (thumbUrl) {
      const thumbOut = path.join(OUT_DIR, `${file}-${nodeSlug}-${stamp}-thumbnail.png`);
      await downloadBinary(thumbUrl, thumbOut);
      console.log(`Saved fallback thumbnail ${thumbOut}`);
    }
  }

  console.log("\nDone. Point Cursor at design/figma/ — no MCP quota needed.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
