const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "articles");
const SITE_URL = "https://blog.mdrenov-menuiserie.com";

const categoryFiles = {
  aides: "aides-subventions.html",
  fenetres: "fenetres-vitrages.html",
  isolation: "isolation-thermique.html",
  "volets-stores": "volets-stores.html",
  "portes-portails": "portes-portails.html",
  exterieur: "tous-les-articles-exterieur.html",
};

const staticSlugs = [
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

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unquote(value) {
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
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
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
    const key = pair[1];
    const value = pair[2] || "";
    if (value.trim() === "") {
      data[key] = [];
      currentList = key;
    } else {
      data[key] = unquote(value);
    }
  }
  return { data, body: match[2].trim() };
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue || "2026-04-29"}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function excerptFrom(body, fallback) {
  const firstParagraph = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("-"));
  return fallback || firstParagraph || "";
}

function mdInline(value) {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function mdToHtml(markdown) {
  const html = [];
  let paragraph = [];
  let list = false;
  const closeParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${mdInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (list) {
      html.push("</ul>");
      list = false;
    }
  };
  for (const raw of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      closeParagraph();
      closeList();
      continue;
    }
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) {
      closeParagraph();
      closeList();
      html.push(`<h2>${mdInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      closeParagraph();
      closeList();
      html.push(`<h3>${mdInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("- ")) {
      closeParagraph();
      if (!list) {
        html.push('<ul class="mdr-check-grid">');
        list = true;
      }
      html.push(`<li><span>${mdInline(line.slice(2))}</span></li>`);
      continue;
    }
    if (line.startsWith("|")) continue;
    paragraph.push(line);
  }
  closeParagraph();
  closeList();
  return html.join("\n");
}

function loadArticles() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs.readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const { data, body } = readFrontmatter(path.join(CONTENT_DIR, name));
      const slug = name.replace(/\.md$/, "");
      return {
        ...data,
        body,
        slug,
        htmlFile: `${slug}.html`,
        title: data.title || slug,
        description: data.description || excerptFrom(body, ""),
        excerpt: excerptFrom(body, data.description),
        category: data.category || "exterieur",
        category_label: data.category_label || "Conseils",
        date: data.date || "2026-04-29",
        reading_time: data.reading_time || "5 min",
        image_alt: data.image_alt || data.title || slug,
        published: data.published !== false,
      };
    })
    .filter((article) => article.published)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

function generatedCard(article) {
  return `<article class="mdr-home-card" data-generated="decap">
<div class="mdr-home-media mdr-home-media--card"><strong>${escapeHtml(article.image_alt || article.category_label)}</strong></div>
<div class="mdr-home-card__body">
<div class="mdr-home-card__meta"><span class="mdr-home-card__tag">${escapeHtml(article.category_label)}</span><span class="mdr-home-card__date">${escapeHtml(formatDate(article.date))}</span></div>
<h3>${escapeHtml(article.title)}</h3>
<p>${escapeHtml(article.excerpt).slice(0, 180)}</p>
<div class="mdr-home-card__foot"><a class="mdr-link" href="./${escapeHtml(article.htmlFile)}">Lire</a><span class="mdr-home-card__time">${escapeHtml(article.reading_time)}</span></div>
</div>
</article>`;
}

function injectCards(fileName, articles) {
  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath) || articles.length === 0) return;
  let html = fs.readFileSync(filePath, "utf8");
  html = html.replace(/<article class="mdr-home-card" data-generated="decap">[\s\S]*?<\/article>\s*/g, "");
  const cards = articles.map(generatedCard).join("\n");
  html = html.replace('<div class="mdr-home-grid">', `<div class="mdr-home-grid">\n${cards}`);
  fs.writeFileSync(filePath, html, "utf8");
}

function generateArticlePage(article) {
  const filePath = path.join(ROOT, article.htmlFile);
  if (fs.existsSync(filePath)) return;
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(article.seo_title || article.title)}</title>
<meta name="description" content="${escapeHtml(article.description)}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${SITE_URL}/${article.slug}" />
<link rel="stylesheet" href="./styles.css" />
</head>
<body class="site-page mdr-article-page">
<a class="skip-link" href="#contenu">Aller au contenu</a>
<main id="contenu" class="mdr-stage"><div class="mdr-wrap">
<header class="mdr-nav"><a class="mdr-nav__brand" href="./index.html"><img src="./logo-mdr-site.svg" alt="Logo MD Rénov'" width="241" height="54" /></a><nav class="mdr-nav__links"><a href="./index.html">Retour au blog</a><span>${escapeHtml(article.category_label)}</span></nav><a class="mdr-btn mdr-btn--primary" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Devis gratuit</a></header>
<section class="mdr-article-head"><div class="mdr-breadcrumb"><a href="./index.html">Accueil</a><span>Blog</span><span>${escapeHtml(article.category_label)}</span></div><div class="mdr-article-head__meta"><span class="mdr-card__tag">${escapeHtml(article.category_label)}</span><span class="mdr-card__date">${escapeHtml(formatDate(article.date))}</span><span class="mdr-card__time">${escapeHtml(article.reading_time)} de lecture</span></div><h1>${escapeHtml(article.title)}</h1><p class="mdr-article-head__excerpt">${escapeHtml(article.description)}</p></section>
<section class="mdr-article-body"><article class="mdr-prose"><div class="mdr-media mdr-media--article"><strong>${escapeHtml(article.image_alt || article.title)}</strong><span>Emplacement photo 16:10</span></div>${mdToHtml(article.body)}</article><aside class="mdr-sidebar"><section class="mdr-side-cta"><h2>Un projet en Haute-Savoie ou Savoie ?</h2><p>Devis gratuit sous 48h et conseils clairs par MD Rénov'.</p><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander mon devis</a></section></aside></section>
</div></main>
</body>
</html>`;
  fs.writeFileSync(filePath, html, "utf8");
}

function updateSitemap(articles) {
  const existingSlugs = fs.readdirSync(ROOT)
    .filter((name) => name.endsWith(".html"))
    .map((name) => name === "index.html" ? "" : name.replace(/\.html$/, ""));
  const slugs = Array.from(new Set([...staticSlugs, ...existingSlugs, ...articles.map((article) => article.slug)]));
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${slugs.map((slug) => `  <url><loc>${SITE_URL}${slug ? `/${slug}` : ""}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
}

const articles = loadArticles();
for (const article of articles) generateArticlePage(article);
injectCards("index.html", articles.slice(0, 3));
for (const [category, fileName] of Object.entries(categoryFiles)) {
  injectCards(fileName, articles.filter((article) => article.category === category));
}
updateSitemap(articles);
console.log(`Synchro Decap terminée : ${articles.length} article(s) publié(s), pages existantes préservées.`);
