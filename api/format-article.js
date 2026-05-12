const https = require("https");
const DEFAULT_REPO = "mathisbergerhub/blog-md-renov";
const DEFAULT_BRANCH = "main";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 120000) {
        reject(new Error("Brief trop long."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch (error) { reject(new Error("JSON invalide.")); }
    });
    req.on("error", reject);
  });
}

function httpsJson(url, options, payload) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = payload ? JSON.stringify(payload) : null;
    const request = https.request({ hostname: parsed.hostname, path: `${parsed.pathname}${parsed.search}`, method: options.method || "GET", headers: Object.assign({}, options.headers || {}, body ? { "Content-Length": Buffer.byteLength(body) } : {}) }, (response) => {
      let responseBody = "";
      response.on("data", (chunk) => { responseBody += chunk; });
      response.on("end", () => {
        let data = {};
        try { data = responseBody ? JSON.parse(responseBody) : {}; }
        catch (error) { data = { raw: responseBody }; }
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, data });
      });
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

function slugify(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 82);
}

function yamlString(value = "") { return `'${String(value).replace(/'/g, "''")}'`; }
function yamlList(values = []) { const list = values.map((value) => `  - ${yamlString(value)}`).join("\n"); return list || "  - 'MD Rénov'"; }
function extractOutputText(response) { if (response.output_text) return response.output_text; const chunks = []; for (const item of response.output || []) for (const content of item.content || []) if (content.type === "output_text" && content.text) chunks.push(content.text); return chunks.join("\n").trim(); }
function parseGeneratedArticle(text) { try { return JSON.parse(text); } catch (error) { const match = text.match(/\{[\s\S]*\}/); if (!match) throw error; return JSON.parse(match[0]); } }
function estimateReadingTime(markdown = "") { const words = markdown.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`|~-]/g, " ").replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length; return `${Math.max(4, Math.ceil(words / 220))} min`; }

function buildMarkdown(article, brief) {
  const today = new Date().toISOString().slice(0, 10);
  const tags = Array.from(new Set([article.category_label, brief.product, brief.location, brief.main_keyword].concat(Array.isArray(article.tags) ? article.tags : []).filter(Boolean))).slice(0, 10);
  return `---
content_type: 'article'
published: false
generated_by_ai: true
title: ${yamlString(article.title)}
seo_title: ${yamlString(article.seo_title)}
description: ${yamlString(article.description)}
category: ${yamlString(brief.category || "aides")}
category_label: ${yamlString(article.category_label || brief.category_label || "Conseils")}
date: ${yamlString(today)}
reading_time: ${yamlString(article.reading_time || estimateReadingTime(article.body))}
featured_image: ''
image_alt: ${yamlString(article.image_alt || article.title)}
source_html: ''
tags:
${yamlList(tags)}
---

# ${article.title}

${article.body.trim()}
`;
}

async function openaiGenerateArticle(brief) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY est manquant dans les variables d'environnement Vercel.");
  const model = process.env.OPENAI_MODEL || "gpt-5.2";
  const response = await httpsJson("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } }, {
    model,
    input: [{ role: "user", content: [{ type: "input_text", text: `Transforme ce brief en article de blog SEO complet pour MD Rénov'.

Brief :
${JSON.stringify(brief, null, 2)}

Contraintes éditoriales :
- Écrire pour des particuliers en Haute-Savoie et Savoie, avec un ton clair, concret et rassurant.
- Répondre aux vraies questions Google : prix, aides, délais, conditions, erreurs, démarches, choix produit.
- Ne jamais inventer une source. Utiliser uniquement les sources fournies dans le brief. Si elles sont insuffisantes, ajouter une section "Points à vérifier" sans inventer de chiffres.
- Structurer en Markdown avec un seul H1 déjà fourni par le template, puis des H2/H3.
- Inclure au moins une réponse directe au début, des repères concrets, une méthode de décision, les erreurs fréquentes, un angle local Haute-Savoie/Savoie et une section "Sources utilisées".
- Pas d'emoji. Pas de promesse abusive. Pas de contenu générique creux.
- Objectif : article utile, lisible, prêt à être relu puis publié.` }] }],
    max_output_tokens: 9000,
    text: { format: { type: "json_schema", name: "mdrenov_blog_article", strict: true, schema: { type: "object", additionalProperties: false, required: ["title", "seo_title", "description", "category_label", "image_alt", "tags", "body"], properties: { title: { type: "string" }, seo_title: { type: "string" }, description: { type: "string" }, category_label: { type: "string" }, image_alt: { type: "string" }, tags: { type: "array", items: { type: "string" } }, body: { type: "string" } } } } }
  });
  if (!response.ok) throw new Error((response.data.error && response.data.error.message) || "Erreur OpenAI pendant la génération.");
  return parseGeneratedArticle(extractOutputText(response.data));
}

async function githubPathExists(repository, branch, token, filePath) {
  const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`;
  const response = await httpsJson(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "mdrenov-blog-admin" } });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(response.data.message || "Impossible de vérifier le fichier GitHub.");
  return true;
}

async function createGithubFile({ repository, branch, token, filePath, content }) {
  const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`;
  const response = await httpsJson(url, { method: "PUT", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "mdrenov-blog-admin" } }, { message: `Create AI draft: ${filePath}`, branch, content: Buffer.from(content, "utf8").toString("base64") });
  if (!response.ok) throw new Error(response.data.message || "Impossible de créer le fichier GitHub.");
  return response.data;
}

async function uniqueArticlePath(repository, branch, token, title) {
  const base = slugify(title) || `article-${Date.now()}`;
  let candidate = `content/articles/${base}.md`;
  let index = 2;
  while (await githubPathExists(repository, branch, token, candidate)) { candidate = `content/articles/${base}-${index}.md`; index += 1; }
  return candidate;
}

module.exports = async function formatArticle(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); sendJson(res, 405, { error: "Méthode non autorisée." }); return; }
  try {
    const brief = await readJson(req);
    if (!brief.title || !brief.category || !brief.main_keyword) { sendJson(res, 400, { error: "Titre, catégorie et mot-clé principal sont obligatoires." }); return; }
    const token = process.env.GITHUB_CONTENT_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) { sendJson(res, 500, { error: "GITHUB_CONTENT_TOKEN est manquant dans les variables d'environnement Vercel." }); return; }
    const repository = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
    const article = await openaiGenerateArticle(brief);
    const markdown = buildMarkdown(article, brief);
    const filePath = await uniqueArticlePath(repository, branch, token, article.title || brief.title);
    const github = await createGithubFile({ repository, branch, token, filePath, content: markdown });
    sendJson(res, 200, { ok: true, status: "draft", filePath, title: article.title, seo_title: article.seo_title, description: article.description, markdown, githubUrl: github.content && github.content.html_url ? github.content.html_url : null, message: "Article généré en brouillon. Relis-le dans Decap avant publication." });
  } catch (error) { sendJson(res, 500, { error: error.message || "Erreur serveur." }); }
};
