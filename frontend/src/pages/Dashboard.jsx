import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Package, Scale, AlertTriangle, Users, TrendingUp } from "lucide-react";
import { api, downloadCsv, formatDateTime } from "../api";
import { LotBadge, SeverityBadge, AnomalyBadge } from "../components/Badge";
import { Spinner, ErrorState } from "../components/States";
import { useToast } from "../components/Toast";

const STATUS_CARDS = [
  { key: "in_progress", label: "En cours", cls: "bg-blue-50 text-blue-800 ring-blue-200" },
  { key: "completed", label: "Terminés", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  { key: "anomaly", label: "En anomalie", cls: "bg-rose-50 text-rose-800 ring-rose-200" }
];

export default function Dashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  function load() {
    setError("");
    api
      .get("/api/admin/stats")
      .then(setStats)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

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

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return <Spinner label="Chargement du tableau de bord…" />;

  const exports = [
    { key: "lots", label: "Lots" },
    { key: "anomalies", label: "Anomalies" },
    { key: "ops", label: "Ordres de production" },
    { key: "weights", label: "Poids" }
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black text-slate-900">
          <TrendingUp className="size-6" />
          Tableau de bord
        </h1>
      </header>

      <section className="grid grid-cols-2 gap-3">
        {[
          { label: "Ordres de prod.", value: stats.totals.ops, icon: Package, cls: "text-blue-600" },
          { label: "Lots", value: stats.totals.lots, icon: Package, cls: "text-slate-700" },
          { label: "Relevés de poids", value: stats.totals.weights, icon: Scale, cls: "text-emerald-600" },
          { label: "Anomalies ouvertes", value: stats.totals.anomaliesOpen, icon: AlertTriangle, cls: "text-rose-600" }
        ].map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200 ${c.cls}`}>
              <c.icon className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-black tabular-nums text-slate-900">{c.value}</p>
              <p className="text-[11px] font-bold uppercase leading-tight text-slate-400">{c.label}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-3 flex items-center gap-2 text-base font-black text-slate-900">
          <Package className="size-5 text-slate-400" />
          Statut des lots
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {STATUS_CARDS.map((s) => (
            <div key={s.key} className={`rounded-xl p-3 text-center ring-1 ring-inset ${s.cls}`}>
              <p className="text-3xl font-black tabular-nums">{stats.byStatus[s.key] || 0}</p>
              <p className="text-xs font-bold">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
          <Users className="size-5 text-slate-400" />
          {stats.totals.users} utilisateur{stats.totals.users > 1 ? "s" : ""} · {stats.totals.anomalies} anomalies au total
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-3 text-base font-black text-slate-900">Exports CSV</h2>
        <div className="grid grid-cols-2 gap-3">
          {exports.map((e) => (
            <button
              key={e.key}
              onClick={() => doExport(e.key)}
              disabled={exporting !== ""}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3.5 font-bold text-white active:scale-95 disabled:opacity-50"
            >
              {exporting === e.key ? (
                "Export…"
              ) : (
                <>
                  <Download className="size-5" />
                  {e.label}
                </>
              )}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-black text-slate-900">Derniers lots</h2>
        <ul className="flex flex-col gap-3">
          {stats.recentLots.map((l) => (
            <li key={l.id}>
              <Link
                to={`/lots/${l.id}`}
                className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:scale-[0.99]"
              >
                <div>
                  <p className="font-mono font-bold text-slate-900">
                    {l.opNumber} · {l.lotNumber}
                  </p>
                  <p className="text-xs font-semibold text-slate-400">
                    {l.createdByName} · {formatDateTime(l.createdAt)}
                  </p>
                </div>
                <LotBadge status={l.status} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-base font-black text-slate-900">Dernières anomalies</h2>
        <ul className="flex flex-col gap-3">
          {stats.recentAnomalies.length === 0 && (
            <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-400 ring-1 ring-slate-200">
              Aucune anomalie récente.
            </p>
          )}
          {stats.recentAnomalies.map((a) => (
            <li key={a.id}>
              <Link
                to="/anomalies"
                className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">{a.type}</p>
                  <p className="font-mono text-xs font-semibold text-slate-400">
                    {a.opNumber} · {a.lotNumber} — {a.createdByName}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <SeverityBadge severity={a.severity} />
                  <AnomalyBadge status={a.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
