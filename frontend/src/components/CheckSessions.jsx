import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Trash2, Clock, Package, Loader2, AlertTriangle } from "lucide-react";
import { api, CHECK_STATUS } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "./Toast";
import { Spinner, ErrorState } from "./States";
import { Modal } from "./Modal";

const SESSION_TYPES = [
  { value: "sortie_machine", label: "Sortie machine", hint: "3 contrôles par équipe" },
  { value: "carton_palette", label: "Carton & palette", hint: "Jusqu'à 10 par heure" }
];

const ITEM_TEMPLATES = {
  sortie_machine: [
    "Remplissage",
    "Scellage",
    "Centrage",
    "Code batch",
    "Aspect visuel"
  ],
  carton_palette: [
    "Traçabilité correcte",
    "Traçabilité lisible",
    "Contrôle palettisation",
    "Conformité fiche produit + n° carton"
  ]
};

const STATUS_OPTIONS = [
  { value: "compliant", label: "OK", cls: "bg-emerald-600 text-white" },
  { value: "non_compliant", label: "NC", cls: "bg-rose-600 text-white" },
  { value: "na", label: "N/A", cls: "bg-slate-600 text-white" }
];

function StatusBadge({ status }) {
  const st = CHECK_STATUS[status] || CHECK_STATUS.na;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${st.cls}`}>{st.label}</span>;
}

export default function CheckSessions({ lotId, canManage, onSaved }) {
  const toast = useToast();
  const { user } = useAuth();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api
      .get(`/api/lots/${lotId}/sessions`)
      .then(setSessions)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [lotId]);

  function openModal(type) {
    setModal({
      type,
      recordedAt: toLocalInput(new Date()),
      cartonNumber: "",
      comment: "",
      items: ITEM_TEMPLATES[type].map((name) => ({ name, status: "compliant", comment: "" }))
    });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        type: modal.type,
        recordedAt: modal.recordedAt ? new Date(modal.recordedAt).toISOString() : null,
        cartonNumber: modal.cartonNumber,
        comment: modal.comment,
        items: modal.items.map((i) => ({ name: i.name, status: i.status, comment: i.comment }))
      };
      const res = await api.post(`/api/lots/${lotId}/sessions`, body);
      toast.success(
        res.anomalyCreated
          ? "Session enregistrée — anomalie ouverte automatiquement"
          : "Session de contrôle enregistrée"
      );
      setModal(null);
      load();
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(sessionId) {
    try {
      await api.del(`/api/lots/${lotId}/sessions/${sessionId}`);
      toast.success("Session supprimée");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!sessions) return <Spinner label="Chargement des sessions…" />;

  const canDelete = user.role === "admin" || user.role === "manager";

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-slate-900">
        <ClipboardList className="size-5 text-indigo-500" />
        Contrôles structurés
      </h2>
      <p className="mb-4 text-xs font-semibold text-slate-500">
        Sortie machine (3× / équipe) et carton & palette (contrôle par carton). Un point « Non conforme » ouvre une
        anomalie.
      </p>

      {SESSION_TYPES.map((st) => {
        const list = (sessions || []).filter((s) => s.type === st.value);
        return (
          <div key={st.value} className="mb-5 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900">{st.label}</p>
                <p className="text-xs font-semibold text-slate-400">{st.hint} · {list.length} session{list.length > 1 ? "s" : ""}</p>
              </div>
              {canManage && (
                <button
                  onClick={() => openModal(st.value)}
                  className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white active:scale-95"
                >
                  <Plus className="size-4" />
                  Nouvelle session
                </button>
              )}
            </div>

            {list.length === 0 ? (
              <p className="mt-3 py-2 text-center text-sm font-semibold text-slate-400">Aucune session enregistrée.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {list.map((s) => (
                  <li key={s.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <Clock className="size-4 text-slate-400" />
                        {new Date(s.recordedAt).toLocaleString("fr-FR")}
                        {s.cartonNumber && (
                          <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-700 ring-1 ring-inset ring-indigo-200">
                            <Package className="size-3" /> N° {s.cartonNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-400">{s.createdByName}</span>
                        {canDelete && (
                          <button
                            onClick={() => remove(s.id)}
                            className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Supprimer la session"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <ul className="mt-2 flex flex-col gap-1">
                      {s.items.map((i) => (
                        <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-semibold text-slate-700">{i.name}</span>
                          <span className="flex items-center gap-2">
                            {i.status === "non_compliant" && <AlertTriangle className="size-3.5 text-rose-500" />}
                            <StatusBadge status={i.status} />
                          </span>
                        </li>
                      ))}
                    </ul>
                    {s.comment && <p className="mt-2 text-xs font-semibold text-slate-500">💬 {s.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal ? `Nouvelle session — ${SESSION_TYPES.find((t) => t.value === modal.type)?.label}` : ""}>
        {modal && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Date et heure du contrôle</label>
              <input
                type="datetime-local"
                value={modal.recordedAt}
                onChange={(e) => setModal({ ...modal, recordedAt: e.target.value })}
                required
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg font-bold focus:border-amber-400 focus:outline-none"
              />
            </div>

            {modal.type === "carton_palette" && (
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">N° de carton</label>
                <input
                  value={modal.cartonNumber}
                  onChange={(e) => setModal({ ...modal, cartonNumber: e.target.value })}
                  required
                  placeholder="EX : 1 ou 0001"
                  className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg font-bold focus:border-amber-400 focus:outline-none"
                />
              </div>
            )}

            <div>
              <p className="mb-1.5 text-sm font-bold text-slate-700">Points de contrôle</p>
              <ul className="flex flex-col gap-2">
                {modal.items.map((item, idx) => (
                  <li key={item.name} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800">{item.name}</p>
                      <div className="flex gap-1">
                        {STATUS_OPTIONS.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => {
                              const items = [...modal.items];
                              items[idx] = { ...items[idx], status: o.value };
                              setModal({ ...modal, items });
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-black ring-1 ring-slate-300 ${
                              item.status === o.value ? o.cls : "bg-white text-slate-600"
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {item.status === "non_compliant" && (
                      <input
                        value={item.comment}
                        onChange={(e) => {
                          const items = [...modal.items];
                          items[idx] = { ...items[idx], comment: e.target.value };
                          setModal({ ...modal, items });
                        }}
                        placeholder="Détail du défaut…"
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold focus:border-amber-400 focus:outline-none"
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Commentaire global</label>
              <textarea
                value={modal.comment}
                onChange={(e) => setModal({ ...modal, comment: e.target.value })}
                rows={2}
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-base font-black text-white active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-5 animate-spin" /> : <ClipboardList className="size-5" />}
              Enregistrer la session
            </button>
          </form>
        )}
      </Modal>
    </section>
  );
}

function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
