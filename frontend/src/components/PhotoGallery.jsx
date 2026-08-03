import { useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Modal } from "./Modal";

export function PhotoGallery({ photos, onDelete, emptyHint }) {
  const [index, setIndex] = useState(null);

  if (!photos || photos.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-6 text-sm text-slate-500">
        <Camera className="size-5" />
        {emptyHint || "Aucune photo"}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setIndex(i)}
            className="relative aspect-square overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-300 active:scale-95"
          >
            <img src={p.url} alt="Anomalie" className="size-full object-cover" />
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">1</span>}
          </button>
        ))}
      </div>

      <Modal open={index !== null} onClose={() => setIndex(null)} maxWidth="max-w-3xl" title={`Photo ${index + 1} / ${photos.length}`}>
        <div className="flex flex-col gap-3">
          <div className="relative flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden">
            {photos.length > 1 && (
              <button
                onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
                className="absolute left-2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                aria-label="Précédente"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}
            <img src={photos[index]?.url} alt="Anomalie" className="max-h-[65vh] w-full object-contain" />
            {photos.length > 1 && (
              <button
                onClick={() => setIndex((i) => (i + 1) % photos.length)}
                className="absolute right-2 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
                aria-label="Suivante"
              >
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>
          {onDelete && (
            <button
              onClick={() => {
                onDelete(photos[index]);
                if (photos.length === 1) setIndex(null);
                else setIndex((i) => (i === 0 ? 0 : i - 1));
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 font-bold text-white active:scale-95"
            >
              <Trash2 className="size-5" />
              Supprimer cette photo
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
