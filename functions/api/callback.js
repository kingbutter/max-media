export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // optional but good to keep
  const error = url.searchParams.get("error");

  // If GitHub sent an error (user canceled, etc.)
  if (error) {
    const content = JSON.stringify({ error, error_description: url.searchParams.get("error_description") });
    const message = JSON.stringify(`authorization:github:error:${content}`);
    return new Response(htmlWithPostMessage(message), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!code) {
    const content = JSON.stringify({ error: "missing_code" });
    const message = JSON.stringify(`authorization:github:error:${content}`);
    return new Response(htmlWithPostMessage(message), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Exchange code for token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": "decap-cms-oauth",
    },
    body: JSON.stringify({
      client_id: context.env.GITHUB_CLIENT_ID,
      client_secret: context.env.GITHUB_CLIENT_SECRET,
      code,
      state,
    }),
  });

  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token;

  if (!accessToken) {
    const content = JSON.stringify(tokenJson);
    const message = JSON.stringify(`authorization:github:error:${content}`);
    return new Response(htmlWithPostMessage(message), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Decap expects a STRING message with a JSON payload
  const content = JSON.stringify({ token: accessToken, provider: "github" });
  const message = JSON.stringify(`authorization:github:success:${content}`);

  return new Response(htmlWithPostMessage(message), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function htmlWithPostMessage(messageJsonString) {
  // messageJsonString is already JSON.stringify("authorization:github:success:...")
  return `<!doctype html>
<html>
  <body>
    <script>
      (function () {
        function receiveMessage(e) {
          // Send token back to the CMS window using the correct origin
          window.opener.postMessage(${messageJsonString}, e.origin);
          window.close();
        }

        window.addEventListener("message", receiveMessage, false);

        // Start handshake so Decap will respond with its origin
        window.opener.postMessage("authorizing:github", "*");
      })();
    </script>
    <p>Authorizing…</p>
  </body>
</html>`;
}
