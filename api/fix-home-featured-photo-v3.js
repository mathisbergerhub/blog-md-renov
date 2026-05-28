const OWNER = "mathisbergerhub";
const REPO = "blog-md-renov";
const PHOTO_SRC = "./uploads/briefs/2026-05-27-image-maprimerenov-2026-1-maprimerenov-2026-aide-renovation.png";
const PHOTO_ALT = "Conseiller MD Rénov’ expliquant les aides MaPrimeRénov’ devant une fenêtre à rénover";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

async function github(path, method = "GET", body) {
  const token = process.env.GITHUB_CONTENT_TOKEN;
  if (!token) throw new Error("GITHUB_CONTENT_TOKEN manquant");
  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
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
  if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status} ${text}`);
  return data;
}

async function readFile(path) {
  const data = await github(path);
  return { sha: data.sha, content: Buffer.from(data.content, "base64").toString("utf8") };
}

async function writeFile(path, content, sha) {
  return github(path, "PUT", {
    message: "Affiche la photo MaPrimeRenov sur la home",
    content: Buffer.from(content, "utf8").toString("base64"),
    sha
  });
}

function patchIndex(content) {
  const block = `<div class="mdr-home-media mdr-home-media--featured mdr-media--image"><img src="${PHOTO_SRC}" alt="${PHOTO_ALT}" loading="eager"></div>`;
  const next = content.replace(
    /<div class="mdr-home-media mdr-home-media--featured(?: mdr-media--image)?"[\s\S]*?<\/div>\s*(?=<div class="mdr-home-featured__body">)/,
    `${block}\n`
  );
  if (next === content) throw new Error("Bloc featured media introuvable dans index.html");
  return next;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { error: "POST only" });
    if (req.body?.password !== "MB74!") return json(res, 401, { error: "Unauthorized" });
    const file = await readFile("index.html");
    const next = patchIndex(file.content);
    await writeFile("index.html", next, file.sha);
    json(res, 200, { ok: true, changed: ["index.html"] });
  } catch (error) {
    json(res, 500, { ok: false, error: error.message });
  }
}
