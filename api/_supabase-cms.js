const { createClient } = require("@supabase/supabase-js");
const { parseFrontmatter } = require("../scripts/sync-content");

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://ykevjcofqrpfxqgwzjis.supabase.co").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const IMAGE_BUCKET = process.env.SUPABASE_BLOG_IMAGE_BUCKET || "blog-images";

let client;

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function getClient() {
  if (!isConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

function cleanTagList(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
  const value = String(tags || "").trim();
  if (!value || value === "[]") return [];
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function slugFromPath(value = "") {
  return String(value || "")
    .replace(/^content\/articles\//, "")
    .replace(/^content\/archive\/articles\/\d{4}-\d{2}-\d{2}-/, "")
    .replace(/^content\/archive\/articles\//, "")
    .replace(/\.html\.md$/, "")
    .replace(/\.md$/, "")
    .replace(/\.html$/, "")
    .replace(/^\/+/, "");
}

function articleRecordFromMarkdown(filePath, markdown, fallback = {}) {
  const parsed = parseFrontmatter(markdown);
  const data = parsed.data || {};
  const slug = slugFromPath(data.source_html || filePath || data.slug || data.title || fallback.slug);
  const htmlPath = String(data.source_html || `${slug}.html`).replace(/^\.?\//, "");

  return {
    slug,
    source_path: filePath || data.source_path || `${slug}.html.md`,
    html_path: htmlPath,
    title: data.title || fallback.title || slug,
    seo_title: data.seo_title || data.title || fallback.title || slug,
    description: data.description || fallback.description || "",
    category: data.category || fallback.category || "exterieur",
    category_label: data.category_label || fallback.category_label || "Conseils",
    published_on: data.date || fallback.date || new Date().toISOString().slice(0, 10),
    modified_on: data.modified_date || data.date || fallback.date || new Date().toISOString().slice(0, 10),
    reading_time: data.reading_time || fallback.reading_time || "4 min",
    featured_image: data.featured_image || fallback.featured_image || "",
    image_alt: data.image_alt || data.title || fallback.title || "",
    tags: cleanTagList(data.tags || fallback.tags),
    content_markdown: parsed.body || fallback.content_markdown || "",
    frontmatter: data,
    published: data.published !== false,
  };
}

function yamlString(value = "") {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function markdownFromRow(row) {
  const tags = cleanTagList(row.tags);
  const tagBlock = tags.length ? `tags:\n${tags.map((tag) => `  - ${yamlString(tag)}`).join("\n")}` : "tags: []";
  return `---
content_type: 'article'
published: ${row.published ? "true" : "false"}
title: ${yamlString(row.title)}
seo_title: ${yamlString(row.seo_title || row.title)}
description: ${yamlString(row.description || "")}
category: ${yamlString(row.category || "exterieur")}
category_label: ${yamlString(row.category_label || "Conseils")}
date: ${yamlString(row.published_on || "")}
modified_date: ${yamlString(row.modified_on || row.published_on || "")}
reading_time: ${yamlString(row.reading_time || "4 min")}
featured_image: ${yamlString(row.featured_image || "")}
image_alt: ${yamlString(row.image_alt || row.title || "")}
source_html: ${yamlString(`./${row.html_path || `${row.slug}.html`}`)}
${tagBlock}
---

${row.content_markdown || `# ${row.title || "Article"}`}
`;
}

function rowToItem(row, includeMarkdown = false) {
  const isPublic = Boolean(row.published) && !row.archived;
  return {
    collection: row.archived ? "archived_articles" : "articles",
    group: "articles",
    typeLabel: row.archived ? "Article archive" : "Article",
    title: row.title || row.slug,
    seo_title: row.seo_title || "",
    description: row.description || "",
    category: row.category_label || row.category || "",
    category_value: row.category || "",
    category_label: row.category_label || "",
    tags: cleanTagList(row.tags),
    status: row.archived ? "archived" : row.published ? "published" : "draft",
    archived: Boolean(row.archived),
    published: Boolean(row.published),
    date: row.published_on || "",
    reading_time: row.reading_time || "",
    image_alt: row.image_alt || "",
    featured_image: row.featured_image || "",
    filePath: row.source_path || row.html_path || `${row.slug}.html.md`,
    htmlPath: row.archived ? "" : row.html_path,
    publicUrl: isPublic && row.html_path ? `https://blog.mdrenov-menuiserie.com/${String(row.html_path).replace(/\.html$/, "")}` : null,
    markdown: includeMarkdown ? markdownFromRow(row) : undefined,
  };
}

async function listArticles({ includeArchived = true, publicOnly = false } = {}) {
  const supabase = getClient();
  let query = supabase
    .from("blog_articles")
    .select("*")
    .order("published_on", { ascending: false })
    .order("title", { ascending: true });

  if (!includeArchived) query = query.eq("archived", false);
  if (publicOnly) query = query.eq("published", true).eq("archived", false);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

async function findArticle(identifier, { publicOnly = false } = {}) {
  const supabase = getClient();
  const normalized = String(identifier || "").replace(/^\.?\//, "").replace(/^\/+/, "");
  const slug = slugFromPath(normalized);
  let query = supabase
    .from("blog_articles")
    .select("*")
    .or(`slug.eq.${slug},html_path.eq.${normalized},source_path.eq.${normalized}`)
    .limit(1)
    .maybeSingle();
  if (publicOnly) query = query.eq("published", true).eq("archived", false);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || null;
}

async function upsertArticleFromMarkdown({ filePath, markdown, archived = false }) {
  const supabase = getClient();
  const record = articleRecordFromMarkdown(filePath, markdown);
  record.archived = Boolean(archived);
  record.archived_at = archived ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from("blog_articles")
    .upsert(record, { onConflict: "slug" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateArticleFromMarkdown({ identifier, markdown, archived }) {
  const existing = await findArticle(identifier);
  if (!existing) throw new Error("Article introuvable dans Supabase.");
  const record = articleRecordFromMarkdown(existing.source_path || identifier, markdown, existing);
  record.slug = existing.slug;
  record.html_path = existing.html_path;
  record.source_path = existing.source_path;
  if (typeof archived === "boolean") {
    record.archived = archived;
    record.archived_at = archived ? (existing.archived_at || new Date().toISOString()) : null;
  } else {
    record.archived = existing.archived;
    record.archived_at = existing.archived_at;
  }
  const { data, error } = await getClient()
    .from("blog_articles")
    .update(record)
    .eq("id", existing.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function setArchived(identifier, archived) {
  const existing = await findArticle(identifier);
  if (!existing) throw new Error("Article introuvable dans Supabase.");
  const { data, error } = await getClient()
    .from("blog_articles")
    .update({
      archived: Boolean(archived),
      archived_at: archived ? new Date().toISOString() : null,
      published: archived ? existing.published : true,
    })
    .eq("id", existing.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteArticle(identifier) {
  const existing = await findArticle(identifier);
  if (!existing) throw new Error("Article introuvable dans Supabase.");
  const { error } = await getClient().from("blog_articles").delete().eq("id", existing.id);
  if (error) throw new Error(error.message);
  return existing;
}

async function uploadImage({ slug, photo }) {
  const match = String(photo && photo.dataUrl ? photo.dataUrl : "").match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return "";
  const mimeType = match[1];
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const bytes = Buffer.from(match[2], "base64");
  const fileName = `${slug}-${Date.now()}.${extension}`;
  const objectPath = `articles/${fileName}`;
  const { error } = await getClient()
    .storage
    .from(IMAGE_BUCKET)
    .upload(objectPath, bytes, { contentType: mimeType, upsert: true });
  if (error) throw new Error(error.message);
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${objectPath}`;
}

module.exports = {
  articleRecordFromMarkdown,
  deleteArticle,
  findArticle,
  isConfigured,
  listArticles,
  markdownFromRow,
  rowToItem,
  setArchived,
  updateArticleFromMarkdown,
  uploadImage,
  upsertArticleFromMarkdown,
};
