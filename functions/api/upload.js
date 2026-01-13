export async function onRequestPost({ request, env }) {
  // Expect multipart/form-data with: file + (optional) path
  const form = await request.formData();
  const file = form.get("file");
  const path = (form.get("path") || "").toString().replace(/^\/+/, "").trim();

  if (!file || typeof file === "string") {
    return new Response("Missing file", { status: 400 });
  }

  // Basic filename sanitization
  const originalName = (file.name || "upload").replace(/[^\w.\-]+/g, "_");
  const key = `${path ? path + "/" : ""}${Date.now()}_${originalName}`;

  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  // IMPORTANT: this should match your R2 public/custom domain
  const publicBase = "https://media.deadframe.pages.dev";
  const url = `${publicBase}/${key}`;

  return Response.json({ ok: true, key, url });
}
