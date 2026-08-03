const TOKEN_KEY = "prodtrack_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, { ...options, headers, body });
  } catch {
    throw new ApiError("Réseau indisponible — vérifiez votre connexion.", 0);
  }

  if (res.status === 401) {
    setToken(null);
    if (!path.endsWith("/auth/login")) {
      window.dispatchEvent(new CustomEvent("prodtrack:unauthorized"));
    }
  }

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),
  upload: (path, formData) => request(path, { method: "POST", body: formData })
};

export function downloadCsv(url) {
  const token = getToken();
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(async (res) => {
      if (!res.ok) {
        let message = `Erreur ${res.status}`;
        try {
          const data = await res.json();
          if (data.error) message = data.error;
        } catch { /* ignore */ }
        throw new ApiError(message, res.status);
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = url.split("/").pop().split("?")[0];
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    });
}

export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const LOT_STATUS = {
  in_progress: { label: "En cours", cls: "bg-blue-100 text-blue-800 ring-blue-200" },
  completed: { label: "Terminé", cls: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  anomaly: { label: "En anomalie", cls: "bg-rose-100 text-rose-800 ring-rose-200" }
};

export const ANOMALY_STATUS = {
  open: { label: "Ouverte", cls: "bg-rose-100 text-rose-800 ring-rose-200" },
  validated: { label: "Validée", cls: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  rejected: { label: "Rejetée", cls: "bg-slate-200 text-slate-700 ring-slate-300" }
};

export const SEVERITY = {
  low: { label: "Faible", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
  medium: { label: "Moyenne", cls: "bg-amber-100 text-amber-800 ring-amber-200" },
  high: { label: "Élevée", cls: "bg-orange-100 text-orange-800 ring-orange-200" },
  critical: { label: "Critique", cls: "bg-rose-100 text-rose-800 ring-rose-200" }
};

export const ROLE_LABELS = {
  operator: "Opérateur",
  manager: "Manager",
  admin: "Administrateur"
};

export const CHECK_STATUS = {
  compliant: { label: "Conforme", cls: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  non_compliant: { label: "Non conforme", cls: "bg-rose-100 text-rose-800 ring-rose-200" },
  na: { label: "N/A", cls: "bg-slate-200 text-slate-700 ring-slate-300" }
};
