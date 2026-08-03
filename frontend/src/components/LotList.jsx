import { Link } from "react-router-dom";
import { Package, Scale, Clock, AlertTriangle, ChevronRight } from "lucide-react";
import { LotBadge } from "./Badge";
import { EmptyState } from "./States";
import { formatDateTime } from "../api";

export default function LotList({ lots }) {
  if (!lots || lots.length === 0) {
    return <EmptyState icon={<Package className="size-10 text-slate-300" />} title="Aucun lot" hint="Créez un lot ou modifiez votre recherche." />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {lots.map((lot) => (
        <li key={lot.id}>
          <Link
            to={`/lots/${lot.id}`}
            className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono text-xs font-bold text-white">{lot.opNumber}</span>
                <span className="font-mono text-lg font-black">{lot.lotNumber}</span>
              </div>
              <LotBadge status={lot.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-slate-600">
              <span className="flex items-center gap-1.5">
                <Scale className="size-4 text-slate-400" />
                {lot.weightCount} relevé{lot.weightCount > 1 ? "s" : ""}
                {lot.weightCount > 0 && <span className="text-slate-400">·</span>}
                {lot.weightCount > 0 && <span className="tabular-nums">{lot.weightSum} kg</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-4 text-slate-400" />
                {formatDateTime(lot.createdAt)}
              </span>
              {lot.createdByName && <span className="text-slate-500">— {lot.createdByName}</span>}
              {lot.openAnomalyCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                  <AlertTriangle className="size-3.5" />
                  {lot.openAnomalyCount} anomalie{lot.openAnomalyCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
