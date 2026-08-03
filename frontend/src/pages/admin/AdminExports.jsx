import { useState } from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "../../api";
import { useToast } from "../../components/Toast";

const EXPORTS = [
  { entity: "lots", label: "Lots", desc: "OP, lot, statut, poids, opérateur" },
  { entity: "anomalies", label: "Anomalies", desc: "Détail des anomalies avec photos et traitement" },
  { entity: "ops", label: "Ordres de production", desc: "Liste des OP avec nombre de lots" },
  { entity: "weights", label: "Relevés de poids", desc: "Tous les relevés horodatés" }
];

export default function AdminExports() {
  const toast = useToast();
  const [exporting, setExporting] = useState("");

  async function doExport(entity) {
    setExporting(entity);
    try {
      await downloadCsv(`/api/export/${entity}.csv`);
      toast.success("Export CSV téléchargé");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting("");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {EXPORTS.map((e) => (
        <button
          key={e.entity}
          onClick={() => doExport(e.entity)}
          disabled={exporting !== ""}
          className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 active:scale-[0.99] disabled:opacity-50"
        >
          <div>
            <p className="font-bold text-slate-900">{e.label}</p>
            <p className="text-xs font-semibold text-slate-500">{e.desc}</p>
          </div>
          <span className="shrink-0 rounded-xl bg-slate-900 p-3 text-white">
            <Download className="size-5" />
          </span>
        </button>
      ))}
      <p className="text-xs font-semibold text-slate-400">
        Les exports sont générés au format CSV (UTF-8) et enregistrés dans l'historique.
      </p>
    </div>
  );
}
