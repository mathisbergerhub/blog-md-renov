const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const UI_PATCH = `<style id="mdr-article-ui-patch">
.mdr-prose .mdr-check-grid li{min-height:auto!important;padding:.85rem!important}
.mdr-prose .mdr-check-grid:has(li:nth-child(1):last-child),
.mdr-prose .mdr-check-grid:has(li:nth-child(2):last-child),
.mdr-prose .mdr-check-grid:has(li:nth-child(3):last-child),
.mdr-prose .mdr-check-grid:has(li:nth-child(4):last-child),
.mdr-prose .mdr-check-grid:has(li:nth-child(5):last-child){grid-template-columns:1fr!important}
.mdr-prose h2 + .mdr-check-grid{margin-top:.35rem}
</style>`;

function compactPrepareLists(html) {
  return html.replace(
    /(<h2[^>]*>(?:Ce qu(?:'|’|&#039;)il faut préparer|Checklist)[\s\S]*?<\/h2>\s*)<ul class="mdr-check-grid">([\s\S]*?)<\/ul>/gi,
    (_match, heading, list) => `${heading}<ul>${list}</ul>`,
  );
}

function injectPatch(html) {
  if (html.includes('id="mdr-article-ui-patch"')) return html;
  return html.replace("</head>", `${UI_PATCH}\n</head>`);
}

let updated = 0;
for (const file of fs.readdirSync(ROOT).filter((name) => name.endsWith(".html"))) {
  const fullPath = path.join(ROOT, file);
  let html = fs.readFileSync(fullPath, "utf8");
  const next = injectPatch(compactPrepareLists(html));
  if (next !== html) {
    fs.writeFileSync(fullPath, next, "utf8");
    updated += 1;
  }
}

console.log(`Correctif UX articles appliqué : ${updated} page(s).`);
