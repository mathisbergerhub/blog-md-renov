const https = require("https");

const REPOSITORY = process.env.GITHUB_REPO || "mathisbergerhub/blog-md-renov";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const IMAGE_PATH = "/uploads/briefs/2026-05-27-image-maprimerenov-2026-1-maprimerenov-2026-aide-renovation.png";
const IMAGE_SRC = `.${IMAGE_PATH}`;
const IMAGE_ALT = "Conseiller MD Rénov’ expliquant les aides MaPrimeRénov’ devant une fenêtre à rénover";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "mdrenov-blog-admin",
  };
}

function httpsJson(url, options, payload) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = payload ? JSON.stringify(payload) : null;
    const request = https.request(
      {
        hostname: parsed.hostname,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method || "GET",
        headers: {
          ...(options.headers || {}),
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (response) => {
        let responseBody = "";
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          let data = {};
          try {
            data = responseBody ? JSON.parse(responseBody) : {};
          } catch (error) {
            data = { raw: responseBody };
          }
          resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, data });
        });
      },
    );
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function readGithubPath(token, filePath) {
  const url = `https://api.github.com/repos/${REPOSITORY}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(BRANCH)}`;
  const response = await httpsJson(url, { method: "GET", headers: githubHeaders(token) });
  if (!response.ok) throw new Error(response.data.message || `Impossible de lire ${filePath}.`);
  return {
    sha: response.data.sha,
    content: Buffer.from(String(response.data.content || "").replace(/\n/g, ""), "base64").toString("utf8"),
  };
}

async function updateGithubPath(token, filePath, sha, content) {
  const url = `https://api.github.com/repos/${REPOSITORY}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`;
  const response = await httpsJson(
    url,
    { method: "PUT", headers: githubHeaders(token) },
    {
      message: `Fix MaPrimeRenov home photo: ${filePath}`,
      branch: BRANCH,
      sha,
      content: Buffer.from(content, "utf8").toString("base64"),
    },
  );
  if (!response.ok) throw new Error(response.data.message || `Impossible de mettre à jour ${filePath}.`);
  return response.data.commit && response.data.commit.sha;
}

function featuredDiv() {
  return `<div class="mdr-home-media mdr-home-media--featured mdr-media--image"><img src="${IMAGE_SRC}" alt="${IMAGE_ALT}" loading="eager"></div>`;
}

function patchSyncContent(content) {
  let patched = content;
  if (!patched.includes("function featuredHomeMedia(article)")) {
    const insertAfter = `</div>\n</article>\`;\n}\n\nfunction renderHomePage(articles) {`;
    const helper = `</div>\n</article>\`;\n}\n\nfunction featuredHomeMedia(article) {\n  const label = escapeHtml(article.image_alt || "Aides rénovation");\n  const image = String(article.featured_image || "").trim();\n  const normalizedImage = image ? (image.startsWith("/") ? \`.\${image}\` : image) : "";\n\n  if (!normalizedImage) {\n    return \`<div class="mdr-home-media mdr-home-media--featured" aria-label="Emplacement visuel 16:10 : \${label}"><strong>\${label}</strong></div>\`;\n  }\n\n  return \`<div class="mdr-home-media mdr-home-media--featured mdr-media--image"><img src="\${escapeHtml(normalizedImage)}" alt="\${label}" loading="eager"></div>\`;\n}\n\nfunction renderHomePage(articles) {`;
    patched = patched.replace(insertAfter, helper);
  }
  patched = patched.replace(
    /<div class="mdr-home-media mdr-home-media--featured" aria-label="Emplacement visuel 16:10 : Aides r(?:é|Ã©)novation"><strong>Aides r(?:é|Ã©)novation<\/strong><\/div>/,
    "${featuredHomeMedia(featured)}",
  );
  return patched;
}

function patchIndex(content) {
  return content.replace(
    /<div class="mdr-home-media mdr-home-media--featured" aria-label="Emplacement visuel 16:10 : Aides r(?:é|Ã©)novation"><strong>Aides r(?:é|Ã©)novation<\/strong><\/div>/,
    featuredDiv(),
  );
}

function patchStyles(content) {
  if (content.includes(".mdr-home-media--featured.mdr-media--image img")) return content;
  return content.replace(
    ".mdr-home-card .mdr-home-media.mdr-media--image img {\n  object-position: center;\n}",
    ".mdr-home-card .mdr-home-media.mdr-media--image img {\n  object-position: center;\n}\n\n.mdr-home-media--featured.mdr-media--image img {\n  object-position: center 38%;\n}",
  );
}

function patchHomeEditorial(content) {
  if (content.includes(".mdr-home-page .mdr-home-media--featured.mdr-media--image img")) return content;
  return content.replace(
    ".mdr-home-page .mdr-home-media--featured {\n  background:\n    radial-gradient(circle at 35% 32%, rgba(255, 255, 255, 0.16), transparent 28%),\n    linear-gradient(135deg, #2b2a27 0%, #171715 100%);\n}",
    ".mdr-home-page .mdr-home-media--featured {\n  background:\n    radial-gradient(circle at 35% 32%, rgba(255, 255, 255, 0.16), transparent 28%),\n    linear-gradient(135deg, #2b2a27 0%, #171715 100%);\n}\n\n.mdr-home-page .mdr-home-media--featured.mdr-media--image img {\n  object-position: center 38%;\n}",
  );
}

function patchArticle(content) {
  let patched = content.replace(
    /<figure class="mdr-article-figure"><img src="\.\/uploads\/briefs\/2026-05-27-image-maprimerenov-2026-1-maprimerenov-2026-aide-renovation\.png" alt="([^"]*)" loading="eager"(?: style="[^"]*")?>/,
    `<figure class="mdr-article-figure"><img src="./uploads/briefs/2026-05-27-image-maprimerenov-2026-1-maprimerenov-2026-aide-renovation.png" alt="$1" loading="eager" style="object-position:center 38%;">`,
  );
  return patched;
}

const patches = {
  "scripts/sync-content.js": patchSyncContent,
  "index.html": patchIndex,
  "styles.css": patchStyles,
  "home-editorial.css": patchHomeEditorial,
  "maprimerenov-2026-haute-savoie.html": patchArticle,
};

module.exports = async function fixMaprimerenovHomePhoto(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "Méthode non autorisée." });
    return;
  }

  try {
    const token = process.env.GITHUB_CONTENT_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_CONTENT_TOKEN manquant.");
    const results = [];
    for (const [filePath, patch] of Object.entries(patches)) {
      const source = await readGithubPath(token, filePath);
      const patched = patch(source.content);
      if (patched === source.content) {
        results.push({ filePath, changed: false });
        continue;
      }
      const commit = await updateGithubPath(token, filePath, source.sha, patched);
      results.push({ filePath, changed: true, commit });
    }
    sendJson(res, 200, { ok: true, results });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erreur serveur." });
  }
};
