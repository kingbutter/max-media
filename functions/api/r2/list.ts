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
    },
  });
}

function cleanBasePath(v: string | undefined, fallback: string) {
  return (v || fallback).replace(/^\/+|\/+$/g, "");
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const req = ctx.request;

  const auth = await requireGithubUser(req);
  if (!auth.ok) return json({ error: auth.msg }, auth.status);

  if (ctx.env.GH_ORG) {
    const ok = await requireOrgMember(auth.token, ctx.env.GH_ORG);
    if (!ok) return json({ error: "Forbidden (not org member)" }, 403);
  }

  const url = new URL(req.url);
  const base = cleanBasePath(ctx.env.R2_BASE_PATH, "uploads");

  const prefixIn = (url.searchParams.get("prefix") || `${base}/`).replace(/^\/+/, "");
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const cursor = url.searchParams.get("cursor") || undefined;
  const limitRaw = parseInt(url.searchParams.get("limit") || "60", 10);
  const limit = Math.max(1, Math.min(isNaN(limitRaw) ? 60 : limitRaw, 200));

  // Force listing to stay under the base folder
  if (!prefixIn.startsWith(base + "/") || prefixIn.includes("..")) {
    return json({ error: `Bad prefix (must start with "${base}/")` }, 400);
  }

  const listed = await ctx.env.R2_BUCKET.list({ prefix: prefixIn, limit, cursor });

  // Optional: simple client-side search filter (on key) while still prefix-scoped
  const objects = q
    ? listed.objects.filter(o => o.key.toLowerCase().includes(q))
    : listed.objects;

  return json({
    objects: objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded })),
    cursor: listed.truncated ? listed.cursor : null,
  });
};
