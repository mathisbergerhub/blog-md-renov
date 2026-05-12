const DEFAULT_REPO = "mathisbergerhub/blog-md-renov";
const DEFAULT_BRANCH = "main";
const https = require("https");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function httpsJson(url, options) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const request = https.request({
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method || "GET",
      headers: options.headers || {},
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
    request.end();
  });
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "mdrenov-blog-admin",
  };
}

function decodeBase64(value = "") {
  return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8");
}

function parseFrontmatter(markdown = "") {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/''/g, "'");
    fields[key] = value;
  }
  return fields;
}

async function readGithubFile(repository, branch, token, path) {
  const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`;
  const response = await httpsJson(url, { method: "GET", headers: githubHeaders(token) });
  if (!response.ok) throw new Error(response.data.message || `Impossible de lire ${path}.`);
  return { htmlUrl: response.data.html_url, markdown: decodeBase64(response.data.content || "") };
}

module.exports = async function listBriefs(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "Méthode non autorisée." });
    return;
  }

  try {
    const token = process.env.GITHUB_CONTENT_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
      sendJson(res, 500, { error: "GITHUB_CONTENT_TOKEN est manquant dans les variables d'environnement Vercel." });
      return;
    }

    const repository = process.env.GITHUB_REPO || DEFAULT_REPO;
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
    const directoryUrl = `https://api.github.com/repos/${repository}/contents/content/briefs?ref=${encodeURIComponent(branch)}`;
    const directory = await httpsJson(directoryUrl, { method: "GET", headers: githubHeaders(token) });

    if (directory.status === 404) {
      sendJson(res, 200, { ok: true, briefs: [] });
      return;
    }
    if (!directory.ok || !Array.isArray(directory.data)) throw new Error(directory.data.message || "Impossible de lister les briefs.");

    const files = directory.data
      .filter((item) => item.type === "file" && item.name.endsWith(".md"))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 30);

    const briefs = [];
    for (const file of files) {
      const content = await readGithubFile(repository, branch, token, file.path);
      const fields = parseFrontmatter(content.markdown);
      if (fields.status !== "pending") continue;
      briefs.push({
        title: fields.title || file.name.replace(/\.md$/, ""),
        category: fields.category || "",
        main_keyword: fields.main_keyword || "",
        product: fields.product || "",
        location: fields.location || "",
        intent: fields.intent || "",
        created_at: fields.created_at || "",
        filePath: file.path,
        githubUrl: content.htmlUrl,
      });
    }

    briefs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    sendJson(res, 200, { ok: true, briefs });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erreur serveur." });
  }
};
