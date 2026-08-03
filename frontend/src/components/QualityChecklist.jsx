import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, Loader2, AlertTriangle, CheckCircle2, MinusCircle, UserCheck } from "lucide-react";
import { api, CHECK_STATUS } from "../api";
import { useToast } from "./Toast";
import { Spinner, ErrorState } from "./States";
import { useAuth } from "../context/AuthContext";

const OPTIONS = [
  { value: "compliant", label: "Conforme", cls: "data-[on=true]:bg-emerald-600 data-[on=true]:text-white" },
  { value: "non_compliant", label: "Non conforme", cls: "data-[on=true]:bg-rose-600 data-[on=true]:text-white" },
  { value: "na", label: "N/A", cls: "data-[on=true]:bg-slate-700 data-[on=true]:text-white" }
];

export default function QualityChecklist({ lotId, canManage, existing, onSaved }) {
  const toast = useToast();
  const { user } = useAuth();
  const [checkpoints, setCheckpoints] = useState(null);
  const [error, setError] = useState("");
  const [values, setValues] = useState({});
  const [comments, setComments] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [signing, setSigning] = useState(null);

  const byCheckpoint = useMemo(() => {
    const map = {};
    (existing || []).forEach((c) => {
      map[c.checkpointId] = c;
    });
    return map;
  }, [existing]);

  useEffect(() => {
    api
      .get("/api/quality/checkpoints")
      .then((rows) => {
        setCheckpoints(rows);
        const v = {};
        const cm = {};
        rows.forEach((cp) => {
          const prev = byCheckpoint[cp.id];
          if (prev) {
            v[cp.id] = prev.status;
            cm[cp.id] = prev.comment || "";
          }
        });
        setValues(v);
        setComments(cm);
      })
      .catch((err) => setError(err.message));
  }, [byCheckpoint]);

  if (error) return <ErrorState message={error} />;
  if (!checkpoints) return <Spinner label="Chargement de la checklist…" />;

  const dirtyCount = checkpoints.filter((cp) => values[cp.id]).length;

  async function signSecondVisa(check) {
    setSigning(check.id);
    try {
      await api.post(`/api/lots/${lotId}/quality-checks/${check.id}/second-visa`);
      toast.success("Second visa apposé");
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSigning(null);
    }
  }

  async function save() {
    const checks = checkpoints
      .filter((cp) => values[cp.id])
      .map((cp) => ({
        checkpointId: cp.id,
        status: values[cp.id],
        comment: (comments[cp.id] || "").trim()
      }));
    if (!checks.length) {
      toast.error("Sélectionnez au moins un statut par contrôle.");
      return;
    }
    setSaving(true);
    setLastResult(null);
    try {
      const res = await api.post(`/api/lots/${lotId}/quality-checks`, { checks });
      setLastResult(res);
      toast.success(
        res.anomalyCreated
          ? "Contrôles enregistrés — anomalie ouverte créée automatiquement"
          : "Contrôles qualité enregistrés"
      );
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-slate-900">
        <ClipboardCheck className="size-5 text-slate-400" />
        Contrôle qualité
      </h2>
      <p className="mb-4 text-xs font-semibold text-slate-500">
        Un contrôle « Non conforme » déclenche automatiquement une anomalie ouverte sur le lot.
      </p>

      <ul className="flex flex-col gap-3">
        {checkpoints.map((cp) => {
          const prev = byCheckpoint[cp.id];
          const value = values[cp.id] || "";
          return (
            <li key={cp.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">
                    {cp.name}
                    {cp.requires_second_visa && (
                      <span className="ml-2 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black text-violet-700 ring-1 ring-inset ring-violet-200">
                        Double visa
                      </span>
                    )}
                  </p>
                  {cp.description && <p className="text-xs font-semibold text-slate-500">{cp.description}</p>}
                </div>
                <div className="flex gap-1.5">
                  {OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      data-on={value === o.value}
                      onClick={() => (canManage ? setValues((v) => ({ ...v, [cp.id]: o.value })) : null)}
                      disabled={!canManage}
                      className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ring-slate-300 transition disabled:cursor-not-allowed disabled:opacity-60 ${o.cls} ${
                        value === o.value ? "" : "bg-white text-slate-600"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {value && (
                <input
                  value={comments[cp.id] || ""}
                  onChange={(e) => canManage && setComments((c) => ({ ...c, [cp.id]: e.target.value }))}
                  readOnly={!canManage}
                  placeholder={`Commentaire ${cp.name}…`}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold focus:border-amber-400 focus:outline-none"
                />
              )}

              {value && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-bold">
                  {value === "non_compliant" ? (
                    <span className="flex items-center gap-1 text-rose-600">
                      <AlertTriangle className="size-3.5" /> Non conforme — une anomalie sera proposée
                    </span>
                  ) : value === "compliant" ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="size-3.5" /> Conforme
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-500">
                      <MinusCircle className="size-3.5" /> Non applicable
                    </span>
                  )}
                </p>
              )}

              {prev && prev.id && (
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Dernier contrôle : {prev.createdByName} · {new Date(prev.createdAt).toLocaleString("fr-FR")}
                  {prev.requiresSecondVisa &&
                    (prev.secondValidatedByName ? (
                      <>
                        {" · "}2e visa : {prev.secondValidatedByName} · {new Date(prev.secondValidatedAt).toLocaleString("fr-FR")}
                      </>
                    ) : (
                      <span className="text-amber-600"> · 2e visa en attente</span>
                    ))}
                </p>
              )}

              {prev && prev.requiresSecondVisa && !prev.secondValidatedByName && prev.createdById !== user?.id && (
                <button
                  onClick={() => signSecondVisa(prev)}
                  disabled={signing === prev.id}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-black text-white active:scale-[0.99] disabled:opacity-50"
                >
                  {signing === prev.id ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
                  Signer le 2e visa (vous)
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {lastResult?.anomalyCreated && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
          <p className="flex items-center gap-2 text-sm font-bold text-rose-700">
            <AlertTriangle className="size-5 shrink-0" />
            {lastResult.anomalies.length} anomalie{lastResult.anomalies.length > 1 ? "s" : ""} ouverte
            {lastResult.anomalies.length > 1 ? "s" : ""} automatiquement
          </p>
          <Link to="/anomalies" className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-black text-white">
            Voir
          </Link>
        </div>
      )}

      {canManage && (
        <button
          onClick={save}
          disabled={saving || dirtyCount === 0}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-base font-black text-white disabled:opacity-40 active:scale-[0.99]"
        >
          {saving ? <Loader2 className="size-5 animate-spin" /> : <ClipboardCheck className="size-5" />}
          Enregistrer {dirtyCount > 0 ? `${dirtyCount} contrôle${dirtyCount > 1 ? "s" : ""}` : "les contrôles"}
        </button>
      )}
    </section>
  );
}
