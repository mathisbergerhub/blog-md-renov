const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LISTING_FILES = [
  "aides-subventions.html",
  "fenetres-vitrages.html",
  "isolation-thermique.html",
  "volets-stores.html",
  "portes-portails.html",
  "tous-les-articles-exterieur.html",
  "index.html",
];

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
  return trimmed;
}

function parseFrontmatter(raw) {
  const match = String(raw || "").replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  return match[1].split(/\r?\n/).reduce((data, line) => {
    const pair = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!pair) return data;
    data[pair[1]] = unquote(pair[2]);
    return data;
  }, {});
}

function loadImagesByArticle() {
  const map = new Map();
  for (const fileName of fs.readdirSync(ROOT).filter((name) => name.endsWith(".html.md"))) {
    const data = parseFrontmatter(fs.readFileSync(path.join(ROOT, fileName), "utf8"));
    const image = String(data.featured_image || "").trim();
    if (!image) continue;

    const htmlFile = String(data.source_html || fileName.replace(/\.md$/, "")).replace(/^\.?\//, "");
    const src = /^https?:\/\//i.test(image) ? image : `./${image.replace(/^\.?\//, "")}`;
    map.set(htmlFile, {
      src,
      alt: data.image_alt || data.title || "Photo article MD Rénov'",
    });
  }
  return map;
}

function mediaMarkup(image) {
  return `<div class="mdr-home-media mdr-home-media--card mdr-media--image"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy"></div>`;
}

function replaceArticleMedia(html, htmlFile, image) {
  const escapedFile = htmlFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const articleRegex = new RegExp(
    `(<article class="mdr-home-card"(?:(?!<article class="mdr-home-card")[\\s\\S])*?<div class="mdr-home-card__foot"><a class="mdr-link" href="\\./${escapedFile}">(?:(?!<article class="mdr-home-card")[\\s\\S])*?<\\/article>)`,
    "g",
  );

  return html.replace(articleRegex, (articleBlock) =>
    articleBlock.replace(/<div class="mdr-home-media mdr-home-media--card(?: mdr-media--image)?"[\s\S]*?<\/div>\s*(?=<div class="mdr-home-card__body">)/, `${mediaMarkup(image)}\n`),
  );
}

function main() {
  const imagesByArticle = loadImagesByArticle();
  let changedPages = 0;

  for (const fileName of LISTING_FILES) {
    const pagePath = path.join(ROOT, fileName);
    if (!fs.existsSync(pagePath)) continue;

    let html = fs.readFileSync(pagePath, "utf8");
    const before = html;
    for (const [htmlFile, image] of imagesByArticle.entries()) {
      html = replaceArticleMedia(html, htmlFile, image);
    }

    if (html !== before) {
      fs.writeFileSync(pagePath, html, "utf8");
      changedPages += 1;
    }
  }

  console.log(`Images de listing appliquées : ${changedPages} page(s).`);
}

main();
