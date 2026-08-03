import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Scale, Trash2, AlertTriangle, CheckCircle2, RotateCcw, Clock,
  User, Package
} from "lucide-react";
import { api, formatDateTime } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { LotBadge, AnomalyBadge, SeverityBadge } from "../components/Badge";
import Numpad from "../components/Numpad";
import BatchVerification from "../components/BatchVerification";
import QualityChecklist from "../components/QualityChecklist";
import LotDocuments from "../components/LotDocuments";
import LotHistory from "../components/LotHistory";
import { PhotoGallery } from "../components/PhotoGallery";
import { Spinner, ErrorState } from "../components/States";
import { Modal } from "../components/Modal";

export default function LotDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [lot, setLot] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingWeight, setSavingWeight] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [batchVerified, setBatchVerified] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(`/api/lots/${id}`)
      .then(setLot)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Chargement du lot…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!lot) return null;

  const canManage = user.role === "admin" || user.role === "manager" || lot.createdById === user.id;

  const weights = lot.weights || [];
  const sum = weights.reduce((a, w) => a + w.weight, 0);
  const count = weights.length;
  const min = count ? Math.min(...weights.map((w) => w.weight)) : null;
  const max = count ? Math.max(...weights.map((w) => w.weight)) : null;
  const avg = count ? sum / count : null;

  async function addWeight(value) {
    setSavingWeight(true);
    try {
      await api.post(`/api/lots/${id}/weights`, { weight: value });
      toast.success(`Poids ${value} kg enregistré`);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingWeight(false);
    }
  }

  async function deleteWeight(weightId) {
    try {
      await api.del(`/api/lots/${id}/weights/${weightId}`);
      toast.success("Relevé supprimé");
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function setStatus(status, doneLabel) {
    try {
      await api.patch(`/api/lots/${id}`, { status });
      toast.success(doneLabel);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteLot() {
    try {
      await api.del(`/api/lots/${id}`);
      toast.success("Lot supprimé");
      navigate("/recherche");
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl bg-slate-900 p-5 text-white shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-mono text-xs font-bold text-slate-400">OP {lot.opNumber}</p>
            <p className="text-2xl font-black tracking-tight">{lot.lotNumber}</p>
          </div>
          <LotBadge status={lot.status} large />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-slate-300">
          <span className="flex items-center gap-1.5">
            <User className="size-4" /> {lot.createdByName}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" /> {formatDateTime(lot.createdAt)}
          </span>
          {lot.completedAt && (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-400" /> Terminé {formatDateTime(lot.completedAt)}
            </span>
          )}
        </div>
      </header>

      <BatchVerification
        lotId={lot.id}
        lotNumber={lot.lotNumber}
        verified={batchVerified}
        onVerified={setBatchVerified}
      />

      {canManage && batchVerified && (
        <button
          onClick={() => navigate(`/anomalies/nouvelle?lot=${id}`)}
          className="flex h-16 items-center justify-center gap-3 rounded-2xl bg-rose-600 text-lg font-black text-white shadow-md transition active:scale-[0.98]"
        >
          <AlertTriangle className="size-7 animate-pulse" />
          Déclarer une anomalie
        </button>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900">
          <Scale className="size-5 text-slate-400" />
          Relevés de poids
        </h2>

        {canManage && lot.status !== "completed" && batchVerified ? (
          <Numpad onSave={addWeight} saving={savingWeight} />
        ) : canManage && lot.status !== "completed" && !batchVerified ? (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
            Vérifiez d'abord le code batch ci-dessus pour déverrouiller la saisie des poids.
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
            {lot.status === "completed"
              ? "Lot terminé — reprenez le lot pour ajouter des poids."
              : "Saisie non autorisée pour ce lot."}
            {lot.status === "completed" && canManage && (
              <button
                onClick={() => setStatus("in_progress", "Lot repris")}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 font-bold text-white"
              >
                <RotateCcw className="size-4" />
                Reprendre
              </button>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: "Relevés", value: count },
            { label: "Total", value: count ? `${sum.toFixed(3)} kg` : "—" },
            { label: "Moyenne", value: avg ? `${avg.toFixed(2)} kg` : "—" },
            { label: "Min / Max", value: min != null ? `${min} / ${max}` : "—" }
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-slate-50 p-2 text-center ring-1 ring-slate-200">
              <p className="text-[11px] font-bold uppercase text-slate-400">{s.label}</p>
              <p className="mt-0.5 text-sm font-black text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        <ul className="mt-4 flex flex-col divide-y divide-slate-100">
          {weights.length === 0 && (
            <li className="py-3 text-center text-sm font-semibold text-slate-400">
              Aucun relevé — saisissez le premier poids ci-dessus.
            </li>
          )}
          {weights.map((w) => (
            <li key={w.id} className="flex items-center gap-3 py-2.5">
              <span className="w-24 rounded-lg bg-slate-900 px-2 py-1 text-center font-mono text-base font-black tabular-nums text-white">
                {w.weight} kg
              </span>
              <div className="flex-1 text-xs font-semibold text-slate-500">
                <p>{w.createdByName}</p>
                <p>{formatDateTime(w.createdAt)}</p>
              </div>
              {canManage && (
                <button
                  onClick={() => setConfirm({ type: "weight", item: w })}
                  className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Supprimer le relevé"
                >
                  <Trash2 className="size-5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <QualityChecklist lotId={lot.id} canManage={canManage} existing={lot.qualityChecks || []} onSaved={load} />

      <LotDocuments lotId={lot.id} canManage={canManage} documents={lot.documents || []} onUploaded={load} />

      {(user.role === "manager" || user.role === "admin") && <LotHistory lotId={lot.id} />}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900">
          <AlertTriangle className="size-5 text-rose-500" />
          Anomalies ({lot.anomalies?.length || 0})
        </h2>
        {!lot.anomalies?.length && (
          <p className="py-2 text-sm font-semibold text-slate-400">Aucune anomalie déclarée sur ce lot.</p>
        )}
        <ul className="flex flex-col gap-3">
          {lot.anomalies?.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-slate-900">{a.type}</p>
                <div className="flex gap-1.5">
                  <SeverityBadge severity={a.severity} />
                  <AnomalyBadge status={a.status} />
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-600">{a.description}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {a.createdByName} · {formatDateTime(a.createdAt)}
                {a.comment && (
                  <span className="mt-1 block rounded-lg bg-slate-50 p-2 text-slate-600 ring-1 ring-slate-200">
                    <span className="font-bold">Commentaire : </span>
                    {a.comment}
                  </span>
                )}
              </p>
              {a.photos?.length > 0 && (
                <div className="mt-3">
                  <PhotoGallery photos={a.photos} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {lot.status !== "completed" && canManage && (
          <button
            onClick={() => setConfirm({ type: "complete" })}
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-lg font-black text-white shadow-sm transition active:scale-[0.98]"
          >
            <CheckCircle2 className="size-6" />
            Terminer
          </button>
        )}
        {lot.status === "completed" && canManage && (
          <button
            onClick={() => setStatus("in_progress", "Lot repris")}
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-blue-600 text-lg font-black text-white shadow-sm transition active:scale-[0.98]"
          >
            <RotateCcw className="size-6" />
            Reprendre
          </button>
        )}
        {(user.role === "admin" || user.role === "manager") && (
          <button
            onClick={() => setConfirm({ type: "delete" })}
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-rose-100 text-lg font-black text-rose-700 ring-1 ring-rose-200 transition active:scale-[0.98]"
          >
            <Trash2 className="size-6" />
            Supprimer
          </button>
        )}
      </section>

      <Link to="/recherche" className="flex items-center justify-center gap-1.5 pb-2 text-sm font-bold text-slate-500">
        <Package className="size-4" />
        Retour à la liste des lots
      </Link>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.type === "complete" ? "Terminer le lot ?" : confirm?.type === "delete" ? "Supprimer le lot ?" : "Supprimer le relevé ?"}
      >
        <p className="text-slate-600">
          {confirm?.type === "complete"
            ? "Le lot passera au statut « Terminé ». Vous pourrez le reprendre à tout moment."
            : confirm?.type === "delete"
              ? "Cette action est définitive. Tous les poids et anomalies associés seront supprimés."
              : "Cette action est définitive."}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setConfirm(null)}
            className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 active:scale-95"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              const c = confirm;
              setConfirm(null);
              if (c.type === "complete") setStatus("completed", "Lot terminé");
              else if (c.type === "delete") deleteLot();
              else deleteWeight(c.item.id);
            }}
            className={`flex-1 rounded-xl px-4 py-3 font-black text-white active:scale-95 ${
              confirm?.type === "complete" ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {confirm?.type === "complete" ? "Terminer" : "Supprimer"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
