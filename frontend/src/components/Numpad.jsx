import { useState } from "react";
import { Delete, Check } from "lucide-react";

function Key({ children, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-16 items-center justify-center rounded-xl bg-white text-2xl font-black text-slate-900 shadow-sm ring-1 ring-slate-200 transition active:scale-95 active:bg-slate-100 ${className}`}
    >
      {children}
    </button>
  );
}

export default function Numpad({ onSave, saving, saveLabel = "Enregistrer le poids" }) {
  const [value, setValue] = useState("");

  function press(digit) {
    setValue((v) => {
      if (digit === ".") {
        if (!v.includes(".")) return v ? `${v}.` : "0.";
        return v;
      }
      if (v === "0") return digit;
      if (v.replace(".", "").length >= 8) return v;
      return v + digit;
    });
  }

  function backspace() {
    setValue((v) => v.slice(0, -1));
  }

  function submit() {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) return;
    onSave(num);
    setValue("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
        <span className="text-sm font-bold text-slate-300">Poids saisi</span>
        <span className={`text-3xl font-black tabular-nums ${value ? "text-amber-300" : "text-slate-500"}`}>
          {value || "0"}
          <span className="text-base text-slate-400"> kg</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)}>{d}</Key>
        ))}
        <Key onClick={() => press(".")}>.</Key>
        <Key onClick={() => press("0")}>0</Key>
        <Key onClick={backspace} className="bg-rose-50 text-rose-600 ring-rose-200">
          <Delete className="size-7" />
        </Key>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={saving || !value || !(parseFloat(value) > 0)}
        className="flex h-16 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xl font-black text-white shadow-md transition active:scale-[0.98] disabled:opacity-40"
      >
        {saving ? "Enregistrement…" : (
          <>
            <Check className="size-6" />
            {saveLabel}
          </>
        )}
      </button>
    </div>
  );
}
