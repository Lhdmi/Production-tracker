import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LogIn, UserCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || "/";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Connexion impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-900">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-400 text-slate-900 shadow-lg">
              <UserCircle2 className="size-10" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">ProdTrack</h1>
            <p className="mt-1 text-sm font-semibold text-slate-400">Gestion de production & suivi de poids</p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Connexion</h2>
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
                <AlertTriangle className="size-5 shrink-0" />
                {error}
              </div>
            )}
            <label className="mb-1 block text-sm font-bold text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
              className="mb-4 w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg focus:border-amber-400 focus:outline-none"
              placeholder="votre@email.fr"
            />
            <label className="mb-1 block text-sm font-bold text-slate-700">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mb-6 w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg focus:border-amber-400 focus:outline-none"
              placeholder="••••••••"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-lg font-black text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Connexion…" : "Se connecter"}
              {!loading && <LogIn className="size-5" />}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Comptes de démonstration —{" "}
            <Link to="/aide" onClick={(e) => e.preventDefault()} className="font-semibold text-slate-300 underline">
              voir le README
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
