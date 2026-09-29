# Expandlogy Software

Stack: Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui (Radix) + TanStack Query + React Router + Supabase. Tests con Vitest. Deploy en Vercel.

## Desarrollo

```sh
npm install
cp .env.example .env   # completar con las claves de Supabase
npm run dev            # http://localhost:8080
```

## Supabase: puesta en marcha

Toda la app exige login; no hay registro público (las cuentas las crea un admin).

1. `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto.
2. Aplicar el esquema: `supabase link --project-ref <ref>` y `supabase db push`
   (o pegar `supabase/migrations/*.sql` en el SQL Editor).
3. Desplegar la función de usuarios: `supabase functions deploy admin-users`.
4. Crear el primer admin: ejecutar `supabase/bootstrap/create-admin.sql` en el
   SQL Editor (está en `.gitignore` porque contiene la contraseña).
5. En el Dashboard → Authentication → Sign In / Providers: desactivar
   "Allow new users to sign up".

Roles: **Administrador** (gestiona usuarios y roles en Perfil → Usuarios y roles)
y **Usuario**. Cada quien ve sólo sus tareas (RLS).

## To-do List

Tableros kanban/lista por usuario, subtareas, recordatorios (Beta) y comentarios con imágenes y audios. Plan y resultado en [Features/To-do List](Features/To-do%20List/00-documento-maestro.md).

Edge Functions: `admin-users` (alta/baja de usuarios) y `attachments-gc` (limpieza diaria de adjuntos huérfanos, vía `pg_cron`).

## Pruebas contra Supabase

`npm run verify:rls` y `npm run test:e2e` usan el proyecto real con identidades temporales que se borran al terminar. Necesitan `.env` y un `.env.e2e.local` (en `.gitignore`) con:

```sh
SUPABASE_SERVICE_ROLE_KEY=...
```

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción en `dist/`
- `npm run lint` — ESLint
- `npm run typecheck` — chequeo de tipos
- `npm test` — tests unitarios (Vitest)
- `npm run test:e2e` — end-to-end (Playwright; levanta el dev server)
- `npm run verify:rls` — permisos (RLS, Storage, Realtime) contra Supabase

## Estructura

```
src/
  components/ui/   componentes shadcn/ui
  components/      componentes compartidos
  hooks/           hooks de React
  lib/             utilidades y cliente de Supabase
  pages/           una página por ruta (ver src/App.tsx)
  test/            setup de Vitest
supabase/
  migrations/      migraciones SQL
  functions/       Edge Functions
```
