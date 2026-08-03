import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackagePlus, ArrowRight, AlertTriangle } from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Toast";

export default function LotForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const [opNumber, setOpNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [opSuggestions, setOpSuggestions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = opNumber.trim();
    if (q.length < 2) {
      setOpSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api.get(`/api/ops?q=${encodeURIComponent(q)}`).then(setOpSuggestions).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [opNumber]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const lot = await api.post("/api/lots", { opNumber, lotNumber });
      toast.success(`Lot ${lotNumber} créé (OP ${opNumber})`);
      navigate(`/lots/${lot.id}`);
    } catch (err) {
      if (err.status === 409) {
        toast.error(err.message);
        navigate(`/lots/${err.id}`);
      } else {
        setError(err.message || "Création impossible");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-black text-slate-900">Nouveau lot</h1>
        <p className="text-sm font-semibold text-slate-500">Associé à votre compte et horodaté automatiquement</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
            <AlertTriangle className="size-5 shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label htmlFor="op" className="mb-1.5 block text-sm font-bold text-slate-700">
            Numéro d'Ordre de Production (OP)
          </label>
          <input
            id="op"
            value={opNumber}
            onChange={(e) => setOpNumber(e.target.value.toUpperCase())}
            list="op-suggestions"
            required
            autoCapitalize="characters"
            className="w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg font-bold uppercase focus:border-amber-400 focus:outline-none"
            placeholder="EX : OP-2026-014"
          />
          <datalist id="op-suggestions">
            {opSuggestions.map((op) => (
              <option key={op.id} value={op.opNumber} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="lot" className="mb-1.5 block text-sm font-bold text-slate-700">
            Numéro de lot
          </label>
          <input
            id="lot"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value.toUpperCase())}
            required
            autoCapitalize="characters"
            className="w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg font-bold uppercase focus:border-amber-400 focus:outline-none"
            placeholder="EX : LOT-A-0042"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-lg font-black text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            "Création…"
          ) : (
            <>
              <PackagePlus className="size-6" />
              Créer le lot
              <ArrowRight className="size-5" />
            </>
          )}
        </button>
      </form>

      <div className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-800 ring-1 ring-blue-200">
        Astuce : si le lot existe déjà pour cette OP, vous serez redirigé vers la fiche existante pour continuer la saisie.
      </div>
    </div>
  );
}
