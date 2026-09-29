import { Outlet, useLocation, useMatch } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "./AppSidebar";

const TITLES: [prefix: string, title: string][] = [
  ["/todos", "To-do List"],
  ["/perfil/usuarios", "Usuarios y roles"],
  ["/perfil", "Mi perfil"],
];

export function AppLayout() {
  const { pathname } = useLocation();
  const title = pathname === "/" ? "Inicio" : (TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? "");
  // El kanban necesita todo el ancho disponible.
  const fullWidth = !!useMatch("/todos/:boardId/*");

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-sm font-medium text-muted-foreground">{title}</h1>
        </header>
        <div className={cn("flex-1 p-4 md:p-8", fullWidth && "min-w-0 md:px-6 md:py-6")}>
          <div className={cn("mx-auto w-full", !fullWidth && "max-w-6xl")}>
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
