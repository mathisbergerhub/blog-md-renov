function getBaseUrl(req) {
  if (process.env.OAUTH_BASE_URL) {
    return process.env.OAUTH_BASE_URL.replace(/\/$/, "");
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}

function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  const match = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function sendPopupMessage(res, status, payload) {
  const safePayload = JSON.stringify(payload).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Connexion Decap CMS</title>
</head>
<body>
  <p>Connexion en cours...</p>
  <script>
    (function () {
      var payload = ${safePayload};
      var status = ${JSON.stringify(status)};
      var message = "authorization:github:" + status + ":" + JSON.stringify(payload);

      function receiveMessage(event) {
        window.removeEventListener("message", receiveMessage, false);
        window.opener.postMessage(message, event.origin);
        window.setTimeout(function () { window.close(); }, 300);
      }

      window.addEventListener("message", receiveMessage, false);

      if (window.opener) {
        window.opener.postMessage("authorizing:github", "*");
      }
    })();
  </script>
</body>
</html>`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Set-Cookie", "decap_oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  res.end(html);
}

module.exports = async function callback(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const code = req.query.code;
  const state = req.query.state;
  const expectedState = getCookie(req, "decap_oauth_state");

  if (!clientId || !clientSecret) {
    sendPopupMessage(res, "error", {
      error: "missing_env",
      error_description: "GITHUB_CLIENT_ID ou GITHUB_CLIENT_SECRET est manquant dans Vercel.",
    });
    return;
  }

  if (!code) {
    sendPopupMessage(res, "error", {
      error: "missing_code",
      error_description: "GitHub n'a pas renvoyé de code d'autorisation.",
    });
    return;
  }

  if (!state || !expectedState || state !== expectedState) {
    sendPopupMessage(res, "error", {
      error: "invalid_state",
      error_description: "La session OAuth a expiré ou ne correspond pas.",
    });
    return;
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${getBaseUrl(req)}/api/callback`,
        state,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
      sendPopupMessage(res, "error", {
        error: tokenData.error || "token_exchange_failed",
        error_description: tokenData.error_description || "GitHub n'a pas renvoyé de token.",
      });
      return;
    }

    sendPopupMessage(res, "success", {
      token: tokenData.access_token,
      provider: "github",
    });
  } catch (error) {
    sendPopupMessage(res, "error", {
      error: "server_error",
      error_description: error.message || "Erreur serveur pendant la connexion GitHub.",
    });
  }
};
