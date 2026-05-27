const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STYLE_ID = "mdr-enhanced-article-media";
const STYLE = `<style id="${STYLE_ID}">
.mdr-article-page .mdr-prose>.mdr-media--article.mdr-media--image{display:block;width:min(100%,860px);min-height:0!important;margin:0 auto .45rem;padding:0!important;border:1px solid #ded6ca!important;border-radius:22px!important;background:#f4eee5!important;box-shadow:0 20px 50px rgba(26,26,24,.08)!important;overflow:hidden!important}
.mdr-article-page .mdr-prose>.mdr-media--article.mdr-media--image img{width:100%!important;height:clamp(190px,27vw,340px)!important;min-height:0!important;display:block!important;border-radius:0!important;object-fit:cover!important;object-position:center!important}
.mdr-article-page .mdr-article-figure{width:min(100%,860px);margin:0 auto .45rem;padding:0;border:1px solid #ded6ca;border-radius:22px;background:#f4eee5;box-shadow:0 20px 50px rgba(26,26,24,.08);overflow:hidden}
.mdr-article-page .mdr-article-figure img{width:100%;height:clamp(190px,27vw,340px);display:block;border-radius:0;object-fit:cover;object-position:center}
.mdr-article-page .mdr-article-figure figcaption{display:flex;align-items:center;gap:.55rem;margin:0;padding:.72rem .95rem .82rem;color:#6d675f;font-size:.78rem;font-weight:650;line-height:1.45}
.mdr-article-page .mdr-article-figure figcaption::before{content:"";width:8px;height:8px;border-radius:999px;background:#9b1c1c;flex:0 0 auto}
@media (max-width:760px){.mdr-article-page .mdr-prose>.mdr-media--article.mdr-media--image,.mdr-article-page .mdr-article-figure{border-radius:17px}.mdr-article-page .mdr-prose>.mdr-media--article.mdr-media--image img,.mdr-article-page .mdr-article-figure img{height:190px}.mdr-article-page .mdr-article-figure figcaption{padding:.65rem .8rem .75rem;font-size:.74rem}}
</style>`;

function addStyle(html) {
  html = html.replace(new RegExp(`<style id="${STYLE_ID}">[\\s\\S]*?<\\/style>\\s*`, "g"), "");
  return html.includes("</head>") ? html.replace("</head>", `${STYLE}\n</head>`) : html;
}

function enhanceFigures(html) {
  return html.replace(
    /<div class="mdr-media mdr-media--article mdr-media--image"><img src="([^"]+)" alt="([^"]*)" loading="eager"><\/div>/g,
    (_match, src, alt) => `<figure class="mdr-article-figure"><img src="${src}" alt="${alt}" loading="eager"><figcaption>${alt}</figcaption></figure>`,
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
