import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Barcode, Camera, X, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, RotateCcw } from "lucide-react";
import { api } from "../api";
import { useToast } from "./Toast";

export default function BatchVerification({ lotId, lotNumber, verified, onVerified }) {
  const toast = useToast();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const scannerRef = useRef(null);

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

  async function startCamera() {
    setFailure(null);
    try {
      const scanner = new Html5Qrcode("batch-scanner-viewport", { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (decoded) => submit(decoded),
        () => {}
      );
    } catch {
      toast.error("Impossible d'accéder à la caméra. Utilisez la saisie manuelle.");
      stopScanner();
    }
  }

  async function submit(code) {
    const value = String(code || "").trim();
    if (!value || busy) return;
    setBusy(true);
    setFailure(null);
    await stopScanner();
    setCameraOpen(false);
    try {
      const res = await api.post(`/api/lots/${lotId}/scan-verifications`, { code: value });
      if (res.matched) {
        setManual("");
        onVerified(true);
        toast.success("Batchcode correct — saisie déverrouillée");
      } else {
        setFailure({ scanned: res.scanned, expected: res.expected });
        onVerified(false);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFailure(null);
    setManual("");
    onVerified(false);
  }

  if (verified) {
    return (
      <section className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <CheckCircle2 className="size-6" />
            </span>
            <div>
              <p className="font-black text-emerald-900">Batchcode correct</p>
              <p className="text-sm font-semibold text-emerald-700">
                Lot attendu <span className="font-mono font-black">{lotNumber}</span> — la saisie est déverrouillée.
              </p>
            </div>
          </div>
          <button
            onClick={reset}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white active:scale-95"
          >
            <RotateCcw className="size-4" />
            Re-vérifier
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Barcode className="size-6" />
        </span>
        <div className="flex-1">
          <p className="font-black text-slate-900">Vérification du code batch</p>
          <p className="text-sm font-semibold text-slate-500">
            Lot attendu :{" "}
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-base font-black text-slate-900 ring-1 ring-slate-300">
              {lotNumber}
            </span>
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Scanner le code-barres ou saisir le numéro de lot avant toute saisie. Chaque tentative est historisée.
          </p>
        </div>
      </div>

      {failure && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-rose-600 p-3 text-white">
          <p className="flex items-center gap-2 text-sm font-black">
            <AlertTriangle className="size-6 shrink-0 animate-pulse" />
            Lot scanné : {failure.scanned} — Lot attendu : {failure.expected}
          </p>
          <button
            onClick={() => setFailure(null)}
            className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-black active:scale-95"
          >
            Réessayer
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {!cameraOpen ? (
          <button
            onClick={() => {
              setCameraOpen(true);
              startCamera();
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 text-base font-black text-white active:scale-[0.99]"
          >
            <Camera className="size-5" />
            Scanner à la caméra
          </button>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                <Camera className="size-4" /> Pointez vers le code-barres du lot
              </p>
              <button
                onClick={() => {
                  stopScanner();
                  setCameraOpen(false);
                }}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Fermer la caméra"
              >
                <X className="size-5" />
              </button>
            </div>
            <div id="batch-scanner-viewport" className="mt-2 overflow-hidden rounded-xl bg-slate-950" />
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(manual)}
            placeholder="Saisir le numéro de lot scanné…"
            className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2.5 text-sm font-semibold focus:border-amber-400 focus:outline-none"
          />
          <button
            onClick={() => submit(manual)}
            disabled={busy || !manual.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40 active:scale-95"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Vérifier
          </button>
        </div>
      </div>
    </section>
  );
}
