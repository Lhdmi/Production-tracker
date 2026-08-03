import { useEffect, useState } from "react";
import { Search as SearchIcon, Trash2, Database } from "lucide-react";
import { api, formatDateTime } from "../../api";
import { useToast } from "../../components/Toast";
import { Spinner, ErrorState } from "../../components/States";
import { Modal } from "../../components/Modal";

const TABLES = [
  { value: "ops", label: "Ordres de production" },
  { value: "lots", label: "Lots" },
  { value: "weights", label: "Relevés de poids" },
  { value: "anomalies", label: "Anomalies" },
  { value: "photos", label: "Photos" },
  { value: "quality_checkpoints", label: "Points de contrôle" },
  { value: "quality_checks", label: "Contrôles qualité" },
  { value: "lot_documents", label: "Documents" },
  { value: "lot_scan_verifications", label: "Scans batch" },
  { value: "users", label: "Utilisateurs" },
  { value: "exports", label: "Exports" }
];

const COLUMN_LABELS = {
  id: "ID",
  op_id: "OP id",
  op_number: "Numéro OP",
  lot_id: "Lot id",
  lot_number: "Numéro lot",
  checkpoint_id: "Contrôle id",
  status: "Statut",
  active: "Actif",
  sort_order: "Ordre",
  image_url: "Image",
  ocr_text: "Texte OCR",
  scanned_code: "Code scanné",
  expected_code: "Code attendu",
  matched: "Correspond",
  weight: "Poids",
  type: "Type",
  description: "Description",
  severity: "Gravité",
  comment: "Commentaire",
  url: "URL",
  name: "Nom",
  email: "Email",
  role: "Rôle",
  entity: "Entité",
  row_count: "Nb lignes",
  created_at: "Créé le",
  updated_at: "Modifié le",
  completed_at: "Terminé le",
  validated_at: "Validé le",
  created_by: "Créé par",
  validated_by: "Validé par",
  user_id: "Utilisateur"
};

export default function DatabaseViewer() {
  const toast = useToast();
  const [table, setTable] = useState("lots");
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);

  useEffect(() => setQ(""), [table]);

  useEffect(() => {
    setError("");
    const params = new URLSearchParams({ table });
    if (q.trim()) params.set("q", q.trim());
    params.set("pageSize", "50");
    api
      .get(`/api/admin/records?${params}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [table, q]);

  function formatValue(col, value) {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "oui" : "non";
    if (col === "url" && typeof value === "string" && value.startsWith("/")) return value;
    if (col === "status") return value;
    if (col === "created_at" || col === "updated_at" || col === "completed_at" || col === "validated_at") {
      return formatDateTime(value);
    }
    return String(value);
  }

  async function doDelete() {
    try {
      await api.del(`/api/admin/records/${confirm.table}/${confirm.row.id}`);
      toast.success("Ligne supprimée");
      setConfirm(null);
      setData((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== confirm.row.id) }));
    } catch (err) {
      toast.error(err.message);
    }
  }

  const isPhotoTable = table === "photos";
  const isUserTable = table === "users";
  const isDocTable = table === "lot_documents";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {TABLES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTable(t.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ring-1 transition ${
              table === t.value ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer les lignes…"
          className="w-full rounded-xl border-2 border-slate-300 py-3 pl-11 pr-4 text-base focus:border-amber-400 focus:outline-none"
        />
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : data ? (
        <>
          <p className="text-sm font-bold text-slate-500">{data.total} ligne{data.total > 1 ? "s" : ""}</p>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {data.rows.length === 0 ? (
              <p className="p-6 text-center text-sm font-semibold text-slate-400">Aucune ligne.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-500">
                      <th className="px-3 py-2.5">#</th>
                      {data.columns.map((c) => (
                        <th key={c} className="px-3 py-2.5">
                          {COLUMN_LABELS[c] || c}
                        </th>
                      ))}
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs text-slate-400">{row.id}</td>
                        {data.columns
                          .filter((c) => c !== "id")
                          .map((c) => (
                            <td key={c} className="max-w-[240px] px-3 py-2">
                              {isPhotoTable && c === "url" ? (
                                <img src={row[c]} alt="photo" className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" />
                              ) : isDocTable && c === "image_url" && row[c] ? (
                                <img src={row[c]} alt="doc" className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" />
                              ) : isUserTable && c === "email" ? (
                                <span className="break-all">{row[c]}</span>
                              ) : (
                                <span className="break-words">{formatValue(c, row[c])}</span>
                              )}
                            </td>
                          ))}
                        <td className="px-2 py-2">
                          <button
                            onClick={() => setConfirm({ table, row })}
                            className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Supprimer la ligne"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {isUserTable && (
            <p className="text-xs font-semibold text-slate-400">
              Les comptes utilisateurs se gèrent dans l'onglet « Utilisateurs ».
            </p>
          )}
        </>
      ) : (
        <Spinner label="Chargement…" />
      )}

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="Supprimer cette ligne ?">
        <p className="text-slate-600">
          Cette action supprimera la ligne {confirm?.row?.id} de la table « {confirm?.table} » (avec ses dépendances éventuelles).
        </p>
        <div className="mt-5 flex gap-3">
          <button onClick={() => setConfirm(null)} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 active:scale-95">
            Annuler
          </button>
          <button onClick={doDelete} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 font-black text-white active:scale-95">
            <Trash2 className="size-4" />
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  );
}
