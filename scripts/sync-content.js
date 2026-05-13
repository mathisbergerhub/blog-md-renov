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

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function stripMarkdown(value = "") {
  return String(value)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_`|~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(markdown = "") {
  const text = stripMarkdown(markdown);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function estimatedReadingTime(markdown = "") {
  return `${Math.max(2, Math.ceil(wordCount(markdown) / 220))} min`;
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

function normalizeAsset(value = "") {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") ? value : `./${value.replace(/^\.?\//, "")}`;
}

function absoluteUrl(value = "") {
  if (!value) return `${SITE_URL}/apple-touch-icon.png`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}/${value.replace(/^\.?\//, "").replace(/^\//, "")}`;
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function commonHeadAssets() {
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

function inline(value) {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
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
  return `<nav class="mdr-article-toc" aria-label="Sommaire de l'article">
<strong>Dans ce guide</strong>
${headings.map((heading) => `<a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a>`).join("\n")}
</nav>`;
}

function mediaBlock(article, variant = "article") {
  const src = normalizeAsset(article.featured_image || "");
  const alt = escapeHtml(article.image_alt || article.title);
  const label = escapeHtml(article.image_alt || article.category_label || "Visuel article");
  const className =
    variant === "card"
      ? "mdr-home-media mdr-home-media--card"
      : "mdr-media mdr-media--article";
  if (src) {
    return `<div class="${className} mdr-media--image"><img src="${escapeHtml(src)}" alt="${alt}" loading="${variant === "article" ? "eager" : "lazy"}"></div>`;
  }
  return `<div class="${className}" aria-label="Emplacement visuel 16:10 : ${label}"><strong>${label}</strong><span>Emplacement photo 16:10</span></div>`;
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
    if (unordered) {
      html.push("</ul>");
      unordered = false;
    }
    if (ordered) {
      html.push("</ol>");
      ordered = false;
    }
  }

  function flushTable() {
    if (!table.length) return;
    const rows = table
      .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
      .map((line) =>
        line
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim()),
      );
    if (rows.length) {
      const [head, ...body] = rows;
      html.push(`<div class="mdr-table-wrap"><table class="mdr-decision-table"><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    }
    table = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      closeLists();
      flushTable();
      continue;
    }
    if (line.startsWith("# ")) continue;
    if (line.startsWith("|")) {
      flushParagraph();
      closeLists();
      table.push(line);
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      closeLists();
      flushTable();
      const title = stripMarkdown(line.slice(3));
      html.push(`<h2 id="${escapeHtml(slugify(title))}">${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      closeLists();
      flushTable();
      const title = stripMarkdown(line.slice(4));
      html.push(`<h3 id="${escapeHtml(slugify(title))}">${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith(">")) {
      flushParagraph();
      closeLists();
      flushTable();
      html.push(`<blockquote><p>${inline(line.replace(/^>\s?/, ""))}</p></blockquote>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      flushTable();
      if (ordered) {
        html.push("</ol>");
        ordered = false;
      }
      if (!unordered) {
        html.push("<ul>");
        unordered = true;
      }
      html.push(`<li><span>${inline(line.slice(2))}</span></li>`);
      continue;
    }
    const orderedItem = line.match(/^\d+[\.)]\s+(.+)$/);
    if (orderedItem) {
      flushParagraph();
      flushTable();
      if (unordered) {
        html.push("</ul>");
        unordered = false;
      }
      if (!ordered) {
        html.push("<ol>");
        ordered = true;
      }
      html.push(`<li><span>${inline(orderedItem[1])}</span></li>`);
      continue;
    }
    paragraph.push(line);
  }

  flushParagraph();
  closeLists();
  flushTable();
  return html.join("\n");
}

function articleFromMarkdown(filePath, fileName) {
  const { data, body } = readFrontmatter(filePath);
  if (data.content_type && data.content_type !== "article") return null;

  const isMirror = fileName.endsWith(".html.md");
  const slug = isMirror ? fileName.replace(/\.html\.md$/, "") : fileName.replace(/\.md$/, "");
  const sourceHtml = String(data.source_html || "").trim();
  const htmlFile = sourceHtml
    ? sourceHtml.replace(/^\.?\//, "").replace(/^\/+/, "")
    : isMirror
      ? fileName.replace(/\.md$/, "")
      : `${slug}.html`;

  return {
    ...data,
    body,
    slug,
    htmlFile,
    title: data.title || slug,
    description: data.description || excerptFrom(body, ""),
    excerpt: excerptFrom(body, data.description),
    category: data.category || "exterieur",
    category_label: data.category_label || "Conseils",
    date: data.date || "2026-04-29",
    reading_time: data.reading_time || estimatedReadingTime(body),
    image_alt: data.image_alt || data.title || slug,
    featured_image: data.featured_image || "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    source_html: data.source_html || "",
    published: data.published !== false,
    isGeneratedArticle: !isMirror && !sourceHtml,
  };
}

function loadArticles() {
  const byHtmlFile = new Map();

  for (const name of fs.readdirSync(ROOT).filter((fileName) => fileName.endsWith(".html.md"))) {
    const article = articleFromMarkdown(path.join(ROOT, name), name);
    if (article && article.published) byHtmlFile.set(article.htmlFile, article);
  }

  if (fs.existsSync(CONTENT_DIR)) {
    for (const name of fs.readdirSync(CONTENT_DIR).filter((fileName) => fileName.endsWith(".md"))) {
      const article = articleFromMarkdown(path.join(CONTENT_DIR, name), name);
      if (article && article.published) byHtmlFile.set(article.htmlFile, article);
    }
  }

  return Array.from(byHtmlFile.values()).sort(
    (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
  );
}

function generatedCard(article) {
  return `<article class="mdr-home-card" data-generated="decap">
${mediaBlock(article, "card")}
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
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, "utf8");
  html = html.replace(/<article class="mdr-home-card" data-generated="decap">[\s\S]*?<\/article>\s*/g, "");
  if (!articles.length) {
    fs.writeFileSync(filePath, html, "utf8");
    return;
  }
  const cards = articles.slice(0, 6).map(generatedCard).join("\n");
  html = html.replace('<div class="mdr-home-grid">', `<div class="mdr-home-grid">\n${cards}`);
  fs.writeFileSync(filePath, html, "utf8");
}

function generatedArticlePage(article, allArticles) {
  const articleUrl = `${SITE_URL}/${article.htmlFile}`;
  const image = absoluteUrl(article.featured_image || "apple-touch-icon.png");
  const headings = extractHeadings(article.body);
  const related = allArticles
    .filter((item) => item.slug !== article.slug && item.category === article.category)
    .slice(0, 4);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    image,
    datePublished: article.date,
    dateModified: article.date,
    author: { "@type": "Organization", name: "MD Rénov'" },
    publisher: {
      "@type": "Organization",
      name: "MD Rénov'",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    articleSection: article.category_label,
    keywords: article.tags.join(", "),
    inLanguage: "fr-FR",
  };

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(article.seo_title || article.title)}</title>
<meta name="description" content="${escapeHtml(article.description)}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${articleUrl}" />
<meta property="og:locale" content="fr_FR" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${escapeHtml(article.seo_title || article.title)}" />
<meta property="og:description" content="${escapeHtml(article.description)}" />
<meta property="og:url" content="${articleUrl}" />
<meta property="og:image" content="${image}" />
<meta property="article:published_time" content="${escapeHtml(article.date)}" />
<meta property="article:modified_time" content="${escapeHtml(article.date)}" />
<meta property="article:section" content="${escapeHtml(article.category_label)}" />
${article.tags.map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}" />`).join("\n")}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(article.seo_title || article.title)}" />
<meta name="twitter:description" content="${escapeHtml(article.description)}" />
<meta name="twitter:image" content="${image}" />
<meta name="author" content="MD Rénov'" />
${commonHeadAssets()}
<script type="application/ld+json">${safeJson(jsonLd)}</script>
</head>
<body class="site-page mdr-article-page" data-generated="decap-page">
<a class="skip-link" href="#contenu">Aller au contenu</a>
<main id="contenu" class="mdr-stage"><div class="mdr-wrap">
<header class="mdr-nav"><a class="mdr-nav__brand" href="./index.html" aria-label="Retour au blog"><img src="./logo-mdr-site.svg" alt="Logo MD Rénov'" width="241" height="54" /></a><nav class="mdr-nav__links" aria-label="Navigation article"><a href="./index.html">Retour au blog</a><span>${escapeHtml(article.category_label)}</span></nav><a class="mdr-btn mdr-btn--primary" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Devis gratuit</a></header>
<section class="mdr-article-head"><div class="mdr-breadcrumb"><a href="./index.html">Accueil</a><span>Blog</span><span>${escapeHtml(article.category_label)}</span></div><div class="mdr-article-head__meta"><span class="mdr-card__tag">${escapeHtml(article.category_label)}</span><span class="mdr-card__date">${escapeHtml(formatDate(article.date))}</span><span class="mdr-card__time">${escapeHtml(article.reading_time)} de lecture</span></div><h1>${escapeHtml(article.title)}</h1><p class="mdr-article-head__excerpt">${escapeHtml(article.description)}</p></section>
<section class="mdr-article-body"><article class="mdr-prose">
${mediaBlock(article, "article")}
${renderToc(headings)}
<div class="mdr-article-leadbox"><strong>Réponse rapide</strong><p>${escapeHtml(article.description)}</p></div>
${mdToHtml(article.body)}
<div class="mdr-prose-cta"><div><strong>Vous avez un projet en Haute-Savoie ou Savoie ?</strong><span>On vous aide à cadrer le besoin, le budget et les démarches avant le devis.</span></div><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander un devis</a></div>
</article><aside class="mdr-sidebar"><section class="mdr-side-cta"><h2>Un projet en Haute-Savoie ou Savoie ?</h2><p>Devis gratuit sous 48h et conseils clairs par MD Rénov'.</p><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander mon devis</a></section>${related.length ? `<section class="mdr-home-panel"><div class="mdr-home-heading">Articles liés</div>${related.map((item) => `<a class="mdr-related-link" href="./${escapeHtml(item.htmlFile)}"><span>${escapeHtml(item.category_label)}</span><strong>${escapeHtml(item.title)}</strong></a>`).join("")}</section>` : ""}</aside></section>
</div></main>
</body>
</html>`;
}

function generateArticlePages(articles) {
  for (const article of articles) {
    fs.writeFileSync(path.join(ROOT, article.htmlFile), generatedArticlePage(article, articles), "utf8");
  }
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
    "## Articles backoffice",
    ...articles.map((article) => `- [${article.title}](${SITE_URL}/${article.htmlFile}) - ${article.description}`),
    "",
  ];
  fs.writeFileSync(path.join(ROOT, "llms.txt"), lines.join("\n"), "utf8");
}

const articles = loadArticles();
const generatedArticles = articles.filter((article) => article.isGeneratedArticle);
generateArticlePages(articles);
injectCards("index.html", generatedArticles);
for (const [category, fileName] of Object.entries(categoryFiles)) {
  injectCards(fileName, generatedArticles.filter((article) => article.category === category));
}
updateSitemap(articles);
updateLlms(articles);

console.log(`Synchro Decap terminée : ${articles.length} article(s) éditable(s), ${generatedArticles.length} nouveau(x) article(s) injecté(s) dans les listings.`);
