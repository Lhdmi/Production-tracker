import { useEffect, useState } from "react";
import { Search as SearchIcon, FilterX, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import LotList from "../components/LotList";
import { Spinner, ErrorState } from "../components/States";

const STATUS_FILTERS = [
  { value: "", label: "Tous" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "Terminés" },
  { value: "anomaly", label: "En anomalie" }
];

export default function Search() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);

  const mine = user.role === "operator";

  useEffect(() => {
    setPage(1);
  }, [q, status, date]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (date) params.set("date", date);
    params.set("mine", String(mine));
    params.set("page", String(page));
    params.set("pageSize", "20");

    setLoading(true);
    api
      .get(`/api/lots?${params}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [q, status, date, page, mine, retry]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-black text-slate-900">Recherche de lots</h1>
        <p className="text-sm font-semibold text-slate-500">
          {mine ? "Recherche dans vos lots" : "Recherche dans tous les lots"}
        </p>
      </header>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="OP, lot, opérateur…"
            className="w-full rounded-xl border-2 border-slate-300 py-3.5 pl-11 pr-4 text-lg focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
                  status === s.value
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-600 ring-slate-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="shrink-0">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border-2 border-slate-300 px-3 py-2 text-sm font-semibold focus:border-amber-400 focus:outline-none"
              aria-label="Filtrer par date"
            />
          </div>
        </div>

        {(q || status || date) && (
          <button
            onClick={() => {
              setQ("");
              setStatus("");
              setDate("");
            }}
            className="mt-3 flex items-center gap-1.5 text-sm font-bold text-rose-600"
          >
            <FilterX className="size-4" />
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {data && (
        <p className="text-sm font-bold text-slate-500">{data.total} lot{data.total > 1 ? "s" : ""} trouvé{data.total > 1 ? "s" : ""}</p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => setRetry((r) => r + 1)} />
      ) : data ? (
        <>
          <LotList lots={data.rows} />
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-xl bg-white px-4 py-2.5 font-bold text-slate-700 ring-1 ring-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
                Précédent
              </button>
              <span className="text-sm font-black text-slate-600">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-xl bg-white px-4 py-2.5 font-bold text-slate-700 ring-1 ring-slate-300 disabled:opacity-40"
              >
                Suivant
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <Spinner label="Recherche…" />
      )}
    </div>
  );
}
