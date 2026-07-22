const fs = require("fs");
const path = require("path");
const cms = require("./_supabase-cms");
const { articleFromMarkdown, articlePage, root } = require("../scripts/sync-content");

function sendHtml(res, statusCode, html) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
}

function notFoundHtml() {
  const fallback = path.join(root, "404.html");
  if (fs.existsSync(fallback)) return fs.readFileSync(fallback, "utf8");
  return "<!doctype html><html lang=\"fr\"><title>Page introuvable</title><body><h1>Page introuvable</h1><a href=\"/\">Retour au blog</a></body></html>";
}

function staticArticleHtml(slug) {
  const normalized = String(slug || "").replace(/[^a-z0-9-]/g, "");
  if (!normalized) return "";
  const fallback = path.join(root, `${normalized}.html`);
  if (!fs.existsSync(fallback)) return "";
  return fs.readFileSync(fallback, "utf8");
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
        sendHtml(res, 200, staticHtml);
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

    sendHtml(res, 200, articlePage(article, articles));
  } catch (error) {
    console.error("[cms-article]", error);
    sendHtml(res, 500, "<!doctype html><html lang=\"fr\"><title>Erreur</title><body><h1>Erreur de chargement</h1><p>Impossible de charger cet article.</p></body></html>");
  }
};
