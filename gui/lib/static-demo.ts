// Static demo mode: serve pre-captured API responses from /static-demo/*.json
// Activated when NEXT_PUBLIC_STATIC_DEMO=1 at build time.
// When not set, all exports are no-ops and behavior is completely unchanged.

// Next.js inlines NEXT_PUBLIC_* vars at build time — this must be a direct
// literal reference, not destructured or read via a variable.
export const IS_STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";

// One-time boot log so static mode is never ambiguous.
if (typeof window !== "undefined") {
  console.log(
    `[static-demo] mode=${IS_STATIC_DEMO ? "ON" : "OFF"} (NEXT_PUBLIC_STATIC_DEMO=${process.env.NEXT_PUBLIC_STATIC_DEMO ?? "unset"})`,
  );
}

// Module-level manifest cache (loaded once, then reused).
let manifestCache: Record<string, string> | null = null;

async function loadManifest(): Promise<Record<string, string>> {
  if (manifestCache !== null) return manifestCache;
  const res = await fetch("/static-demo/manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load static-demo manifest: ${res.status}`);
  manifestCache = (await res.json()) as Record<string, string>;
  return manifestCache;
}

// Portable SHA-256 using Web Crypto API (available in both browser and Node
// since Next.js polyfills it). Falls back to djb2 if crypto is unavailable.
async function sha256Hex(str: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback: djb2 hash (should not normally be reached)
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return h.toString(16).padStart(8, "0").repeat(4).slice(0, 64);
  }
}

// Sort JSON keys recursively to match Python's json.dumps(sort_keys=True).
// Python's default separators are ", " and ": " (with spaces), so we must match.
function sortedJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(sortedJsonStringify).join(", ") + "]";
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(
    (k) => `${JSON.stringify(k)}: ${sortedJsonStringify(obj[k])}`
  );
  return "{" + pairs.join(", ") + "}";
}

// Strip null values from an object tree to match the capture script's bodies,
// which omit keys that were not set rather than including them as null.
function stripNulls(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripNulls);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    const v = stripNulls(obj[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// Build the lookup key that matches what the capture script produces:
//   METHOD:path                  → for GET requests (no body)
//   METHOD:path:sha256(body)[:12] → for POST/PATCH requests with a body
// Then replace "/" with "_" and ":" with "__".
function sanitise(raw: string): string {
  return raw
    .replace(/\//g, "_")
    .replace(/:/g, "__")
    .replace(/\?/g, "_Q_")
    .replace(/&/g, "_A_")
    .replace(/=/g, "_E_")
    .replace(/\+/g, "_P_");
}

// Returns an array of candidate keys — first with the raw body (preserving
// nulls), then with nulls stripped.  The resolver tries both and uses the
// first one found in the manifest.
async function buildKeys(method: string, path: string, body?: unknown): Promise<string[]> {
  const upperMethod = method.toUpperCase();
  const prefix = `${upperMethod}:${path}`;

  if (body === undefined || body === null || upperMethod === "GET") {
    return [sanitise(prefix)];
  }

  // Key with the body as-is (nulls preserved).
  const rawJson = sortedJsonStringify(body);
  const rawHash = (await sha256Hex(rawJson)).slice(0, 12);
  const keyRaw = sanitise(`${prefix}:${rawHash}`);

  // Key with nulls stripped (for captures that omitted null fields).
  const cleaned = stripNulls(body);
  const cleanedJson = sortedJsonStringify(cleaned);
  const cleanedHash = (await sha256Hex(cleanedJson)).slice(0, 12);
  const keyClean = sanitise(`${prefix}:${cleanedHash}`);

  // Deduplicate when stripping nulls changes nothing.
  return keyRaw === keyClean ? [keyRaw] : [keyRaw, keyClean];
}

// Resolve a static demo response. Returns parsed JSON if found, null if not.
export async function resolveStatic<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T | null> {
  try {
    const manifest = await loadManifest();
    const keys = await buildKeys(method, path, body);
    // Exact key match (with body hash).
    for (const key of keys) {
      const filename = manifest[key];
      if (!filename) {
        if (typeof window !== "undefined") {
          console.debug(`[static-demo] MISS ${method} ${path} key=${key}`);
        }
        continue;
      }
      const res = await fetch(`/static-demo/${filename}`, { cache: "no-store" });
      if (!res.ok) {
        if (typeof window !== "undefined") {
          console.warn(`[static-demo] file fetch failed: /static-demo/${filename} status=${res.status}`);
        }
        continue;
      }
      if (typeof window !== "undefined") {
        console.debug(`[static-demo] HIT ${method} ${path} -> ${filename}`);
      }
      return (await res.json()) as T;
    }
    // Fallback: for POST endpoints where the body varies (e.g. free-text
    // revision comments, ad-hoc chat messages), find any manifest entry
    // whose key starts with the same method+path prefix.
    if (body !== undefined && method.toUpperCase() !== "GET") {
      const prefix = sanitise(`${method.toUpperCase()}:${path}`) + "__";
      const fallbackKey = Object.keys(manifest).find((k) => k.startsWith(prefix));
      if (fallbackKey) {
        const res = await fetch(`/static-demo/${manifest[fallbackKey]}`, { cache: "no-store" });
        if (res.ok) {
          if (typeof window !== "undefined") {
            console.debug(`[static-demo] FALLBACK ${method} ${path} -> ${manifest[fallbackKey]}`);
          }
          return (await res.json()) as T;
        }
      }
    }
    if (typeof window !== "undefined") {
      console.warn(`[static-demo] NO MATCH ${method} ${path} keys=${JSON.stringify(keys)}`);
    }
    return null;
  } catch (err) {
    if (typeof window !== "undefined") {
      console.error(`[static-demo] ERROR resolving ${method} ${path}:`, err);
    }
    return null;
  }
}

// Simulated latency for AI endpoints (900–1800 ms, randomized).
// Only called for POST requests that would normally hit an LLM.
export async function simulateLatency(): Promise<void> {
  const ms = 900 + Math.floor(Math.random() * 900);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// Whether a path should trigger simulated latency.
export function isAiPath(path: string): boolean {
  return (
    path.includes("/api/ai/") ||
    path.includes("/skills/generate-") ||
    path.includes("/skills/segment") ||
    path.includes("/api/rag/")
  );
}
