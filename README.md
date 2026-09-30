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

## Landing Lab (landings de clientes)

Landings públicas que se autooptimizan: cada variable (titular, imagen, botón, color, orden de secciones…) se prueba por separado y la landing reparte el tráfico con Thompson sampling.

- **Panel:** `/landings` (sólo admins) lista todas las landings; `/landings/:slug` es el panel de cada una. Ahí se crean landings y variables, se editan opciones y se fijan ganadores.
- **Cada cliente tiene su repo y su dominio** (p. ej. `LANDING EXPANDLOGY/LUQMAN`) y usa el paquete [`@danielexpandlogy/landing-core`](packages/landing-core/README.md), que vive en `packages/landing-core` y se publica en GitHub Packages con la Action *Publicar landing-core*.
- **Una sola Supabase para todas.** Este repo es el único que aplica migraciones. Los cambios en `lp_*` sólo pueden agregar, para no romper landings con versiones anteriores del paquete.
- **Esquema:** `supabase/migrations/20261001100000_landing_lab.sql` y `20261002100000_landing_lab_multi.sql` (aplicar en el SQL Editor). Los visitantes anónimos sólo llaman a `lp_public_config`, `lp_track_visit` y `lp_track_event`.
- **Eduardo** (`/eduardo`, `/eduardo-gracias`) todavía vive en esta app: `src/features/landing-eduardo/`. Su panel dibuja las variantes con sus propios componentes (`src/features/landing-lab/previews.tsx`); las landings externas se ven en un iframe.
- No se registran las vistas previas (`?lp_preview=<option_id>`), las visitas con sesión en esta app ni los navegadores marcados con `?lp_team=1`.

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
- `npm run build:landing-core` — build del paquete en `packages/landing-core/dist/`

## Estructura

```
src/
  components/ui/   componentes shadcn/ui
  components/      componentes compartidos
  hooks/           hooks de React
  lib/             utilidades y cliente de Supabase
  pages/           una página por ruta (ver src/App.tsx)
  test/            setup de Vitest
packages/
  landing-core/    paquete que usan las landings de clientes
supabase/
  migrations/      migraciones SQL
  functions/       Edge Functions
```
