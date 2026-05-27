const https = require("https");

const REPOSITORY = process.env.GITHUB_REPO || "mathisbergerhub/blog-md-renov";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE_PATH = "admin/manage.html";

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
      message: "Clarify admin archive filters",
      branch: BRANCH,
      sha,
      content: Buffer.from(content, "utf8").toString("base64"),
    },
  );
  if (!response.ok) throw new Error(response.data.message || `Impossible de mettre à jour ${filePath}.`);
  return response.data.commit && response.data.commit.sha;
}

function patchHtml(html) {
  let patched = html
    .replace('<button type="button" class="is-active" data-filter="all">Tous</button>', '<button type="button" class="is-active" data-filter="all">Ouverts</button>')
    .replace('<button type="button" data-filter="archived">Archivés</button>', '<button type="button" data-filter="archived_articles">Articles archivés</button>\n        <button type="button" data-filter="archived_briefs">Briefs traités</button>');

  const oldRenderStart = '    function render() {\n      const visible = activeFilter === "all" ? items : items.filter((item) => (item.group || item.collection) === activeFilter);';
  const newRenderStart = `    function filterItems() {
      if (activeFilter === "all") return items.filter((item) => !item.archived);
      if (activeFilter === "articles") return items.filter((item) => item.group === "articles" && !item.archived);
      if (activeFilter === "briefs") return items.filter((item) => item.group === "briefs" && !item.archived);
      if (activeFilter === "archived_articles") return items.filter((item) => item.collection === "archived_articles");
      if (activeFilter === "archived_briefs") return items.filter((item) => item.collection === "archived_briefs");
      return items;
    }

    function filterLabel() {
      return {
        all: "contenu(s) ouvert(s)",
        articles: "article(s) publié(s)",
        briefs: "brief(s) en attente",
        archived_articles: "article(s) archivé(s)",
        archived_briefs: "brief(s) traité(s)",
      }[activeFilter] || "contenu(s)";
    }

    function render() {
      const visible = filterItems();
      status.textContent = \`${'${visible.length}'} ${'${filterLabel()}'}\`;`;

  patched = patched.replace(oldRenderStart, newRenderStart);
  patched = patched.replace('        status.textContent = `${items.length} contenu(s) trouvé(s).`;\n        render();', '        render();');
  return patched;
}

module.exports = async function fixAdminArchiveFilters(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "Méthode non autorisée." });
    return;
  }

  try {
    const token = process.env.GITHUB_CONTENT_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_CONTENT_TOKEN manquant.");
    const source = await readGithubPath(token, FILE_PATH);
    const patched = patchHtml(source.content);
    if (patched === source.content) {
      sendJson(res, 200, { ok: true, changed: false, message: "Aucune modification nécessaire." });
      return;
    }
    const commit = await updateGithubPath(token, FILE_PATH, source.sha, patched);
    sendJson(res, 200, { ok: true, changed: true, commit });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erreur serveur." });
  }
};
