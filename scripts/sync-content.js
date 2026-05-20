const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://blog.mdrenov-menuiserie.com";
const HANDCRAFTED_PAGES = new Set(["maprimerenov-2026-haute-savoie.html"]);

function e(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function unquote(value = "") {
  const v = String(value).trim();
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) return v.slice(1, -1).replace(/''/g, "'");
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

function slugify(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

function parseFrontmatter(raw) {
  raw = String(raw || "").replace(/^\uFEFF/, "");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  let listKey = null;
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && listKey) {
      data[listKey].push(unquote(item[1]));
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!pair) continue;
    listKey = null;
    if ((pair[2] || "").trim() === "") {
      data[pair[1]] = [];
      listKey = pair[1];
    } else {
      data[pair[1]] = unquote(pair[2]);
    }
  }
  return { data, body: match[2].trim() };
}

function stripMd(value = "") {
  return String(value).replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*]\([^)]+\)/g, " ").replace(/\[([^\]]+)]\([^)]+\)/g, "$1").replace(/[#>*_`|~-]/g, " ").replace(/\s+/g, " ").trim();
}

function inline(value = "") {
  return e(value).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/\[(.*?)]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue || "2026-04-29"}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function readArticle(fileName) {
  const { data, body } = parseFrontmatter(fs.readFileSync(path.join(ROOT, fileName), "utf8"));
  if (data.content_type !== "article" || data.published === false) return null;
  const htmlFile = String(data.source_html || fileName.replace(/\.md$/, "")).replace(/^\.?\//, "");
  return {
    ...data,
    body,
    htmlFile,
    title: data.title || fileName.replace(/\.html\.md$/, ""),
    description: data.description || "Guide MD Rénov' pour préparer un projet de rénovation.",
    category: data.category || "exterieur",
    category_label: data.category_label || "Conseils",
    date: data.date || "2026-04-29",
    reading_time: data.reading_time || "4 min",
    image_alt: data.image_alt || data.title || "Visuel article",
    featured_image: data.featured_image || "",
    tags: Array.isArray(data.tags) ? data.tags : [],
  };
}

function loadArticles() {
  return fs.readdirSync(ROOT).filter((name) => name.endsWith(".html.md")).map(readArticle).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

function headings(markdown = "") {
  return markdown.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^##\s+/.test(line)).map((line) => {
    const title = stripMd(line.replace(/^##\s+/, ""));
    return { title, id: slugify(title) };
  }).filter((item) => item.title);
}

function toc(items) {
  if (!items.length) return "";
  return `<nav class="mdr-article-toc" aria-label="Sommaire de l'article"><strong>Dans ce guide</strong>${items.map((item) => `<a href="#${e(item.id)}">${e(item.title)}</a>`).join("")}</nav>`;
}

function media(article) {
  const label = e(article.image_alt || article.category_label || "Visuel article");
  const src = String(article.featured_image || "").trim();
  if (!src) return `<div class="mdr-media mdr-media--article" aria-label="Emplacement visuel 16:10 : ${label}"><strong>${label}</strong><span>Emplacement photo 16:10</span></div>`;
  const url = /^https?:\/\//i.test(src) ? src : `./${src.replace(/^\.?\//, "")}`;
  return `<div class="mdr-media mdr-media--article mdr-media--image"><img src="${e(url)}" alt="${label}" loading="eager"></div>`;
}

function mdToHtml(markdown = "") {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let p = [];
  let ul = false;
  let ol = false;
  let table = [];
  const flushP = () => { if (p.length) { html.push(`<p>${inline(p.join(" "))}</p>`); p = []; } };
  const closeLists = () => { if (ul) { html.push("</ul>"); ul = false; } if (ol) { html.push("</ol>"); ol = false; } };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line)).map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
    if (rows.length) {
      const [head, ...body] = rows;
      html.push(`<div class="mdr-table-wrap"><table class="mdr-decision-table"><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    }
    table = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushP(); closeLists(); flushTable(); continue; }
    if (line.startsWith("# ")) continue;
    if (line.startsWith("|")) { flushP(); closeLists(); table.push(line); continue; }
    if (line.startsWith("## ")) { flushP(); closeLists(); flushTable(); const t = stripMd(line.slice(3)); html.push(`<h2 id="${e(slugify(t))}">${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith("### ")) { flushP(); closeLists(); flushTable(); const t = stripMd(line.slice(4)); html.push(`<h3 id="${e(slugify(t))}">${inline(line.slice(4))}</h3>`); continue; }
    if (line.startsWith("- ")) { flushP(); flushTable(); if (ol) { html.push("</ol>"); ol = false; } if (!ul) { html.push("<ul>"); ul = true; } html.push(`<li><span>${inline(line.slice(2))}</span></li>`); continue; }
    const ordered = line.match(/^\d+[\.)]\s+(.+)$/);
    if (ordered) { flushP(); flushTable(); if (ul) { html.push("</ul>"); ul = false; } if (!ol) { html.push("<ol>"); ol = true; } html.push(`<li><span>${inline(ordered[1])}</span></li>`); continue; }
    p.push(line);
  }
  flushP(); closeLists(); flushTable();
  return html.join("\n");
}

function assets() {
  return `<link rel="icon" type="image/png" sizes="32x32" href="./favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="./favicon-16x16.png" />
<link rel="icon" type="image/svg+xml" href="./favicon.svg" />
<link rel="shortcut icon" href="./favicon-32x32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png" />
<link rel="manifest" href="./site.webmanifest" />
<meta name="theme-color" content="#9B1C1C" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@1,500;1,600;1,700;1,800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="./styles.css" />
<link rel="stylesheet" href="./decap.css" />`;
}

function page(article, all) {
  const url = `${SITE_URL}/${article.htmlFile}`;
  const image = `${SITE_URL}/apple-touch-icon.png`;
  const related = all.filter((item) => item.htmlFile !== article.htmlFile && item.category === article.category).slice(0, 4);
  const jsonLd = { "@context": "https://schema.org", "@type": "BlogPosting", headline: article.title, description: article.description, image, datePublished: article.date, dateModified: article.date, author: { "@type": "Organization", name: "MD Rénov'" }, publisher: { "@type": "Organization", name: "MD Rénov'", logo: { "@type": "ImageObject", url: image } }, mainEntityOfPage: { "@type": "WebPage", "@id": url }, articleSection: article.category_label, keywords: article.tags.join(", "), inLanguage: "fr-FR" };
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${e(article.seo_title || article.title)}</title>
<meta name="description" content="${e(article.description)}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${url}" />
<meta property="og:locale" content="fr_FR" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${e(article.seo_title || article.title)}" />
<meta property="og:description" content="${e(article.description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${image}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="author" content="MD Rénov'" />
${assets()}
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
</head>
<body class="site-page mdr-article-page" data-generated="decap-page">
<a class="skip-link" href="#contenu">Aller au contenu</a>
<main id="contenu" class="mdr-stage"><div class="mdr-wrap">
<header class="mdr-nav"><a class="mdr-nav__brand" href="./index.html" aria-label="Retour au blog"><img src="./logo-mdr-site.svg" alt="Logo MD Rénov'" width="241" height="54" /></a><nav class="mdr-nav__links" aria-label="Navigation article"><a href="./index.html">Retour au blog</a><span>${e(article.category_label)}</span></nav><a class="mdr-btn mdr-btn--primary" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Devis gratuit</a></header>
<section class="mdr-article-head"><div class="mdr-breadcrumb"><a href="./index.html">Accueil</a><span>Blog</span><span>${e(article.category_label)}</span></div><div class="mdr-article-head__meta"><span class="mdr-card__tag">${e(article.category_label)}</span><span class="mdr-card__date">${e(formatDate(article.date))}</span><span class="mdr-card__time">${e(article.reading_time)} de lecture</span></div><h1>${e(article.title)}</h1><p class="mdr-article-head__excerpt">${e(article.description)}</p></section>
<section class="mdr-article-body"><article class="mdr-prose">
${media(article)}
${toc(headings(article.body))}
<div class="mdr-article-leadbox"><p>${e(article.description)}</p></div>
${mdToHtml(article.body)}
<div class="mdr-prose-cta"><div><strong>Vous avez un projet en Haute-Savoie ou Savoie ?</strong><span>On vous aide à cadrer le besoin, le budget et les démarches avant le devis.</span></div><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander un devis</a></div>
</article><aside class="mdr-sidebar"><section class="mdr-side-cta"><h2>Un projet en Haute-Savoie ou Savoie ?</h2><p>Devis gratuit sous 48h et conseils clairs par MD Rénov'.</p><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander mon devis</a></section>${related.length ? `<section class="mdr-home-panel"><div class="mdr-home-heading">Articles liés</div>${related.map((item) => `<a class="mdr-related-link" href="./${e(item.htmlFile)}"><span>${e(item.category_label)}</span><strong>${e(item.title)}</strong></a>`).join("")}</section>` : ""}</aside></section>
</div></main>
</body>
</html>`;
}

function updateSitemap(articles) {
  const htmlFiles = fs.readdirSync(ROOT).filter((name) => name.endsWith(".html")).map((name) => (name === "index.html" ? "" : name));
  const urls = Array.from(new Set([...htmlFiles, ...articles.map((article) => article.htmlFile)]));
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((file) => `  <url><loc>${SITE_URL}${file ? `/${file}` : ""}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`, "utf8");
}

function updateLlms(articles) {
  const lines = ["# Blog MD Rénov'", "", "Guides rénovation, menuiseries, aides, isolation, volets, stores, pergolas, portes et portails en Haute-Savoie et Savoie.", "", "## Articles", ...articles.map((article) => `- [${article.title}](${SITE_URL}/${article.htmlFile}) - ${article.description}`), ""];
  fs.writeFileSync(path.join(ROOT, "llms.txt"), lines.join("\n"), "utf8");
}

const articles = loadArticles();
for (const article of articles) {
  if (HANDCRAFTED_PAGES.has(article.htmlFile)) continue;
  fs.writeFileSync(path.join(ROOT, article.htmlFile), page(article, articles), "utf8");
}
updateSitemap(articles);
updateLlms(articles);
console.log(`Build éditorial terminé : ${articles.length} article(s), ${HANDCRAFTED_PAGES.size} page(s) protégée(s).`);
