const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://blog.mdrenov-menuiserie.com";
const ASSET_VERSION = "menu-20260605e";
const HANDCRAFTED_PAGES = new Set(["maprimerenov-2026-haute-savoie.html"]);
const CATEGORY_LISTINGS = {
  "aides-subventions.html": { slug: "aides-subventions", categories: ["aides"] },
  "fenetres-vitrages.html": { slug: "fenetres-vitrages", categories: ["fenetres"] },
  "isolation-thermique.html": { slug: "isolation-thermique", categories: ["isolation"] },
  "volets-stores.html": { slug: "volets-stores", categories: ["volets-stores"] },
  "portes-portails.html": { slug: "portes-portails", categories: ["portes-portails"] },
  "tous-les-articles-exterieur.html": { slug: "tous-les-articles-exterieur", categories: ["exterieur"] },
};

function e(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Pages whose absolute URL is built without the .html extension (clean URLs are
// enabled in vercel.json, so /article is the canonical form served by Vercel).
const SITEMAP_EXCLUDE = new Set(["maprimerenov-2025-haute-savoie.html"]);

function cleanPath(htmlFile = "") {
  const name = String(htmlFile).replace(/^\.?\//, "");
  if (name === "index.html") return "";
  return name.replace(/\.html$/, "");
}

function pageUrl(htmlFile = "") {
  const clean = cleanPath(htmlFile);
  return clean ? `${SITE_URL}/${clean}` : SITE_URL;
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

function parseFrontmatter(raw) {
  raw = String(raw || "").replace(/^\uFEFF/, "");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  let currentList = null;
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && currentList) {
      data[currentList].push(unquote(item[1]));
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
  return e(value)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[(.*?)]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue || "2026-04-29"}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function cleanArticleTitle(rawTitle = "", description = "") {
  let title = String(rawTitle || "").replace(/\s+/g, " ").trim();
  const desc = String(description || "").replace(/\s+/g, " ").trim();
  if (desc && title.includes(desc)) title = title.replace(desc, "").trim();
  title = title.replace(/\s+([?.!,;:])/g, "$1").replace(/[.\s]+$/, "").trim();
  if (title.length > 95) {
    const questionEnd = title.indexOf("? ");
    if (questionEnd > 20) title = title.slice(0, questionEnd + 1).trim();
  }
  if (title.length > 95) title = title.slice(0, 92).replace(/\s+\S*$/, "").trim();
  return title || rawTitle;
}

function shortenText(value = "", max = 74) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "").trim()}…`;
}

function normalizeArticleMarkdown(markdown = "") {
  let text = String(markdown || "").replace(/\r\n/g, "\n").trim();
  text = text.replace(/^#\s+.+\n+/, "");
  text = text.replace(/##\s+Ce que ce guide vous aide à décider\s*\n+[\s\S]*?(?=\n##\s+)/i, "");
  text = text.replace(/##\s+Rep(?:ères|Ã¨res) rapides\s*\n+[\s\S]*?(?=\n##\s+)/i, "");
  text = text.replace(/\s+Vous habitez [\s\S]*?Cadrer mon store/gi, "");

  return text
    .split("\n")
    .map((rawLine) => {
      const line = rawLine.trimEnd();
      const checklistHeading = line.match(/^(##\s+Ce qu['’]il faut préparer[^-]+)\s+-\s+(.+)$/i);
      if (checklistHeading) return `${checklistHeading[1].trim()}\n\n- ${checklistHeading[2].trim()}`;
      if (!line.startsWith("## ") || line.length < 95) return line;
      const source = line.slice(3);
      const markers = [" Un ", " Le ", " La ", " L'", " L’", " Les ", " Si ", " En ", " Dans ", " Pour ", " À "];
      const splitAt = markers.map((marker) => source.indexOf(marker, 28)).filter((index) => index > 28).sort((a, b) => a - b)[0];
      if (!splitAt) return line;
      return `## ${source.slice(0, splitAt).trim()}\n\n${source.slice(splitAt).trim()}`;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstParagraph(markdown = "") {
  const paragraph = String(markdown)
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith("#"));
  return paragraph ? stripMarkdown(paragraph) : "";
}

function articleFromFile(fileName) {
  const { data, body } = parseFrontmatter(fs.readFileSync(path.join(ROOT, fileName), "utf8"));
  if (data.content_type !== "article" || data.published === false) return null;
  const htmlFile = String(data.source_html || fileName.replace(/\.md$/, "")).replace(/^\.?\//, "");
  const description = data.description || "Guide MD Rénov' pour préparer un projet de rénovation.";
  const title = cleanArticleTitle(data.title || fileName.replace(/\.html\.md$/, ""), description);
  return {
    ...data,
    body: normalizeArticleMarkdown(body),
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
  return fs.readdirSync(ROOT).filter((name) => name.endsWith(".html.md")).map(articleFromFile).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

function headAssets() {
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
<link rel="stylesheet" href="./styles.css?v=${ASSET_VERSION}" />`;
}

function bodyAssets() {
  return `<script src="./script.js?v=${ASSET_VERSION}" defer></script>`;
}

function footerSocialLinks(extraClass = "") {
  return `<div class="mdr-footer-socials${extraClass ? ` ${extraClass}` : ""}" aria-label="Réseaux sociaux MD Rénov'">
<a href="https://www.instagram.com/mdrenov.annecy/" target="_blank" rel="noopener noreferrer" aria-label="Instagram MD Rénov'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"></rect><circle cx="12" cy="12" r="3.5"></circle><circle class="mdr-social-dot" cx="17" cy="7" r="0.85"></circle></svg></a>
<a href="https://www.facebook.com/profile.php?id=61561365092368&ref=PROFILE_EDIT_xav_ig_profile_page_web#" target="_blank" rel="noopener noreferrer" aria-label="Facebook MD Rénov'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 8.5h2V5.2c-.35-.05-1.55-.16-2.95-.16-2.92 0-4.92 1.78-4.92 5.05v2.84H5.5v3.68h3.13V24h3.84v-7.39h3l.48-3.68h-3.48v-2.48c0-1.06.3-1.95 2.03-1.95Z"></path></svg></a>
</div>`;
}

function renderSiteFooter(mode = "home") {
  const isArticle = mode === "article";
  return `<footer class="mdr-site-footer${isArticle ? " mdr-site-footer--article" : ""}">
<div class="mdr-site-footer__main">
<section class="mdr-site-footer__brandblock" aria-label="MD Rénov'">
<p class="mdr-site-footer__eyebrow">Blog conseil menuiserie</p>
<div class="mdr-site-footer__brand">MD Rénov'</div>
<p class="mdr-site-footer__text">Guides courts pour choisir fenêtres, vitrages, isolation, volets, stores, portes et portails avant de demander un devis.</p>
<div class="mdr-site-footer__trust" aria-label="Repères de confiance"><span>Certifié RGE</span><span>20 ans d'expérience</span><span>Haute-Savoie · Savoie · Pays de Gex</span></div>
</section>
<nav class="mdr-site-footer__nav" aria-label="Navigation pied de page">
<div><p>Guides</p><a href="./fenetres-vitrages.html">Fenêtres & vitrages</a><a href="./isolation-thermique.html">Isolation</a><a href="./volets-stores.html">Volets & stores</a><a href="./portes-portails.html">Portes & portails</a></div>
<div><p>Infos pratiques</p><a href="./prix-renovation-menuiseries-haute-savoie.html">Prix & budget</a><a href="./aides-subventions.html">Aides & subventions</a><a href="./autorisation-travaux-menuiseries-haute-savoie.html">Autorisations</a><a href="./delais-pose-menuiseries-renovation.html">Délais de pose</a></div>
<div><p>MD Rénov'</p><a href="./index.html">Tous les articles</a><a href="https://www.mdrenov-menuiserie.com" target="_blank" rel="noopener noreferrer">Site principal</a><a href="./mentions-legales.html">Mentions légales</a><a href="./politique-confidentialite.html">Confidentialité</a></div>
</nav>
<section class="mdr-site-footer__action" aria-label="Demander un devis">
<p>Un projet à cadrer ?</p>
<a class="mdr-site-footer__cta" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander un devis</a>
<span>Réponse sous 48h, sans engagement.</span>
</section>
</div>
<div class="mdr-site-footer__bottom">
<p>Meythet (Annecy) · Haute-Savoie · Savoie · Pays de Gex</p>
${footerSocialLinks(isArticle ? "mdr-footer-socials--dark" : "")}
<div class="mdr-site-footer__legal"><a href="./politique-cookies.html">Cookies</a><a href="./conditions-utilisation.html">Conditions d'utilisation</a></div>
</div>
</footer>`;
}

function mediaBlock(article) {
  const label = e(article.image_alt || article.category_label || "Visuel article");
  const src = String(article.featured_image || "").trim();
  if (src) {
    const normalized = /^https?:\/\//i.test(src) ? src : `./${src.replace(/^\.?\//, "")}`;
    return `<div class="mdr-media mdr-media--article mdr-media--image"><img src="${e(normalized)}" alt="${label}" loading="eager"></div>`;
  }
  return `<div class="mdr-media mdr-media--article" aria-label="Emplacement visuel 16:10 : ${label}"><strong>${label}</strong><span>Emplacement photo 16:10</span></div>`;
}

function articleImageUrl(article) {
  const src = String(article.featured_image || "").trim();
  if (!src) return `${SITE_URL}/apple-touch-icon.png`;
  if (/^https?:\/\//i.test(src)) return src;
  return `${SITE_URL}/${src.replace(/^\.?\//, "")}`;
}

function accentTitle(title = "", article = {}) {
  const wordsByCategory = {
    aides: ["aide", "aides", "budget", "MaPrimeRénov", "MaPrimeRenov"],
    fenetres: ["fenêtres", "fenêtre", "vitrage", "PVC", "aluminium"],
    isolation: ["isolation", "chaleur", "condensation", "bruit"],
    "volets-stores": ["volet", "volets", "store", "stores", "solaire"],
    "portes-portails": ["porte", "portes", "portail", "portails", "sécurité"],
    demarches: ["autorisations", "autorisation", "PLU", "copropriété"],
    exterieur: ["pergola", "terrasse", "extérieur", "store"],
  };
  const theme = String(article.category_label || "").toLowerCase().includes("démarch") ? "demarches" : article.category;
  for (const word of wordsByCategory[theme] || ["projet"]) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\s|:|')(${escaped})(?=\\s|,|:|\\?|$)`, "i");
    if (regex.test(title)) return e(title).replace(regex, `$1<span class="mdr-title-accent">$2</span>`);
  }
  return e(title);
}

function categoryFacts(article) {
  const theme = String(article.category_label || "").toLowerCase().includes("démarch") ? "demarches" : article.category;
  const facts = {
    aides: [["À vérifier", "Éligibilité réelle", "Les aides dépendent du foyer, du logement, des travaux et de l'ordre des démarches."], ["Budget", "Reste à charge", "Le montant utile est celui qui reste à payer après aides, options, pose et finitions."], ["Condition clé", "Entreprise RGE", "La qualification et le devis doivent être vérifiés avant signature."], ["Prudence", "Ne pas signer trop tôt", "Un dossier mal ordonné peut faire perdre une aide ou retarder le chantier."]],
    fenetres: [["Confort", "Froid, bruit, lumière", "Le vitrage doit être choisi selon la pièce, l'altitude, le bruit et la luminosité."], ["Performance", "Uw, Sw, TLw", "Ces valeurs aident à comprendre l'isolation, les apports solaires et la lumière naturelle."], ["Pose", "Étanchéité décisive", "Une bonne fenêtre mal posée perd une grande partie de son intérêt."], ["Budget", "Comparer juste", "Matériau, vitrage, dépose, habillage et garanties doivent être lisibles sur le devis."]],
    isolation: [["Symptôme", "Observer avant de changer", "Courants d'air, paroi froide, condensation ou bruit n'ont pas toujours la même cause."], ["Diagnostic", "Fenêtre + ventilation", "Une menuiserie plus étanche peut révéler un problème d'air intérieur."], ["Confort", "Hiver et été", "Le bon choix doit limiter les pertes de chaleur sans dégrader le confort d'été."], ["Pose", "Détails invisibles", "Joints, tapées, coffres de volets et seuils expliquent souvent la différence de résultat."]],
    "volets-stores": [["Usage", "Soleil, sécurité, intimité", "Le bon équipement dépend d'abord de ce que vous voulez améliorer au quotidien."], ["Motorisation", "Filaire, radio ou solaire", "La solution dépend de l'accès électrique, de la façade et du confort attendu."], ["Exposition", "Chaleur et vent", "L'orientation et les rafales comptent autant que le design."], ["Devis", "Options visibles", "Coffre, tablier, coulisses, commande et garanties doivent être détaillés."]],
    "portes-portails": [["Sécurité", "Usage réel", "Le choix dépend des accès, de la fréquence d'utilisation et du niveau de protection."], ["Confort", "Manœuvre quotidienne", "Motorisation, seuil, largeur de passage et isolation changent l'expérience."], ["Façade", "Aspect extérieur", "Couleur, matériau et dimensions peuvent nécessiter une vérification."], ["Devis", "Finitions comprises", "Serrure, vitrage, motorisation, accessoires et pose doivent être inclus clairement."]],
    demarches: [["Déclencheur", "Aspect extérieur", "Couleur, matériau, dimensions ou ajout visible peuvent imposer une vérification avant travaux."], ["Mairie", "PLU et secteur", "La commune peut fixer des règles sur les teintes, formes, hauteurs ou matériaux."], ["Copropriété", "Accord à prévoir", "Un élément visible peut demander un accord même s'il est privatif."], ["Commande", "Valider avant fabrication", "Une menuiserie sur mesure commandée trop tôt peut devenir coûteuse à corriger."]],
    exterieur: [["Terrasse", "Usage et saison", "L'objectif peut être l'ombre, la pluie, le vent, la fraîcheur ou l'esthétique."], ["Structure", "Support à vérifier", "Murs, dalle, pente, évacuation et exposition changent la faisabilité."], ["Règles", "Mairie ou copropriété", "Certaines installations visibles demandent une vérification administrative."], ["Budget", "Options utiles", "Motorisation, capteurs, éclairage, coloris et finitions expliquent les écarts de prix."]],
  };
  return facts[theme] || facts.fenetres;
}

function renderKeyFacts(article) {
  return `<div class="mdr-keyfacts mdr-keyfacts--compact" aria-label="Repères à retenir">
${categoryFacts(article).map(([label, title, text]) => `<div><span>${e(label)}</span><strong>${e(title)}</strong><p>${e(text)}</p></div>`).join("\n")}
</div>`;
}

function listMode(sectionType) {
  if (sectionType === "sources") return "source";
  if (sectionType === "errors" || sectionType === "questions") return "grid";
  return "";
}

function mdToHtml(markdown = "") {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let unordered = false;
  let ordered = false;
  let table = [];
  let sectionType = "";
  let openSourceCard = false;
  let openEditorialCard = false;

  const flushParagraph = () => { if (paragraph.length) { html.push(`<p>${inline(paragraph.join(" "))}</p>`); paragraph = []; } };
  const closeLists = () => { if (unordered) { html.push("</ul>"); unordered = false; } if (ordered) { html.push("</ol>"); ordered = false; } };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line)).map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
    if (rows.length) {
      const [head, ...body] = rows;
      html.push(`<div class="mdr-table-wrap"><table class="mdr-decision-table"><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    }
    table = [];
  };
  const closeSourceCard = () => { if (openSourceCard) { html.push("</div>"); openSourceCard = false; } };
  const closeEditorialCard = () => { if (openEditorialCard) { html.push("</section>"); openEditorialCard = false; } };

  function listClass() {
    const mode = listMode(sectionType);
    if (mode === "source") return ' class="mdr-source-list"';
    if (mode === "grid") return ' class="mdr-check-grid"';
    return "";
  }

  function listItem(text) {
    const mode = listMode(sectionType);
    if (mode === "source") {
      const parts = text.split(/\s+:\s+/);
      if (parts.length > 1) return `<li>${inline(parts.shift())}<span>${inline(parts.join(" : "))}</span></li>`;
      return `<li>${inline(text)}</li>`;
    }
    if (mode === "grid") {
      const match = text.match(/^\*\*(.*?)\*\*\s*:?\s*(.*)$/);
      if (match) return `<li><strong>${inline(match[1])}</strong><span>${inline(match[2])}</span></li>`;
    }
    return `<li><span>${inline(text)}</span></li>`;
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); closeLists(); flushTable(); continue; }
    if (/^<!--\s*mdr-editorial-value-md\s*-->$/.test(line)) { flushParagraph(); closeLists(); flushTable(); closeSourceCard(); closeEditorialCard(); openEditorialCard = true; sectionType = ""; html.push('<section class="mdr-editorial-value mdr-editorial-value--from-md">'); continue; }
    if (/^<!--.*-->$/.test(line) || line.startsWith("# ")) { flushParagraph(); continue; }
    if (line.startsWith("|")) { flushParagraph(); closeLists(); table.push(line); continue; }
    if (line.startsWith("## ")) {
      flushParagraph(); closeLists(); flushTable();
      const title = stripMarkdown(line.slice(3));
      const normalized = slugify(title);
      closeSourceCard();
      if (normalized.includes("source")) { closeEditorialCard(); sectionType = "sources"; openSourceCard = true; html.push(`<div class="mdr-source-card mdr-source-card--rich" id="${e(normalized)}"><strong>${inline(line.slice(3))}</strong>`); continue; }
      if (normalized.includes("erreur") || normalized.includes("eviter")) sectionType = "errors";
      else if (normalized.includes("question")) sectionType = "questions";
      else sectionType = "";
      html.push(`<h2 id="${e(normalized)}">${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) { flushParagraph(); closeLists(); flushTable(); const title = stripMarkdown(line.slice(4)); closeSourceCard(); html.push(`<h3 id="${e(slugify(title))}">${inline(line.slice(4))}</h3>`); continue; }
    if (line.startsWith("- ")) { flushParagraph(); flushTable(); if (ordered) { html.push("</ol>"); ordered = false; } if (!unordered) { html.push(`<ul${listClass()}>`); unordered = true; } html.push(listItem(line.slice(2))); continue; }
    const orderedItem = line.match(/^\d+[\.)]\s+(.+)$/);
    if (orderedItem) { flushParagraph(); flushTable(); if (unordered) { html.push("</ul>"); unordered = false; } if (!ordered) { html.push("<ol>"); ordered = true; } html.push(listItem(orderedItem[1])); continue; }
    paragraph.push(line);
  }
  flushParagraph(); closeLists(); flushTable(); closeSourceCard(); closeEditorialCard();
  return html.join("\n");
}

function renderFooter() {
  return renderSiteFooter("article");
}

function cardTags(article, pageSlug) {
  return Array.from(new Set([
    pageSlug,
    slugify(article.category_label || ""),
    ...article.tags.map(slugify),
  ].filter(Boolean))).join(" ");
}

function listingCard(article, pageSlug) {
  const mediaLabel = e(article.image_alt || article.category_label || "Guide MD Rénov'");
  return `<article class="mdr-home-card" data-tags="${e(cardTags(article, pageSlug))}">
<a class="mdr-home-card__overlay" href="./${e(article.htmlFile)}" aria-label="Lire : ${e(article.title)}"></a>
<div class="mdr-home-media mdr-home-media--card"><strong>${mediaLabel}</strong></div>
<div class="mdr-home-card__body">
<div class="mdr-home-card__meta"><span class="mdr-home-card__tag">${e(article.category_label)}</span><span class="mdr-home-card__date">${e(formatDate(article.date))}</span></div>
<h3>${e(article.title)}</h3>
<p>${e(article.description)}</p>
<div class="mdr-home-card__foot"><a class="mdr-link" href="./${e(article.htmlFile)}">Lire</a><span class="mdr-home-card__time">${e(article.reading_time)}</span></div>
</div>
</article>`;
}

function updateCategoryListings(articles) {
  for (const [fileName, config] of Object.entries(CATEGORY_LISTINGS)) {
    const pagePath = path.join(ROOT, fileName);
    if (!fs.existsSync(pagePath)) continue;

    const listingArticles = articles
      .filter((article) => config.categories.includes(article.category))
      .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
    const grid = `<section class="mdr-listing-content">
<div class="mdr-home-grid">
${listingArticles.map((article) => listingCard(article, config.slug)).join("\n")}
</div>
</section>`;
    const html = fs.readFileSync(pagePath, "utf8");
    const updated = html.replace(/<section class="mdr-listing-content">\s*<div class="mdr-home-grid">[\s\S]*?<\/div>\s*<\/section>/, grid);
    fs.writeFileSync(pagePath, updated, "utf8");
  }
}

function updateLegacyFooters() {
  const footerPattern = /<footer class="(?:mdr-(home|article)-footer|mdr-site-footer( mdr-site-footer--article)?)">[\s\S]*?<\/footer>/g;
  for (const fileName of fs.readdirSync(ROOT).filter((name) => name.endsWith(".html"))) {
    const pagePath = path.join(ROOT, fileName);
    const html = fs.readFileSync(pagePath, "utf8");
    const updated = html.replace(footerPattern, (_match, kind, articleModifier) => renderSiteFooter(kind === "article" || articleModifier ? "article" : "home"));
    if (updated !== html) fs.writeFileSync(pagePath, updated, "utf8");
  }
}

function categoryPage(article) {
  const category = String(article.category || "").toLowerCase();
  const label = String(article.category_label || "").toLowerCase();

  if (category === "aides" || label.includes("budget") || label.includes("aides")) return "./aides-subventions.html";
  if (category === "fenetres" || label.includes("fenêtre") || label.includes("vitrage")) return "./fenetres-vitrages.html";
  if (category === "isolation" || label.includes("isolation")) return "./isolation-thermique.html";
  if (category === "volets-stores" || label.includes("volet") || label.includes("store")) return "./volets-stores.html";
  if (category === "portes-portails" || label.includes("porte") || label.includes("portail")) return "./portes-portails.html";

  return "./tous-les-articles-exterieur.html";
}

function articlePage(article, allArticles) {
  const articleUrl = pageUrl(article.htmlFile);
  const related = allArticles.filter((item) => item.htmlFile !== article.htmlFile && item.category === article.category).slice(0, 3).map((item) => ({ ...item, title: shortenText(item.title, 74) }));
  const image = articleImageUrl(article);
  const publisherLogo = `${SITE_URL}/apple-touch-icon.png`;
  const lead = article.description || firstParagraph(article.body);
  const hasCustomEditorialBlock = /<!--\s*mdr-editorial-value-md\s*-->/.test(article.body);
  const jsonLd = { "@context": "https://schema.org", "@type": "BlogPosting", headline: article.title, description: article.description, image, datePublished: article.date, dateModified: article.date, author: { "@type": "Organization", name: "MD Rénov'" }, publisher: { "@type": "Organization", name: "MD Rénov'", logo: { "@type": "ImageObject", url: publisherLogo } }, mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl }, articleSection: article.category_label, keywords: article.tags.join(", "), inLanguage: "fr-FR" };

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${e(article.seo_title || article.title)}</title>
<meta name="description" content="${e(article.description)}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${articleUrl}" />
<meta property="og:locale" content="fr_FR" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${e(article.seo_title || article.title)}" />
<meta property="og:description" content="${e(article.description)}" />
<meta property="og:url" content="${articleUrl}" />
<meta property="og:image" content="${image}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="author" content="MD Rénov'" />
${headAssets()}
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
</head>
<body class="site-page mdr-article-page" data-generated="editorial-template">
<a class="skip-link" href="#contenu">Aller au contenu</a>
<main id="contenu" class="mdr-stage"><div class="mdr-wrap">
<header class="mdr-nav"><a class="mdr-nav__brand" href="./index.html" aria-label="Retour au blog"><img src="./logo-mdr-site.svg" alt="Logo MD Rénov'" width="241" height="54" /></a><nav class="mdr-nav__links" aria-label="Navigation article"><a href="./index.html">Retour au blog</a><span>${e(article.category_label)}</span></nav><a class="mdr-btn mdr-btn--primary" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Devis gratuit</a></header>
<section class="mdr-article-head"><div class="mdr-breadcrumb"><a href="./index.html">Accueil</a><span>Blog</span><span><a href="${categoryPage(article)}">${e(article.category_label)}</a></span></div><div class="mdr-article-head__meta"><a class="mdr-card__tag" href="${categoryPage(article)}" aria-label="Voir les articles ${e(article.category_label)}">${e(article.category_label)}</a><span class="mdr-card__date">${e(formatDate(article.date))}</span><span class="mdr-card__time">${e(article.reading_time)} de lecture</span></div><h1>${accentTitle(article.title, article)}</h1><p class="mdr-article-head__excerpt">${e(article.description)}</p></section>
<section class="mdr-article-body"><article class="mdr-prose">
${mediaBlock(article)}
<div class="mdr-article-leadbox"><strong>Le point important</strong><p>${e(lead)}</p></div>
${renderKeyFacts(article)}
${mdToHtml(article.body)}
${hasCustomEditorialBlock ? "" : ""}
<div class="mdr-prose-cta"><div><strong>Vous voulez cadrer votre projet avant de signer ?</strong><span>MD Rénov' vous aide à choisir la solution utile, adaptée au logement et au budget.</span></div><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Faire le point</a></div>
</article><aside class="mdr-sidebar"><section class="mdr-cta-box"><h3>Un projet en Haute-Savoie ou Savoie ?</h3><p>Devis gratuit sous 48h, conseils clairs et accompagnement local en Haute-Savoie et Savoie par MD Rénov'.</p><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander mon devis</a><div class="mdr-cta-box__badges"><span>RGE certifié</span><span>Annecy · Chambéry · Savoie</span></div></section>${related.length ? `<section class="mdr-sidepanel"><h4>Articles similaires</h4><div class="mdr-sidelinks">${related.map((item) => `<a class="mdr-sidelink" href="./${e(item.htmlFile)}"><span class="mdr-sidelink__cat">${e(item.category_label)}</span><strong>${e(item.title)}</strong></a>`).join("")}</div></section>` : ""}</aside></section>
${renderFooter()}
</div></main>
${bodyAssets()}
</body>
</html>`;
}

function updateSitemap(articles) {
  const htmlFiles = fs.readdirSync(ROOT)
    .filter((name) => name.endsWith(".html") && !SITEMAP_EXCLUDE.has(name))
    .map(cleanPath);
  const articlePaths = articles
    .filter((article) => !SITEMAP_EXCLUDE.has(article.htmlFile))
    .map((article) => cleanPath(article.htmlFile));
  const urls = Array.from(new Set([...htmlFiles, ...articlePaths]));
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((file) => `  <url><loc>${SITE_URL}${file ? `/${file}` : ""}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`, "utf8");
}

function updateLlms(articles) {
  const lines = ["# Blog MD Rénov'", "", "Guides rénovation, menuiseries, aides, isolation, volets, stores, pergolas, portes et portails en Haute-Savoie et Savoie.", "", "## Articles", ...articles.map((article) => `- [${article.title}](${pageUrl(article.htmlFile)}) - ${article.description}`), ""];
  fs.writeFileSync(path.join(ROOT, "llms.txt"), lines.join("\n"), "utf8");
}

const articles = loadArticles();
for (const article of articles) {
  if (HANDCRAFTED_PAGES.has(article.htmlFile)) continue;
  fs.writeFileSync(path.join(ROOT, article.htmlFile), articlePage(article, articles), "utf8");
}
updateCategoryListings(articles);
updateLegacyFooters();
updateSitemap(articles);
updateLlms(articles);
console.log(`Build éditorial terminé : ${articles.length} article(s), ${HANDCRAFTED_PAGES.size} page(s) protégée(s).`);
