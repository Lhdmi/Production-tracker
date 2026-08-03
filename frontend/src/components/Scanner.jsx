import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { ScanLine, Camera, X, Loader2, AlertTriangle, ChevronRight } from "lucide-react";
import { api } from "../api";
import { useToast } from "./Toast";

export default function Scanner() {
  const navigate = useNavigate();
  const toast = useToast();
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const scannerRef = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  async function stopScanner() {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch {
      /* ignore */
    }
  }

  async function startScanner() {
    setError("");
    setResult(null);
    try {
      const scanner = new Html5Qrcode("scanner-viewport", { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => handleCode(decoded),
        () => {}
      );
    } catch {
      setError("Impossible d'accéder à la caméra. Utilisez la saisie manuelle ci-dessous.");
      stopScanner();
    }
  }

  async function handleCode(code) {
    const value = String(code || "").trim();
    if (!value || busy) return;
    if (resultRef.current) return;
    await stopScanner();
    setActive(false);
    lookup(value);
  }

  async function lookup(code) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await api.get(`/api/lots/scan?code=${encodeURIComponent(code)}`);
      resultRef.current = data;
      setResult(data);
      if (data.kind === "lot") {
        navigate(`/lots/${data.lot.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      {!active && !result && (
        <button
          onClick={() => {
            setActive(true);
            startScanner();
          }}
          className="flex w-full items-center gap-3 rounded-xl bg-slate-900 px-4 py-3.5 text-left text-white transition active:scale-[0.99]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
            <ScanLine className="size-6" />
          </span>
          <div className="flex-1">
            <p className="font-black">Scanner un code-barres / QR</p>
            <p className="text-xs font-semibold text-slate-400">Identifie un lot ou une OP avec la caméra</p>
          </div>
        </button>
      )}

      {active && (
        <div>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-black text-slate-900">
              <Camera className="size-4" /> Pointez la caméra vers le code
            </p>
            <button
              onClick={() => {
                stopScanner();
                setActive(false);
              }}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Fermer le scanner"
            >
              <X className="size-5" />
            </button>
          </div>
          <div id="scanner-viewport" className="mt-2 overflow-hidden rounded-xl bg-slate-950" />
        </div>
      )}

      {result && result.kind === "op" && (
        <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
          <p className="font-black text-slate-900">OP {result.op.opNumber}</p>
          <p className="text-xs font-semibold text-slate-500">
            {result.lots.length} lot{result.lots.length > 1 ? "s" : ""} associé{result.lots.length > 1 ? "s" : ""}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {result.lots.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => navigate(`/lots/${l.id}`)}
                  className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left ring-1 ring-emerald-200"
                >
                  <span className="font-mono text-sm font-black text-slate-900">{l.lotNumber}</span>
                  <ChevronRight className="size-4 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              setResult(null);
              resultRef.current = null;
            }}
            className="mt-2 text-xs font-bold text-slate-600 underline"
          >
            Scanner un autre code
          </button>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup(manual)}
          placeholder="Saisie manuelle : LOT-B-0001 ou OP-2026-001"
          className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm font-semibold focus:border-amber-400 focus:outline-none"
        />
        <button
          onClick={() => lookup(manual)}
          disabled={busy || !manual.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40 active:scale-95"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
          Chercher
        </button>
      </div>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-50 p-2.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
