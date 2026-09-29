import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FullScreenSpinner } from "@/components/FullScreenSpinner";

/** Todas las rutas hijas exigen sesión; sin ella se redirige a /login. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenSpinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Sólo admins; el resto vuelve al inicio. RLS protege los datos igualmente. */
export function RequireAdmin() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <FullScreenSpinner />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
