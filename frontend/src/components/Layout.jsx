import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import { Home, Search, AlertTriangle, LayoutDashboard, ShieldCheck, LogOut, UserCircle2, Boxes } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../api";

function navItems(role) {
  const items = [
    { to: "/", label: "Accueil", icon: Home, end: true },
    { to: "/recherche", label: "Recherche", icon: Search },
    { to: "/materiaux", label: "Matières", icon: Boxes },
    { to: "/anomalies", label: "Anomalies", icon: AlertTriangle }
  ];
  if (role === "manager" || role === "admin") {
    items.push({ to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard });
  }
  if (role === "admin") {
    items.push({ to: "/admin", label: "Admin", icon: ShieldCheck });
  }
  return items;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navItems(user?.role);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-slate-100">
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md pt-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-400 text-slate-900">
              <UserCircle2 className="size-6" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-black tracking-tight">ProdTrack</p>
              <p className="text-[11px] text-slate-300">Suivi de production</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <div className="text-right leading-tight">
              <p className="max-w-[140px] truncate text-sm font-bold">{user?.name}</p>
              <p className="text-[11px] font-semibold text-amber-300">{ROLE_LABELS[user?.role]}</p>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="Se déconnecter"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700 bg-slate-900 pb-safe">
        <div className="mx-auto flex max-w-2xl">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition-colors ${
                  isActive ? "text-amber-300" : "text-slate-400 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`size-6 ${isActive ? "scale-110" : ""}`} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
