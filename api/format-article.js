function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = async function formatArticle(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "Méthode non autorisée." });
    return;
  }

  sendJson(res, 410, {
    error: "La génération IA automatique est désactivée pour éviter toute facturation OpenAI. Utilise /api/create-brief.",
  });
};
