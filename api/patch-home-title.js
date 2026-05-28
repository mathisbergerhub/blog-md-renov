const https = require("https");

const OWNER = "mathisbergerhub";
const REPO = "blog-md-renov";
const OLD = '<h1>Choisir juste,<br><span class="mdr-script-word">budgéter</span> clair,<br>éviter les erreurs</h1>';
const NEW = '<h1>Mieux choisir,<br><span class="mdr-script-word">budget</span> clair,<br>éviter les erreurs</h1>';

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

function readJson(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try { return Promise.resolve(JSON.parse(req.body || "{}")); }
    catch { return Promise.reject(new Error("JSON invalide.")); }
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(new Error("JSON invalide.")); }
    });
    req.on("error", reject);
  });
}

function githubRequest(path, method, token, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const request = https.request({
      hostname: "api.github.com",
      path: `/repos/${OWNER}/${REPO}/contents/${path}`,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mdrenov-blog-patch",
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {})
      }
    }, (response) => {
      let responseBody = "";
      response.on("data", (chunk) => { responseBody += chunk; });
      response.on("end", () => {
        let data = {};
        try { data = responseBody ? JSON.parse(responseBody) : {}; }
        catch { data = { raw: responseBody }; }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${method} ${path} failed: ${response.statusCode} ${responseBody}`));
          return;
        }
        resolve(data);
      });
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function readFile(path, token) {
  const data = await githubRequest(path, "GET", token);
  return { sha: data.sha, content: Buffer.from(data.content, "base64").toString("utf8") };
}

async function writeFile(path, token, sha, content) {
  return githubRequest(path, "PUT", token, {
    message: "Ajuste le titre de la home",
    content: Buffer.from(content, "utf8").toString("base64"),
    sha
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
    const body = await readJson(req);
    if (body.password !== "MB74!") return sendJson(res, 401, { error: "Unauthorized" });
    const token = process.env.GITHUB_CONTENT_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) return sendJson(res, 500, { error: "GITHUB_CONTENT_TOKEN manquant" });

    const changed = [];
    for (const path of ["index.html", "scripts/sync-content.js"]) {
      const file = await readFile(path, token);
      const next = file.content.replace(OLD, NEW);
      if (next !== file.content) {
        await writeFile(path, token, file.sha, next);
        changed.push(path);
      }
    }
    sendJson(res, 200, { ok: true, changed });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || String(error) });
  }
};
