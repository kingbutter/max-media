import { requireGithubUser, requireOrgMember } from "./_auth";

export interface Env {
  R2_BUCKET: R2Bucket;
  R2_BASE_PATH: string; // uploads
  GH_ORG?: string;
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
  const base = cleanBasePath(ctx.env.R2_BASE_PATH, "uploads");

  if (!key || !key.startsWith(base + "/") || key.includes("..")) {
    return json({ error: `Invalid key (must start with "${base}/")` }, 400);
  }

  await ctx.env.R2_BUCKET.delete(key);
  return json({ ok: true });
};
