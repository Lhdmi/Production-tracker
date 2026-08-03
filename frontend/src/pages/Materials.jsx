import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Search, Loader2, Boxes } from "lucide-react";
import { api, formatDate, MATERIAL_STATUS } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { Spinner, ErrorState } from "../components/States";
import { Modal } from "../components/Modal";

const STATUS_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "compliant", label: "Conforme" },
  { value: "non_compliant", label: "Non conforme" }
];

const EMPTY = {
  lotNumber: "",
  otNumber: "",
  designation: "",
  reference: "",
  supplier: "",
  quantity: "",
  bestBefore: "",
  productionDate: "",
  qualityStatus: "pending",
  editing: false,
  id: null
};

export default function Materials() {
  const toast = useToast();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const pageSize = 25;

  const load = () => {
    setError("");
    api
      .get(`/api/materials?q=${encodeURIComponent(q)}&status=${status}&page=${page}&pageSize=${pageSize}`)
      .then(setData)
      .catch((err) => setError(err.message));
  };

  useEffect(load, [q, status, page]);

  function openCreate() {
    setForm({ ...EMPTY });
  }

  function openEdit(m) {
    setForm({
      lotNumber: m.lotNumber,
      otNumber: m.otNumber || "",
      designation: m.designation || "",
      reference: m.reference || "",
      supplier: m.supplier || "",
      quantity: m.quantity != null ? String(m.quantity) : "",
      bestBefore: m.bestBefore || "",
      productionDate: m.productionDate || "",
      qualityStatus: m.qualityStatus || "pending",
      editing: true,
      id: m.id
    });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const body = {
      lotNumber: form.lotNumber,
      otNumber: form.otNumber,
      designation: form.designation,
      reference: form.reference,
      supplier: form.supplier,
      quantity: form.quantity ? Number(form.quantity) : null,
      bestBefore: form.bestBefore || null,
      productionDate: form.productionDate || null,
      qualityStatus: form.qualityStatus
    };
    try {
      if (form.editing) {
        await api.patch(`/api/materials/${form.id}`, body);
        toast.success("Lot MP modifié");
      } else {
        await api.post("/api/materials", body);
        toast.success("Lot MP enregistré");
      }
      setForm(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    try {
      await api.del(`/api/materials/${id}`);
      toast.success("Lot MP supprimé");
      setConfirmId(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirmId(null);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Boxes className="size-6 text-amber-500" />
            Matières premières
          </h1>
          <p className="text-sm font-semibold text-slate-500">Traçabilité des lots MP et de leurs données</p>
        </div>
        <button
          onClick={openCreate}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm active:scale-[0.98]"
        >
          <Plus className="size-5" />
          Ajouter
        </button>
      </header>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="N° lot, désignation, référence, fournisseur…"
              className="w-full rounded-xl border-2 border-slate-300 py-3 pl-10 pr-3 text-sm font-semibold focus:border-amber-400 focus:outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border-2 border-slate-300 px-2 py-3 text-sm font-semibold focus:border-amber-400 focus:outline-none"
          >
            <option value="">Statut</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data ? (
        <>
          <ul className="flex flex-col gap-3">
            {data.rows.length === 0 && (
              <li className="rounded-2xl bg-white p-6 text-center text-sm font-semibold text-slate-400 ring-1 ring-slate-200">
                Aucun lot MP trouvé.
              </li>
            )}
            {data.rows.map((m) => {
              const st = MATERIAL_STATUS[m.qualityStatus] || MATERIAL_STATUS.pending;
              return (
                <li key={m.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-base font-black text-slate-900">{m.lotNumber}</p>
                      {m.designation && <p className="truncate font-bold text-slate-700">{m.designation}</p>}
                      <p className="text-xs font-semibold text-slate-500">
                        {[m.reference, m.supplier, m.otNumber && `OT ${m.otNumber}`].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {m.quantity != null && <span>{m.quantity} kg · </span>}
                        {m.productionDate && <span>Prod. {formatDate(m.productionDate)} · </span>}
                        {m.bestBefore && <span>BB {formatDate(m.bestBefore)}</span>}
                        <span className="ml-1">· {m.linkedLots} lot(s) PF</span>
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
                    <button
                      onClick={() => openEdit(m)}
                      className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Modifier"
                    >
                      <Pencil className="size-4" />
                    </button>
                    {(user.role === "manager" || user.role === "admin") && (
                      <button
                        onClick={() => setConfirmId(m.id)}
                        className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                ← Précédent
              </button>
              <span className="text-sm font-bold text-slate-500">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      ) : (
        <Spinner label="Chargement des lots MP…" />
      )}

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.editing ? "Modifier le lot MP" : "Nouveau lot MP"}
      >
        {form && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Numéro de lot MP *</label>
              <input
                value={form.lotNumber}
                onChange={(e) => setForm({ ...form, lotNumber: e.target.value.toUpperCase() })}
                required
                autoCapitalize="characters"
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 font-mono text-lg font-black uppercase focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">N° OT</label>
                <input
                  value={form.otNumber}
                  onChange={(e) => setForm({ ...form, otNumber: e.target.value })}
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Référence</label>
                <input
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Désignation (produit)</label>
              <input
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Fournisseur</label>
                <input
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Quantité (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Date de production</label>
                <input
                  type="date"
                  value={form.productionDate}
                  onChange={(e) => setForm({ ...form, productionDate: e.target.value })}
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Best before</label>
                <input
                  type="date"
                  value={form.bestBefore}
                  onChange={(e) => setForm({ ...form, bestBefore: e.target.value })}
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Statut qualité</label>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm({ ...form, qualityStatus: s.value })}
                    className={`rounded-xl px-2 py-3 text-sm font-black ring-2 transition ${
                      form.qualityStatus === s.value
                        ? "bg-slate-900 text-white ring-slate-900"
                        : "bg-white text-slate-600 ring-slate-300"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-black text-white disabled:opacity-50 active:scale-[0.99]"
            >
              {saving && <Loader2 className="size-5 animate-spin" />}
              {saving ? "Enregistrement…" : form.editing ? "Enregistrer les modifications" : "Créer le lot MP"}
            </button>
          </form>
        )}
      </Modal>

      <Modal open={confirmId !== null} onClose={() => setConfirmId(null)} title="Supprimer ce lot MP ?">
        <p className="text-slate-600">
          La suppression est impossible si le lot est lié à des lots PF (traçabilité). Dans ce cas, déliez-le d'abord.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setConfirmId(null)}
            className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 active:scale-95"
          >
            Annuler
          </button>
          <button onClick={() => remove(confirmId)} className="flex-1 rounded-xl bg-rose-600 px-4 py-3 font-black text-white active:scale-95">
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  );
}
