import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, GripVertical } from "lucide-react";
import { api, formatDateTime } from "../../api";
import { useToast } from "../../components/Toast";
import { Spinner, ErrorState } from "../../components/States";
import { Modal } from "../../components/Modal";

export default function QualityCheckpoints() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  function load() {
    setError("");
    api
      .get("/api/quality/checkpoints")
      .then(setItems)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function openCreate() {
    setForm({ name: "", description: "", sortOrder: 0, active: true, requiresSecondVisa: false, editing: false });
  }

  function openEdit(cp) {
    setForm({ name: cp.name, description: cp.description || "", sortOrder: cp.sort_order, active: cp.active, requiresSecondVisa: cp.requires_second_visa, editing: true, id: cp.id });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.editing) {
        await api.patch(`/api/quality/checkpoints/${form.id}`, {
          name: form.name,
          description: form.description,
          sortOrder: form.sortOrder,
          active: form.active,
          requiresSecondVisa: form.requiresSecondVisa
        });
        toast.success("Point de contrôle modifié");
      } else {
        await api.post("/api/quality/checkpoints", {
          name: form.name,
          description: form.description,
          sortOrder: form.sortOrder,
          active: form.active,
          requiresSecondVisa: form.requiresSecondVisa
        });
        toast.success("Point de contrôle créé");
      }
      setForm(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(cp) {
    try {
      await api.patch(`/api/quality/checkpoints/${cp.id}`, { active: !cp.active });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function toggleSecondVisa(cp) {
    try {
      await api.patch(`/api/quality/checkpoints/${cp.id}`, { requiresSecondVisa: !cp.requires_second_visa });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove(id) {
    try {
      await api.del(`/api/quality/checkpoints/${id}`);
      toast.success("Point de contrôle supprimé");
      setConfirmId(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirmId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={openCreate}
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-lg font-black text-white shadow-sm active:scale-[0.98]"
      >
        <Plus className="size-6" />
        Ajouter un point de contrôle
      </button>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items ? (
        <ul className="flex flex-col gap-3">
          {items.map((cp) => (
            <li key={cp.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 text-slate-300">
                    <GripVertical className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{cp.name}</p>
                    {cp.description && <p className="truncate text-sm text-slate-500">{cp.description}</p>}
                    <p className="text-xs font-semibold text-slate-400">
                      Ordre {cp.sort_order} · Créé le {formatDateTime(cp.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {cp.requires_second_visa && (
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 ring-1 ring-inset ring-violet-200">
                      Double visa
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${
                      cp.active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-300"
                    }`}
                  >
                    {cp.active ? "Actif" : "Inactif"}
                  </span>
                  <button onClick={() => toggleSecondVisa(cp)} className="rounded-full px-3 py-1.5 text-xs font-bold text-violet-600 ring-1 ring-violet-300 hover:bg-violet-50" aria-label="Basculer double visa">
                    {cp.requires_second_visa ? "1 visa" : "Double visa"}
                  </button>
                  <button onClick={() => openEdit(cp)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Modifier">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => toggleActive(cp)} className="rounded-full px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50" aria-label="Activer / désactiver">
                    {cp.active ? "Désactiver" : "Activer"}
                  </button>
                  <button onClick={() => setConfirmId(cp.id)} className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Supprimer">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Spinner label="Chargement des points de contrôle…" />
      )}

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.editing ? "Modifier le point de contrôle" : "Nouveau point de contrôle"}
      >
        {form && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Nom</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Ex : Contrôle visuel"
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Critère de conformité…"
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Ordre</label>
                <input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">Statut</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, active: !form.active })}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-bold ring-2 transition ${
                    form.active ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-600 ring-slate-300"
                  }`}
                >
                  {form.active ? "Actif" : "Inactif"}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Double visa</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, requiresSecondVisa: !form.requiresSecondVisa })}
                className={`w-full rounded-xl px-4 py-3 text-sm font-bold ring-2 transition ${
                  form.requiresSecondVisa ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-600 ring-slate-300"
                }`}
              >
                {form.requiresSecondVisa ? "2 visas requis (2e utilisateur)" : "1 visa suffisant"}
              </button>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-3.5 font-black text-white active:scale-95 disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : form.editing ? "Enregistrer les modifications" : "Créer le point de contrôle"}
            </button>
          </form>
        )}
      </Modal>

      <Modal open={confirmId !== null} onClose={() => setConfirmId(null)} title="Supprimer ce point de contrôle ?">
        <p className="text-slate-600">
          La suppression est impossible si des contrôles existants y font référence (traçabilité). Dans ce cas, désactivez-le
          plutôt.
        </p>
        <div className="mt-5 flex gap-3">
          <button onClick={() => setConfirmId(null)} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 active:scale-95">
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
