import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX, Loader2, CheckCircle2 } from "lucide-react";
import { api, CHECK_STATUS } from "../api";
import { useToast } from "./Toast";
import { Spinner, ErrorState } from "./States";

const FIELDS = [
  { key: "recordStatus", label: "Feuille d'enregistrement" },
  { key: "resultsStatus", label: "Résultats des contrôles" },
  { key: "netWeightStatus", label: "Poids net des cartons" }
];

const STATUS_OPTIONS = [
  { value: "compliant", label: "Conforme" },
  { value: "non_compliant", label: "Non conforme" },
  { value: "na", label: "N/A" }
];

const EMPTY = {
  recordStatus: "compliant",
  resultsStatus: "compliant",
  netWeightStatus: "compliant",
  released: true,
  comment: ""
};

export default function LotRelease({ lotId, canManage, onSaved }) {
  const toast = useToast();
  const [release, setRelease] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api
      .get(`/api/lots/${lotId}/release`)
      .then((r) => {
        setRelease(r);
        setLoaded(true);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [lotId]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const values = form || editing || EMPTY;
      const res = await api.post(`/api/lots/${lotId}/release`, {
        ...values,
        released: values.released === true || values.released === "true"
      });
      setRelease(res);
      setForm(null);
      toast.success(res.released ? "Production libérée — lot clôturé" : "Libération enregistrée (lot non libéré)");
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!loaded) return <Spinner label="Chargement de la libération…" />;

  const summary = release || {};
  const editing = form || (!release ? EMPTY : null);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-slate-900">
        <ShieldCheck className="size-5 text-emerald-500" />
        Libération du produit
      </h2>
      <p className="mb-4 text-xs font-semibold text-slate-500">
        La libération clôture le lot : les trois conformités et la décision finale sont visées par l'utilisateur.
      </p>

      {release ? (
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap gap-2">
            {FIELDS.map((f) => {
              const st = CHECK_STATUS[summary[f.key]] || CHECK_STATUS.na;
              return (
                <span key={f.key} className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${st.cls}`}>
                  {f.label} : {st.label}
                </span>
              );
            })}
            <span
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ring-1 ring-inset ${
                summary.released
                  ? "bg-emerald-600 text-white ring-emerald-600"
                  : "bg-rose-100 text-rose-800 ring-rose-200"
              }`}
            >
              {summary.released ? <CheckCircle2 className="size-3.5" /> : <ShieldX className="size-3.5" />}
              {summary.released ? "Libéré" : "Non libéré"}
            </span>
          </div>
          {summary.comment && (
            <p className="mt-2 text-sm font-semibold text-slate-600">💬 {summary.comment}</p>
          )}
          <p className="mt-2 text-xs font-semibold text-slate-400">
            Visa : {summary.releasedByName || "—"} ·{" "}
            {summary.releasedAt ? new Date(summary.releasedAt).toLocaleString("fr-FR") : "—"}
          </p>
          {canManage && !form && (
            <button
              onClick={() => setForm({ ...EMPTY, ...summary })}
              className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white active:scale-[0.99]"
            >
              Modifier la libération
            </button>
          )}
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
          Aucune libération enregistrée.
        </p>
      )}

      {canManage && editing && (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {FIELDS.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-bold text-slate-800">{f.label}</p>
                <div className="flex gap-1">
                  {STATUS_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setForm({ ...editing, [f.key]: o.value })}
                      className={`rounded-full px-3 py-1 text-xs font-black ring-1 ring-slate-300 ${
                        editing[f.key] === o.value
                          ? o.value === "compliant"
                            ? "bg-emerald-600 text-white"
                            : o.value === "non_compliant"
                              ? "bg-rose-600 text-white"
                              : "bg-slate-600 text-white"
                          : "bg-white text-slate-600"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Décision finale</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...editing, released: true })}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-black ring-2 transition ${
                  editing.released ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-600 ring-slate-300"
                }`}
              >
                <CheckCircle2 className="size-5" />
                Libéré
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...editing, released: false })}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-black ring-2 transition ${
                  !editing.released ? "bg-rose-600 text-white ring-rose-600" : "bg-white text-slate-600 ring-slate-300"
                }`}
              >
                <ShieldX className="size-5" />
                Non libéré
              </button>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {editing.released ? "La production est libérée — le lot passe au statut « Terminé »." : "Le lot reste ouvert."}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">Commentaire</label>
            <textarea
              value={editing.comment}
              onChange={(e) => setForm({ ...editing, comment: e.target.value })}
              rows={2}
              className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex gap-3">
            {release && (
              <button
                type="button"
                onClick={() => setForm(null)}
                className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 active:scale-95"
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-black text-white active:scale-[0.98] disabled:opacity-50 ${
                editing.released ? "bg-emerald-600" : "bg-rose-600"
              }`}
            >
              {saving ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
              {editing.released ? "Libérer le lot" : "Enregistrer la décision"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
