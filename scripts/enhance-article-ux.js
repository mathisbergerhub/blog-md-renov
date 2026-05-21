const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HANDCRAFTED = new Set(["maprimerenov-2026-haute-savoie.html"]);

function esc(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function categoryKey(label = "") {
  const value = label.toLowerCase();
  if (value.includes("aide") || value.includes("budget")) return "aides";
  if (value.includes("fen")) return "fenetres";
  if (value.includes("isol")) return "isolation";
  if (value.includes("volet") || value.includes("store")) return "volets";
  if (value.includes("porte") || value.includes("portail")) return "portes";
  return "exterieur";
}

const facts = {
  aides: [
    ["À vérifier", "Éligibilité réelle", "Les aides dépendent du foyer, du logement, des travaux et de l'ordre des démarches."],
    ["Budget", "Reste à charge", "Le montant utile est celui qui reste à payer après aides, options, pose et finitions."],
    ["Condition clé", "Entreprise RGE", "Pour les aides énergie, la qualification et le devis doivent être vérifiés avant signature."],
    ["Prudence", "Ne pas signer trop tôt", "Un dossier mal ordonné peut faire perdre une aide ou retarder le chantier."]
  ],
  fenetres: [
    ["Confort", "Froid, bruit, lumière", "Le vitrage doit être choisi selon la pièce : exposition, altitude, bruit et luminosité."],
    ["Performance", "Uw, Sw, TLw", "Ces valeurs aident à comprendre l'isolation, les apports solaires et la lumière naturelle."],
    ["Pose", "Étanchéité décisive", "Une bonne fenêtre mal posée perd une grande partie de son intérêt."],
    ["Budget", "Comparer à périmètre égal", "Matériau, vitrage, dépose, habillage et garanties doivent être lisibles sur le devis."]
  ],
  isolation: [
    ["Symptôme", "Observer avant de changer", "Courants d'air, paroi froide, condensation ou bruit n'ont pas toujours la même cause."],
    ["Diagnostic", "Fenêtre + ventilation", "Une menuiserie plus étanche peut révéler un problème d'air intérieur ou de pont thermique."],
    ["Confort", "Hiver et été", "Le bon choix doit limiter les pertes de chaleur sans dégrader la lumière ni le confort d'été."],
    ["Pose", "Détails invisibles", "Joints, tapées, coffres de volets et seuils expliquent souvent la différence de résultat."]
  ],
  volets: [
    ["Usage", "Soleil, sécurité, intimité", "Le bon équipement dépend d'abord de ce que vous voulez améliorer au quotidien."],
    ["Motorisation", "Filaire, radio ou solaire", "La solution dépend de l'accès électrique, de la façade et du confort attendu."],
    ["Exposition", "Chaleur et vent", "En Haute-Savoie et Savoie, l'orientation et les rafales comptent autant que le design."],
    ["Devis", "Options visibles", "Coffre, tablier, coulisses, commande et garanties doivent être détaillés."]
  ],
  portes: [
    ["Sécurité", "Usage réel", "Porte, portail ou garage doivent être choisis selon les accès et le niveau de protection."],
    ["Confort", "Manœuvre quotidienne", "Motorisation, seuil, largeur de passage et isolation changent fortement l'expérience."],
    ["Façade", "Aspect extérieur", "Couleur, matériau et dimensions peuvent nécessiter une vérification en mairie ou copropriété."],
    ["Devis", "Finitions comprises", "Serrure, vitrage, motorisation, accessoires et pose doivent être inclus clairement."]
  ],
  exterieur: [
    ["Terrasse", "Usage et saison", "L'objectif peut être l'ombre, la pluie, le vent, la fraîcheur ou l'esthétique de façade."],
    ["Structure", "Support à vérifier", "Murs, dalle, pente, évacuation et exposition changent la faisabilité."],
    ["Règles", "Mairie ou copropriété", "Certaines installations visibles demandent une vérification administrative avant commande."],
    ["Budget", "Options utiles", "Motorisation, capteurs, éclairage, coloris et finitions expliquent les écarts de prix."]
  ]
};

const decisions = {
  aides: [
    ["Montant", "Estimer les aides possibles", "Le bon chiffrage distingue l'aide théorique, le devis réel et le reste à charge."],
    ["Dossier", "Vérifier avant signature", "Le calendrier des demandes compte autant que le choix du produit."],
    ["Projet", "Ne pas raisonner uniquement par aide", "Une menuiserie doit aussi répondre au froid, au bruit, à la sécurité et à l'esthétique."]
  ],
  fenetres: [
    ["Vitrage", "Adapter pièce par pièce", "Une chambre froide au nord ne demande pas le même vitrage qu'une baie plein sud."],
    ["Matériau", "PVC, aluminium, bois ou mixte", "Le choix dépend du budget, du style, de l'entretien et des dimensions."],
    ["Pose", "Regarder le détail du chantier", "Dormant, étanchéité, habillages et reprises expliquent souvent l'écart entre deux devis."]
  ],
  isolation: [
    ["Cause", "Identifier le vrai problème", "Le froid peut venir du vitrage, du cadre, de la pose, du coffre de volet ou de la ventilation."],
    ["Confort", "Ne pas créer un nouveau défaut", "Une maison plus étanche doit conserver un renouvellement d'air correct."],
    ["Priorité", "Agir dans le bon ordre", "Traiter fenêtres, ventilation et ponts thermiques évite les travaux décevants."]
  ],
  volets: [
    ["Protection", "Choisir selon l'exposition", "Soleil rasant, chaleur, vent et intimité orientent le type de volet ou de store."],
    ["Commande", "Penser usage quotidien", "Une motorisation adaptée peut changer le confort sans complexifier le chantier."],
    ["Façade", "Garder une cohérence", "Coffres, coulisses, coloris et dimensions doivent rester harmonieux."]
  ],
  portes: [
    ["Accès", "Penser passage et sécurité", "Le bon choix dépend du passage quotidien, du niveau d'isolation et de la protection attendue."],
    ["Motorisation", "Prévoir l'alimentation", "Portail ou garage motorisé demande d'anticiper câblage, commandes et sécurité."],
    ["Esthétique", "Respecter la façade", "Couleur, matériau et style doivent rester cohérents avec la maison et les règles locales."]
  ],
  exterieur: [
    ["Exposition", "Commencer par l'usage", "Ombre, pluie, vent, chaleur et intimité ne se traitent pas avec les mêmes options."],
    ["Technique", "Vérifier le support", "Murs, dalle, pente, fixation et évacuation conditionnent la solution possible."],
    ["Autorisation", "Anticiper les règles", "Une installation visible peut nécessiter mairie ou accord de copropriété."]
  ]
};

function keyFactsHtml(key) {
  return `<div class="mdr-keyfacts mdr-keyfacts--compact" aria-label="Repères à retenir">${(facts[key] || facts.exterieur).map(([label, title, text]) => `<div><span>${esc(label)}</span><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`).join("")}</div>`;
}

function decisionHtml(key) {
  return `<section class="mdr-editorial-value"><h2>Ce qui change vraiment la décision</h2><p>Ce guide sert à comprendre les critères qui font varier le prix, le confort et la pertinence du choix avant de demander ou comparer un devis.</p><div class="mdr-value-grid">${(decisions[key] || decisions.exterieur).map(([label, title, text]) => `<div><span>${esc(label)}</span><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`).join("")}</div></section>`;
}

function footerHtml() {
  return `<footer class="mdr-article-footer"><div><div class="mdr-article-footer__identity"><div class="mdr-article-footer__brand">MD Rénov'</div><div class="mdr-footer-socials mdr-footer-socials--dark" aria-label="Réseaux sociaux MD Rénov'"><a href="https://www.instagram.com/mdrenov.annecy/" target="_blank" rel="noopener noreferrer" aria-label="Instagram MD Rénov'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"></rect><circle cx="12" cy="12" r="3.5"></circle><circle class="mdr-social-dot" cx="17" cy="7" r="0.85"></circle></svg></a><a href="https://www.facebook.com/profile.php?id=61561365092368&ref=PROFILE_EDIT_xav_ig_profile_page_web#" target="_blank" rel="noopener noreferrer" aria-label="Facebook MD Rénov'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 8.5h2V5.2c-.35-.05-1.55-.16-2.95-.16-2.92 0-4.92 1.78-4.92 5.05v2.84H5.5v3.68h3.13V24h3.84v-7.39h3l.48-3.68h-3.48v-2.48c0-1.06.3-1.95 2.03-1.95Z"></path></svg></a></div></div><div class="mdr-article-footer__sub">Meythet (Annecy) · Haute-Savoie · Savoie · Pays de Gex</div></div><div class="mdr-article-footer__links"><a href="./index.html">Tous les articles</a><a href="https://www.mdrenov-menuiserie.com" target="_blank" rel="noopener noreferrer">Site principal</a><a href="https://www.mdrenov-menuiserie.com/contact#Contact-Form" target="_blank" rel="noopener noreferrer">Contact</a><a href="./mentions-legales.html">Mentions légales</a><a href="./politique-confidentialite.html">Confidentialité</a><a href="./politique-cookies.html">Cookies</a><a href="./conditions-utilisation.html">Conditions d'utilisation</a></div></footer>`;
}

function accentTitle(html, key) {
  const words = {
    aides: ["aide", "aides", "budget", "MaPrimeRénov", "MaPrimeRenov"],
    fenetres: ["fenêtres", "fenêtre", "vitrage", "PVC", "aluminium"],
    isolation: ["isolation", "chaleur", "condensation", "bruit"],
    volets: ["volet", "volets", "store", "stores", "solaire"],
    portes: ["porte", "portes", "portail", "portails", "sécurité"],
    exterieur: ["pergola", "terrasse", "extérieur", "store"]
  }[key] || ["projet"];

  return html.replace(/<h1>([\s\S]*?)<\/h1>/, (match, title) => {
    if (title.includes("mdr-title-accent")) return match;
    for (const word of words) {
      const re = new RegExp(`(^|\\s|:|')(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=\\s|,|:|\\?|$)`, "i");
      if (re.test(title)) return `<h1>${title.replace(re, `$1<span class="mdr-title-accent">$2</span>`)}</h1>`;
    }
    return match;
  });
}

function convertSourceLists(html) {
  return html.replace(/<h2 id="sources[^"]*">([\s\S]*?)<\/h2>\s*<ul>([\s\S]*?)<\/ul>/g, (_, title, list) => {
    const converted = list.replace(/<li><span>([\s\S]*?)<\/span><\/li>/g, (item, body) => {
      const parts = body.split(/\s+:\s+/);
      if (parts.length > 1) return `<li>${parts.shift()}<span>${parts.join(" : ")}</span></li>`;
      return item;
    });
    return `<div class="mdr-source-card mdr-source-card--rich"><strong>${title}</strong><ul class="mdr-source-list">${converted}</ul></div>`;
  });
}

function convertUsefulLists(html) {
  return html.replace(/(<h2 id="[^"]*(?:erreur|eviter|question|preparer|checklist)[^"]*">[\s\S]*?<\/h2>\s*)<ul>([\s\S]*?)<\/ul>/g, (match, head, list) => {
    const converted = list.replace(/<li><span><strong>([\s\S]*?)<\/strong>\s*:?\s*([\s\S]*?)<\/span><\/li>/g, `<li><strong>$1</strong><span>$2</span></li>`);
    return `${head}<ul class="mdr-check-grid">${converted}</ul>`;
  });
}

function enhanceSidebar(html) {
  html = html.replace(/<section class="mdr-side-cta"><h2>([\s\S]*?)<\/h2>([\s\S]*?)<\/section>/, (match, title, rest) => {
    if (rest.includes("mdr-cta-box__badges")) return match;
    return `<section class="mdr-cta-box"><h3>${title}</h3>${rest}<div class="mdr-cta-box__badges"><span>RGE certifié</span><span>Annecy · Chambéry · Savoie</span></div></section>`;
  });
  return html.replace(/<section class="mdr-home-panel"><div class="mdr-home-heading">Articles liés<\/div>([\s\S]*?)<\/section>/, (_, links) => {
    const converted = links.replace(/mdr-related-link/g, "mdr-sidelink").replace(/<span>/g, '<span class="mdr-sidelink__cat">');
    return `<section class="mdr-sidepanel"><h4>Articles similaires</h4><div class="mdr-sidelinks">${converted}</div></section>`;
  });
}

function enhance(file) {
  if (HANDCRAFTED.has(file)) return;
  const fullPath = path.join(ROOT, file);
  let html = fs.readFileSync(fullPath, "utf8");
  if (!html.includes("mdr-article-page")) return;

  const category = (html.match(/<span class="mdr-card__tag">([\s\S]*?)<\/span>/) || ["", ""])[1];
  const key = categoryKey(category);

  html = html.replace('data-generated="decap-page"', 'data-generated="editorial-template"');
  html = html.replace(/<link rel="stylesheet" href="\.\/decap\.css" \/>\n?/, "");
  html = html.replace(/<nav class="mdr-article-toc"[\s\S]*?<\/nav>\s*/g, "");
  html = accentTitle(html, key);
  html = html.replace(/<div class="mdr-article-leadbox"><p>([\s\S]*?)<\/p><\/div>/, `<div class="mdr-article-leadbox"><strong>Le point important</strong><p>$1</p></div>\n${keyFactsHtml(key)}`);
  html = convertSourceLists(html);
  html = convertUsefulLists(html);
  html = html.replace(/<div class="mdr-prose-cta">/, `${decisionHtml(key)}\n<div class="mdr-prose-cta">`);
  html = html.replace(/Vous avez un projet en Haute-Savoie ou Savoie \?/g, "Vous voulez cadrer votre projet avant de signer ?");
  html = html.replace(/On vous aide à cadrer le besoin, le budget et les démarches avant le devis\./g, "MD Rénov' vous aide à choisir la solution utile, adaptée au logement et au budget.");
  html = html.replace(/Demander un devis/g, "Faire le point");
  html = enhanceSidebar(html);
  if (!html.includes("mdr-article-footer")) html = html.replace("</div></main>", `${footerHtml()}\n</div></main>`);

  fs.writeFileSync(fullPath, html, "utf8");
}

fs.readdirSync(ROOT).filter((name) => name.endsWith(".html")).forEach(enhance);
console.log("UX article harmonisée avec la DA MaPrimeRénov'.");
