import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Scale, Trash2, AlertTriangle, CheckCircle2, RotateCcw, Clock,
  User, Package, Boxes, Plus, Search, CalendarDays, Loader2
} from "lucide-react";
import { api, formatDateTime, formatDate, MATERIAL_STATUS, SHIFT_LABELS, NET_WEIGHT_LABELS } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { LotBadge, AnomalyBadge, SeverityBadge } from "../components/Badge";
import Numpad from "../components/Numpad";
import BatchVerification from "../components/BatchVerification";
import QualityChecklist from "../components/QualityChecklist";
import CheckSessions from "../components/CheckSessions";
import LotRelease from "../components/LotRelease";
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
  const [matOpen, setMatOpen] = useState(false);
  const [matQuery, setMatQuery] = useState("");
  const [matResults, setMatResults] = useState(null);
  const [matLinking, setMatLinking] = useState(false);

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

  function searchMaterials(q) {
    setMatQuery(q);
    if (q.trim().length < 2) {
      setMatResults(null);
      return;
    }
    api
      .get(`/api/materials?q=${encodeURIComponent(q.trim())}&pageSize=15`)
      .then((d) => setMatResults(d.rows))
      .catch(() => setMatResults([]));
  }

  async function linkMaterial(matId) {
    setMatLinking(true);
    try {
      await api.post(`/api/lots/${id}/raw-materials`, { rawMaterialId: matId });
      toast.success("Lot MP lié au lot PF");
      setMatOpen(false);
      setMatQuery("");
      setMatResults(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMatLinking(false);
    }
  }

  async function unlinkMaterial(matId) {
    try {
      await api.del(`/api/lots/${id}/raw-materials/${matId}`);
      toast.success("Lot MP délié");
      await load();
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
        {lot.productionDate && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/10 p-2.5">
              <p className="text-[11px] font-bold uppercase text-slate-400">Date de production</p>
              <p className="text-sm font-black">
                {formatDate(lot.productionDate)}
                {lot.julianDay != null && (
                  <span className="ml-1.5 text-amber-300">J{lot.julianDay}</span>
                )}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5">
              <p className="text-[11px] font-bold uppercase text-slate-400">Best before</p>
              <p className="text-sm font-black">{formatDate(lot.bestBefore)}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5">
              <p className="text-[11px] font-bold uppercase text-slate-400">Référence / Variété</p>
              <p className="truncate text-sm font-black">
                {lot.productReference || "—"}
                {lot.variety && <span className="text-slate-300"> · {lot.variety}</span>}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5">
              <p className="text-[11px] font-bold uppercase text-slate-400">Usine · Ligne · Indic.</p>
              <p className="font-mono text-sm font-black">
                {lot.plantCode || "—"}
                {lot.line ? ` · ${lot.line}` : ""}
                {lot.batchFlag ? ` · ${lot.batchFlag}` : ""}
                {lot.batchRun ? ` · ${lot.batchRun}` : ""}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5">
              <p className="text-[11px] font-bold uppercase text-slate-400">Équipe</p>
              <p className="text-sm font-black">{lot.shift ? SHIFT_LABELS[lot.shift] || lot.shift : "—"}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5">
              <p className="text-[11px] font-bold uppercase text-slate-400">N° OT</p>
              <p className="truncate text-sm font-black">{lot.otNumber || "—"}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5">
              <p className="text-[11px] font-bold uppercase text-slate-400">Quantité produite</p>
              <p className="text-sm font-black">
                {lot.producedQuantity != null ? `${lot.producedQuantity} pièces` : "—"}
                {lot.palletsQuantity != null && <span className="text-slate-300"> · {lot.palletsQuantity} pal.</span>}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5">
              <p className="text-[11px] font-bold uppercase text-slate-400">Poids net (Excel)</p>
              <p className="text-sm font-black">{lot.netWeightStatus ? NET_WEIGHT_LABELS[lot.netWeightStatus] || lot.netWeightStatus : "—"}</p>
            </div>
          </div>
        )}
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

      <CheckSessions lotId={lot.id} canManage={canManage} onSaved={load} />

      <LotRelease lotId={lot.id} canManage={canManage} onSaved={load} />

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <Boxes className="size-5 text-amber-500" />
            Matières premières ({lot.rawMaterials?.length || 0})
          </h2>
          {canManage && (
            <button
              onClick={() => {
                setMatOpen(true);
                setMatQuery("");
                setMatResults(null);
              }}
              className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white active:scale-95"
            >
              <Plus className="size-4" />
              Ajouter
            </button>
          )}
        </div>

        {!lot.rawMaterials?.length && (
          <p className="py-2 text-sm font-semibold text-slate-400">Aucun lot matière première lié.</p>
        )}
        <ul className="flex flex-col gap-3">
          {lot.rawMaterials?.map((m) => {
            const st = MATERIAL_STATUS[m.qualityStatus] || MATERIAL_STATUS.pending;
            return (
              <li key={m.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-base font-black text-slate-900">{m.lotNumber}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">
                      {[m.designation, m.reference, m.otNumber && `OT ${m.otNumber}`, m.supplier].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">
                      {m.quantity != null && <span>{m.quantity} kg · </span>}
                      {m.productionDate && <span>Prod. {formatDate(m.productionDate)} · </span>}
                      {m.bestBefore && <span>BB {formatDate(m.bestBefore)}</span>}
                      {m.linkedByName && <span className="ml-1">· {m.linkedByName}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${st.cls}`}>{st.label}</span>
                    {canManage && (
                      <button
                        onClick={() => unlinkMaterial(m.id)}
                        className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Délier ce lot MP"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

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

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm?.type === "complete" ? "Terminer le lot ?" : confirm?.type === "delete" ? "Supprimer le lot ?" : "Supprimer le relevé ?"}>
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

      <Modal open={matOpen} onClose={() => setMatOpen(false)} title="Lier un lot matière première">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={matQuery}
              onChange={(e) => searchMaterials(e.target.value)}
              placeholder="Rechercher par n° lot, désignation, référence…"
              className="w-full rounded-xl border-2 border-slate-300 py-3 pl-10 pr-3 text-sm font-semibold focus:border-amber-400 focus:outline-none"
            />
          </div>

          {matResults === null ? (
            <p className="py-3 text-center text-sm font-semibold text-slate-400">
              Saisissez au moins 2 caractères pour rechercher.
            </p>
          ) : matResults.length === 0 ? (
            <p className="py-3 text-center text-sm font-semibold text-slate-400">Aucun lot MP trouvé.</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {matResults.map((m) => {
                const st = MATERIAL_STATUS[m.qualityStatus] || MATERIAL_STATUS.pending;
                const already = lot.rawMaterials?.some((r) => r.id === m.id);
                return (
                  <li key={m.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-black text-slate-900">{m.lotNumber}</p>
                        <p className="truncate text-xs font-semibold text-slate-500">
                          {[m.designation, m.reference, m.supplier].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    {already ? (
                      <p className="mt-2 text-xs font-bold text-emerald-600">Déjà lié</p>
                    ) : (
                      <button
                        onClick={() => linkMaterial(m.id)}
                        disabled={matLinking}
                        className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50 active:scale-[0.98]"
                      >
                        {matLinking ? <Loader2 className="mx-auto size-4 animate-spin" /> : <CalendarDays className="mx-auto size-4" />}
                        Lier ce lot MP
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}
