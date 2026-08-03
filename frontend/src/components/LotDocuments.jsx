import { useState } from "react";
import { FileText, Upload, Loader2, ScanText } from "lucide-react";
import { api, formatDateTime } from "../api";
import { useToast } from "./Toast";

export default function LotDocuments({ lotId, canManage, documents, onUploaded }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showOcr, setShowOcr] = useState(null);

  async function upload(e) {
    e.preventDefault();
    if (!file) {
      toast.error("Sélectionnez une photo du document.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim() || "Document");
      fd.append("image", file);
      await api.upload(`/api/lots/${lotId}/documents`, fd);
      toast.success("Document attaché au lot");
      setTitle("");
      setFile(null);
      if (onUploaded) onUploaded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900">
        <FileText className="size-5 text-slate-400" />
        Documents & OCR
      </h2>

      {canManage && (
        <form onSubmit={upload} className="mb-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre (bulletin, fiche contrôle…)"
              className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm font-semibold focus:border-amber-400 focus:outline-none"
            />
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-300 active:scale-95">
              <Upload className="size-4" />
              {file ? file.name : "Photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white disabled:opacity-40 active:scale-[0.99]"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Attacher le document
          </button>
        </form>
      )}

      {!documents?.length && (
        <p className="py-2 text-sm font-semibold text-slate-400">Aucun document attaché à ce lot.</p>
      )}

      <ul className="flex flex-col gap-3">
        {documents?.map((d) => (
          <li key={d.id} className="overflow-hidden rounded-xl border border-slate-200">
            {d.imageUrl && (
              <img
                src={d.imageUrl}
                alt={d.title || "Document"}
                className="max-h-48 w-full bg-slate-100 object-contain"
              />
            )}
            <div className="p-3">
              <p className="font-bold text-slate-900">{d.title}</p>
              <p className="text-xs font-semibold text-slate-400">
                {d.createdByName} · {formatDateTime(d.createdAt)}
              </p>
              {d.ocrText ? (
                <>
                  <button
                    onClick={() => setShowOcr(showOcr === d.id ? null : d.id)}
                    className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 ring-1 ring-blue-200"
                  >
                    <ScanText className="size-4" />
                    {showOcr === d.id ? "Masquer le texte OCR" : "Afficher le texte OCR"}
                  </button>
                  {showOcr === d.id && (
                    <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700 ring-1 ring-slate-200">
                      {d.ocrText}
                    </pre>
                  )}
                </>
              ) : (
                <p className="mt-1.5 text-[11px] font-semibold text-slate-400">OCR non disponible sur ce document</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
