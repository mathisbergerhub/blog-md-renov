const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://blog.mdrenov-menuiserie.com";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unquote(value = "") {
  const trimmed = String(value).trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed;
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function readFrontmatterText(raw) {
  raw = String(raw || "").replace(/^\uFEFF/, "");
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
    if ((pair[2] || "").trim() === "") {
      data[pair[1]] = [];
      currentList = pair[1];
    } else {
      data[pair[1]] = unquote(pair[2]);
    }
  }
  return { data, body: match[2].trim() };
}

function stripMarkdown(value = "") {
  return String(value)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_`|~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inline(value = "") {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[(.*?)]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
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

function extractHeadings(markdown = "") {
  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^##\s+/.test(line))
    .map((line) => {
      const title = stripMarkdown(line.replace(/^##\s+/, ""));
      return { title, id: slugify(title) };
    })
    .filter((heading) => heading.title);
}

function renderToc(headings) {
  if (!headings.length) return "";
  return `<nav class="mdr-article-toc" aria-label="Sommaire de l'article">\n<strong>Dans ce guide</strong>\n${headings.map((heading) => `<a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a>`).join("\n")}\n</nav>`;
}

function mediaBlock(article) {
  const label = escapeHtml(article.image_alt || article.category_label || "Visuel article");
  const src = String(article.featured_image || "").trim();
  if (src) {
    const normalized = /^https?:\/\//i.test(src) ? src : `./${src.replace(/^\.?\//, "")}`;
    return `<div class="mdr-media mdr-media--article mdr-media--image"><img src="${escapeHtml(normalized)}" alt="${label}" loading="eager"></div>`;
  }
  return `<div class="mdr-media mdr-media--article" aria-label="Emplacement visuel 16:10 : ${label}"><strong>${label}</strong><span>Emplacement photo 16:10</span></div>`;
}

function mdToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let unordered = false;
  let ordered = false;
  let table = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  }
  function closeLists() {
    if (unordered) { html.push("</ul>"); unordered = false; }
    if (ordered) { html.push("</ol>"); ordered = false; }
  }
  function flushTable() {
    if (!table.length) return;
    const rows = table
      .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
      .map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
    if (rows.length) {
      const [head, ...body] = rows;
      html.push(`<div class="mdr-table-wrap"><table class="mdr-decision-table"><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    }
    table = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); closeLists(); flushTable(); continue; }
    if (line.startsWith("# ")) continue;
    if (line.startsWith("|")) { flushParagraph(); closeLists(); table.push(line); continue; }
    if (line.startsWith("## ")) {
      flushParagraph(); closeLists(); flushTable();
      const title = stripMarkdown(line.slice(3));
      html.push(`<h2 id="${escapeHtml(slugify(title))}">${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph(); closeLists(); flushTable();
      const title = stripMarkdown(line.slice(4));
      html.push(`<h3 id="${escapeHtml(slugify(title))}">${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph(); flushTable();
      if (ordered) { html.push("</ol>"); ordered = false; }
      if (!unordered) { html.push("<ul>"); unordered = true; }
      html.push(`<li><span>${inline(line.slice(2))}</span></li>`);
      continue;
    }
    const orderedItem = line.match(/^\d+[\.)]\s+(.+)$/);
    if (orderedItem) {
      flushParagraph(); flushTable();
      if (unordered) { html.push("</ul>"); unordered = false; }
      if (!ordered) { html.push("<ol>"); ordered = true; }
      html.push(`<li><span>${inline(orderedItem[1])}</span></li>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph(); closeLists(); flushTable();
  return html.join("\n");
}

function articleFromMirror(fileName) {
  const { data, body } = readFrontmatterText(fs.readFileSync(path.join(ROOT, fileName), "utf8"));
  if (data.content_type !== "article" || data.published === false) return null;
  const htmlFile = String(data.source_html || fileName.replace(/\.md$/, "")).replace(/^\.?\//, "");
  const title = data.title || fileName.replace(/\.html\.md$/, "");
  const description = data.description || excerptFrom(body, "Guide MD Rénov' pour préparer un projet de rénovation.");
  return {
    ...data,
    body,
    htmlFile,
    title,
    description,
    category: data.category || "exterieur",
    category_label: data.category_label || "Conseils",
    date: data.date || "2026-04-29",
    reading_time: data.reading_time || "4 min",
    image_alt: data.image_alt || title,
    featured_image: data.featured_image || "",
    tags: Array.isArray(data.tags) ? data.tags : [],
  };
}

function loadArticles() {
  return fs.readdirSync(ROOT)
    .filter((name) => name.endsWith(".html.md"))
    .map(articleFromMirror)
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

function headAssets() {
  return `<link rel="icon" type="image/png" sizes="32x32" href="./favicon-32x32.png" />\n<link rel="icon" type="image/png" sizes="16x16" href="./favicon-16x16.png" />\n<link rel="icon" type="image/svg+xml" href="./favicon.svg" />\n<link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png" />\n<link rel="manifest" href="./site.webmanifest" />\n<meta name="theme-color" content="#9B1C1C" />\n<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@1,500;1,600;1,700;1,800&display=swap" rel="stylesheet" />\n<link rel="stylesheet" href="./styles.css" />\n<link rel="stylesheet" href="./decap.css" />`;
}

function articlePage(article, allArticles) {
  const articleUrl = `${SITE_URL}/${article.htmlFile}`;
  const headings = extractHeadings(article.body);
  const related = allArticles.filter((item) => item.htmlFile !== article.htmlFile && item.category === article.category).slice(0, 4);
  const image = `${SITE_URL}/apple-touch-icon.png`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    image,
    datePublished: article.date,
    dateModified: article.date,
    author: { "@type": "Organization", name: "MD Rénov'" },
    publisher: { "@type": "Organization", name: "MD Rénov'", logo: { "@type": "ImageObject", url: image } },
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    articleSection: article.category_label,
    keywords: article.tags.join(", "),
    inLanguage: "fr-FR",
  };
  return `<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>${escapeHtml(article.seo_title || article.title)}</title>\n<meta name="description" content="${escapeHtml(article.description)}" />\n<meta name="robots" content="index,follow" />\n<link rel="canonical" href="${articleUrl}" />\n<meta property="og:locale" content="fr_FR" />\n<meta property="og:type" content="article" />\n<meta property="og:title" content="${escapeHtml(article.seo_title || article.title)}" />\n<meta property="og:description" content="${escapeHtml(article.description)}" />\n<meta property="og:url" content="${articleUrl}" />\n<meta property="og:image" content="${image}" />\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="author" content="MD Rénov'" />\n${headAssets()}\n<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n</head>\n<body class="site-page mdr-article-page" data-generated="decap-page">\n<a class="skip-link" href="#contenu">Aller au contenu</a>\n<main id="contenu" class="mdr-stage"><div class="mdr-wrap">\n<header class="mdr-nav"><a class="mdr-nav__brand" href="./index.html" aria-label="Retour au blog"><img src="./logo-mdr-site.svg" alt="Logo MD Rénov'" width="241" height="54" /></a><nav class="mdr-nav__links" aria-label="Navigation article"><a href="./index.html">Retour au blog</a><span>${escapeHtml(article.category_label)}</span></nav><a class="mdr-btn mdr-btn--primary" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Devis gratuit</a></header>\n<section class="mdr-article-head"><div class="mdr-breadcrumb"><a href="./index.html">Accueil</a><span>Blog</span><span>${escapeHtml(article.category_label)}</span></div><div class="mdr-article-head__meta"><span class="mdr-card__tag">${escapeHtml(article.category_label)}</span><span class="mdr-card__date">${escapeHtml(formatDate(article.date))}</span><span class="mdr-card__time">${escapeHtml(article.reading_time)} de lecture</span></div><h1>${escapeHtml(article.title)}</h1><p class="mdr-article-head__excerpt">${escapeHtml(article.description)}</p></section>\n<section class="mdr-article-body"><article class="mdr-prose">\n${mediaBlock(article)}\n${renderToc(headings)}\n<div class="mdr-article-leadbox"><p>${escapeHtml(article.description)}</p></div>\n${mdToHtml(article.body)}\n<div class="mdr-prose-cta"><div><strong>Vous avez un projet en Haute-Savoie ou Savoie ?</strong><span>On vous aide à cadrer le besoin, le budget et les démarches avant le devis.</span></div><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander un devis</a></div>\n</article><aside class="mdr-sidebar"><section class="mdr-side-cta"><h2>Un projet en Haute-Savoie ou Savoie ?</h2><p>Devis gratuit sous 48h et conseils clairs par MD Rénov'.</p><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander mon devis</a></section>${related.length ? `<section class="mdr-home-panel"><div class="mdr-home-heading">Articles liés</div>${related.map((item) => `<a class="mdr-related-link" href="./${escapeHtml(item.htmlFile)}"><span>${escapeHtml(item.category_label)}</span><strong>${escapeHtml(item.title)}</strong></a>`).join("")}</section>` : ""}</aside></section>\n</div></main>\n</body>\n</html>`;
}

function updateSitemap(articles) {
  const htmlFiles = fs.readdirSync(ROOT).filter((name) => name.endsWith(".html")).map((name) => (name === "index.html" ? "" : name));
  const urls = Array.from(new Set([...htmlFiles, ...articles.map((article) => article.htmlFile)]));
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((file) => `  <url><loc>${SITE_URL}${file ? `/${file}` : ""}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
}

function updateLlms(articles) {
  const lines = ["# Blog MD Rénov'", "", "Guides rénovation, menuiseries, aides, isolation, volets, stores, pergolas, portes et portails en Haute-Savoie et Savoie.", "", "## Articles", ...articles.map((article) => `- [${article.title}](${SITE_URL}/${article.htmlFile}) - ${article.description}`), ""];
  fs.writeFileSync(path.join(ROOT, "llms.txt"), lines.join("\n"), "utf8");
}

const articles = loadArticles();
for (const article of articles) {
  fs.writeFileSync(path.join(ROOT, article.htmlFile), articlePage(article, articles), "utf8");
}
updateSitemap(articles);
updateLlms(articles);
console.log(`Build éditorial terminé : ${articles.length} article(s) régénéré(s).`);
