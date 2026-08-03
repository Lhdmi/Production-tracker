import { Loader2 } from "lucide-react";

export function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-500">
      <Loader2 className="size-8 animate-spin" />
      {label && <p className="text-sm font-semibold">{label}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <p className="font-semibold text-rose-600">{message || "Une erreur est survenue"}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white active:scale-95">
          Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon}
      <p className="font-bold text-slate-700">{title}</p>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
    </div>
  );
}
