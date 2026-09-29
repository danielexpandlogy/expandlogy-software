# Expandlogy Software

Stack: Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui (Radix) + TanStack Query + React Router + Supabase. Tests con Vitest. Deploy en Vercel.

## Desarrollo

```sh
npm install
cp .env.example .env   # completar con las claves de Supabase
npm run dev            # http://localhost:8080
```

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción en `dist/`
- `npm run lint` — ESLint
- `npm run typecheck` — chequeo de tipos
- `npm test` — tests (Vitest)

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
