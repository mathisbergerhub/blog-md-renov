const DEFAULT_REPO = "mathisbergerhub/blog-md-renov";
const DEFAULT_BRANCH = "main";
const https = require("https");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try { return Promise.resolve(JSON.parse(req.body || "{}")); }
    catch { return Promise.reject(new Error("JSON invalide.")); }
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 80000) {
        reject(new Error("Brief trop long."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(new Error("JSON invalide.")); }
    });
    req.on("error", reject);
  });
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function yamlString(value = "") {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function httpsJson(url, options, payload) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = payload ? JSON.stringify(payload) : null;
    const request = https.request({
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method || "GET",
      headers: { ...(options.headers || {}), ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}) },
    }, (response) => {
      let responseBody = "";
      response.on("data", (chunk) => { responseBody += chunk; });
      response.on("end", () => {
        let data = {};
        try { data = responseBody ? JSON.parse(responseBody) : {}; }
        catch { data = { raw: responseBody }; }
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, data });
      });
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
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

async function githubPathExists(repository, branch, token, filePath) {
  const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`;
  const response = await httpsJson(url, { method: "GET", headers: githubHeaders(token) });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(response.data.message || "Impossible de vérifier le fichier GitHub.");
  return true;
}

async function createGithubFile({ repository, branch, token, filePath, content }) {
  const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`;
  const response = await httpsJson(url, { method: "PUT", headers: githubHeaders(token) }, {
    message: `Create article brief: ${filePath}`,
    branch,
    content: Buffer.from(content, "utf8").toString("base64"),
  });
  if (!response.ok) throw new Error(response.data.message || "Impossible de créer le brief GitHub.");
  return response.data;
}

async function uniqueBriefPath(repository, branch, token, title) {
  const day = new Date().toISOString().slice(0, 10);
  const base = slugify(title) || `brief-${Date.now()}`;
  let candidate = `content/briefs/${day}-${base}.md`;
  let index = 2;
  while (await githubPathExists(repository, branch, token, candidate)) {
    candidate = `content/briefs/${day}-${base}-${index}.md`;
    index += 1;
  }
  return candidate;
}

function buildBriefMarkdown(brief) {
  const createdAt = new Date().toISOString();
  const title = String(brief.title || "").trim();
  const category = String(brief.category || "").trim();
  const mainKeyword = String(brief.main_keyword || "").trim();

  return `---
content_type: 'article_brief'
status: 'pending'
title: ${yamlString(title)}
category: ${yamlString(category)}
main_keyword: ${yamlString(mainKeyword)}
product: ${yamlString(brief.product || "")}
location: ${yamlString(brief.location || "Haute-Savoie et Savoie")}
intent: ${yamlString(brief.intent || "information")}
created_at: ${yamlString(createdAt)}
---

# ${title}

## Sujet à traiter
${brief.notes || "À compléter."}

## Mot-clé principal
${mainKeyword}

## Questions clients à traiter
${brief.questions || "À compléter."}

## Sources à utiliser
${brief.sources || "À compléter."}

## Produit concerné
${brief.product || "Non précisé."}

## Zone locale
${brief.location || "Haute-Savoie et Savoie"}

## Intention de recherche
${brief.intent || "information"}

## Consigne de traitement
Transformer ce brief en article utile pour des particuliers, avec réponses concrètes, exemples locaux, sources citées, structure SEO, maillage interne et appel à l'action discret.
`;
}

module.exports = async function createBrief(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "Méthode non autorisée." });
    return;
  }

  try {
    const brief = await readJson(req);
    if (!brief.title || !brief.category || !brief.main_keyword || !brief.questions) {
      sendJson(res, 400, { error: "Titre, catégorie, mot-clé principal et questions clients sont obligatoires." });
      return;
    }

    const token = process.env.GITHUB_CONTENT_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
      sendJson(res, 500, { error: "GITHUB_CONTENT_TOKEN est manquant dans les variables d'environnement Vercel." });
      return;
    }

    const repository = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
    const markdown = buildBriefMarkdown(brief);
    const filePath = await uniqueBriefPath(repository, branch, token, brief.title);
    const github = await createGithubFile({ repository, branch, token, filePath, content: markdown });

    sendJson(res, 200, {
      ok: true,
      status: "pending",
      filePath,
      title: brief.title,
      markdown,
      githubUrl: github.content && github.content.html_url ? github.content.html_url : null,
      message: "Brief créé. Il attend maintenant d'être transformé en article.",
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erreur serveur." });
  }
};
