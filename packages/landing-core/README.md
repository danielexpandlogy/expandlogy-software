# @danielexpandlogy/landing-core

Motor del Landing Lab para las landings de clientes. Cada landing vive en su propio repo y dominio, usa este paquete y se administra desde **/landings** en Expandlogy Software (misma Supabase para todas).

El paquete hace tres cosas:

1. Pide a Supabase las variables y opciones de la landing (`lp_public_config`).
2. Elige qué ve cada visitante: reparto parejo al principio y luego prioriza a las mejores (Thompson sampling). La misma persona ve siempre la misma combinación.
3. Registra la visita, el clic en el CTA y la agenda (`lp_track_visit`, `lp_track_event`).

No tiene dependencias además de React y no usa `supabase-js`.

## Instalar en el repo de una landing

`.npmrc` en la raíz del repo:

```
@danielexpandlogy:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

`NPM_TOKEN` es un token de GitHub (classic) con permiso `read:packages`. Va en tu entorno local (`export NPM_TOKEN=…`) y en Vercel → Settings → Environment Variables.

```sh
npm install @danielexpandlogy/landing-core
```

## Usarlo

**1. Configurar una vez al arrancar** (`main.tsx`):

```ts
import { configureLandingLab } from "@danielexpandlogy/landing-core";

configureLandingLab({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
```

**2. Aplicar las variantes en la landing.** Cada variable del panel tiene una `key` y un tipo; la landing aplica el valor elegido sobre su contenido base con los `read*` del tipo. Un valor inválido devuelve `null` y se muestra el original.

```tsx
import { readCta, readHeadline, useLandingLab } from "@danielexpandlogy/landing-core";

const LANDING = "luqman"; // el identificador de la landing en el panel

export function Landing() {
  const { ready, selection, trackClick, reason } = useLandingLab(LANDING);
  if (!ready) return <Placeholder />;

  const v = selection.values; // { [key de variable]: valor }
  const title = (v.headline && readHeadline(v.headline)) ?? base.title;
  const cta = (v.cta_text && readCta(v.cta_text)) ?? base.cta;

  return <Page title={title} cta={cta} onCtaClick={trackClick} />;
}
```

| Tipo         | Valor                                  | Leer con     |
| ------------ | -------------------------------------- | ------------ |
| `headline`   | `{ before, highlight, after }`         | `readHeadline` |
| `text`       | `{ text }`                             | `readText`   |
| `image`      | `{ src, alt }` (src `https://`)        | `readImage`  |
| `cta`        | `{ label, sub }`                       | `readCta`    |
| `color`      | `{ color, hover }` (`#RRGGBB`)         | `readColor`  |
| `order`      | `{ order: [keys de secciones] }`       | `readOrder(value, SECTION_KEYS)` |

**3. Página de gracias.** El calendario o formulario redirige aquí al agendar; se cuenta la agenda con la combinación que vio el visitante.

```tsx
import { useTrackConversion } from "@danielexpandlogy/landing-core";

export function Thanks() {
  useTrackConversion("luqman");
  return <p>¡Gracias!</p>;
}
```

## Qué no se registra

- `?lp_preview=<option_id>`: vistas previas del panel (fuerza esa opción).
- `?lp_team=1`: marca el navegador como del equipo hasta abrir con `?lp_team=0`.
- `useLandingLab(landing, { skip: true })`: cualquier otro motivo propio de la landing.

## Publicar una versión nueva

1. Cambia el código en `packages/landing-core/src` (en el repo de Expandlogy Software) y corre `npm test`.
2. Sube `version` en `packages/landing-core/package.json` (semver: `0.1.1` arreglos, `0.2.0` algo nuevo).
3. Push a `main`: la Action *Publicar landing-core* la publica en GitHub Packages.
4. En cada landing: `npm install @danielexpandlogy/landing-core@latest`, commit y push (Vercel redespliega).

Todas las landings comparten la misma base de datos: los cambios en las tablas y funciones `lp_*` sólo pueden **agregar**, para que las landings con versiones anteriores del paquete sigan funcionando.
