export function notFound(req, res) {
  res.status(404).json({ error: "Route introuvable" });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error("[error]", err);
  let status = err.status || err.statusCode || 500;
  let message = err.expose ? err.message : "Erreur interne du serveur";

  if (err.name === "MulterError") {
    status = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Fichier trop volumineux (10 Mo max)"
        : "Erreur lors de l'envoi du fichier";
  }

  res.status(status).json({ error: message });
}
