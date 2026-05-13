const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://blog.mdrenov-menuiserie.com";

function unquote(value = "") {
  const trimmed = String(value).trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed;
}

function readFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  let currentList = null;
  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && currentList) {
      data[currentList].push(unquote(listItem[1]));
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!pair) continue;
    currentList = null;
    if (pair[2].trim() === "") {
      data[pair[1]] = [];
      currentList = pair[1];
    } else {
      data[pair[1]] = unquote(pair[2]);
    }
  }
  return data;
}

function articleFromMirror(fileName) {
  const data = readFrontmatter(path.join(ROOT, fileName));
  if (data.content_type !== "article" || data.published === false) return null;
  return {
    title: data.title || fileName.replace(/\.html\.md$/, ""),
    description: data.description || "Guide MD Rénov' pour préparer un projet de rénovation.",
    htmlFile: fileName.replace(/\.md$/, ""),
    date: data.date || "2026-04-29",
  };
}

function collectArticles() {
  return fs
    .readdirSync(ROOT)
    .filter((name) => name.endsWith(".html.md"))
    .map(articleFromMirror)
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

function updateSitemap(articles) {
  const htmlFiles = fs
    .readdirSync(ROOT)
    .filter((name) => name.endsWith(".html"))
    .map((name) => (name === "index.html" ? "" : name));
  const urls = Array.from(new Set([...htmlFiles, ...articles.map((article) => article.htmlFile)]));
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((file) => `  <url><loc>${SITE_URL}${file ? `/${file}` : ""}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
}

function updateLlms(articles) {
  const lines = [
    "# Blog MD Rénov'",
    "",
    "Guides rénovation, menuiseries, aides, isolation, volets, stores, pergolas, portes et portails en Haute-Savoie et Savoie.",
    "",
    "## Articles",
    ...articles.map((article) => `- [${article.title}](${SITE_URL}/${article.htmlFile}) - ${article.description}`),
    "",
  ];
  fs.writeFileSync(path.join(ROOT, "llms.txt"), lines.join("\n"), "utf8");
}

const articles = collectArticles();
updateSitemap(articles);
updateLlms(articles);

console.log(`Build éditorial terminé : ${articles.length} article(s) conservé(s), aucun HTML d'article existant régénéré.`);
