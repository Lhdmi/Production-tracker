import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import { Spinner } from "./components/States";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import LotForm from "./pages/LotForm";
import LotDetail from "./pages/LotDetail";
import AnomalyForm from "./pages/AnomalyForm";
import Search from "./pages/Search";
import Dashboard from "./pages/Dashboard";
import Anomalies from "./pages/Anomalies";
import Materials from "./pages/Materials";
import Admin from "./pages/Admin";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-900">
        <Spinner label="Chargement…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/lots/nouveau" element={<LotForm />} />
          <Route path="/lots/:id" element={<LotDetail />} />
          <Route path="/materiaux" element={<Materials />} />
          <Route path="/anomalies/nouvelle" element={<AnomalyForm />} />
          <Route path="/recherche" element={<Search />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route
            path="/dashboard"
            element={
              <RequireRole roles={["manager", "admin"]}>
                <Dashboard />
              </RequireRole>
            }
          />
          <Route
            path="/admin/*"
            element={
              <RequireRole roles={["admin"]}>
                <Admin />
              </RequireRole>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
