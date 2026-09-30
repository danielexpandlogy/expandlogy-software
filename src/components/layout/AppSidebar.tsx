import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronsUpDown, FlaskConical, LayoutDashboard, ListTodo, LogOut, UserRound, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { displayName, initials, ROLE_LABEL } from "@/lib/labels";
import { useMyBoards } from "@/features/todo/api/boards";

const NAV = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, end: true, adminOnly: false },
  { to: "/todos", label: "To-do List", icon: ListTodo, end: false, adminOnly: false },
  { to: "/landings", label: "Landings", icon: FlaskConical, end: false, adminOnly: true },
];

export function AppSidebar() {
  const { profile, session, isAdmin, signOut } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  // Los tableros en los que está la persona (personales y de equipo asignados).
  const { data: boards } = useMyBoards();
  const location = useLocation();
  const navigate = useNavigate();

  const email = profile?.email ?? session?.user.email ?? "";
  const name = displayName(profile?.full_name ?? "", email);
  const closeOnMobile = () => isMobile && setOpenMobile(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2.5 px-1.5" onClick={closeOnMobile}>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            E
          </span>
          <span className="truncate text-[15px] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Expandlogy
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground">Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV.filter((item) => isAdmin || !item.adminOnly).map(({ to, label, icon: Icon, end }) => {
                const active = end || (to === "/todos" && boards.length > 0) ? location.pathname === to : location.pathname.startsWith(to);
                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label} className="h-9 font-medium">
                      <NavLink to={to} end={end} onClick={closeOnMobile}>
                        <Icon />
                        <span>{label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {to === "/todos" && boards.length > 0 && (
                      <SidebarMenuSub>
                        {boards.map((b) => (
                          <SidebarMenuSubItem key={b.id}>
                            <SidebarMenuSubButton asChild isActive={location.pathname.startsWith(`/todos/${b.id}`)}>
                              <NavLink to={`/todos/${b.id}`} onClick={closeOnMobile}>
                                {b.member_count > 1 ? <Users /> : <UserRound />}
                                <span>{b.name}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip="Perfil"
                  isActive={location.pathname.startsWith("/perfil")}
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {initials(profile?.full_name ?? "", email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium text-foreground">{name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {profile ? ROLE_LABEL[profile.role] : email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "top" : "right"}
                align="end"
                sideOffset={8}
                className="w-60 rounded-lg"
              >
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/perfil" onClick={closeOnMobile}>
                    <UserRound className="mr-2 size-4" />
                    Mi perfil
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/perfil/usuarios" onClick={closeOnMobile}>
                      <Users className="mr-2 size-4" />
                      Usuarios y roles
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 size-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
