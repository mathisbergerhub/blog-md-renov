const OWNER = "mathisbergerhub";
const REPO = "blog-md-renov";
const PHOTO = "2026-05-27-image-maprimerenov-2026-1-maprimerenov-2026-aide-renovation.png";
const PHOTO_PATH = `/uploads/briefs/${PHOTO}`;
const PHOTO_SRC = `./uploads/briefs/${PHOTO}`;
const PHOTO_ALT = "Conseiller MD Rénov’ expliquant les aides MaPrimeRénov’ devant une fenêtre à rénover";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

async function github(path, method = "GET", body) {
  const token = process.env.GITHUB_CONTENT_TOKEN;
  if (!token) throw new Error("GITHUB_CONTENT_TOKEN manquant");

  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "mdrenov-blog-patch"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${text}`);
  }
  return data;
}

async function readFile(path) {
  const data = await github(path);
  return {
    sha: data.sha,
    content: Buffer.from(data.content, "base64").toString("utf8")
  };
}

async function writeFile(path, content, sha) {
  return github(path, "PUT", {
    message: "Affiche la photo MaPrimeRenov en une",
    content: Buffer.from(content, "utf8").toString("base64"),
    sha
  });
}

function patchSyncContent(content) {
  let next = content;

  if (!next.includes("function featuredHomeMedia(article)")) {
    const helper = `function featuredHomeMedia(article) {\n  const label = escapeHtml(article.image_alt || "Aides rénovation");\n  const image = String(article.featured_image || "").trim();\n  const normalizedImage = image ? (image.startsWith("/") ? \`.\${image}\` : image) : "";\n\n  if (!normalizedImage) {\n    return \`<div class="mdr-home-media mdr-home-media--featured" aria-label="Emplacement visuel 16:10 : \${label}"><strong>\${label}</strong></div>\`;\n  }\n\n  return \`<div class="mdr-home-media mdr-home-media--featured mdr-media--image"><img src="\${escapeHtml(normalizedImage)}" alt="\${label}" loading="eager"></div>\`;\n}\n\n`;
    next = next.replace("function renderHomePage(articles) {", `${helper}function renderHomePage(articles) {`);
  }

  next = next.replace(
    /<div class="mdr-home-media mdr-home-media--featured" aria-label="Emplacement visuel 16:10 : Aides rénovation"><strong>Aides rénovation<\/strong><\/div>/,
    "${featuredHomeMedia(featured)}"
  );

  return next;
}

function patchIndex(content) {
  const imageHtml = `<div class="mdr-home-media mdr-home-media--featured mdr-media--image"><img src="${PHOTO_SRC}" alt="${PHOTO_ALT}" loading="eager"></div>`;
  let next = content;

  next = next.replace(
    /<div class="mdr-home-media mdr-home-media--featured" aria-label="Emplacement visuel 16:10 : Aides rénovation"><strong>Aides rénovation<\/strong><\/div>/,
    imageHtml
  );

  next = next.replace(
    /<div class="mdr-home-media mdr-home-media--featured" aria-label="Emplacement visuel 16:10 : [^"]+"><strong>[^<]+<\/strong><\/div>/,
    imageHtml
  );

  return next;
}

function patchStyles(content) {
  if (content.includes(".mdr-home-media--featured.mdr-media--image img")) return content;
  const rule = `\n.mdr-home-media--featured.mdr-media--image img {\n  object-position: center 38%;\n}\n`;
  const marker = `.mdr-home-card .mdr-home-media.mdr-media--image img {\n  object-position: center;\n}\n`;
  if (content.includes(marker)) return content.replace(marker, `${marker}${rule}`);
  return `${content}\n${rule}`;
}

function patchHomeEditorial(content) {
  if (content.includes(".mdr-home-page .mdr-home-media--featured.mdr-media--image img")) return content;
  return `${content}\n.mdr-home-page .mdr-home-media--featured.mdr-media--image img {\n  object-position: center 38%;\n}\n`;
}

function patchMaprimerenov(content) {
  let next = content;
  next = next.replaceAll("/uploads/briefs/2026-05-27-image-maprimerenov-2026-1-maprimerenov-2026-aide-renovation.png", PHOTO_PATH);
  next = next.replaceAll("./uploads/briefs/2026-05-27-image-maprimerenov-2026-1-maprimerenov-2026-aide-renovation.png", PHOTO_SRC);

  next = next.replace(
    /(<figure class="mdr-article-figure"><img[^>]*src="\.\/uploads\/briefs\/2026-05-27-image-maprimerenov-2026-1-maprimerenov-2026-aide-renovation\.png"[^>]*loading="eager")(?![^>]*object-position)([^>]*>)/,
    `$1 style="object-position:center 38%;"$2`
  );

  return next;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });
  if (req.body?.password !== "MB74!") return json(res, 401, { error: "Unauthorized" });

  const jobs = [
    ["scripts/sync-content.js", patchSyncContent],
    ["styles.css", patchStyles],
    ["home-editorial.css", patchHomeEditorial],
    ["index.html", patchIndex],
    ["maprimerenov-2026-haute-savoie.html", patchMaprimerenov]
  ];

  const changed = [];
  for (const [path, patch] of jobs) {
    const file = await readFile(path);
    const next = patch(file.content);
    if (next !== file.content) {
      await writeFile(path, next, file.sha);
      changed.push(path);
    }
  }

  json(res, 200, { ok: true, changed });
}
