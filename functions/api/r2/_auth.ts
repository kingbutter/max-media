export type AuthOk = { ok: true; token: string; user: any };
export type AuthFail = { ok: false; status: number; msg: string };
export type AuthResult = AuthOk | AuthFail;

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function requireGithubUser(req: Request): Promise<AuthResult> {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, msg: "Missing Authorization: Bearer <token>" };

  // Validate the token by calling GitHub
  const r = await fetch("https://api.github.com/user", {
    headers: {
      "User-Agent": "decap-r2-media",
      "Authorization": `token ${token}`, // GitHub accepts "token <...>"
      "Accept": "application/vnd.github+json",
    },
  });

  if (!r.ok) return { ok: false, status: 401, msg: "Invalid GitHub token" };

  const user = await r.json();
  return { ok: true, token, user };
}

export async function requireOrgMember(token: string, org: string): Promise<boolean> {
  // If GH_ORG is set, restrict to members of that org.
  const r = await fetch(`https://api.github.com/user/memberships/orgs/${org}`, {
    headers: {
      "User-Agent": "decap-r2-media",
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github+json",
    },
  });

  if (!r.ok) return false;

  // Optional: enforce active membership only
  try {
    const body = await r.json();
    return body?.state === "active" || body?.state === "pending";
  } catch {
    return true;
  }
}
