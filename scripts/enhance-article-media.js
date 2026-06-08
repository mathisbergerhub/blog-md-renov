const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STYLE_ID = "mdr-enhanced-article-media";
const STYLE = `<style id="${STYLE_ID}">
.mdr-article-page .mdr-prose>.mdr-media--article.mdr-media--image{display:block;width:100%!important;min-height:0!important;margin:0 0 .45rem;padding:0!important;border:1px solid #ded6ca!important;border-radius:22px!important;background:#f4eee5!important;box-shadow:0 20px 50px rgba(26,26,24,.08)!important;overflow:hidden!important}
.mdr-article-page .mdr-prose>.mdr-media--article.mdr-media--image img{width:100%!important;height:clamp(190px,27vw,340px)!important;min-height:0!important;display:block!important;border-radius:0!important;object-fit:cover!important;object-position:center!important}
.mdr-article-page .mdr-article-figure{width:100%;margin:0 0 .45rem;padding:0;border:1px solid #ded6ca;border-radius:22px;background:#f4eee5;box-shadow:0 20px 50px rgba(26,26,24,.08);overflow:hidden}
.mdr-article-page .mdr-article-figure img{width:100%;height:clamp(190px,27vw,340px);display:block;border-radius:0;object-fit:cover;object-position:center}
@media (max-width:760px){.mdr-article-page .mdr-prose>.mdr-media--article.mdr-media--image,.mdr-article-page .mdr-article-figure{border-radius:17px}.mdr-article-page .mdr-prose>.mdr-media--article.mdr-media--image img,.mdr-article-page .mdr-article-figure img{height:190px}}
</style>`;

function addStyle(html) {
  html = html.replace(new RegExp(`<style id="${STYLE_ID}">[\\s\\S]*?<\\/style>\\s*`, "g"), "");
  return html.includes("</head>") ? html.replace("</head>", `${STYLE}\n</head>`) : html;
}

function enhanceFigures(html) {
  return html.replace(
    /<div class="mdr-media mdr-media--article mdr-media--image"><img src="([^"]+)" alt="([^"]*)" loading="eager"><\/div>/g,
    (_match, src, alt) => `<figure class="mdr-article-figure"><img src="${src}" alt="${alt}" loading="eager"></figure>`,
  );
}

let changed = 0;

for (const fileName of fs.readdirSync(ROOT).filter((name) => name.endsWith(".html"))) {
  const filePath = path.join(ROOT, fileName);
  const before = fs.readFileSync(filePath, "utf8");
  if (!before.includes("mdr-article-page")) continue;

  const after = enhanceFigures(addStyle(before));
  if (after !== before) {
    fs.writeFileSync(filePath, after, "utf8");
    changed += 1;
  }
}

console.log(`Médias article améliorés : ${changed} page(s).`);
