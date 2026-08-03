import { NavLink, Route, Routes } from "react-router-dom";
import { Database, Users, Download } from "lucide-react";
import DatabaseViewer from "./admin/DatabaseViewer";
import UsersManagement from "./admin/UsersManagement";
import AdminExports from "./admin/AdminExports";

const TABS = [
  { to: "/admin", label: "Base de données", icon: Database, end: true },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { to: "/admin/exports", label: "Exports", icon: Download }
];

export default function Admin() {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-black text-slate-900">Administration</h1>
        <p className="text-sm font-semibold text-slate-500">Accès direct à la base de données et aux comptes</p>
      </header>

      <nav className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ring-1 transition ${
                isActive ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300"
              }`
            }
          >
            <t.icon className="size-4" />
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route index element={<DatabaseViewer />} />
        <Route path="utilisateurs" element={<UsersManagement />} />
        <Route path="exports" element={<AdminExports />} />
      </Routes>
    </div>
  );
}
