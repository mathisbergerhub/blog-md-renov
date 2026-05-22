const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const UI_PATCH = `<style id="mdr-article-ui-patch">
.mdr-prose .mdr-check-grid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))!important;align-items:stretch!important}
.mdr-prose .mdr-check-grid li{min-height:auto!important;padding:.95rem!important}
.mdr-prose .mdr-check-grid li strong{display:block;margin-bottom:.35rem}
.mdr-prose h2 + .mdr-check-grid{margin-top:.35rem}
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

function injectPatch(html) {
  if (html.includes('id="mdr-article-ui-patch"')) {
    return html.replace(/<style id="mdr-article-ui-patch">[\s\S]*?<\/style>/, UI_PATCH);
  }
  return html.replace("</head>", `${UI_PATCH}\n</head>`);
}

let updated = 0;
for (const file of fs.readdirSync(ROOT).filter((name) => name.endsWith(".html"))) {
  const fullPath = path.join(ROOT, file);
  let html = fs.readFileSync(fullPath, "utf8");
  const next = injectPatch(enrichShortCards(html));
  if (next !== html) {
    fs.writeFileSync(fullPath, next, "utf8");
    updated += 1;
  }
}

console.log(`Correctif UX articles appliqué : ${updated} page(s).`);
