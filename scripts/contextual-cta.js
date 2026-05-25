const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONTACT_URL = "https://www.mdrenov-menuiserie.com/contact#Contact-Form";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ctaFor(label = "", title = "") {
  const text = `${label} ${title}`.toLowerCase();

  if (text.includes("aides") || text.includes("budget")) {
    return ["Besoin de chiffrer votre projet ?", "Aides, budget, priorités de travaux : MD Rénov' vous aide à cadrer les bons postes avant de demander un devis.", "Faire le point budget"];
  }

  if (text.includes("fenêtre") || text.includes("vitrage")) {
    return ["Vos fenêtres sont à remplacer ?", "Matériau, vitrage, type de pose et confort thermique : faites valider les bons choix avant de commander.", "Demander un avis fenêtre"];
  }

  if (text.includes("isolation") || text.includes("condensation") || text.includes("bruit")) {
    return ["Froid, bruit ou condensation ?", "Un diagnostic clair permet d'éviter de changer une menuiserie sans traiter la vraie cause du problème.", "Demander un diagnostic"];
  }

  if (text.includes("volet") || text.includes("store")) {
    return ["Stores ou volets : besoin d'arbitrer ?", "Protection solaire, sécurité, motorisation, façade : MD Rénov' vous aide à choisir la solution adaptée à votre usage.", "Parler de mon projet"];
  }

  if (text.includes("porte") || text.includes("portail")) {
    return ["Porte ou portail à sécuriser ?", "Accès, isolation, motorisation et sécurité : faites cadrer votre projet avant de comparer les devis.", "Demander un conseil"];
  }

  if (text.includes("pergola") || text.includes("moustiquaire") || text.includes("démarche")) {
    return ["Un projet extérieur à cadrer ?", "Contraintes de façade, usage quotidien, autorisations et exposition : vérifiez les points clés avant de vous lancer.", "Cadrer mon projet"];
  }

  return ["Un projet en Haute-Savoie ou Savoie ?", "Devis gratuit sous 48h, conseils clairs et accompagnement local par MD Rénov'.", "Demander mon devis"];
}

function blockFor(label, pageTitle) {
  const [title, text, button] = ctaFor(label, pageTitle);
  return `<section class="mdr-cta-box"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p><a class="mdr-btn mdr-btn--white" href="${CONTACT_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(button)}</a><div class="mdr-cta-box__badges"><span>Certifié RGE FERVAM</span><span>Annecy · Aix-les-Bains · Chambéry</span></div></section>`;
}

let count = 0;
for (const file of fs.readdirSync(ROOT).filter((name) => name.endsWith(".html"))) {
  const filePath = path.join(ROOT, file);
  let html = fs.readFileSync(filePath, "utf8");
  if (!html.includes('class="mdr-cta-box"')) continue;

  const label = html.match(/<span class="mdr-card__tag">([^<]+)<\/span>/)?.[1] || "";
  const pageTitle = html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, " ") || "";
  const next = html.replace(/<section class="mdr-cta-box">[\s\S]*?<\/section>/, blockFor(label, pageTitle));

  if (next !== html) {
    fs.writeFileSync(filePath, next, "utf8");
    count += 1;
  }
}

console.log(`CTA contextuels appliqués : ${count} page(s).`);
