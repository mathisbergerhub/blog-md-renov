const DEFAULT_REPO = "mathisbergerhub/blog-md-renov";
const DEFAULT_BRANCH = "main";
const https = require("https");

const allowedCollections = {
  articles: { folder: "content/articles", archiveFolder: "content/archive/articles", label: "Article", group: "articles" },
  article_mirrors: { folder: "", archiveFolder: "content/archive/articles", label: "Article du site", group: "articles" },
  archived_articles: { folder: "content/archive/articles", archiveFolder: "content/archive/articles", label: "Article archivé", group: "archived", archived: true },
  archived_briefs: { folder: "content/archive/briefs", archiveFolder: "content/archive/briefs", label: "Brief archivé", group: "archived", archived: true },
  briefs: { folder: "content/briefs", archiveFolder: "content/archive/briefs", label: "Brief", group: "briefs" },
};

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(JSON.parse(req.body || "{}"));
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 7000000) {
        reject(new Error("Requête trop longue."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("JSON invalide.")); }
    });
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
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "mdrenov-blog-admin",
  };
}

function decodeBase64(value = "") {
  return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8");
}

function cleanYamlValue(value = "") {
  const trimmed = String(value).trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
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
    if (listItem && currentList) {
      fields[currentList].push(cleanYamlValue(listItem[1]));
      continue;
    }
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    currentList = null;
    if (!rawValue) {
      fields[key] = [];
      currentList = key;
    } else {
      fields[key] = cleanYamlValue(rawValue);
    }
  }
  return fields;
}

function slugify(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
}

function yamlString(value = "") {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function pathExtension(value = "") {
  const ext = String(value).toLowerCase().match(/\.(png|jpe?g|webp)$/);
  return ext ? `.${ext[1] === "jpeg" ? "jpg" : ext[1]}` : ".jpg";
}

function safeFileName(value = "") {
  const ext = pathExtension(value);
  const base = slugify(String(value).replace(/\.[^.]+$/, "")) || "photo";
  return `${base}${ext}`;
}

function parsePhoto(photo) {
  const dataUrl = String(photo && photo.dataUrl ? photo.dataUrl : "");
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return { name: safeFileName(photo.name || "photo.jpg"), base64: match[2] };
}

function normalizeManagedPath(collection, filePath) {
  const config = allowedCollections[collection];
  const normalized = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!config || normalized.includes("..")) throw new Error("Chemin de contenu non autorisé.");
  if (collection === "article_mirrors") {
    if (normalized.includes("/") || !normalized.endsWith(".html.md")) throw new Error("Chemin d'article non autorisé.");
    return normalized;
  }
  if (config.archived) {
    if (!normalized.startsWith(`${config.folder}/`) || !normalized.endsWith(".md")) throw new Error("Chemin d'archive non autorisé.");
    return normalized;
  }
  if (!normalized.startsWith(`${config.folder}/`) || !normalized.endsWith(".md")) throw new Error("Chemin de contenu non autorisé.");
  return normalized;
}

function rootHtmlPathFromArticle(filePath, fields) {
  const sourceHtml = String(fields.source_html || "").trim();
  if (sourceHtml) return sourceHtml.replace(/^\.?\//, "").replace(/^\/+/, "");
  if (filePath.endsWith(".html.md")) return filePath.replace(/\.md$/, "");
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

async function putGithubFile({ repository, branch, token, filePath, content, base64Content, sha, message }) {
  const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`;
  const payload = { message, branch, content: base64Content || Buffer.from(content, "utf8").toString("base64") };
  if (sha) payload.sha = sha;
  const response = await httpsJson(url, { method: "PUT", headers: githubHeaders(token) }, payload);
  if (!response.ok) throw new Error(response.data.message || `Impossible d'enregistrer ${filePath}.`);
  return response.data;
}

async function deleteGithubFile({ repository, branch, token, filePath, sha, message }) {
  const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`;
  const response = await httpsJson(url, { method: "DELETE", headers: githubHeaders(token) }, { message, branch, sha });
  if (!response.ok) throw new Error(response.data.message || `Impossible de supprimer ${filePath}.`);
  return response.data;
}

async function githubPathExists(repository, branch, token, filePath) {
  return Boolean(await readGithubPath(repository, branch, token, filePath));
}

async function uniqueBriefPath(repository, branch, token, title) {
  const day = new Date().toISOString().slice(0, 10);
  const base = slugify(title) || `modification-${Date.now()}`;
  let candidate = `content/briefs/${day}-${base}.md`;
  let index = 2;
  while (await githubPathExists(repository, branch, token, candidate)) {
    candidate = `content/briefs/${day}-${base}-${index}.md`;
    index += 1;
  }
  return candidate;
}

async function uploadRevisionPhotos({ repository, branch, token, briefPath, photos }) {
  const parsedPhotos = Array.isArray(photos) ? photos.slice(0, 3).map(parsePhoto).filter(Boolean) : [];
  const uploaded = [];
  const briefSlug = briefPath.split("/").pop().replace(/\.md$/, "");
  for (const [index, photo] of parsedPhotos.entries()) {
    if (Buffer.byteLength(photo.base64, "base64") > 2500000) throw new Error(`La photo ${photo.name} dépasse 2,5 Mo.`);
    const filePath = `uploads/briefs/${briefSlug}-${index + 1}-${photo.name}`;
    await putGithubFile({ repository, branch, token, filePath, base64Content: photo.base64, message: `Upload modification photo: ${filePath}` });
    uploaded.push({ filePath, publicPath: `/${filePath}`, name: photo.name });
  }
  return uploaded;
}

async function listManagedContent(repository, branch, token) {
  const results = [];
  for (const [collection, config] of Object.entries(allowedCollections)) {
    const files = await listGithubFolder(repository, branch, token, config.folder);
    const managedFiles = files.filter((item) => item.type === "file" && (collection === "article_mirrors" ? item.name.endsWith(".html.md") : item.name.endsWith(".md")));
    for (const file of managedFiles) {
      if (file.name === ".gitkeep") continue;
      const content = await readGithubPath(repository, branch, token, file.path);
      if (!content) continue;
      const fields = parseFrontmatter(content.content);
      if (collection === "article_mirrors" && fields.content_type !== "article") continue;
      if (collection === "articles" && fields.source_html) continue;
      results.push({
        collection,
        group: config.group,
        typeLabel: config.label,
        title: fields.title || file.name.replace(/\.md$/, ""),
        category: fields.category_label || fields.category || "",
        status: config.archived ? "archived" : fields.status || (fields.published === false ? "draft" : "published"),
        archived: Boolean(config.archived),
        published: fields.published !== false,
        date: fields.date || fields.created_at || "",
        filePath: file.path,
        htmlPath: config.group === "articles" ? rootHtmlPathFromArticle(file.path, fields) : "",
        githubUrl: content.htmlUrl,
      });
    }
  }
  results.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title));
  return results;
}

async function readManagedContent({ repository, branch, token, collection, filePath }) {
  const managedPath = normalizeManagedPath(collection, filePath);
  const source = await readGithubPath(repository, branch, token, managedPath);
  if (!source) throw new Error("Contenu introuvable.");
  const fields = parseFrontmatter(source.content);
  return {
    collection,
    title: fields.title || managedPath.split("/").pop().replace(/\.md$/, ""),
    category: fields.category_label || fields.category || "",
    main_keyword: fields.main_keyword || "",
    filePath: managedPath,
    htmlPath: allowedCollections[collection].group === "articles" ? rootHtmlPathFromArticle(managedPath, fields) : "",
    markdown: source.content,
    githubUrl: source.htmlUrl,
  };
}

function buildRevisionBrief({ source, body, photos }) {
  const createdAt = new Date().toISOString();
  const title = String(body.title || source.title || "").trim();
  const revisionTitle = `Modification - ${title}`;
  const notes = String(body.notes || "").trim();
  const proposedMarkdown = String(body.markdown || "").trim();
  const sources = String(body.sources || "").trim();
  const photoNotes = String(body.photo_notes || "").trim();
  return `---
content_type: 'article_revision_brief'
status: 'pending'
title: ${yamlString(revisionTitle)}
original_title: ${yamlString(title)}
category: ${yamlString(body.category || source.category || "")}
main_keyword: ${yamlString(body.main_keyword || source.main_keyword || "")}
original_file: ${yamlString(source.filePath)}
original_html: ${yamlString(source.htmlPath || "")}
created_at: ${yamlString(createdAt)}
---

# ${revisionTitle}

## Article concerné
- Fichier source : ${source.filePath}
${source.htmlPath ? `- Page publique : /${source.htmlPath}` : "- Page publique : non précisée"}

## Ce qu’il faut modifier
${notes || "Relire les modifications proposées, améliorer le contenu, corriger le SEO et publier proprement."}

## Sources ou informations à ajouter
${sources || "Aucune source supplémentaire indiquée."}

## Photos ajoutées
${photos.length ? photos.map((photo, index) => `- Photo ${index + 1} : ${photo.publicPath}`).join("\n") : "Aucune photo ajoutée dans ce brief de modification."}

## Consignes photo
${photoNotes || "À décider pendant la mise en forme."}

## Version proposée par le back-office
\`\`\`markdown
${proposedMarkdown || source.markdown}
\`\`\`

## Version actuelle avant modification
\`\`\`markdown
${source.markdown}
\`\`\`

## Consigne de traitement
Transformer cette demande en article final propre : corriger le texte, garder l'UX du blog, renforcer le SEO, vérifier les sources, mettre à jour le maillage interne et publier seulement après validation “MAJ”.
`;
}

async function createRevisionBrief({ repository, branch, token, collection, filePath, body }) {
  const source = await readManagedContent({ repository, branch, token, collection, filePath });
  if (allowedCollections[collection].group !== "articles" || allowedCollections[collection].archived) throw new Error("Seuls les articles publiés peuvent être envoyés en modification.");
  const briefPath = await uniqueBriefPath(repository, branch, token, `modification-${source.title}`);
  const photos = await uploadRevisionPhotos({ repository, branch, token, briefPath, photos: body.photos });
  const markdown = buildRevisionBrief({ source, body, photos });
  const github = await putGithubFile({ repository, branch, token, filePath: briefPath, content: markdown, message: `Create article modification brief: ${source.filePath}` });
  return { status: "pending", filePath: briefPath, title: `Modification - ${source.title}`, photos, markdown, githubUrl: github.content && github.content.html_url ? github.content.html_url : null };
}

async function updatePendingBrief({ repository, branch, token, collection, filePath, body }) {
  if (collection !== "briefs") throw new Error("Seuls les briefs en attente peuvent être modifiés ici.");
  const managedPath = normalizeManagedPath(collection, filePath);
  const source = await readGithubPath(repository, branch, token, managedPath);
  if (!source) throw new Error("Brief introuvable.");
  const fields = parseFrontmatter(source.content);
  if (fields.status !== "pending") throw new Error("Ce brief n'est plus en attente.");
  const markdown = String(body.markdown || "").trim();
  if (!markdown || !markdown.startsWith("---")) throw new Error("Le contenu du brief doit conserver son en-tête de configuration.");
  const github = await putGithubFile({ repository, branch, token, filePath: managedPath, sha: source.sha, content: `${markdown}\n`, message: `Update pending brief: ${managedPath}` });
  return { status: "pending", filePath: managedPath, title: parseFrontmatter(markdown).title || fields.title || managedPath.split("/").pop(), githubUrl: github.content && github.content.html_url ? github.content.html_url : null };
}

async function archiveManagedContent({ repository, branch, token, collection, filePath }) {
  const managedPath = normalizeManagedPath(collection, filePath);
  const source = await readGithubPath(repository, branch, token, managedPath);
  if (!source) throw new Error("Contenu introuvable.");
  const archivedMdPath = archivePath(collection, managedPath);
  await putGithubFile({ repository, branch, token, filePath: archivedMdPath, content: source.content, message: `Archive ${managedPath}` });
  await deleteGithubFile({ repository, branch, token, filePath: managedPath, sha: source.sha, message: `Remove archived ${managedPath}` });
  const archived = [archivedMdPath];
  const deleted = [managedPath];
  if (allowedCollections[collection].group === "articles") {
    const htmlPath = rootHtmlPathFromArticle(managedPath, parseFrontmatter(source.content));
    const html = await readGithubPath(repository, branch, token, htmlPath);
    if (html && html.type === "file") {
      const archivedHtmlPath = archiveHtmlPath(htmlPath);
      await putGithubFile({ repository, branch, token, filePath: archivedHtmlPath, content: html.content, message: `Archive ${htmlPath}` });
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
  if (collection === "archived_articles" && managedPath.endsWith(".html.md")) {
    const archivedHtmlPath = managedPath.replace(/^content\/archive\/articles\//, "content/archive/html/").replace(/\.md$/, "");
    const archivedHtml = await readGithubPath(repository, branch, token, archivedHtmlPath);
    if (archivedHtml && archivedHtml.type === "file") {
      await deleteGithubFile({ repository, branch, token, filePath: archivedHtmlPath, sha: archivedHtml.sha, message: `Delete ${archivedHtmlPath}` });
      deleted.push(archivedHtmlPath);
    }
  }
  if (allowedCollections[collection].group === "articles") {
    const htmlPath = rootHtmlPathFromArticle(managedPath, parseFrontmatter(source.content));
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
    if (!token) return sendJson(res, 500, { error: "GITHUB_CONTENT_TOKEN est manquant dans les variables d'environnement Vercel." });
    const repository = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;

    if (req.method === "GET") {
      const url = new URL(req.url, "https://blog.mdrenov-menuiserie.com");
      const collection = url.searchParams.get("collection");
      const filePath = url.searchParams.get("filePath");
      if (collection && filePath) return sendJson(res, 200, { ok: true, item: await readManagedContent({ repository, branch, token, collection, filePath }) });
      return sendJson(res, 200, { ok: true, items: await listManagedContent(repository, branch, token) });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return sendJson(res, 405, { error: "Méthode non autorisée." });
    }

    const body = await readJson(req);
    const action = String(body.action || "");
    const collection = String(body.collection || "");
    const filePath = String(body.filePath || "");

    if (action === "archive") return sendJson(res, 200, { ok: true, action, ...(await archiveManagedContent({ repository, branch, token, collection, filePath })) });
    if (action === "delete") {
      if (body.confirm !== "SUPPRIMER") return sendJson(res, 400, { error: "Confirmation requise : écris SUPPRIMER." });
      return sendJson(res, 200, { ok: true, action, ...(await deleteManagedContent({ repository, branch, token, collection, filePath })) });
    }
    if (action === "revision") return sendJson(res, 200, { ok: true, action, ...(await createRevisionBrief({ repository, branch, token, collection, filePath, body })) });
    if (action === "update_brief") return sendJson(res, 200, { ok: true, action, ...(await updatePendingBrief({ repository, branch, token, collection, filePath, body })) });

    return sendJson(res, 400, { error: "Action inconnue." });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Erreur serveur." });
  }
};
