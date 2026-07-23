const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BRAND_NAME = "MD Rénov'";
const VERCEL_OBSERVABILITY_QUEUE = '<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};window.si=window.si||function(){(window.siq=window.siq||[]).push(arguments)};</script>';
const ANALYTICS_SCRIPT = '<script defer src="/_vercel/insights/script.js" data-sdkn="@vercel/analytics" data-sdkv="2.0.1"></script>';
const SPEED_INSIGHTS_SCRIPT = '<script defer src="/_vercel/speed-insights/script.js" data-sdkn="@vercel/speed-insights" data-sdkv="2.0.0"></script>';
const FAVICON_BLOCK = `<link rel="icon" type="image/svg+xml" href="./logo-mdr-site.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="./favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="./favicon-16x16.png" />
<link rel="shortcut icon" href="./favicon-32x32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png" />`;

function normalizeBrand(value = "") {
  return String(value)
    .replace(/MD Renov'?/gi, BRAND_NAME)
    .replace(/MD Rénov'?/gi, BRAND_NAME)
    .replace(/md rénov'?/gi, BRAND_NAME)
    .replace(/MD Rénov''/g, BRAND_NAME);
}

function ensureMeta(html, pattern, insertion) {
  if (html.includes(insertion)) return html;
  return html.replace(pattern, (match) => `${match}\n${insertion}`);
}

function normalizeHead(html) {
  let next = normalizeBrand(html);
  next = next.replace(
    /<link rel="icon"[^>]+>\s*\n<link rel="icon"[^>]+>\s*\n<link rel="icon"[^>]+>\s*\n<link rel="shortcut icon"[^>]+>\s*\n<link rel="apple-touch-icon"[^>]+>/,
    FAVICON_BLOCK,
  );
  next = next.replace(/<link rel="icon" type="image\/svg\+xml" href="\.\/favicon\.svg" \/>/g, '<link rel="icon" type="image/svg+xml" href="./logo-mdr-site.svg" />');
  next = next.replace(/MD R&#233;nov(?!&#39;|')/g, "MD R&#233;nov&#39;");
  next = ensureMeta(next, /<meta property="og:type" content="[^"]+" \/>/, `<meta property="og:site_name" content="${BRAND_NAME}" />`);
  next = ensureMeta(next, /<meta name="theme-color" content="[^"]+" \/>/, `<meta name="application-name" content="${BRAND_NAME}" />`);
  next = ensureMeta(next, /<meta name="application-name" content="[^"]+" \/>/, `<meta name="apple-mobile-web-app-title" content="${BRAND_NAME}" />`);
  if (!next.includes("window.vaq") || !next.includes("window.siq")) {
    next = next.replace("</head>", `${VERCEL_OBSERVABILITY_QUEUE}\n</head>`);
  }
  if (!next.includes('/_vercel/insights/script.js')) {
    next = next.replace("</head>", `${ANALYTICS_SCRIPT}\n</head>`);
  }
  if (!next.includes('/_vercel/speed-insights/script.js')) {
    next = next.replace("</head>", `${SPEED_INSIGHTS_SCRIPT}\n</head>`);
  }
  return next;
}

for (const fileName of fs.readdirSync(ROOT).filter((name) => name.endsWith(".html"))) {
  const filePath = path.join(ROOT, fileName);
  const html = fs.readFileSync(filePath, "utf8");
  const updated = normalizeHead(html);
  if (updated !== html) fs.writeFileSync(filePath, updated, "utf8");
}

console.log(`Identité de marque appliquée : ${BRAND_NAME}.`);
