const fs = require("fs");
const path = require("path");
const cms = require("./_supabase-cms");
const staticArticleManifest = require("./_article-manifest");
const { articleFromMarkdown, articlePage, root } = require("../scripts/sync-content");

function sendHtml(res, statusCode, html, source = "") {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (source) res.setHeader("X-MDR-Article-Source", source);
  res.end(html);
}

function notFoundHtml() {
  const fallback = path.join(root, "404.html");
  if (fs.existsSync(fallback)) return fs.readFileSync(fallback, "utf8");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,follow" />
<title>Page introuvable | Blog MD Renov'</title>
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="stylesheet" href="/styles.css" />
<style>
body{margin:0;background:#f4f0e9;color:#171717;font-family:Lexend,system-ui,sans-serif}
.notfound{min-height:100vh;display:grid;place-items:center;padding:32px}
.notfound__box{width:min(760px,100%);border:1px solid #ded6ca;border-radius:18px;background:#fffaf3;padding:clamp(28px,5vw,56px);box-shadow:0 24px 70px rgba(23,23,23,.1)}
.notfound__tag{display:inline-flex;border:1px solid #e9b8b8;border-radius:999px;padding:10px 14px;background:#fff5f3;color:#9b1c1c;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
h1{margin:26px 0 16px;font-size:clamp(46px,8vw,96px);line-height:.92;letter-spacing:-.06em}
p{max-width:620px;color:#59554f;font-size:clamp(17px,2vw,22px);line-height:1.65}
.notfound__actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.notfound__actions a{display:inline-flex;align-items:center;justify-content:center;border:1px solid #ded6ca;border-radius:12px;padding:15px 19px;color:#171717;text-decoration:none;font-weight:800}
.notfound__actions a:first-child{border-color:#9b1c1c;background:#9b1c1c;color:white}
</style>
</head>
<body>
<main class="notfound">
<section class="notfound__box">
<span class="notfound__tag">Erreur 404</span>
<h1>Page introuvable</h1>
<p>La page demandée a peut-être été déplacée, archivée ou renommée. Vous pouvez repartir du blog ou consulter les guides principaux.</p>
<div class="notfound__actions">
<a href="/">Retour au blog</a>
<a href="/fenetres-vitrages">Fenêtres & vitrages</a>
<a href="/volets-stores">Volets & stores</a>
</div>
</section>
</main>
</body>
</html>`;
}

function staticArticleHtml(slug) {
  const normalized = String(slug || "").replace(/[^a-z0-9-]/g, "");
  if (!normalized) return "";
  const articles = staticArticleManifest
    .map((item) => articleFromMarkdown(item.filePath, item.markdown))
    .filter(Boolean);
  const article = articles.find((item) => item.htmlFile.replace(/\.html$/, "") === normalized);
  return article ? articlePage(article, articles) : "";
}

module.exports = async function cmsArticle(req, res) {
  try {
    if (!cms.isConfigured()) {
      sendHtml(res, 503, "Supabase n'est pas configure sur Vercel.");
      return;
    }

    const url = new URL(req.url, "https://blog.mdrenov-menuiserie.com");
    const slug = String(url.searchParams.get("slug") || "").replace(/^\/+/, "").replace(/\.html$/, "");
    if (!slug) {
      sendHtml(res, 404, notFoundHtml());
      return;
    }

    const row = await cms.findArticle(slug, { publicOnly: true });
    if (!row) {
      const staticHtml = staticArticleHtml(slug);
      if (staticHtml) {
        sendHtml(res, 200, staticHtml, "static");
        return;
      }
      sendHtml(res, 404, notFoundHtml());
      return;
    }

    const rows = await cms.listArticles({ includeArchived: false, publicOnly: true });
    const articles = rows
      .map((item) => articleFromMarkdown(item.source_path || `${item.slug}.html.md`, cms.markdownFromRow(item)))
      .filter(Boolean);
    const article = articles.find((item) => item.htmlFile === row.html_path) || articleFromMarkdown(row.source_path || `${row.slug}.html.md`, cms.markdownFromRow(row));

    sendHtml(res, 200, articlePage(article, articles), "supabase");
  } catch (error) {
    console.error("[cms-article]", error);
    sendHtml(res, 500, "<!doctype html><html lang=\"fr\"><title>Erreur</title><body><h1>Erreur de chargement</h1><p>Impossible de charger cet article.</p></body></html>");
  }
};
