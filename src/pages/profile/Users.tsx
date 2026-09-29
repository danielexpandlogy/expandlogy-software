import { useState, type FormEvent } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Search, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateUser, useDeleteUser, useProfiles, useUpdateRole } from "@/hooks/use-users";
import { displayName, initials, ROLE_LABEL } from "@/lib/labels";
import type { AppRole, Profile } from "@/lib/database.types";

const ROLES: AppRole[] = ["admin", "user"];

const Users = () => {
  const { profile: me } = useAuth();
  const { data: users = [], isLoading, error } = useProfiles();
  const updateRole = useUpdateRole();
  const deleteUser = useDeleteUser();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<Profile | null>(null);

  const q = query.trim().toLowerCase();
  const visible = users.filter(
    (u) => !q || u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q),
  );
  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <Card className="shadow-none">
      <CardHeader className="gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="text-base font-semibold">Equipo</CardTitle>
          <CardDescription>
            {users.length} usuarios · {adminCount} administradores
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9 sm:w-56"
            />
          </div>
          <Button onClick={() => setAdding(true)} className="h-9">
            <UserPlus className="mr-1.5 size-4" /> Añadir usuario
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {error ? (
          <p className="px-6 py-8 text-sm text-destructive">No se pudieron cargar los usuarios: {error.message}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Usuario</TableHead>
                <TableHead className="hidden md:table-cell">Alta</TableHead>
                <TableHead className="w-40">Rol</TableHead>
                <TableHead className="w-12 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 3 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4} className="px-6">
                        <Skeleton className="h-9 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : visible.map((u) => {
                    const isMe = u.id === me?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9">
                              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                {initials(u.full_name, u.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 font-medium">
                                <span className="truncate">
{displayName(u.full_name, u.email)}</span>
                                {isMe && (
                                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                                    Tú
                                  </Badge>
                                )}
                              </div>
                              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {format(new Date(u.created_at), "d MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            disabled={isMe || updateRole.isPending}
                            onValueChange={(role) => updateRole.mutate({ id: u.id, role: role as AppRole })}
                          >
                            <SelectTrigger className="h-8" aria-label={`Rol de ${u.email}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABEL[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="pr-6">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            disabled={isMe}
                            onClick={() => setToDelete(u)}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Eliminar {u.email}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AddUserDialog open={adding} onOpenChange={setAdding} />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {toDelete && displayName(toDelete.full_name, toDelete.email)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Perderá el acceso de inmediato y se borrarán sus tareas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && deleteUser.mutate(toDelete.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createUser = useCreateUser();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("user");

  const reset = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("user");
    createUser.reset();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createUser.mutate(
      { full_name: fullName.trim(), email: email.trim(), password, role },
      {
        onSuccess: () => handleOpenChange(false),
      },
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Añadir usuario</DialogTitle>
            <DialogDescription>
              La cuenta queda activa al instante. Comparte el email y la contraseña con la persona.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="new_full_name">Nombre completo</Label>
            <Input id="new_full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_email">Email</Label>
            <Input
              id="new_email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">Contraseña inicial</Label>
              <Input
                id="new_password"
                type="text"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {role === "admin"
              ? "Los administradores pueden gestionar usuarios y roles."
              : "Los usuarios gestionan sus propias tareas y su perfil."}
          </p>

          {createUser.error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {createUser.error.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!fullName.trim() || !email.trim() || password.length < 8 || createUser.isPending}
            >
              {createUser.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Crear usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default Users;
