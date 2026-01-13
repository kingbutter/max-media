import { requireGithubUser, requireOrgMember } from "./_auth";

export interface Env {
  R2_BUCKET: R2Bucket;
  R2_PUBLIC_BASE: string; // e.g. https://assets.deadframe.media
  R2_BASE_PATH: string;   // e.g. uploads
  GH_ORG?: string;        // optional
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      // same-origin is typical; CORS headers don't hurt for local testing
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

function cleanBasePath(v: string | undefined, fallback: string) {
  return (v || fallback).replace(/^\/+|\/+$/g, "");
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

  const base = cleanBasePath(ctx.env.R2_BASE_PATH, "uploads");

  if (!key || !key.startsWith(base + "/")) {
    return json({ error: `Invalid key (must start with "${base}/")` }, 400);
  }
  if (key.includes("..")) return json({ error: "Invalid key" }, 400);

  // Strongly recommended: images only
  if (!contentType.startsWith("image/")) {
    return json({ error: "Only image uploads allowed" }, 400);
  }

  const obj = ctx.env.R2_BUCKET.object(key);

  // Signed PUT URL valid for 10 minutes
  const uploadUrl = await obj.createPresignedUrl({
    method: "PUT",
    expiresIn: 600,
    httpMetadata: { contentType },
  });

  const publicBase = (ctx.env.R2_PUBLIC_BASE || "").replace(/\/+$/g, "");
  const publicUrl = `${publicBase}/${key}`;

  return json({ uploadUrl, publicUrl });
};
