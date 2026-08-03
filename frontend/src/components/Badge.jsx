import { LOT_STATUS, ANOMALY_STATUS, SEVERITY } from "../api";

export function LotBadge({ status, large }) {
  const s = LOT_STATUS[status] || LOT_STATUS.in_progress;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ring-1 ring-inset ${s.cls} ${large ? "px-4 py-1.5 text-base" : ""}`}>
      <span className={`size-2 rounded-full ${status === "anomaly" ? "bg-rose-500 animate-pulse" : status === "completed" ? "bg-emerald-500" : "bg-blue-500"}`} />
      {s.label}
    </span>
  );
}

export function AnomalyBadge({ status }) {
  const s = ANOMALY_STATUS[status] || ANOMALY_STATUS.open;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
}

export function SeverityBadge({ severity }) {
  const s = SEVERITY[severity] || SEVERITY.medium;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
}
