const OWNER = "mathisbergerhub";
const REPO = "blog-md-renov";
const PHOTO = "2026-05-27-image-maprimerenov-2026-1-maprimerenov-2026-aide-renovation.png";
const PHOTO_SRC = `./uploads/briefs/${PHOTO}`;
const PHOTO_ALT = "Conseiller MD Rénov’ expliquant les aides MaPrimeRénov’ devant une fenêtre à rénover";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

async function github(path, method = "GET", body) {
  const token = process.env.GITHUB_CONTENT_TOKEN;
  if (!token) throw new Error("GITHUB_CONTENT_TOKEN manquant");
  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`, {
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

function featuredImageHtml() {
  return `<div class="mdr-home-media mdr-home-media--featured mdr-media--image"><img src="${PHOTO_SRC}" alt="${PHOTO_ALT}" loading="eager"></div>`;
}

function patchIndex(content) {
  const block = featuredImageHtml();
  return content.replace(
    /<article class="mdr-home-featured"[\s\S]*?<div class="mdr-home-featured__body">/,
    (match) => match.replace(/<div class="mdr-home-media mdr-home-media--featured(?: mdr-media--image)?"[\s\S]*?<\/div>\s*(?=<div class="mdr-home-featured__body">)/, `${block}\n`)
  );
}

function patchFixListingImages(content) {
  if (content.includes("replaceFeaturedMedia")) return content;
  const helper = `\nfunction featuredMediaMarkup(image) {\n  return \`<div class="mdr-home-media mdr-home-media--featured mdr-media--image"><img src="\${escapeHtml(image.src)}" alt="\${escapeHtml(image.alt)}" loading="eager"></div>\`;\n}\n\nfunction replaceFeaturedMedia(html, htmlFile, image) {\n  const escapedFile = htmlFile.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");\n  const featuredRegex = new RegExp(\n    \`(<article class="mdr-home-featured"(?:(?!<article class="mdr-home-featured")[\\\\s\\\\S])*?<a class="mdr-btn mdr-btn--white" href="\\\\./\${escapedFile}">(?:(?!<article class="mdr-home-featured")[\\\\s\\\\S])*?<\\\\/article>)\`,\n    "g",\n  );\n\n  return html.replace(featuredRegex, (articleBlock) =>\n    articleBlock.replace(/<div class="mdr-home-media mdr-home-media--featured(?: mdr-media--image)?"[\\s\\S]*?<\\/div>\\s*(?=<div class="mdr-home-featured__body">)/, \`${featuredMediaMarkup(image)}\\n\`),\n  );\n}\n`;
  let next = content.replace("function replaceArticleMedia(html, htmlFile, image) {", `${helper}\nfunction replaceArticleMedia(html, htmlFile, image) {`);
  next = next.replace(
    "html = replaceArticleMedia(html, htmlFile, image);",
    "html = replaceFeaturedMedia(html, htmlFile, image);\n      html = replaceArticleMedia(html, htmlFile, image);"
  );
  return next;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });
  if (req.body?.password !== "MB74!") return json(res, 401, { error: "Unauthorized" });

  const jobs = [["index.html", patchIndex], ["scripts/fix-listing-images.js", patchFixListingImages]];
  const changed = [];
  for (const [path, patch] of jobs) {
    const file = await readFile(path);
    const next = patch(file.content);
    if (next !== file.content) {
      await writeFile(path, next, file.sha);
      changed.push(path);
    }
  }
  json(res, 200, { ok: true, changed });
}
