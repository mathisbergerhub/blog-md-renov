const fs = require("fs");
const path = require("path");
const cms = require("./_supabase-cms");
const { root } = require("../scripts/sync-content");

const SITE_URL = "https://blog.mdrenov-menuiserie.com";

function staticLlms() {
  const file = path.join(root, "llms.txt");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function cleanPath(value = "") {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "")
    .replace(/\.html$/, "");
}

function markdownText(value = "") {
  return String(value || "").replace(/[\r\n]+/g, " ").replace(/[[\]]/g, "");
}

function sendText(res, statusCode, text) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(text);
}

module.exports = async function llms(req, res) {
  try {
    if (!cms.isConfigured()) {
      sendText(res, 200, staticLlms());
      return;
    }

    const rows = await cms.listArticles({ includeArchived: false, publicOnly: true });
    const lines = [
      "# Blog MD Rénov'",
      "",
      "Guides rénovation, menuiseries, aides, isolation, volets, stores, pergolas, portes et portails en Haute-Savoie et Savoie.",
      "",
      "## Articles",
      ...rows.map((row) => {
        const pathname = cleanPath(row.html_path || `${row.slug}.html`);
        return `- [${markdownText(row.title || row.slug)}](${SITE_URL}/${pathname}) - ${markdownText(row.description || "")}`;
      }),
      "",
    ];
    sendText(res, 200, lines.join("\n"));
  } catch (error) {
    console.error("[llms]", error);
    const fallback = staticLlms();
    sendText(res, fallback ? 200 : 500, fallback || "# Blog MD Rénov'\n");
  }
};
