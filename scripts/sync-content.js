const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "articles");
const SITE_URL = "https://blog.mdrenov-menuiserie.com";

const categories = {
  aides: {
    file: "aides-subventions.html",
    label: "Aides & Subventions",
    badge: "Aides & Subventions",
    title: "Les articles pour mieux cadrer votre budget",
    intro: "Aides, démarches, autorisations, préparation de budget et points de vigilance avant devis.",
  },
  fenetres: {
    file: "fenetres-vitrages.html",
    label: "Fenêtres & Vitrages",
    badge: "Fenêtres & Vitrages",
    title: "Tous les conseils pour choisir vos fenêtres",
    intro: "Matériaux, vitrages, pose, isolation, bruit et confort : les guides pour choisir sans se tromper.",
  },
  isolation: {
    file: "isolation-thermique.html",
    label: "Isolation thermique",
    badge: "Isolation thermique",
    title: "Comprendre les pertes de chaleur avant de remplacer",
    intro: "Fenêtres froides, vitrage, ventilation, bruit, condensation et confort thermique en Haute-Savoie.",
  },
  "volets-stores": {
    file: "volets-stores.html",
    label: "Volets & Stores",
    badge: "Volets & Stores",
    title: "Volets, stores et protection solaire",
    intro: "Motorisation, solaire, stores bannes, BSO et choix de protection selon exposition et usage.",
  },
  "portes-portails": {
    file: "portes-portails.html",
    label: "Portes & Portails",
    badge: "Portes & Portails",
    title: "Bien choisir ses portes, portails et accès",
    intro: "Sécurité, isolation, motorisation, porte de garage, portail et cohérence de façade.",
  },
  exterieur: {
    file: "tous-les-articles-exterieur.html",
    label: "Aménagements extérieurs",
    badge: "Aménagements extérieurs",
    title: "Pergolas, stores, moustiquaires et extérieurs",
    intro: "Les articles pour aménager terrasse, balcon et accès extérieurs avec des solutions durables.",
  },
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

function unquote(value) {
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed;
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue || "2026-04-29"}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function excerptFrom(body, fallback) {
  const firstParagraph = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("-"));
  return fallback || firstParagraph || "";
}

function mdToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let list = false;
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  function closeList() {
    if (list) {
      html.push("</ul>");
      list = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }
    if (line.startsWith("# ")) continue;
    if (line.startsWith("## ")) {
      flushParagraph();
      closeList();
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      closeList();
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      if (!list) {
        html.push('<ul class="mdr-check-grid">');
        list = true;
      }
      html.push(`<li><span>${inline(line.slice(2))}</span></li>`);
      continue;
    }
    if (line.startsWith("|")) continue;
    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  return html.join("\n");
}

function inline(value) {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function loadArticles() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const filePath = path.join(CONTENT_DIR, name);
      const { data, body } = readFrontmatter(filePath);
      const slug = name.replace(/\.md$/, "");
      const htmlFile = `${slug}.html`;
      return {
        ...data,
        body,
        slug,
        htmlFile,
        url: `./${htmlFile}`,
        description: data.description || excerptFrom(body, ""),
        excerpt: excerptFrom(body, data.description),
        category: data.category || "exterieur",
        category_label: data.category_label || categories[data.category]?.label || "Conseils",
        date: data.date || "2026-04-29",
        reading_time: data.reading_time || "5 min",
        title: data.title || slug,
        image_alt: data.image_alt || data.title || slug,
        published: data.published !== false,
      };
    })
    .filter((article) => article.published)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

function card(article) {
  const tags = [
    article.category,
    ...(Array.isArray(article.tags) ? article.tags : []),
    article.category_label,
  ]
    .filter(Boolean)
    .map(slugify)
    .join(" ");

  return `<article class="mdr-home-card" data-tags="${escapeHtml(tags)}">
<div class="mdr-home-media mdr-home-media--card"><strong>${escapeHtml(article.image_alt || article.category_label)}</strong></div>
<div class="mdr-home-card__body">
<div class="mdr-home-card__meta"><span class="mdr-home-card__tag">${escapeHtml(article.category_label)}</span><span class="mdr-home-card__date">${escapeHtml(formatDate(article.date))}</span></div>
<h3>${escapeHtml(article.title)}</h3>
<p>${escapeHtml(article.excerpt).slice(0, 180)}</p>
<div class="mdr-home-card__foot"><a class="mdr-link" href="./${escapeHtml(article.htmlFile)}">Lire</a><span class="mdr-home-card__time">${escapeHtml(article.reading_time)}</span></div>
</div>
</article>`;
}

function replaceBetween(html, startMarker, endMarker, replacement) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) return html;
  return html.slice(0, start + startMarker.length) + "\n" + replacement + "\n" + html.slice(end);
}

function updateHome(articles) {
  const homePath = path.join(ROOT, "index.html");
  let html = fs.readFileSync(homePath, "utf8");
  const cards = articles.slice(0, 6).map(card).join("\n");
  const pattern = /<div class="mdr-home-grid">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<aside class="mdr-home-side">/;
  html = html.replace(pattern, `<div class="mdr-home-grid">\n${cards}\n</div>\n</div>\n</div>\n<aside class="mdr-home-side">`);
  fs.writeFileSync(homePath, html, "utf8");
}

function generateListingPage(meta, articles) {
  const cards = articles.map(card).join("\n") || '<p class="mdr-empty">Aucun article publié pour le moment.</p>';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(meta.label)} | Blog MD Rénov'</title>
<meta name="description" content="${escapeHtml(meta.intro)}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${SITE_URL}/${meta.file.replace(/\.html$/, "")}" />
<link rel="stylesheet" href="./styles.css" />
</head>
<body class="site-page mdr-listing-page">
<a class="skip-link" href="#contenu">Aller au contenu</a>
<main id="contenu" class="mdr-full">
${topBar()}
<section class="mdr-listing-hero">
<span class="mdr-home-badge">${escapeHtml(meta.badge)}</span>
<h1>${escapeHtml(meta.title)}</h1>
<p>${escapeHtml(meta.intro)}</p>
</section>
${categoryNav(meta.file)}
<section class="mdr-listing-content">
<div class="mdr-home-grid">
${cards}
</div>
</section>
${homeFooter()}
</main>
</body>
</html>
`;
}

function topBar() {
  return `<div class="mdr-trust">
<span>Certifié RGE</span><span>20 ans d'expertise</span><span>Éligible MaPrimeRénov'</span><span>Haute-Savoie · Savoie · Pays de Gex</span>
</div>
<header class="mdr-topnav">
<a class="mdr-topnav__brand" href="./index.html" aria-label="Retour à l'accueil du blog"><img src="./logo-mdr-site.svg" alt="Logo MD Rénov'" width="241" height="54" /></a>
<nav class="mdr-topnav__links" aria-label="Navigation du blog"><a href="./index.html">Tous les articles</a><a href="./fenetres-vitrages.html">Fenêtres</a><a href="./isolation-thermique.html">Isolation</a><a href="./aides-subventions.html">Aides</a><a href="https://www.mdrenov-menuiserie.com" target="_blank" rel="noopener noreferrer">Site principal</a></nav>
<a class="mdr-btn mdr-btn--primary" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Devis gratuit</a>
</header>`;
}

function categoryNav(activeFile = "index.html") {
  const links = [
    ["index.html", "Tous les articles"],
    ["aides-subventions.html", "Aides & Subventions"],
    ["fenetres-vitrages.html", "Fenêtres & Vitrages"],
    ["isolation-thermique.html", "Isolation thermique"],
    ["volets-stores.html", "Volets & Stores"],
    ["portes-portails.html", "Portes & Portails"],
    ["tous-les-articles-exterieur.html", "Aménagements extérieurs"],
  ];
  return `<section class="mdr-home-cats" aria-label="Catégories du blog">
${links.map(([href, label]) => `<a class="mdr-home-cat${href === activeFile ? " mdr-home-cat--active" : ""}" href="./${href}">${label}</a>`).join("\n")}
</section>`;
}

function homeFooter() {
  return `<footer class="mdr-home-footer">
<div class="mdr-home-footer__copy"><p class="mdr-home-footer__brand">MD Rénov'</p><p class="mdr-home-footer__sub">Meythet (Annecy) · Haute-Savoie · Savoie · Pays de Gex</p></div>
<div class="mdr-home-footer__links"><a href="./index.html">Tous les articles</a><a href="https://www.mdrenov-menuiserie.com" target="_blank" rel="noopener noreferrer">Site principal</a><a href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Contact</a></div>
</footer>`;
}

function articlePage(article) {
  const articleHtml = mdToHtml(article.body);
  return `<!DOCTYPE html>
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
<header class="mdr-nav">
<a class="mdr-nav__brand" href="./index.html" aria-label="Retour au blog"><img src="./logo-mdr-site.svg" alt="Logo MD Rénov'" width="241" height="54" /></a>
<nav class="mdr-nav__links" aria-label="Navigation article"><a href="./index.html">Retour au blog</a><span>${escapeHtml(article.category_label)}</span></nav>
<a class="mdr-btn mdr-btn--primary" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Devis gratuit</a>
</header>
<section class="mdr-article-head">
<div class="mdr-breadcrumb"><a href="./index.html">Accueil</a><span>Blog</span><span>${escapeHtml(article.category_label)}</span></div>
<div class="mdr-article-head__meta"><span class="mdr-card__tag">${escapeHtml(article.category_label)}</span><span class="mdr-card__date">${escapeHtml(formatDate(article.date))}</span><span class="mdr-card__time">${escapeHtml(article.reading_time)} de lecture</span></div>
<h1>${escapeHtml(article.title)}</h1>
<p class="mdr-article-head__excerpt">${escapeHtml(article.description)}</p>
</section>
<section class="mdr-article-body">
<article class="mdr-prose">
<div class="mdr-media mdr-media--article" aria-label="Emplacement visuel 16:10 : ${escapeHtml(article.image_alt)}"><strong>${escapeHtml(article.image_alt || article.title)}</strong><span>Emplacement photo 16:10</span></div>
${articleHtml}
<div class="mdr-prose-cta"><div><strong>Vous avez un projet en Haute-Savoie ou Savoie ?</strong><span>On vous aide à cadrer le besoin, le budget et les démarches avant le devis.</span></div><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander un devis</a></div>
</article>
<aside class="mdr-sidebar">
<section class="mdr-side-cta"><h2>Un projet en Haute-Savoie ou Savoie ?</h2><p>Devis gratuit sous 48h et conseils clairs par MD Rénov'.</p><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander mon devis</a></section>
</aside>
</section>
${homeFooter()}
</div></main>
</body>
</html>
`;
}

function updateListings(articles) {
  for (const [category, meta] of Object.entries(categories)) {
    const page = generateListingPage(meta, articles.filter((article) => article.category === category));
    fs.writeFileSync(path.join(ROOT, meta.file), page, "utf8");
  }
}

function generateMissingArticlePages(articles) {
  for (const article of articles) {
    fs.writeFileSync(path.join(ROOT, article.htmlFile), articlePage(article), "utf8");
  }
}

function updateSitemap(articles) {
  const staticPages = [
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
  const urls = [...staticPages, ...articles.map((article) => article.slug)];
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((slug) => `  <url><loc>${SITE_URL}${slug ? `/${slug}` : ""}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
}

function updateLlms(articles) {
  const lines = [
    "# Blog MD Rénov'",
    "",
    "Guides rénovation, menuiseries, aides, isolation, volets, stores, pergolas, portes et portails en Haute-Savoie et Savoie.",
    "",
    "## Articles",
    ...articles.map((article) => `- [${article.title}](${SITE_URL}/${article.slug}) - ${article.description}`),
    "",
  ];
  fs.writeFileSync(path.join(ROOT, "llms.txt"), lines.join("\n"), "utf8");
}

const articles = loadArticles();
updateHome(articles);
updateListings(articles);
generateMissingArticlePages(articles);
updateSitemap(articles);
updateLlms(articles);

console.log(`Synchro terminée : ${articles.length} article(s) publié(s).`);
