import { next } from "@vercel/functions";

const PASSWORD_HASH =
  "8f9e5669280cd41a44674368ccb532d5b8f1070e58ad7bc9091216c62893b25e";
const BLOG_ACCESS_COOKIE = "mdr_blog_access";
const ADMIN_ACCESS_COOKIE = "mdr_admin_access";
const ADMIN_PASSWORD_HASH = PASSWORD_HASH;
const ONE_WEEK = 60 * 60 * 24 * 7;

function parseCookie(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator === -1) return [part, ""];
        return [
          decodeURIComponent(part.slice(0, separator)),
          decodeURIComponent(part.slice(separator + 1)),
        ];
      }),
  );
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isPublicAsset(pathname) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/uploads/") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".woff2")
  );
}

function isAdminRoute(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAdminApi(pathname) {
  return pathname.startsWith("/api/");
}

function buildCookie(name, value) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ONE_WEEK}`;
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function jsonResponse(error, status = 401) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function loginPage({ admin = false, error = false } = {}) {
  const title = admin ? "Administration du blog" : "Le blog MD Rénov' arrive bientôt.";
  const eyebrow = admin ? "Espace sécurisé" : "Accès privé";
  const description = admin
    ? "Cet espace permet de créer, modifier, archiver ou préparer des articles. Il est réservé aux personnes autorisées par MD Rénov'."
    : "Nous préparons une nouvelle interface avec des guides pratiques sur les fenêtres, volets, stores, portes, portails, pergolas et aides à la rénovation en Haute-Savoie et Savoie.";
  const label = admin ? "Mot de passe administrateur" : "Mot de passe";
  const button = admin ? "Accéder au back-office" : "Accéder au blog";

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>${admin ? "Administration MD Rénov' - Accès sécurisé" : "Blog MD Rénov' - Accès privé"}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,700&display=swap");

      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at 16% 14%, rgba(155, 28, 28, .12), transparent 30%),
          radial-gradient(circle at 86% 8%, rgba(23, 79, 49, .12), transparent 28%),
          #f0ece4;
        color: #171717;
        font-family: Lexend, system-ui, sans-serif;
      }
      main {
        width: min(${admin ? "560px" : "980px"}, 100%);
        display: grid;
        grid-template-columns: ${admin ? "1fr" : "1.05fr .95fr"};
        overflow: hidden;
        border: 1px solid #ded6ca;
        border-radius: 30px;
        background: #fffaf3;
        box-shadow: 0 28px 80px rgba(23, 23, 23, .10);
      }
      .intro, .panel { padding: clamp(30px, 6vw, 64px); }
      .intro { border-right: ${admin ? "0" : "1px solid #ded6ca"}; }
      .panel {
        display: grid;
        align-content: center;
        gap: 20px;
        background: ${admin ? "#fffaf3" : "#161614"};
        color: ${admin ? "#171717" : "#fff"};
      }
      img {
        width: 220px;
        max-width: 78%;
        height: auto;
        margin-bottom: 38px;
      }
      .eyebrow {
        color: #9b1c1c;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .18em;
        text-transform: uppercase;
      }
      h1 {
        margin: 12px 0 16px;
        color: ${admin ? "#171717" : "#174f31"};
        font-size: clamp(34px, 6vw, 70px);
        line-height: .98;
        letter-spacing: -.06em;
      }
      h1 em {
        color: #9b1c1c;
        font-family: "Playfair Display", serif;
        font-style: italic;
      }
      p {
        margin: 0;
        color: ${admin ? "#6f6a63" : "rgba(255, 255, 255, .78)"};
        font-size: clamp(16px, 2vw, 20px);
        line-height: 1.7;
      }
      .intro p { color: #6f6a63; }
      form { display: grid; gap: 12px; margin-top: 6px; }
      label {
        color: ${admin ? "#9b1c1c" : "rgba(255, 255, 255, .74)"};
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .14em;
        text-transform: uppercase;
      }
      input {
        width: 100%;
        border: 1px solid ${admin ? "#ded6ca" : "rgba(255, 255, 255, .18)"};
        border-radius: 16px;
        padding: 17px 18px;
        background: ${admin ? "#fff" : "rgba(255, 255, 255, .08)"};
        color: ${admin ? "#171717" : "#fff"};
        font: 700 18px Lexend, system-ui, sans-serif;
        outline: none;
      }
      input:focus {
        border-color: ${admin ? "#9b1c1c" : "#fff"};
        box-shadow: 0 0 0 4px ${admin ? "rgba(155, 28, 28, .10)" : "rgba(255, 255, 255, .10)"};
      }
      button {
        border: 0;
        border-radius: 16px;
        padding: 18px 20px;
        background: #9b1c1c;
        color: white;
        cursor: pointer;
        font: 800 16px Lexend, system-ui, sans-serif;
      }
      .error {
        color: ${admin ? "#9b1c1c" : "#ffd6d6"};
        font-size: 14px;
        font-weight: 800;
      }
      @media (max-width: 820px) {
        body { padding: 14px; }
        main { grid-template-columns: 1fr; border-radius: 22px; }
        .intro { border-right: 0; border-bottom: ${admin ? "0" : "1px solid #ded6ca"}; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="intro">
        <img src="/logo-mdr-site.svg" alt="MD Rénov'">
        <div class="eyebrow">${eyebrow}</div>
        <h1>${admin ? title : "Le blog MD Rénov' arrive <em>bientôt</em>."}</h1>
        <p>${description}</p>
      </section>
      <section class="panel" aria-label="${admin ? "Connexion administrateur" : "Accès interne"}">
        ${admin ? "" : "<h1>Validation interne uniquement.</h1><p>Le blog n'est pas encore accessible au public. Les personnes autorisées peuvent entrer avec le mot de passe transmis par MD Rénov'.</p>"}
        <form method="post">
          <label for="password">${label}</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
          <button type="submit">${button}</button>
          ${error ? '<div class="error">Mot de passe incorrect.</div>' : ""}
        </form>
      </section>
    </main>
  </body>
</html>`;
}

async function handlePasswordPost(request, url, expectedHash, cookieName) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const passwordHash = await sha256(password);

  if (passwordHash !== expectedHash) {
    return null;
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: url.pathname + url.search,
      "Set-Cookie": buildCookie(cookieName, expectedHash),
    },
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);

  if (isPublicAsset(url.pathname)) {
    return next();
  }

  const cookies = parseCookie(request.headers.get("cookie") || "");
  const adminRoute = isAdminRoute(url.pathname);
  const adminApi = isAdminApi(url.pathname);

  if (adminRoute || adminApi) {
    if (cookies[ADMIN_ACCESS_COOKIE] === ADMIN_PASSWORD_HASH) {
      return next();
    }

    if (adminRoute && request.method === "POST") {
      const response = await handlePasswordPost(
        request,
        url,
        ADMIN_PASSWORD_HASH,
        ADMIN_ACCESS_COOKIE,
      );
      return response || htmlResponse(loginPage({ admin: true, error: true }), 401);
    }

    if (adminApi) {
      return jsonResponse("Accès admin requis.");
    }

    return htmlResponse(loginPage({ admin: true }));
  }

  if (cookies[BLOG_ACCESS_COOKIE] === PASSWORD_HASH) {
    return next();
  }

  if (request.method === "POST") {
    const response = await handlePasswordPost(request, url, PASSWORD_HASH, BLOG_ACCESS_COOKIE);
    return response || htmlResponse(loginPage({ error: true }), 401);
  }

  return htmlResponse(loginPage());
}

export const config = {
  runtime: "edge",
  matcher: "/((?!_next/).*)",
};
