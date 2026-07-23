const fs = require("fs");
const path = require("path");
const cms = require("./_supabase-cms");
const staticListings = require("./_listing-manifest");
const { articleFromMarkdown, root } = require("../scripts/sync-content");

const PAGES = {
  "": { file: "index.html", categories: null, pageSlug: "tous-les-articles" },
  index: { file: "index.html", categories: null, pageSlug: "tous-les-articles" },
  "aides-subventions": { file: "aides-subventions.html", categories: ["aides"], pageSlug: "aides-subventions" },
  "fenetres-vitrages": { file: "fenetres-vitrages.html", categories: ["fenetres"], pageSlug: "fenetres-vitrages" },
  "isolation-thermique": { file: "isolation-thermique.html", categories: ["isolation"], pageSlug: "isolation-thermique" },
  "volets-stores": { file: "volets-stores.html", categories: ["volets-stores"], pageSlug: "volets-stores" },
  "portes-portails": { file: "portes-portails.html", categories: ["portes-portails"], pageSlug: "portes-portails" },
  "tous-les-articles-exterieur": { file: "tous-les-articles-exterieur.html", categories: ["exterieur"], pageSlug: "tous-les-articles-exterieur" },
};

function e(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue || "2026-04-29"}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function cardTags(article, pageSlug) {
  return Array.from(new Set([
    pageSlug,
    slugify(article.category_label || ""),
    ...(article.tags || []).map(slugify),
  ].filter(Boolean))).join(" ");
}

function imageSrc(src = "") {
  const value = String(src || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `./${value.replace(/^\.?\//, "")}`;
}

function articleCard(article, pageSlug) {
  const href = `./${article.htmlFile}`;
  const src = imageSrc(article.featured_image);
  const media = src
    ? `<div class="mdr-home-media mdr-home-media--card mdr-media--image"><img src="${e(src)}" alt="${e(article.image_alt || article.title)}" loading="lazy"></div>`
    : `<div class="mdr-home-media mdr-home-media--card"><strong>${e(article.image_alt || article.category_label || "Guide MD Rénov'")}</strong></div>`;
  return `<article class="mdr-home-card" data-tags="${e(cardTags(article, pageSlug))}">
<a class="mdr-home-card__overlay" href="${e(href)}" aria-label="Lire : ${e(article.title)}"></a>
${media}
<div class="mdr-home-card__body">
<div class="mdr-home-card__meta"><span class="mdr-home-card__tag">${e(article.category_label)}</span><span class="mdr-home-card__date">${e(formatDate(article.modified_date || article.date))}</span></div>
<h3>${e(article.title)}</h3>
<p>${e(article.description)}</p>
<div class="mdr-home-card__foot"><a class="mdr-link" href="${e(href)}">Lire</a><span class="mdr-home-card__time">${e(article.reading_time)}</span></div>
</div>
</article>`;
}

function sendHtml(res, statusCode, html) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
}

function staticListingHtml(page) {
  if (!page) return "";
  if (staticListings[page.file]) return staticListings[page.file];
  const staticFile = path.join(root, page.file);
  if (fs.existsSync(staticFile)) return fs.readFileSync(staticFile, "utf8");
  return "";
}

function replaceGrid(html, page, cards) {
  if (page.file === "index.html") {
    return html.replace(
      /(<div class="mdr-home-heading">Articles[\s\S]*?<\/div>\s*<div class="mdr-home-grid">)[\s\S]*?(<\/div>\s*<\/div>\s*<aside class="mdr-home-side">)/,
      `$1\n${cards}\n$2`,
    );
  }
  return html.replace(
    /(<section class="mdr-listing-content">\s*<div class="mdr-home-grid">)[\s\S]*?(<\/div>\s*<\/section>)/,
    `$1\n${cards}\n$2`,
  );
}

module.exports = async function cmsListing(req, res) {
  try {
    const url = new URL(req.url, "https://blog.mdrenov-menuiserie.com");
    const requested = String(url.searchParams.get("path") || "").replace(/^\/+/, "").replace(/\.html$/, "");
    const page = PAGES[requested];
    if (!page) {
      sendHtml(res, 404, "Page introuvable.");
      return;
    }

    let html = staticListingHtml(page);
    if (!html) {
      sendHtml(res, 404, "Page introuvable.");
      return;
    }
    if (!cms.isConfigured()) {
      sendHtml(res, 200, html);
      return;
    }

    let rows = [];
    try {
      rows = await cms.listArticles({ includeArchived: false, publicOnly: true });
    } catch (error) {
      console.error("[cms-listing:supabase-fallback]", error);
      sendHtml(res, 200, html);
      return;
    }
    const articles = rows
      .map((row) => articleFromMarkdown(row.source_path || `${row.slug}.html.md`, cms.markdownFromRow(row)))
      .filter(Boolean)
      .filter((article) => !page.categories || page.categories.includes(article.category));
    if (articles.length) {
      html = replaceGrid(html, page, articles.map((article) => articleCard(article, page.pageSlug)).join("\n"));
    }
    sendHtml(res, 200, html);
  } catch (error) {
    console.error("[cms-listing]", error);
    const url = new URL(req.url, "https://blog.mdrenov-menuiserie.com");
    const requested = String(url.searchParams.get("path") || "").replace(/^\/+/, "").replace(/\.html$/, "");
    const fallback = staticListingHtml(PAGES[requested]);
    sendHtml(res, fallback ? 200 : 500, fallback || "Impossible de charger la liste d'articles.");
  }
};
