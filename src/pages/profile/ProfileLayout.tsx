import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function ProfileLayout() {
  const { isAdmin } = useAuth();
  const tabs = [{ to: "/perfil", label: "Mi perfil", end: true }];
  if (isAdmin) tabs.push({ to: "/perfil/usuarios", label: "Usuarios y roles", end: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Perfil</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin ? "Administra tu cuenta y los accesos de tu equipo." : "Administra los datos de tu cuenta."}
        </p>
      </div>
      {tabs.length > 1 && (
        <nav className="flex gap-1 border-b">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
      <Outlet />
    </div>
  );
}
