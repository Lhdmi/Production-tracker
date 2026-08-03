import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FolderOpen, TrendingUp } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import LotList from "../components/LotList";
import { Spinner, ErrorState } from "../components/States";

export default function Home() {
  const { user } = useAuth();
  const [lots, setLots] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/api/lots?mine=${user.role === "operator"}&pageSize=6`)
      .then((data) => setLots(data.rows))
      .catch((err) => setError(err.message));
  }, [user.role]);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-xl font-black text-slate-900">Bonjour, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-sm font-semibold text-slate-500">Que souhaitez-vous faire ?</p>
      </section>

      <section className="grid grid-cols-1 gap-3">
        <Link
          to="/lots/nouveau"
          className="flex items-center gap-4 rounded-2xl bg-emerald-600 p-5 text-white shadow-md transition active:scale-[0.98]"
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Plus className="size-8" />
          </span>
          <div>
            <p className="text-xl font-black">Créer un nouveau lot</p>
            <p className="text-sm font-semibold text-emerald-100">Saisie d'un lot et de ses relevés de poids</p>
          </div>
        </Link>

        <Link
          to="/recherche"
          className="flex items-center gap-4 rounded-2xl bg-slate-900 p-5 text-white shadow-md transition active:scale-[0.98]"
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <FolderOpen className="size-8" />
          </span>
          <div>
            <p className="text-xl font-black">Reprendre un lot existant</p>
            <p className="text-sm font-semibold text-slate-300">Recherche par OP, lot, date ou statut</p>
          </div>
        </Link>
      </section>

      {user.role !== "operator" && (
        <Link
          to="/dashboard"
          className="flex items-center gap-4 rounded-2xl bg-amber-400 p-5 text-slate-900 shadow-md transition active:scale-[0.98]"
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-slate-900/10">
            <TrendingUp className="size-8" />
          </span>
          <div>
            <p className="text-xl font-black">Tableau de bord</p>
            <p className="text-sm font-semibold text-slate-700">Indicateurs de production & anomalies</p>
          </div>
        </Link>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">
            {user.role === "operator" ? "Mes derniers lots" : "Derniers lots"}
          </h2>
          <Link to="/recherche" className="text-sm font-bold text-blue-700 underline">
            Tout voir
          </Link>
        </div>
        {error ? (
          <ErrorState message={error} />
        ) : lots ? (
          <LotList lots={lots} />
        ) : (
          <Spinner label="Chargement des lots…" />
        )}
      </section>
    </div>
  );
}
