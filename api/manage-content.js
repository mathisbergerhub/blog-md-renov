const DEFAULT_REPO = "mathisbergerhub/blog-md-renov";
const DEFAULT_BRANCH = "main";
const https = require("https");

const allowedCollections = {
  articles: { folder: "content/articles", archiveFolder: "content/archive/articles", label: "Article" },
  briefs: { folder: "content/briefs", archiveFolder: "content/archive/briefs", label: "Brief" },
};

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
      if (body.length > 20000) { reject(new Error("Requête trop longue.")); req.destroy(); }
    });
    req.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("JSON invalide.")); } });
    req.on("error", reject);
  });
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
        try { data = responseBody ? JSON.parse(responseBody) : {}; } catch { data = { raw: responseBody }; }
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, data });
      });
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

function githubHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "mdrenov-blog-admin" };
}

function decodeBase64(value = "") { return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8"); }
function cleanYamlValue(value = "") {
  const trimmed = String(value).trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) return trimmed.slice(1, -1).replace(/''/g, "'");
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return trimmed;
}
function parseFrontmatter(markdown = "") {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields = {};
  let currentList = null;
  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && currentList) { fields[currentList].push(cleanYamlValue(listItem[1])); continue; }
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    currentList = null;
    if (!rawValue) { fields[key] = []; currentList = key; } else { fields[key] = cleanYamlValue(rawValue); }
  }
  return fields;
}

function normalizeManagedPath(collection, filePath) {
  const config = allowedCollections[collection];
  const normalized = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!config || !normalized.startsWith(`${config.folder}/`) || !normalized.endsWith(".md") || normalized.includes("..")) throw new Error("Chemin de contenu non autorisé.");
  return normalized;
}
function rootHtmlPathFromArticle(filePath, fields) {
  const sourceHtml = String(fields.source_html || "").trim();
  if (sourceHtml) return sourceHtml.replace(/^\.?\//, "").replace(/^\/+/, "");
  return `${filePath.split("/").pop().replace(/\.md$/, "")}.html`;
}
function archivePath(collection, filePath) {
  const today = new Date().toISOString().slice(0, 10);
  return `${allowedCollections[collection].archiveFolder}/${today}-${filePath.split("/").pop()}`;
}
function archiveHtmlPath(filePath) {
  const today = new Date().toISOString().slice(0, 10);
  return `content/archive/html/${today}-${filePath.split("/").pop()}`;
}

async function readGithubPath(repository, branch, token, path) {
  const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`;
  const response = await httpsJson(url, { method: "GET", headers: githubHeaders(token) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(response.data.message || `Impossible de lire ${path}.`);
  return { path, name: response.data.name, sha: response.data.sha, htmlUrl: response.data.html_url, content: response.data.content ? decodeBase64(response.data.content) : "", type: response.data.type };
}
async function listGithubFolder(repository, branch, token, folder) {
  const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(folder).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`;
  const response = await httpsJson(url, { method: "GET", headers: githubHeaders(token) });
  if (response.status === 404) return [];
  if (!response.ok || !Array.isArray(response.data)) throw new Error(response.data.message || `Impossible de lister ${folder}.`);
  return response.data;
}
async function createGithubFile({ repository, branch, token, filePath, content, message }) {
  const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`;
  const response = await httpsJson(url, { method: "PUT", headers: githubHeaders(token) }, { message, branch, content: Buffer.from(content, "utf8").toString("base64") });
  if (!response.ok) throw new Error(response.data.message || `Impossible de créer ${filePath}.`);
  return response.data;
}
async function deleteGithubFile({ repository, branch, token, filePath, sha, message }) {
  const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`;
  const response = await httpsJson(url, { method: "DELETE", headers: githubHeaders(token) }, { message, branch, sha });
  if (!response.ok) throw new Error(response.data.message || `Impossible de supprimer ${filePath}.`);
  return response.data;
}

async function listManagedContent(repository, branch, token) {
  const results = [];
  for (const [collection, config] of Object.entries(allowedCollections)) {
    const files = await listGithubFolder(repository, branch, token, config.folder);
    for (const file of files.filter((item) => item.type === "file" && item.name.endsWith(".md"))) {
      if (file.name === ".gitkeep") continue;
      const content = await readGithubPath(repository, branch, token, file.path);
      if (!content) continue;
      const fields = parseFrontmatter(content.content);
      results.push({
        collection,
        typeLabel: config.label,
        title: fields.title || file.name.replace(/\.md$/, ""),
        category: fields.category_label || fields.category || "",
        status: fields.status || (fields.published === false ? "draft" : "published"),
        published: fields.published !== false,
        date: fields.date || fields.created_at || "",
        filePath: file.path,
        htmlPath: collection === "articles" ? rootHtmlPathFromArticle(file.path, fields) : "",
        githubUrl: content.htmlUrl,
      });
    }
  }
  results.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title));
  return results;
}

async function archiveManagedContent({ repository, branch, token, collection, filePath }) {
  const managedPath = normalizeManagedPath(collection, filePath);
  const source = await readGithubPath(repository, branch, token, managedPath);
  if (!source) throw new Error("Contenu introuvable.");
  const archivedMdPath = archivePath(collection, managedPath);
  await createGithubFile({ repository, branch, token, filePath: archivedMdPath, content: source.content, message: `Archive ${managedPath}` });
  await deleteGithubFile({ repository, branch, token, filePath: managedPath, sha: source.sha, message: `Remove archived ${managedPath}` });
  const archived = [archivedMdPath];
  const deleted = [managedPath];
  if (collection === "articles") {
    const fields = parseFrontmatter(source.content);
    const htmlPath = rootHtmlPathFromArticle(managedPath, fields);
    const html = await readGithubPath(repository, branch, token, htmlPath);
    if (html && html.type === "file") {
      const archivedHtmlPath = archiveHtmlPath(htmlPath);
      await createGithubFile({ repository, branch, token, filePath: archivedHtmlPath, content: html.content, message: `Archive ${htmlPath}` });
      await deleteGithubFile({ repository, branch, token, filePath: htmlPath, sha: html.sha, message: `Remove archived ${htmlPath}` });
      archived.push(archivedHtmlPath);
      deleted.push(htmlPath);
    }
  }
  return { archived, deleted };
}

async function deleteManagedContent({ repository, branch, token, collection, filePath }) {
  const managedPath = normalizeManagedPath(collection, filePath);
  const source = await readGithubPath(repository, branch, token, managedPath);
  if (!source) throw new Error("Contenu introuvable.");
  await deleteGithubFile({ repository, branch, token, filePath: managedPath, sha: source.sha, message: `Delete ${managedPath}` });
  const deleted = [managedPath];
  if (collection === "articles") {
    const fields = parseFrontmatter(source.content);
    const htmlPath = rootHtmlPathFromArticle(managedPath, fields);
    const html = await readGithubPath(repository, branch, token, htmlPath);
    if (html && html.type === "file") {
      await deleteGithubFile({ repository, branch, token, filePath: htmlPath, sha: html.sha, message: `Delete ${htmlPath}` });
      deleted.push(htmlPath);
    }
  }
  return { deleted };
}

module.exports = async function manageContent(req, res) {
  try {
    const token = process.env.GITHUB_CONTENT_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) { sendJson(res, 500, { error: "GITHUB_CONTENT_TOKEN est manquant dans les variables d'environnement Vercel." }); return; }
    const repository = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
    if (req.method === "GET") { sendJson(res, 200, { ok: true, items: await listManagedContent(repository, branch, token) }); return; }
    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); sendJson(res, 405, { error: "Méthode non autorisée." }); return; }
    const body = await readJson(req);
    const action = String(body.action || "");
    const collection = String(body.collection || "");
    const filePath = String(body.filePath || "");
    if (action === "archive") { sendJson(res, 200, { ok: true, action, ...(await archiveManagedContent({ repository, branch, token, collection, filePath })) }); return; }
    if (action === "delete") {
      if (body.confirm !== "SUPPRIMER") { sendJson(res, 400, { error: "Confirmation requise : écris SUPPRIMER." }); return; }
      sendJson(res, 200, { ok: true, action, ...(await deleteManagedContent({ repository, branch, token, collection, filePath })) });
      return;
    }
    sendJson(res, 400, { error: "Action inconnue." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erreur serveur." });
  }
};
