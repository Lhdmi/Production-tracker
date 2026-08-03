import { useEffect, useState } from "react";
import { AlertTriangle, Camera, Check, X, MessageSquarePlus } from "lucide-react";
import { api, formatDateTime } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { SeverityBadge, AnomalyBadge } from "../components/Badge";
import { PhotoGallery } from "../components/PhotoGallery";
import { Modal } from "../components/Modal";
import { Spinner, ErrorState, EmptyState } from "../components/States";

const FILTERS = [
  { value: "", label: "Toutes" },
  { value: "open", label: "Ouvertes" },
  { value: "validated", label: "Validées" },
  { value: "rejected", label: "Rejetées" }
];

export default function Anomalies() {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState("open");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const canValidate = user.role === "manager" || user.role === "admin";

  function load() {
    setError("");
    api
      .get(`/api/anomalies?status=${status}&pageSize=50`)
      .then(setData)
      .catch((err) => setError(err.message));
  }

  useEffect(load, [status]);

  async function validate(nextStatus) {
    setBusy(true);
    try {
      await api.patch(`/api/anomalies/${selected.id}`, {
        status: nextStatus,
        comment: comment.trim()
      });
      toast.success(nextStatus === "validated" ? "Anomalie validée" : "Anomalie rejetée");
      setSelected(null);
      setComment("");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(anomaly) {
    try {
      await api.del(`/api/anomalies/${anomaly.id}`);
      toast.success("Anomalie supprimée");
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black text-slate-900">
          <AlertTriangle className="size-6 text-rose-600" />
          Anomalies
        </h1>
        {canValidate && (
          <p className="text-sm font-semibold text-slate-500">Validez ou rejetez les anomalies déclarées par les opérateurs</p>
        )}
      </header>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ring-1 transition ${
              status === f.value ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300"
            }`}
          >
            {f.label}
            {f.value === "open" && data && data.total > 0 && (
              <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-xs text-white">{data.total}</span>
            )}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data ? (
        data.rows.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="size-10 text-slate-300" />}
            title="Aucune anomalie"
            hint="Les anomalies déclarées apparaîtront ici."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.rows.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => {
                    setSelected(a);
                    setComment(a.comment || "");
                  }}
                  className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-bold text-slate-500">
                        {a.opNumber} · {a.lotNumber}
                      </p>
                      <p className="mt-0.5 text-base font-black text-slate-900">{a.type}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <SeverityBadge severity={a.severity} />
                      <AnomalyBadge status={a.status} />
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-400">
                    <span>{a.createdByName} · {formatDateTime(a.createdAt)}</span>
                    {a.photos?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Camera className="size-3.5" />
                        {a.photos.length} photo{a.photos.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {a.validatedByName && <span className="text-emerald-600">Par {a.validatedByName}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <Spinner label="Chargement…" />
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title="Détail de l'anomalie">
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-bold text-slate-500">
                  {selected.opNumber} · {selected.lotNumber}
                </p>
                <p className="text-lg font-black text-slate-900">{selected.type}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <SeverityBadge severity={selected.severity} />
                <AnomalyBadge status={selected.status} />
              </div>
            </div>
            <p className="text-slate-700">{selected.description}</p>
            <p className="text-xs font-semibold text-slate-400">
              Déclarée par {selected.createdByName} le {formatDateTime(selected.createdAt)}
              {selected.validatedByName && <> · Traitée par {selected.validatedByName}</>}
            </p>

            <PhotoGallery photos={selected.photos} />

            {(selected.status === "open" || selected.status === "rejected" || selected.status === "validated") && (
              <div className="flex flex-col gap-3">
                {selected.comment && (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
                    <span className="font-bold">Commentaire du traitement : </span>
                    {selected.comment}
                  </div>
                )}
              </div>
            )}

            {canValidate && selected.status === "open" && (
              <div className="mt-1 flex flex-col gap-3 border-t border-slate-200 pt-4">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <MessageSquarePlus className="size-4" />
                  Commentaire (optionnel)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-2.5 focus:border-amber-400 focus:outline-none"
                  placeholder="Décision, mesure corrective…"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => validate("rejected")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-3.5 font-black text-slate-700 active:scale-95 disabled:opacity-50"
                  >
                    <X className="size-5" />
                    Rejeter
                  </button>
                  <button
                    onClick={() => validate("validated")}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-black text-white active:scale-95 disabled:opacity-50"
                  >
                    <Check className="size-5" />
                    Valider
                  </button>
                </div>
              </div>
            )}

            {(selected.createdById === user.id || user.role === "admin" || user.role === "manager") && (
              <button
                onClick={() => remove(selected)}
                className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 ring-1 ring-rose-200 active:scale-95"
              >
                Supprimer l'anomalie
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
