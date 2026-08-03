// Extraction OCR — V2 (optionnel)
//
// Cette fonction est un point d'extension prêt à brancher sur Tesseract.js
// (reconnaissance locale) ou Google Vision API (nuage).
// Pour l'activer, installez la dépendance souhaitée puis remplissez
// runOcr() afin de retourner le texte brut extrait du fichier image.
//
// Exemple Tesseract.js :
//   import { createWorker } from "tesseract.js";
//   const worker = await createWorker("fra");
//   const { data } = await worker.recognize(imagePath);
//   return data.text;

export async function runOcr(_imagePath) {
  return null;
}
