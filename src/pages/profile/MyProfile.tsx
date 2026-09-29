import { useEffect, useState, type FormEvent } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { displayName, initials, ROLE_LABEL } from "@/lib/labels";

const MyProfile = () => {
  const { profile, session, refreshProfile } = useAuth();
  const email = profile?.email ?? session?.user.email ?? "";

  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setJobTitle(profile.job_title);
    setPhone(profile.phone);
  }, [profile]);

  const dirty =
    !!profile && (fullName !== profile.full_name || jobTitle !== profile.job_title || phone !== profile.phone);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), job_title: jobTitle.trim(), phone: phone.trim() })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error("No se pudo guardar el perfil", { description: error.message });
    await refreshProfile();
    toast.success("Perfil actualizado");
  };

  const passwordError =
    password && password.length < 8
      ? "Mínimo 8 caracteres."
      : confirm && password !== confirm
        ? "Las contraseñas no coinciden."
        : null;

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (passwordError || !password) return;
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setChangingPassword(false);
    if (error) return toast.error("No se pudo cambiar la contraseña", { description: error.message });
    setPassword("");
    setConfirm("");
    toast.success("Contraseña actualizada");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="h-fit shadow-none">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <Avatar className="size-20">
            <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
              {initials(profile?.full_name ?? "", email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 max-w-full">
            <p className="truncate text-lg font-semibold">{displayName(profile?.full_name ?? "", email)}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
          {profile && (
            <Badge variant={profile.role === "admin" ? "default" : "secondary"} className="gap-1">
              {profile.role === "admin" && <ShieldCheck className="size-3" />}
              {ROLE_LABEL[profile.role]}
            </Badge>
          )}
          {profile?.job_title && <p className="text-sm text-muted-foreground">{profile.job_title}</p>}
        </CardContent>
      </Card>

      <div className="space-y-6 lg:col-span-2">
        <Card className="shadow-none">
          <form onSubmit={handleSave}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Datos personales</CardTitle>
              <CardDescription>Esta información la ve tu equipo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="full_name">Nombre completo</Label>
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_title">Puesto</Label>
                <Input
                  id="job_title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ej. Director de operaciones"
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+52 55 1234 5678"
                  maxLength={40}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} disabled />
                <p className="text-xs text-muted-foreground">El email es tu usuario de acceso y no se puede cambiar aquí.</p>
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t pt-6">
              <Button type="submit" disabled={!dirty || saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Guardar cambios
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-none">
          <form onSubmit={handlePassword}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Contraseña</CardTitle>
              <CardDescription>Usa al menos 8 caracteres.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new_password">Nueva contraseña</Label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirmar contraseña</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {passwordError && <p className="text-sm text-destructive sm:col-span-2">{passwordError}</p>}
            </CardContent>
            <CardFooter className="justify-end border-t pt-6">
              <Button type="submit" variant="outline" disabled={!password || !confirm || !!passwordError || changingPassword}>
                {changingPassword && <Loader2 className="mr-2 size-4 animate-spin" />}
                Cambiar contraseña
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default MyProfile;
