import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Camera, X, Send, PackageSearch, Check } from "lucide-react";
import { api, formatDateTime } from "../api";
import { useToast } from "../components/Toast";
import { SeverityBadge } from "../components/Badge";
import { Spinner, EmptyState } from "../components/States";

const ANOMALY_TYPES = [
  "Défaut d'apparence",
  "Masse hors tolérance",
  "Dimension incorrecte",
  "Problème fonctionnel",
  "Emballage / étiquetage",
  "Matière première",
  "Autre"
];

const SEVERITIES = [
  { value: "low", label: "Faible", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
  { value: "medium", label: "Moyenne", cls: "bg-amber-100 text-amber-800 ring-amber-300" },
  { value: "high", label: "Élevée", cls: "bg-orange-100 text-orange-800 ring-orange-300" },
  { value: "critical", label: "Critique", cls: "bg-rose-100 text-rose-800 ring-rose-300" }
];

export default function AnomalyForm() {
  const [searchParams] = useSearchParams();
  const lotParam = searchParams.get("lot");
  const navigate = useNavigate();
  const toast = useToast();

  const [lot, setLot] = useState(lotParam ? { id: Number(lotParam), loading: true } : null);
  const [lotLoadError, setLotLoadError] = useState("");
  const [lotSearch, setLotSearch] = useState("");
  const [lotResults, setLotResults] = useState(null);
  const [type, setType] = useState("");
  const [customType, setCustomType] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!lotParam) return;
    api
      .get(`/api/lots/${lotParam}`)
      .then((l) => setLot(l))
      .catch((err) => {
        setLotLoadError(err.message || "Lot introuvable");
        setLot(null);
      });
  }, [lotParam, toast]);

  useEffect(() => {
    if (!lotSearch.trim() || lot) {
      setLotResults(null);
      return;
    }
    const timer = setTimeout(() => {
      api.get(`/api/lots?q=${encodeURIComponent(lotSearch.trim())}&pageSize=8`).then((d) => setLotResults(d.rows)).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [lotSearch, lot]);

  function addFiles(files) {
    const imgs = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    setPhotos((p) => [...p, ...imgs.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  }

  function removePhoto(index) {
    setPhotos((p) => p.filter((_, i) => i !== index));
  }

  async function submit(e) {
    e.preventDefault();
    if (!lot || !lot.id) {
      toast.error("Sélectionnez un lot d'abord");
      return;
    }
    const finalType = type === "Autre" ? customType.trim() : type;
    if (!finalType || !description.trim()) {
      toast.error("Renseignez le type et la description");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("type", finalType);
      fd.append("description", description.trim());
      fd.append("severity", severity);
      photos.forEach((p) => fd.append("photos", p.file));
      await api.upload(`/api/lots/${lot.id}/anomalies`, fd);
      toast.success("Anomalie déclarée");
      navigate(`/lots/${lot.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (lotParam && lot?.loading) {
    return <Spinner label="Chargement du lot…" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black text-rose-700">
          <AlertTriangle className="size-6" />
          Déclarer une anomalie
        </h1>
      </header>

      {lotLoadError && (
        <div className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
          {lotLoadError} — veuillez choisir un lot manuellement.
        </div>
      )}

      {!lot ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <label className="mb-1.5 block text-sm font-bold text-slate-700">Choisir un lot concerné</label>
          <div className="relative">
            <input
              value={lotSearch}
              onChange={(e) => setLotSearch(e.target.value)}
              placeholder="Rechercher par OP ou numéro de lot…"
              className="w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {lotResults === null && lotSearch.trim() === "" && (
              <EmptyState
                icon={<PackageSearch className="size-10 text-slate-300" />}
                title="Recherchez le lot concerné"
                hint="Utilisez le numéro d'OP ou le numéro de lot."
              />
            )}
            {lotResults?.map((l) => (
              <button
                key={l.id}
                onClick={() => setLot(l)}
                className="flex items-center justify-between rounded-xl border-2 border-slate-200 p-3 text-left transition active:scale-[0.99]"
              >
                <div>
                  <p className="font-mono font-bold text-slate-900">
                    {l.opNumber} · {l.lotNumber}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">{formatDateTime(l.createdAt)}</p>
                </div>
                <span className="rounded-lg bg-emerald-600 p-1.5 text-white"><Check className="size-4" /></span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-2xl bg-slate-900 p-4 text-white">
          <p className="text-xs font-bold text-slate-400">Lot concerné</p>
          <p className="font-mono text-xl font-black">
            {lot.opNumber} · {lot.lotNumber}
          </p>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-5">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <label className="mb-2 block text-sm font-bold text-slate-700">Type d'anomalie</label>
          <div className="flex flex-wrap gap-2">
            {ANOMALY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-xl px-4 py-3 text-sm font-bold ring-2 transition active:scale-95 ${
                  type === t ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {type === "Autre" && (
            <input
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="Précisez le type…"
              className="mt-3 w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg focus:border-amber-400 focus:outline-none"
            />
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <label className="mb-2 block text-sm font-bold text-slate-700">Niveau de gravité</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEVERITIES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSeverity(s.value)}
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-3 ring-2 transition active:scale-95 ${
                  severity === s.value ? `ring-slate-900 ${s.cls}` : "bg-white ring-slate-200 text-slate-500"
                }`}
              >
                <SeverityBadge severity={s.value} />
                <span className="text-xs font-bold">{s.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <label htmlFor="desc" className="mb-2 block text-sm font-bold text-slate-700">
            Description détaillée
          </label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            placeholder="Décrivez le problème constaté…"
            className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg focus:border-amber-400 focus:outline-none"
          />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-bold text-slate-700">Photos (prises de vue ou upload)</label>
            <span className="text-xs font-semibold text-slate-400">{photos.length} photo{photos.length > 1 ? "s" : ""}</span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {photos.length > 0 && (
            <div className="mb-3 grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-slate-300">
                  <img src={p.preview} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    aria-label="Retirer la photo"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 font-bold text-slate-600 active:scale-[0.98]"
          >
            <Camera className="size-6" />
            {photos.length ? "Ajouter des photos" : "Prendre une photo / importer"}
          </button>
        </section>

        <button
          type="submit"
          disabled={submitting || !lot?.id}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-rose-600 text-lg font-black text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? (
            "Envoi…"
          ) : (
            <>
              <Send className="size-6" />
              Déclarer l'anomalie
            </>
          )}
        </button>
      </form>
    </div>
  );
}
