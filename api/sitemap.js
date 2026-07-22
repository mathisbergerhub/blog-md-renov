const fs = require("fs");
const path = require("path");
const cms = require("./_supabase-cms");
const { root } = require("../scripts/sync-content");

const SITE_URL = "https://blog.mdrenov-menuiserie.com";
const STATIC_PATHS = [
  "",
  "aides-subventions",
  "fenetres-vitrages",
  "isolation-thermique",
  "volets-stores",
  "portes-portails",
  "tous-les-articles-exterieur",
  "mentions-legales",
  "politique-confidentialite",
  "politique-cookies",
  "conditions-utilisation",
];

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanPath(value = "") {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "")
    .replace(/\.html$/, "");
}

function staticSitemap() {
  const file = path.join(root, "sitemap.xml");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function urlEntry(pathname, lastmod) {
  const clean = cleanPath(pathname);
  const loc = clean ? `${SITE_URL}/${clean}` : SITE_URL;
  return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${escapeXml(lastmod)}</lastmod></url>`;
}

function sendXml(res, statusCode, xml) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(xml);
}

module.exports = async function sitemap(req, res) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (!cms.isConfigured()) {
      sendXml(res, 200, staticSitemap());
      return;
    }

    const rows = await cms.listArticles({ includeArchived: false, publicOnly: true });
    const entries = new Map();
    for (const pathname of STATIC_PATHS) entries.set(cleanPath(pathname), today);
    for (const row of rows) {
      const pathname = cleanPath(row.html_path || `${row.slug}.html`);
      if (!pathname) continue;
      entries.set(pathname, row.modified_on || row.published_on || today);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(entries.entries()).map(([pathname, lastmod]) => urlEntry(pathname, lastmod)).join("\n")}
</urlset>
`;
    sendXml(res, 200, xml);
  } catch (error) {
    console.error("[sitemap]", error);
    const fallback = staticSitemap();
    sendXml(res, fallback ? 200 : 500, fallback || "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset></urlset>");
  }
};
