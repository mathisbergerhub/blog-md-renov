const PASSWORD_HASH = "8f9e5669280cd41a44674368ccb532d5b8f1070e58ad7bc9091216c62893b25e";
const ACCESS_COOKIE = "mdr_blog_access";
const ONE_WEEK = 60 * 60 * 24 * 7;

function isPublicAsset(pathname) {
  return (
    pathname === "/robots.txt" ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    pathname === "/site.webmanifest" ||
    /\.(css|js|png|jpg|jpeg|webp|svg|ico|webmanifest|txt|xml|md)$/i.test(pathname)
  );
}

function parseCookie(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function waitingPage(url, error = "") {
  const path = new URL(url).pathname;
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>Blog MD Rénov' bientôt disponible</title>
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,600;1,700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.2rem; background: #f0ece4; color: #1a1a18; font-family: Lexend, sans-serif; }
    main { width: min(100%, 860px); display: grid; gap: 1.4rem; padding: clamp(1.4rem, 4vw, 3rem); border: 1px solid #ddd9d0; border-radius: 24px; background: rgba(255,255,255,.72); box-shadow: 0 24px 80px rgba(26,26,24,.12); }
    img { width: min(260px, 74vw); height: auto; }
    .badge { width: fit-content; padding: .45rem .8rem; border-radius: 999px; background: #9b1c1c; color: #fff; font-size: .78rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    h1 { max-width: 760px; margin: 0; font-size: clamp(2.1rem, 6vw, 4.6rem); line-height: .98; letter-spacing: -.06em; }
    h1 span { color: #9b1c1c; font-family: "Playfair Display", serif; font-style: italic; font-weight: 700; letter-spacing: -.05em; }
    p { max-width: 650px; margin: 0; color: #5f665f; font-size: clamp(1rem, 2vw, 1.14rem); line-height: 1.75; }
    form { display: flex; flex-wrap: wrap; gap: .7rem; margin-top: .2rem; }
    input { flex: 1 1 240px; min-height: 52px; padding: 0 1rem; border: 1px solid #d6cfc3; border-radius: 12px; background: #fff; color: #1a1a18; font: inherit; }
    button { min-height: 52px; padding: 0 1.2rem; border: 0; border-radius: 12px; background: #9b1c1c; color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
    .error { color: #9b1c1c; font-weight: 700; }
    .meta { color: #777; font-size: .9rem; }
  </style>
</head>
<body>
  <main>
    <img src="/logo-mdr-site.svg" alt="MD Rénov'" />
    <div class="badge">Accès privé</div>
    <h1>Le blog MD Rénov' arrive <span>bientôt</span>.</h1>
    <p>Le blog est en préparation et n'est pas accessible au public pour le moment. L'équipe MD Rénov' peut le consulter avec le mot de passe interne.</p>
    <form method="post" action="${path}">
      <input type="password" name="password" autocomplete="current-password" placeholder="Mot de passe" aria-label="Mot de passe" required />
      <button type="submit">Entrer</button>
    </form>
    ${error ? `<p class="error">${error}</p>` : ""}
    <p class="meta">Haute-Savoie · Savoie · Pays de Gex</p>
  </main>
</body>
</html>`;
}

export default async function middleware(request) {
  const url = new URL(request.url);

  if (isPublicAsset(url.pathname)) {
    return fetch(request);
  }

  const cookies = parseCookie(request.headers.get("cookie") || "");
  if (cookies[ACCESS_COOKIE] === PASSWORD_HASH) {
    return fetch(request);
  }

  if (request.method === "POST") {
    const formData = await request.formData();
    const password = String(formData.get("password") || "");
    const passwordHash = await sha256(password);

    if (passwordHash === PASSWORD_HASH) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: url.pathname + url.search,
          "Set-Cookie": `${ACCESS_COOKIE}=${PASSWORD_HASH}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ONE_WEEK}`,
        },
      });
    }

    return new Response(waitingPage(request.url, "Mot de passe incorrect."), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(waitingPage(request.url), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export const config = {
  runtime: "edge",
  matcher: "/((?!_next/).*)",
};
