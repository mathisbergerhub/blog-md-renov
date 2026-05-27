const https = require("https");

const REPOSITORY = process.env.GITHUB_REPO || "mathisbergerhub/blog-md-renov";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const HTML_PATH = "maprimerenov-2026-haute-savoie.html";
const IMAGE_PATH = "/uploads/briefs/2026-05-27-image-maprimerenov-2026-1-maprimerenov-2026-aide-renovation.png";
const IMAGE_URL = `https://blog.mdrenov-menuiserie.com${IMAGE_PATH}`;
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
      message: `Apply MaPrimeRenov article image`,
      branch: BRANCH,
      sha,
      content: Buffer.from(content, "utf8").toString("base64"),
    },
  );
  if (!response.ok) throw new Error(response.data.message || `Impossible de mettre à jour ${filePath}.`);
  return response.data.commit && response.data.commit.sha;
}

function patchHtml(html) {
  const figure = `<figure class="mdr-article-figure"><img src=".${IMAGE_PATH}" alt="${IMAGE_ALT}" loading="eager"><figcaption>${IMAGE_ALT}</figcaption></figure>`;
  let patched = html
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${IMAGE_URL}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${IMAGE_URL}" />`);

  if (patched.includes("mdr-article-figure")) {
    patched = patched.replace(/<figure class="mdr-article-figure">[\s\S]*?<\/figure>/, figure);
  } else {
    patched = patched.replace(
      /<div class="mdr-media mdr-media--article"[^>]*><strong>Maison, fen(?:&#234;|ê)tres, devis et aides<\/strong><span>Emplacement photo 16:10<\/span><\/div>/,
      figure,
    );
  }

  if (/"image"\s*:/.test(patched)) {
    patched = patched.replace(/"image"\s*:\s*"[^"]*"/, `"image": "${IMAGE_URL}"`);
  } else {
    patched = patched.replace(/("headline"\s*:\s*"[^"]*",\s*)/, `$1"image": "${IMAGE_URL}", `);
  }

  return patched;
}

module.exports = async function applyMaprimerenovImage(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "Méthode non autorisée." });
    return;
  }

  try {
    const token = process.env.GITHUB_CONTENT_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_CONTENT_TOKEN manquant.");
    const source = await readGithubPath(token, HTML_PATH);
    const patched = patchHtml(source.content);
    if (patched === source.content) {
      sendJson(res, 200, { ok: true, changed: false, message: "Aucune modification nécessaire." });
      return;
    }
    const commit = await updateGithubPath(token, HTML_PATH, source.sha, patched);
    sendJson(res, 200, { ok: true, changed: true, commit, image: IMAGE_PATH });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erreur serveur." });
  }
};
