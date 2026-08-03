import { useEffect, useState } from "react";
import { UserPlus, Trash2, Pencil } from "lucide-react";
import { api, ROLE_LABELS, formatDateTime } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { Spinner, ErrorState } from "../../components/States";
import { Modal } from "../../components/Modal";

const ROLE_CLS = {
  operator: "bg-blue-50 text-blue-800 ring-blue-200",
  manager: "bg-amber-50 text-amber-800 ring-amber-200",
  admin: "bg-rose-50 text-rose-800 ring-rose-200"
};

const EMPTY = { name: "", email: "", password: "", role: "operator" };

export default function UsersManagement() {
  const { user: me, refreshUser } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  function load() {
    setError("");
    api
      .get("/api/admin/users")
      .then(setUsers)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function openCreate() {
    setForm({ ...EMPTY, editing: false });
  }

  function openEdit(u) {
    setForm({ name: u.name, email: u.email, password: "", role: u.role, editing: true, id: u.id });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.editing) {
        const body = { name: form.name, email: form.email, role: form.role };
        if (form.password) body.password = form.password;
        await api.patch(`/api/admin/users/${form.id}`, body);
        if (form.id === me.id) await refreshUser();
        toast.success("Utilisateur modifié");
      } else {
        await api.post("/api/admin/users", {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role
        });
        toast.success("Utilisateur créé");
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
      await api.del(`/api/admin/users/${id}`);
      toast.success("Utilisateur supprimé");
      setConfirmId(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={openCreate}
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-lg font-black text-white shadow-sm active:scale-[0.98]"
      >
        <UserPlus className="size-6" />
        Créer un utilisateur
      </button>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : users ? (
        <ul className="flex flex-col gap-3">
          {users.map((u) => (
            <li key={u.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">
                    {u.name}
                    {u.id === me.id && <span className="ml-1.5 text-xs font-semibold text-slate-400">(vous)</span>}
                  </p>
                  <p className="truncate text-sm text-slate-500">{u.email}</p>
                  <p className="text-xs font-semibold text-slate-400">Créé le {formatDateTime(u.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${ROLE_CLS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                  <button onClick={() => openEdit(u)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Modifier">
                    <Pencil className="size-4" />
                  </button>
                  {u.id !== me.id && (
                    <button onClick={() => setConfirmId(u.id)} className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Supprimer">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Spinner label="Chargement des utilisateurs…" />
      )}

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.editing ? "Modifier l'utilisateur" : "Créer un utilisateur"}
      >
        {form && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Nom</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">
                {form.editing ? "Mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!form.editing}
                minLength={6}
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">Rôle</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, role: value })}
                    className={`rounded-xl px-2 py-3 text-sm font-bold ring-2 transition ${
                      form.role === value ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-3.5 font-black text-white active:scale-95 disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : form.editing ? "Enregistrer les modifications" : "Créer l'utilisateur"}
            </button>
          </form>
        )}
      </Modal>

      <Modal open={confirmId !== null} onClose={() => setConfirmId(null)} title="Supprimer cet utilisateur ?">
        <p className="text-slate-600">
          Le compte sera supprimé. Les enregistrements associés (lots, poids, anomalies) seront conservés sans opérateur.
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
