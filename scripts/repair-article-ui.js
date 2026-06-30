const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const UI_PATCH = `<style id="mdr-article-ui-patch">
.mdr-prose .mdr-check-grid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))!important;align-items:stretch!important}
.mdr-prose .mdr-check-grid li{min-height:auto!important;padding:.95rem!important}
.mdr-prose .mdr-check-grid li strong{display:block;margin-bottom:.35rem}
.mdr-prose h2 + .mdr-check-grid{margin-top:.35rem}
.mdr-prose .mdr-table-wrap{margin:1rem 0 1.25rem!important;border:1px solid #ded7cd!important;border-radius:18px!important;background:#fff!important;box-shadow:0 18px 38px rgba(26,26,24,.07)!important;overflow:hidden!important}
.mdr-prose .mdr-table-wrap table{width:100%!important;margin:0!important;border:0!important;border-collapse:separate!important;border-spacing:0!important;background:#fff!important}
.mdr-prose .mdr-decision-table th{padding:.85rem 1rem!important;border:0!important;background:#9b1c1c!important;color:#fff!important;font-size:.72rem!important;font-weight:800!important;letter-spacing:.08em!important;text-transform:uppercase!important}
.mdr-prose .mdr-decision-table td{padding:1rem!important;border:0!important;border-bottom:1px solid #eee5da!important;color:#333!important;line-height:1.58!important}
.mdr-prose .mdr-decision-table tbody tr:nth-child(even){background:#fbf7f1!important}
.mdr-prose .mdr-decision-table tbody tr:last-child td{border-bottom:0!important}
.mdr-prose .mdr-decision-table td:first-child{width:24%!important;color:#9b1c1c!important;font-weight:800!important}
@media (max-width:720px){
  .mdr-prose .mdr-table-wrap{border:0!important;box-shadow:none!important;background:transparent!important;overflow:visible!important}
  .mdr-prose .mdr-decision-table,.mdr-prose .mdr-decision-table thead,.mdr-prose .mdr-decision-table tbody,.mdr-prose .mdr-decision-table tr,.mdr-prose .mdr-decision-table td{display:block!important;width:100%!important}
  .mdr-prose .mdr-decision-table thead{display:none!important}
  .mdr-prose .mdr-decision-table tr{margin:0 0 .75rem!important;border:1px solid #ded7cd!important;border-radius:16px!important;background:#fff!important;box-shadow:0 12px 24px rgba(26,26,24,.06)!important;overflow:hidden!important}
  .mdr-prose .mdr-decision-table td{display:grid!important;grid-template-columns:minmax(7.5rem,38%) 1fr!important;gap:.8rem!important;padding:.85rem .95rem!important;border-bottom:1px solid #eee5da!important}
  .mdr-prose .mdr-decision-table td::before{content:attr(data-label);color:#9b1c1c;font-size:.68rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
  .mdr-prose .mdr-decision-table td:first-child{background:#fbf7f1!important;color:#1a1a18!important}
}
</style>`;

function normalize(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cardCopy(raw = "") {
  const text = raw.replace(/\s+([?.!,;:])/g, "$1").trim();
  const normalized = normalize(text);
  const rules = [
    {
      test: /emplacement exact/,
      title: "Emplacement exact",
      description: "Indiquer où le store, la menuiserie ou l'équipement sera posé évite les allers-retours avec la mairie, le syndic ou le poseur.",
    },
    {
      test: /dimensions|couleur|toile|armature|ral/,
      title: "Dimensions et couleurs",
      description: "Largeur, hauteur, avancée, couleur de toile, coloris RAL ou finition doivent être cohérents avec la façade et le règlement éventuel.",
    },
    {
      test: /mode de fixation|fixation|impact sur la facade/,
      title: "Mode de fixation",
      description: "Le support change tout : béton, isolation extérieure, balcon, linteau ou façade ancienne ne se traitent pas de la même façon.",
    },
    {
      test: /photo|fiche technique|modele/,
      title: "Photo ou fiche technique",
      description: "Une photo de la façade et la fiche du modèle permettent de comprendre rapidement l'impact visible et les contraintes techniques du projet.",
    },
    {
      test: /engagement|remise en etat|pose professionnelle/,
      title: "Pose et remise en état",
      description: "Le dossier doit préciser que la pose sera propre, professionnelle et que les reprises nécessaires seront prévues si le support l'exige.",
    },
    {
      test: /contrainte|copropriete|plu|acces|humidite|bruit|vent/,
      title: "Contraintes à signaler",
      description: "Copropriété, PLU, accès difficile, humidité, bruit ou exposition au vent changent souvent le choix du produit et le coût réel.",
    },
    {
      test: /priorite|budget|confort|securite|esthetique|lumiere/,
      title: "Priorité du projet",
      description: "Dire si l'objectif principal est le budget, le confort, la sécurité, l'esthétique ou la lumière permet d'éviter un devis mal orienté.",
    },
  ];
  const rule = rules.find((item) => item.test.test(normalized));
  if (rule) return rule;
  return {
    title: text.replace(/\.$/, ""),
    description: "Point à cadrer avant le devis pour éviter les mauvaises surprises, les oublis techniques ou les comparaisons de prix faussées.",
  };
}

function enrichShortCards(html) {
  return html.replace(/<ul class="mdr-check-grid">([\s\S]*?)<\/ul>/g, (match, content) => {
    const next = content.replace(/<li><span>([^<]{1,170})<\/span><\/li>/g, (_item, raw) => {
      const copy = cardCopy(raw);
      return `<li><strong>${copy.title}</strong><span>${copy.description}</span></li>`;
    });
    return `<ul class="mdr-check-grid">${next}</ul>`;
  });
}

function enhanceTables(html) {
  return html.replace(/<table class="mdr-decision-table">\s*<thead><tr>([\s\S]*?)<\/tr><\/thead>\s*<tbody>([\s\S]*?)<\/tbody>\s*<\/table>/g, (match, head, body) => {
    const labels = [...head.matchAll(/<th(?:\s+scope="col")?>([\s\S]*?)<\/th>/g)].map((item) =>
      item[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    );
    const nextHead = head.replace(/<th>/g, '<th scope="col">');
    const nextBody = body.replace(/<tr>([\s\S]*?)<\/tr>/g, (_rowMatch, row) => {
      let cellIndex = 0;
      const nextRow = row.replace(/<td(?![^>]*data-label=)>/g, () => {
        const label = labels[cellIndex] || "";
        cellIndex += 1;
        return `<td data-label="${label.replace(/"/g, "&quot;")}">`;
      });
      return `<tr>${nextRow}</tr>`;
    });
    return `<table class="mdr-decision-table"><thead><tr>${nextHead}</tr></thead><tbody>${nextBody}</tbody></table>`;
  });
}

// Le CSS est désormais dans styles.css : on se contente de purger
// d'éventuels anciens blocs <style> inline.
function injectPatch(html) {
  return html.replace(/<style id="mdr-article-ui-patch">[\s\S]*?<\/style>\s*/g, "");
}

let updated = 0;
for (const file of fs.readdirSync(ROOT).filter((name) => name.endsWith(".html"))) {
  const fullPath = path.join(ROOT, file);
  let html = fs.readFileSync(fullPath, "utf8");
  const next = injectPatch(enhanceTables(enrichShortCards(html)));
  if (next !== html) {
    fs.writeFileSync(fullPath, next, "utf8");
    updated += 1;
  }
}

console.log(`Correctif UX articles appliqué : ${updated} page(s).`);
