-- ─────────────────────────────────────────────────────────────────────────────
-- Landing Lab para varias landings. Cada landing de cliente vive en su propio
-- repo y dominio (usa el paquete @danielexpandlogy/landing-core) y todas se
-- administran desde /landings en este software. Todo lo que el panel necesita
-- saber de una landing queda en la base: su nombre, sus URLs, el tipo de cada
-- variable y los nombres de sus secciones. Así una landing nueva no requiere
-- cambiar código aquí.
--
-- Sólo agrega: las landings ya publicadas siguen funcionando sin cambios (las
-- funciones públicas lp_* no cambian).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Datos de cada landing ───────────────────────────────────────────────────

alter table public.lp_settings
  add column name text not null default '' check (char_length(name) <= 80),
  -- Dirección de la landing y de su página de gracias: https://… (otro dominio)
  -- o /ruta (landings que todavía viven en esta misma app).
  add column landing_url text check (landing_url is null or (landing_url ~ '^(https://|/)\S*$' and char_length(landing_url) <= 300)),
  add column thanks_url text check (thanks_url is null or (thanks_url ~ '^(https://|/)\S*$' and char_length(thanks_url) <= 300)),
  -- Color de marca para dibujar titulares y botones en el panel.
  add column accent_color text not null default '#d9711f' check (accent_color ~* '^#[0-9a-f]{6}$'),
  add column created_at timestamptz not null default now();

-- ── Tipo de cada variable ───────────────────────────────────────────────────

alter table public.lp_variables
  -- Decide la forma del valor de sus opciones y el formulario del panel
  -- (ver packages/landing-core/src/kinds.ts).
  add column kind text check (kind in ('headline', 'text', 'image', 'cta', 'color', 'order')),
  -- Ajustes del tipo. 'order': {"sections": [{"key": "…", "label": "…"}, …]}.
  add column config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 4000);

-- ── Eduardo: lo que antes estaba en src/features/landing-eduardo ────────────

update public.lp_settings
set name = 'Eduardo Professional Tree Service',
    landing_url = '/eduardo',
    thanks_url = '/eduardo-gracias',
    accent_color = '#d9711f'
where landing = 'eduardo';

update public.lp_variables
set kind = case key
  when 'headline' then 'headline'
  when 'hero_image' then 'image'
  when 'cta_text' then 'cta'
  when 'button_color' then 'color'
  when 'section_order' then 'order'
end
where landing = 'eduardo';

update public.lp_variables
set config = '{"sections": [
  {"key": "signs", "label": "Señales de alerta"},
  {"key": "services", "label": "Servicios"},
  {"key": "process", "label": "Cómo funciona"},
  {"key": "ctaBand", "label": "Franja de disponibilidad"},
  {"key": "testimonials", "label": "Reseñas"},
  {"key": "area", "label": "Zona de servicio"},
  {"key": "why", "label": "Por qué elegirnos"}
]}'::jsonb
where landing = 'eduardo' and key = 'section_order';

-- Toda variable tiene tipo de aquí en adelante.
alter table public.lp_variables alter column kind set not null;

-- ── Crear landings y variables desde el panel (sólo admins, por RLS) ────────

grant insert on public.lp_settings to authenticated;
grant insert, delete on public.lp_variables to authenticated;

-- Crea la variable con su opción original ("control") en un solo paso: una
-- variable sin control no puede probarse.
create or replace function public.lp_create_variable(
  p_landing text,
  p_key text,
  p_name text,
  p_kind text,
  p_description text,
  p_config jsonb,
  p_control_label text,
  p_control_value jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Sólo un administrador puede crear variables';
  end if;

  insert into public.lp_variables (landing, key, name, description, kind, config, enabled, position)
  values (
    p_landing,
    p_key,
    p_name,
    coalesce(p_description, ''),
    p_kind,
    coalesce(p_config, '{}'::jsonb),
    false,
    coalesce((select max(position) + 1 from public.lp_variables where landing = p_landing), 1)
  )
  returning id into v_id;

  insert into public.lp_options (variable_id, label, value, is_control, position)
  values (v_id, p_control_label, p_control_value, true, 0);

  return v_id;
end;
$$;

revoke execute on function public.lp_create_variable(text, text, text, text, text, jsonb, text, jsonb) from public, anon;
grant execute on function public.lp_create_variable(text, text, text, text, text, jsonb, text, jsonb) to authenticated;
