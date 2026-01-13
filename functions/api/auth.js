export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  const clientId = context.env.GITHUB_CLIENT_ID;
  const siteId = url.searchParams.get("site_id") || url.hostname;

  // Decap sends these
  const provider = url.searchParams.get("provider") || "github";
  const scope = url.searchParams.get("scope") || "repo";

  if (!clientId) {
    return new Response("Missing GITHUB_CLIENT_ID", { status: 500 });
  }
  if (provider !== "github") {
    return new Response("Only GitHub is supported in this starter.", { status: 400 });
  }

  // State carries the origin so callback can postMessage back safely
  const state = encodeURIComponent(JSON.stringify({ siteId, origin: url.origin }));

  const auth = new URL("https://github.com/login/oauth/authorize");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("scope", scope);
  auth.searchParams.set("state", state);

  return Response.redirect(auth.toString(), 302);
}
