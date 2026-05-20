const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://blog.mdrenov-menuiserie.com";

// Pages éditoriales faites à la main : elles servent de référence UX et ne doivent
// jamais être réécrites automatiquement par le build.
const HANDCRAFTED_PAGES = new Set(["maprimerenov-2026-haute-savoie.html"]);

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

function articleFromFile(fileName) {
  const { data, body } = readFrontmatterText(fs.readFileSync(path.join(ROOT, fileName), "utf8"));
  if (data.content_type !== "article" || data.published === false) return null;

  const htmlFile = String(data.source_html || fileName.replace(/\.md$/, "")).replace(/^\.?\//, "");
  const title = data.title || fileName.replace(/\.html\.md$/, "");
  const description = data.description || "Guide MD Rénov' pour préparer un projet de rénovation.";

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
  return fs
    .readdirSync(ROOT)
    .filter((name) => name.endsWith(".html.md"))
    .map(articleFromFile)
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
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

function firstParagraph(markdown = "") {
  const paragraph = String(markdown)
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith("#"));
  if (!paragraph) return "";
  return stripMarkdown(paragraph);
}

function withoutFirstParagraph(markdown = "") {
  let removed = false;
  return String(markdown)
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .filter((block) => {
      const trimmed = block.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith("#")) return true;
      if (!removed) {
        removed = true;
        return false;
      }
      return true;
    })
    .join("\n\n");
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
  const candidates = wordsByCategory[theme] || ["projet"];
  for (const word of candidates) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\s|:|')(${escaped})(?=\\s|,|:|\\?|$)`, "i");
    if (regex.test(title)) {
      return escapeHtml(title).replace(regex, `$1<span class="mdr-title-accent">$2</span>`);
    }
  }
  return escapeHtml(title);
}

function categoryFacts(article) {
  const common = [
    ["Avant devis", "Cadrer le besoin", "La bonne réponse dépend du logement, de l'exposition, de l'usage quotidien et des contraintes de pose."],
    ["À comparer", "Produit + pose", "Deux devis ne se comparent pas seulement au prix : vitrage, accessoires, finitions et garanties changent le résultat."],
    ["Point local", "Haute-Savoie et Savoie", "Froid, soleil, vent, bruit et règles de façade peuvent modifier le choix technique."],
    ["Décision", "Choisir utile", "L'objectif est de payer la bonne performance, pas l'option la plus chère ou la plus tendance."],
  ];
  const byCategory = {
    aides: [
      ["À vérifier", "Éligibilité réelle", "Les aides dépendent du foyer, du logement, des travaux et de l'ordre des démarches."],
      ["Budget", "Reste à charge", "Le montant utile est celui qui reste à payer après aides, options, pose et finitions."],
      ["Condition clé", "Entreprise RGE", "Pour les aides énergie, la qualification et le devis doivent être vérifiés avant signature."],
      ["Prudence", "Ne pas signer trop tôt", "Un dossier mal ordonné peut faire perdre une aide ou retarder le chantier."],
    ],
    fenetres: [
      ["Confort", "Froid, bruit, lumière", "Le vitrage doit être choisi selon la pièce : exposition, altitude, bruit et luminosité."],
      ["Performance", "Uw, Sw, TLw", "Ces valeurs aident à comprendre l'isolation, les apports solaires et la lumière naturelle."],
      ["Pose", "Étanchéité décisive", "Une bonne fenêtre mal posée perd une grande partie de son intérêt."],
      ["Budget", "Comparer à périmètre égal", "Matériau, vitrage, dépose, habillage et garanties doivent être lisibles sur le devis."],
    ],
    isolation: [
      ["Symptôme", "Observer avant de changer", "Courants d'air, paroi froide, condensation ou bruit n'ont pas toujours la même cause."],
      ["Diagnostic", "Fenêtre + ventilation", "Une menuiserie plus étanche peut révéler un problème d'air intérieur ou de pont thermique."],
      ["Confort", "Hiver et été", "Le bon choix doit limiter les pertes de chaleur sans dégrader la lumière ni le confort d'été."],
      ["Pose", "Détails invisibles", "Joints, tapées, coffres de volets et seuils expliquent souvent la différence de résultat."],
    ],
    "volets-stores": [
      ["Usage", "Soleil, sécurité, intimité", "Le bon équipement dépend d'abord de ce que vous voulez améliorer au quotidien."],
      ["Motorisation", "Filaire, radio ou solaire", "La solution dépend de l'accès électrique, de la façade et du confort attendu."],
      ["Exposition", "Chaleur et vent", "En Haute-Savoie et Savoie, l'orientation et les rafales comptent autant que le design."],
      ["Devis", "Options visibles", "Coffre, tablier, coulisses, commande et garanties doivent être détaillés."],
    ],
    "portes-portails": [
      ["Sécurité", "Usage réel", "Porte, portail ou garage doivent être choisis selon les accès, la fréquence d'utilisation et le niveau de protection."],
      ["Confort", "Manœuvre quotidienne", "Motorisation, seuil, largeur de passage et isolation changent fortement l'expérience."],
      ["Façade", "Aspect extérieur", "Couleur, matériau et dimensions peuvent nécessiter une vérification en mairie ou copropriété."],
      ["Devis", "Finitions comprises", "Serrure, vitrage, motorisation, accessoires et pose doivent être inclus clairement."],
    ],
    demarches: [
      ["Déclencheur", "Aspect extérieur", "Couleur, matériau, dimensions ou ajout visible peuvent imposer une vérification avant travaux."],
      ["Mairie", "PLU et secteur", "La commune peut fixer des règles sur les teintes, les formes, les hauteurs ou les matériaux."],
      ["Copropriété", "Accord à prévoir", "Un élément visible depuis l'extérieur peut demander un accord même s'il est privatif."],
      ["Commande", "Valider avant fabrication", "Une menuiserie sur mesure commandée trop tôt peut devenir coûteuse à corriger."],
    ],
    exterieur: [
      ["Terrasse", "Usage et saison", "L'objectif peut être l'ombre, la pluie, le vent, la fraîcheur ou l'esthétique de façade."],
      ["Structure", "Support à vérifier", "Murs, dalle, pente, évacuation et exposition changent la faisabilité."],
      ["Règles", "Mairie ou copropriété", "Certaines installations visibles demandent une vérification administrative avant commande."],
      ["Budget", "Options utiles", "Motorisation, capteurs, éclairage, coloris et finitions expliquent les écarts de prix."],
    ],
  };
  const theme = String(article.category_label || "").toLowerCase().includes("démarch") ? "demarches" : article.category;
  return byCategory[theme] || common;
}

function renderKeyFacts(article) {
  return `<div class="mdr-keyfacts mdr-keyfacts--compact" aria-label="Repères à retenir">
${categoryFacts(article).map(([label, title, text]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`).join("\n")}
</div>`;
}

function renderDecisionBlock(article) {
  const grids = {
    aides: [
      ["Montant", "Estimer les aides possibles", "Le bon chiffrage doit distinguer aide théorique, devis réel et reste à charge."],
      ["Dossier", "Vérifier avant signature", "Le calendrier des demandes compte autant que le choix du produit."],
      ["Projet", "Ne pas raisonner uniquement par aide", "Une menuiserie doit aussi répondre au froid, au bruit, à la sécurité et à l'esthétique."],
    ],
    fenetres: [
      ["Vitrage", "Adapter pièce par pièce", "Une chambre froide au nord ne demande pas le même vitrage qu'une baie plein sud."],
      ["Matériau", "PVC, aluminium, bois ou mixte", "Le choix dépend du budget, du style, de l'entretien et des dimensions."],
      ["Pose", "Regarder le détail du chantier", "Dormant, étanchéité, habillages et reprises expliquent souvent l'écart entre deux devis."],
    ],
    isolation: [
      ["Cause", "Identifier le vrai problème", "Le froid peut venir du vitrage, du cadre, de la pose, du coffre de volet ou de la ventilation."],
      ["Confort", "Ne pas créer un nouveau défaut", "Une maison plus étanche doit conserver un renouvellement d'air correct."],
      ["Priorité", "Agir dans le bon ordre", "Traiter fenêtres, ventilation et ponts thermiques évite les travaux décevants."],
    ],
    "volets-stores": [
      ["Protection", "Choisir selon l'exposition", "Soleil rasant, chaleur, vent et intimité orientent le type de volet ou de store."],
      ["Commande", "Penser usage quotidien", "Une motorisation adaptée peut changer le confort sans forcément complexifier le chantier."],
      ["Façade", "Garder une cohérence", "Coffres, coulisses, coloris et dimensions doivent rester harmonieux."],
    ],
    "portes-portails": [
      ["Accès", "Penser passage et sécurité", "Le bon choix dépend du passage quotidien, du niveau d'isolation et de la protection attendue."],
      ["Motorisation", "Prévoir l'alimentation", "Portail ou garage motorisé demande d'anticiper câblage, commandes et sécurité."],
      ["Esthétique", "Respecter la façade", "Couleur, matériau et style doivent rester cohérents avec la maison et les règles locales."],
    ],
    demarches: [
      ["Mairie", "Vérifier avant la couleur", "Un changement visible peut demander une déclaration préalable ou une validation du PLU."],
      ["Copropriété", "Faire valider ce qui se voit", "Fenêtres, volets, stores ou portes peuvent modifier l'harmonie de façade."],
      ["Fabrication", "Ne pas lancer trop tôt", "La commande sur mesure doit venir après les validations utiles, pas avant."],
    ],
    exterieur: [
      ["Exposition", "Commencer par l'usage", "Ombre, pluie, vent, chaleur et intimité ne se traitent pas avec les mêmes options."],
      ["Technique", "Vérifier le support", "Murs, dalle, pente, fixation et évacuation conditionnent la solution possible."],
      ["Autorisation", "Anticiper les règles", "Une installation visible peut nécessiter mairie ou accord de copropriété."],
    ],
  };
  const theme = String(article.category_label || "").toLowerCase().includes("démarch") ? "demarches" : article.category;
  const items = grids[theme] || grids.fenetres;
  return `<section class="mdr-editorial-value">
<h2>Ce qui change vraiment la décision</h2>
<p>Ce guide sert à comprendre les critères qui font varier le prix, le confort et la pertinence du choix avant de demander ou comparer un devis.</p>
<div class="mdr-value-grid">
${items.map(([label, title, text]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`).join("\n")}
</div>
</section>`;
}

function renderFooter() {
  return `<footer class="mdr-article-footer">
<div><div class="mdr-article-footer__identity"><div class="mdr-article-footer__brand">MD Rénov'</div><div class="mdr-footer-socials mdr-footer-socials--dark" aria-label="Réseaux sociaux MD Rénov'">
<a href="https://www.instagram.com/mdrenov.annecy/" target="_blank" rel="noopener noreferrer" aria-label="Instagram MD Rénov'">
<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"></rect><circle cx="12" cy="12" r="3.5"></circle><circle class="mdr-social-dot" cx="17" cy="7" r="0.85"></circle></svg>
</a>
<a href="https://www.facebook.com/profile.php?id=61561365092368&ref=PROFILE_EDIT_xav_ig_profile_page_web#" target="_blank" rel="noopener noreferrer" aria-label="Facebook MD Rénov'">
<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 8.5h2V5.2c-.35-.05-1.55-.16-2.95-.16-2.92 0-4.92 1.78-4.92 5.05v2.84H5.5v3.68h3.13V24h3.84v-7.39h3l.48-3.68h-3.48v-2.48c0-1.06.3-1.95 2.03-1.95Z"></path></svg>
</a>
</div></div><div class="mdr-article-footer__sub">Meythet (Annecy) · Haute-Savoie · Savoie · Pays de Gex</div></div>
<div class="mdr-article-footer__links">
<a href="./index.html">Tous les articles</a>
<a href="https://www.mdrenov-menuiserie.com" target="_blank" rel="noopener noreferrer">Site principal</a>
<a href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Contact</a>
<a href="./mentions-legales.html">Mentions légales</a>
<a href="./politique-confidentialite.html">Confidentialité</a>
<a href="./politique-cookies.html">Cookies</a>
<a href="./conditions-utilisation.html">Conditions d'utilisation</a>
</div>
</footer>`;
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
  let sectionType = "";
  let openSourceCard = false;
  let openEditorialCard = false;
  let skipSection = false;

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
      .map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
    if (rows.length) {
      const [head, ...body] = rows;
      html.push(`<div class="mdr-table-wrap"><table class="mdr-decision-table"><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
    }
    table = [];
  }

  function closeSourceCard() {
    if (openSourceCard) {
      html.push("</div>");
      openSourceCard = false;
    }
  }

  function closeEditorialCard() {
    if (openEditorialCard) {
      html.push("</section>");
      openEditorialCard = false;
    }
  }

  function listMode() {
    if (sectionType === "sources") return "source";
    if (sectionType === "errors" || sectionType === "checklist" || sectionType === "questions") return "grid";
    return "";
  }

  function listClass() {
    const mode = listMode();
    if (mode === "source") return ' class="mdr-source-list"';
    if (mode === "grid") return ' class="mdr-check-grid"';
    return "";
  }

  function listItem(text) {
    const mode = listMode();
    if (mode === "source") {
      const parts = text.split(/\s+:\s+/);
      if (parts.length > 1) {
        return `<li>${inline(parts.shift())}<span>${inline(parts.join(" : "))}</span></li>`;
      }
      return `<li>${inline(text)}</li>`;
    }
    if (mode === "grid") {
      const match = text.match(/^\*\*(.*?)\*\*\s*:?\s*(.*)$/);
      if (match) {
        return `<li><strong>${inline(match[1])}</strong><span>${inline(match[2])}</span></li>`;
      }
    }
    return `<li><span>${inline(text)}</span></li>`;
  }

  for (const raw of lines) {
    const line = raw.trim();

    if (/^##\s+Repères rapides\s*$/i.test(line)) {
      flushParagraph();
      closeLists();
      flushTable();
      closeSourceCard();
      skipSection = true;
      sectionType = "";
      continue;
    }

    if (skipSection) {
      if (line.startsWith("## ") || line.startsWith("# ")) {
        skipSection = false;
      } else {
        continue;
      }
    }

    if (!line) {
      flushParagraph();
      closeLists();
      flushTable();
      continue;
    }

    if (/^<!--\s*mdr-editorial-value-md\s*-->$/.test(line)) {
      flushParagraph();
      closeLists();
      flushTable();
      closeSourceCard();
      closeEditorialCard();
      openEditorialCard = true;
      sectionType = "";
      html.push('<section class="mdr-editorial-value mdr-editorial-value--from-md">');
      continue;
    }

    if (/^<!--.*-->$/.test(line)) {
      flushParagraph();
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
      closeSourceCard();
      const normalized = slugify(title);
      if (normalized.includes("source")) {
        closeEditorialCard();
        sectionType = "sources";
        openSourceCard = true;
        html.push(`<div class="mdr-source-card mdr-source-card--rich" id="${escapeHtml(normalized)}"><strong>${inline(line.slice(3))}</strong>`);
        continue;
      }
      if (normalized.includes("erreur") || normalized.includes("eviter")) sectionType = "errors";
      else if (normalized.includes("checklist") || normalized.includes("preparer")) sectionType = "checklist";
      else if (normalized.includes("question")) sectionType = "questions";
      else sectionType = "";
      html.push(`<h2 id="${escapeHtml(normalized)}">${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      closeLists();
      flushTable();
      const title = stripMarkdown(line.slice(4));
      closeSourceCard();
      html.push(`<h3 id="${escapeHtml(slugify(title))}">${inline(line.slice(4))}</h3>`);
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
        html.push(`<ul${listClass()}>`);
        unordered = true;
      }
      html.push(listItem(line.slice(2)));
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
      html.push(listItem(orderedItem[1]));
      continue;
    }
    paragraph.push(line);
  }

  flushParagraph();
  closeLists();
  flushTable();
  closeSourceCard();
  closeEditorialCard();
  return html.join("\n");
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
<link rel="stylesheet" href="./styles.css" />`;
}

function articlePage(article, allArticles) {
  const articleUrl = `${SITE_URL}/${article.htmlFile}`;
  const related = allArticles.filter((item) => item.htmlFile !== article.htmlFile && item.category === article.category).slice(0, 4);
  const image = `${SITE_URL}/apple-touch-icon.png`;
  const lead = firstParagraph(article.body) || article.description;
  const editorialBody = withoutFirstParagraph(article.body);
  const hasCustomEditorialBlock = /<!--\s*mdr-editorial-value-md\s*-->/.test(article.body);
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
<meta name="twitter:card" content="summary_large_image" />
<meta name="author" content="MD Rénov'" />
${headAssets()}
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
</head>
<body class="site-page mdr-article-page" data-generated="editorial-template">
<a class="skip-link" href="#contenu">Aller au contenu</a>
<main id="contenu" class="mdr-stage"><div class="mdr-wrap">
<header class="mdr-nav"><a class="mdr-nav__brand" href="./index.html" aria-label="Retour au blog"><img src="./logo-mdr-site.svg" alt="Logo MD Rénov'" width="241" height="54" /></a><nav class="mdr-nav__links" aria-label="Navigation article"><a href="./index.html">Retour au blog</a><span>${escapeHtml(article.category_label)}</span></nav><a class="mdr-btn mdr-btn--primary" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Devis gratuit</a></header>
<section class="mdr-article-head"><div class="mdr-breadcrumb"><a href="./index.html">Accueil</a><span>Blog</span><span>${escapeHtml(article.category_label)}</span></div><div class="mdr-article-head__meta"><span class="mdr-card__tag">${escapeHtml(article.category_label)}</span><span class="mdr-card__date">${escapeHtml(formatDate(article.date))}</span><span class="mdr-card__time">${escapeHtml(article.reading_time)} de lecture</span></div><h1>${accentTitle(article.title, article)}</h1><p class="mdr-article-head__excerpt">${escapeHtml(article.description)}</p></section>
<section class="mdr-article-body"><article class="mdr-prose">
${mediaBlock(article)}
<div class="mdr-article-leadbox"><strong>Le point important</strong><p>${escapeHtml(lead)}</p></div>
${renderKeyFacts(article)}
${mdToHtml(editorialBody)}
${hasCustomEditorialBlock ? "" : renderDecisionBlock(article)}
<div class="mdr-prose-cta"><div><strong>Vous voulez cadrer votre projet avant de signer ?</strong><span>MD Rénov' vous aide à choisir la solution utile, adaptée au logement et au budget.</span></div><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Faire le point</a></div>
</article><aside class="mdr-sidebar"><section class="mdr-cta-box"><h3>Un projet en Haute-Savoie ou Savoie ?</h3><p>Devis gratuit sous 48h, conseils clairs et accompagnement local en Haute-Savoie et Savoie par MD Rénov'.</p><a class="mdr-btn mdr-btn--white" href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Demander mon devis</a><div class="mdr-cta-box__badges"><span>RGE certifié</span><span>Annecy · Chambéry · Savoie</span></div></section>${related.length ? `<section class="mdr-sidepanel"><h4>Articles similaires</h4><div class="mdr-sidelinks">${related.map((item) => `<a class="mdr-sidelink" href="./${escapeHtml(item.htmlFile)}"><span class="mdr-sidelink__cat">${escapeHtml(item.category_label)}</span><strong>${escapeHtml(item.title)}</strong></a>`).join("")}</div></section>` : ""}</aside></section>
${renderFooter()}
</div></main>
</body>
</html>`;
}

function updateSitemap(articles) {
  const htmlFiles = fs.readdirSync(ROOT).filter((name) => name.endsWith(".html")).map((name) => (name === "index.html" ? "" : name));
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

const articles = loadArticles();
for (const article of articles) {
  if (HANDCRAFTED_PAGES.has(article.htmlFile)) continue;
  fs.writeFileSync(path.join(ROOT, article.htmlFile), articlePage(article, articles), "utf8");
}
updateSitemap(articles);
updateLlms(articles);

console.log(`Build éditorial terminé : ${articles.length} article(s), ${HANDCRAFTED_PAGES.size} page(s) protégée(s).`);
