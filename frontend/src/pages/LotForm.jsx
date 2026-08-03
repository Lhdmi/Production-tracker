import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackagePlus, ArrowRight, AlertTriangle, Wand2, CalendarDays } from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Toast";

const DEFAULT_RUN = "1";

export default function LotForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const [opNumber, setOpNumber] = useState("");
  const [opSuggestions, setOpSuggestions] = useState([]);
  const [productionDate, setProductionDate] = useState("");
  const [bestBefore, setBestBefore] = useState("");
  const [productReference, setProductReference] = useState("");
  const [variety, setVariety] = useState("");
  const [plantCode, setPlantCode] = useState("");
  const [line, setLine] = useState("");
  const [batchFlag, setBatchFlag] = useState("");
  const [batchRun, setBatchRun] = useState(DEFAULT_RUN);
  const [lotNumber, setLotNumber] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const lotTouched = useRef(false);

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

  // Aperçu du numéro de lot PF à partir de la date de production
  useEffect(() => {
    if (!productionDate) {
      setPreview(null);
      if (!lotTouched.current) setLotNumber("");
      return;
    }
    const params = new URLSearchParams({ date: productionDate });
    if (plantCode.trim()) params.set("plant", plantCode.trim());
    if (line.trim()) params.set("line", line.trim());
    if (batchFlag.trim()) params.set("flag", batchFlag.trim());
    if (batchRun.trim()) params.set("run", batchRun.trim());
    const timer = setTimeout(() => {
      api
        .get(`/api/lots/generate?${params.toString()}`)
        .then((res) => {
          setPreview(res);
          if (!lotTouched.current) setLotNumber(res.lotNumber);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [productionDate, plantCode, line, batchFlag, batchRun]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = {
        opNumber,
        productionDate: productionDate || null,
        bestBefore: bestBefore || null,
        productReference: productReference || null,
        variety: variety || null,
        plantCode: plantCode.trim() || null,
        line: line.trim() || null,
        batchFlag: batchFlag.trim() || null,
        batchRun: batchRun.trim() || DEFAULT_RUN
      };
      if (!lotTouched.current && preview?.lotNumber) body.lotNumber = preview.lotNumber;
      const lot = await api.post("/api/lots", body);
      toast.success(`Lot ${lot.lotNumber} créé (OP ${opNumber})`);
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
        <h1 className="text-xl font-black text-slate-900">Nouveau lot (PF)</h1>
        <p className="text-sm font-semibold text-slate-500">
          Produit fini — n° de lot auto-généré selon la date de production (année + jour julien)
        </p>
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
          <label htmlFor="pd" className="mb-1.5 block text-sm font-bold text-slate-700">
            Date de production <span className="font-semibold text-slate-400">(génère le n° de lot)</span>
          </label>
          <input
            id="pd"
            type="date"
            value={productionDate}
            onChange={(e) => setProductionDate(e.target.value)}
            className="w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg font-bold focus:border-amber-400 focus:outline-none"
          />
        </div>

        {preview && (
          <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-3 ring-1 ring-blue-200">
            <CalendarDays className="size-6 shrink-0 text-blue-600" />
            <div className="flex-1 text-sm font-semibold text-blue-800">
              <p>
                Année <span className="font-black">{preview.productionYear}</span> · Jour julien{" "}
                <span className="font-black">{preview.julianDay}</span>
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="bb" className="mb-1.5 block text-sm font-bold text-slate-700">
              Best before
            </label>
            <input
              id="bb"
              type="date"
              value={bestBefore}
              onChange={(e) => setBestBefore(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-300 px-3 py-3.5 text-lg font-bold focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="ref" className="mb-1.5 block text-sm font-bold text-slate-700">
              Référence produit
            </label>
            <input
              id="ref"
              value={productReference}
              onChange={(e) => setProductReference(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-300 px-3 py-3.5 text-lg font-bold focus:border-amber-400 focus:outline-none"
              placeholder="EX : 12273686"
            />
          </div>
        </div>

        <div>
          <label htmlFor="var" className="mb-1.5 block text-sm font-bold text-slate-700">
            Variété
          </label>
          <input
            id="var"
            value={variety}
            onChange={(e) => setVariety(e.target.value)}
            className="w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg font-bold focus:border-amber-400 focus:outline-none"
            placeholder="EX : Guatemala"
          />
        </div>

        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="mb-2 text-xs font-black uppercase text-slate-400">Composition du numéro de lot</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="plant" className="mb-1 block text-sm font-bold text-slate-700">
                Code usine
              </label>
              <input
                id="plant"
                value={plantCode}
                onChange={(e) => setPlantCode(e.target.value.toUpperCase())}
                maxLength={3}
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 font-mono text-lg font-black uppercase focus:border-amber-400 focus:outline-none"
                placeholder="886"
              />
            </div>
            <div>
              <label htmlFor="line" className="mb-1 block text-sm font-bold text-slate-700">
                Ligne
              </label>
              <input
                id="line"
                value={line}
                onChange={(e) => setLine(e.target.value.toUpperCase())}
                maxLength={1}
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 font-mono text-lg font-black uppercase focus:border-amber-400 focus:outline-none"
                placeholder="1"
              />
            </div>
            <div>
              <label htmlFor="flag" className="mb-1 block text-sm font-bold text-slate-700">
                Indicatif (changement de date)
              </label>
              <input
                id="flag"
                value={batchFlag}
                onChange={(e) => setBatchFlag(e.target.value.toUpperCase())}
                maxLength={1}
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 font-mono text-lg font-black uppercase focus:border-amber-400 focus:outline-none"
                placeholder="A"
              />
            </div>
            <div>
              <label htmlFor="run" className="mb-1 block text-sm font-bold text-slate-700">
                N° course
              </label>
              <input
                id="run"
                value={batchRun}
                onChange={(e) => setBatchRun(e.target.value)}
                maxLength={1}
                className="w-full rounded-xl border-2 border-slate-300 px-3 py-3 font-mono text-lg font-black focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="lot" className="text-sm font-bold text-slate-700">
              Numéro de lot PF
            </label>
            {preview?.lotNumber && (
              <button
                type="button"
                onClick={() => {
                  lotTouched.current = false;
                  setLotNumber(preview.lotNumber);
                }}
                className="flex items-center gap-1 text-xs font-black text-blue-700 underline"
              >
                <Wand2 className="size-3.5" />
                Réinitialiser auto
              </button>
            )}
          </div>
          <input
            id="lot"
            value={lotNumber}
            onChange={(e) => {
              lotTouched.current = true;
              setLotNumber(e.target.value.toUpperCase());
            }}
            required
            autoCapitalize="characters"
            className="w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 font-mono text-xl font-black uppercase focus:border-amber-400 focus:outline-none"
            placeholder={preview?.lotNumber ? preview.lotNumber : "EX : 612188611"}
          />
          {preview && (
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Format : année · jour julien · usine · ligne · indicatif · course
            </p>
          )}
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
