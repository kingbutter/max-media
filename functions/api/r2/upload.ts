import { requireGithubUser, requireOrgMember } from "./_auth";

export interface Env {
  R2_BUCKET: R2Bucket;
  R2_PUBLIC_BASE: string; // https://assets.deadframe.media
  R2_BASE_PATH: string;   // uploads
  GH_ORG?: string;
  MAX_UPLOAD_BYTES?: string; // optional env var e.g. "26214400" (25MB)
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

function cleanBasePath(v: string | undefined, fallback: string) {
  return (v || fallback).replace(/^\/+|\/+$/g, "");
}

function b64ToBytes(b64: string): Uint8Array {
  // Support base64url and missing padding
  let s = b64.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const req = ctx.request;

  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireGithubUser(req);
  if (!auth.ok) return json({ error: auth.msg }, auth.status);

  if (ctx.env.GH_ORG) {
    const ok = await requireOrgMember(auth.token, ctx.env.GH_ORG);
    if (!ok) return json({ error: "Forbidden (not org member)" }, 403);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const key = String(payload?.key || "");
  const contentType = String(payload?.contentType || "application/octet-stream");
  const dataUrl = String(payload?.dataUrl || "");

  const base = cleanBasePath(ctx.env.R2_BASE_PATH, "uploads");

  if (!key || !key.startsWith(base + "/") || key.includes("..")) {
    return json({ error: `Invalid key (must start with "${base}/")` }, 400);
  }

  if (!contentType.startsWith("image/")) {
    return json({ error: "Only image uploads allowed" }, 400);
  }

  // Expect: data:<mime>;base64,<data>
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return json({ error: "Missing/invalid dataUrl" }, 400);

  const dataMime = m[1] || "";
  const b64 = m[2] || "";

  // Optional: ensure the mime in the Data URL matches the declared contentType
  if (dataMime && dataMime !== contentType) {
    // Don't hard-fail; just trust contentType (client file.type is usually correct)
    // return json({ error: "contentType does not match dataUrl mime" }, 400);
  }

  const bytes = b64ToBytes(b64);

  // Server-side size check (defaults to 25MB if not set)
  const maxBytes = parseInt(ctx.env.MAX_UPLOAD_BYTES || "26214400", 10);
  if (!Number.isNaN(maxBytes) && bytes.byteLength > maxBytes) {
    return json({ error: `File too large (${Math.round(bytes.byteLength / 1024 / 1024)}MB)` }, 413);
  }

  await ctx.env.R2_BUCKET.put(key, bytes, {
    httpMetadata: { contentType },
  });

  const publicBase = (ctx.env.R2_PUBLIC_BASE || "").replace(/\/+$/g, "");
  if (!publicBase) return json({ error: "Server missing R2_PUBLIC_BASE env var" }, 500);

  const publicUrl = `${publicBase}/${key}`;
  return json({ publicUrl, key });
};
