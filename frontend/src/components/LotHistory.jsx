import { useEffect, useState } from "react";
import { History as HistoryIcon, Scale, ClipboardCheck, FileText, AlertTriangle, Barcode } from "lucide-react";
import { api, formatDateTime } from "../api";
import { Spinner, ErrorState } from "./States";

const KIND_ICON = {
  weight: { icon: Scale, cls: "bg-blue-100 text-blue-700" },
  check: { icon: ClipboardCheck, cls: "bg-emerald-100 text-emerald-700" },
  document: { icon: FileText, cls: "bg-amber-100 text-amber-700" },
  anomaly: { icon: AlertTriangle, cls: "bg-rose-100 text-rose-700" },
  scan: { icon: Barcode, cls: "bg-slate-200 text-slate-700" }
};

export default function LotHistory({ lotId }) {
  const [timeline, setTimeline] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    api
      .get(`/api/lots/${lotId}/history`)
      .then(setTimeline)
      .catch((err) => setError(err.message));
  }, [lotId, retry]);

  if (error) return <ErrorState message={error} onRetry={() => setRetry((r) => r + 1)} />;
  if (!timeline) return <Spinner label="Chargement de l'historique…" />;
  if (!timeline.length) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-black text-slate-900">
          <HistoryIcon className="size-5 text-slate-400" /> Historique / traçabilité
        </h2>
        <p className="text-sm font-semibold text-slate-400">Aucun événement enregistré sur ce lot.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
        <HistoryIcon className="size-5 text-slate-400" /> Historique / traçabilité
      </h2>
      <ol className="relative flex flex-col gap-4 border-l-2 border-slate-100 pl-4">
        {timeline.map((ev, i) => {
          const meta = KIND_ICON[ev.kind] || KIND_ICON.document;
          const Icon = meta.icon;
          return (
            <li key={i} className="relative">
              <span className={`absolute -left-[26px] top-0.5 flex size-6 items-center justify-center rounded-full ${meta.cls}`}>
                <Icon className="size-3.5" />
              </span>
              <p className="text-sm font-black text-slate-900">{ev.text}</p>
              <p className="text-xs font-semibold text-slate-500">
                {ev.kind === "weight" && ev.weight != null ? `Poids ${ev.weight} kg · ` : ""}
                {ev.by ? `${ev.by} · ` : ""}
                {formatDateTime(ev.at)}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
