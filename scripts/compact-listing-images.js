const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STYLE_ID = "mdr-compact-listing-images";
const STYLE = `<style id="${STYLE_ID}">
.mdr-home-card .mdr-home-media.mdr-media--image{height:104px!important;min-height:104px!important;padding:0!important;overflow:hidden!important}
.mdr-listing-page .mdr-home-card .mdr-home-media.mdr-media--image{height:124px!important;min-height:124px!important}
.mdr-home-card .mdr-home-media.mdr-media--image img{width:100%!important;height:100%!important;min-height:0!important;display:block!important;object-fit:cover!important;object-position:center!important}
</style>`;

// Le CSS est désormais dans styles.css. Ce script ne fait plus que purger
// d'éventuels anciens blocs <style> inline restants.
for (const fileName of fs.readdirSync(ROOT).filter((name) => name.endsWith(".html"))) {
  const filePath = path.join(ROOT, fileName);
  const before = fs.readFileSync(filePath, "utf8");
  const after = before.replace(new RegExp(`<style id="${STYLE_ID}">[\\s\\S]*?<\\/style>\\s*`, "g"), "");
  if (after !== before) fs.writeFileSync(filePath, after, "utf8");
}

console.log("Format compact des images de listing : CSS dans styles.css.");
