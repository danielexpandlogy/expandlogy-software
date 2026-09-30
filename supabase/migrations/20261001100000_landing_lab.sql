-- ─────────────────────────────────────────────────────────────────────────────
-- Landing Lab: A/B testing autooptimizado para landings públicas (piloto:
-- /eduardo). Cada variable (titular, imagen, CTA…) se prueba por separado; la
-- landing reparte el tráfico con un bandit (Thompson sampling) a partir de los
-- conteos que expone lp_public_config.
--
-- Los visitantes son anónimos: nunca leen ni escriben tablas directamente,
-- sólo llaman a lp_public_config / lp_track_visit / lp_track_event. Los
-- admins gestionan todo desde /eduardo-admin (RLS con is_admin()).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Reglas del algoritmo, una fila por landing ─────────────────────────────

create table public.lp_settings (
  landing                  text primary key check (landing ~ '^[a-z0-9-]{1,40}$'),
  -- false: reparto parejo siempre (A/B clásico); true: prioriza a las mejores.
  auto_optimize            boolean not null default true,
  -- Hasta que TODAS las opciones activas lleguen a esto, el reparto es parejo.
  min_visitors_per_option  integer not null default 300 check (min_visitors_per_option between 1 and 1000000),
  -- Para declarar ganador: agendas de la mejor opción y probabilidad de ser la mejor.
  min_conversions_to_win   integer not null default 30 check (min_conversions_to_win between 1 and 100000),
  win_probability          numeric(4, 3) not null default 0.950 check (win_probability between 0.5 and 0.999),
  -- Tráfico mínimo que recibe cada opción activa mientras se prioriza.
  traffic_floor            numeric(4, 3) not null default 0.100 check (traffic_floor between 0 and 0.5),
  updated_at               timestamptz not null default now()
);

-- ── Variables y sus opciones ────────────────────────────────────────────────

create table public.lp_variables (
  id                uuid primary key default gen_random_uuid(),
  landing           text not null references public.lp_settings (landing) on delete cascade,
  -- La landing aplica cada variable según su key (ver src/features/landing-eduardo/variants.ts).
  key               text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  name              text not null check (char_length(name) between 1 and 80),
  description       text not null default '' check (char_length(description) <= 500),
  enabled           boolean not null default false,
  -- Con ganador fijado, todo el tráfico ve esa opción y deja de registrarse.
  winner_option_id  uuid,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  unique (landing, key)
);

create table public.lp_options (
  id           uuid primary key default gen_random_uuid(),
  variable_id  uuid not null references public.lp_variables (id) on delete cascade,
  label        text not null check (char_length(label) between 1 and 80),
  value        jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object' and pg_column_size(value) <= 4000),
  -- La versión original de la landing; no se puede borrar.
  is_control   boolean not null default false,
  active       boolean not null default true,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (id, variable_id)
);

create index lp_options_variable_idx on public.lp_options (variable_id, position);
create unique index lp_options_one_control_idx on public.lp_options (variable_id) where is_control;

-- El ganador tiene que ser una opción de la misma variable. Si se borra la
-- opción, sólo se limpia winner_option_id.
alter table public.lp_variables
  add constraint lp_variables_winner_fkey
  foreign key (winner_option_id, id) references public.lp_options (id, variable_id)
  on delete set null (winner_option_id);

create or replace function public.lp_options_guard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Permite el borrado en cascada de la variable; bloquea borrar sólo el control.
  if old.is_control and exists (select 1 from public.lp_variables where id = old.variable_id) then
    raise exception 'La opción original (control) no se puede borrar';
  end if;
  return old;
end;
$$;

create trigger lp_options_keep_control
  before delete on public.lp_options
  for each row execute function public.lp_options_guard_delete();

-- ── Visitantes y lo que vio cada uno ────────────────────────────────────────

create table public.lp_visitors (
  -- Lo genera el navegador (crypto.randomUUID) y lo guarda en localStorage.
  id              uuid primary key,
  landing         text not null references public.lp_settings (landing) on delete cascade,
  utm             jsonb not null default '{}'::jsonb,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  cta_clicked_at  timestamptz,
  converted_at    timestamptz
);

create index lp_visitors_landing_idx on public.lp_visitors (landing, first_seen_at desc);

create table public.lp_assignments (
  visitor_id   uuid not null references public.lp_visitors (id) on delete cascade,
  variable_id  uuid not null references public.lp_variables (id) on delete cascade,
  option_id    uuid not null,
  assigned_at  timestamptz not null default now(),
  primary key (visitor_id, variable_id),
  foreign key (option_id, variable_id) references public.lp_options (id, variable_id) on delete cascade
);

create index lp_assignments_option_idx on public.lp_assignments (option_id);
create index lp_assignments_variable_idx on public.lp_assignments (variable_id);

-- ── Estadísticas ────────────────────────────────────────────────────────────

-- security_invoker: aplica la RLS de quien consulta (sólo admins ven filas).
create view public.lp_option_stats
with (security_invoker = true)
as
  select
    o.id                    as option_id,
    o.variable_id,
    count(a.visitor_id)     as visitors,
    count(v.cta_clicked_at) as clicks,
    count(v.converted_at)   as conversions
  from public.lp_options o
  left join public.lp_assignments a on a.option_id = o.id
  left join public.lp_visitors v on v.id = a.visitor_id
  group by o.id, o.variable_id;

create view public.lp_landing_totals
with (security_invoker = true)
as
  select
    s.landing,
    count(v.id)                                                   as visitors,
    count(v.cta_clicked_at)                                       as clicks,
    count(v.converted_at)                                         as conversions,
    count(v.id) filter (where v.first_seen_at > now() - interval '7 days') as visitors_7d,
    count(v.converted_at) filter (where v.converted_at > now() - interval '7 days') as conversions_7d
  from public.lp_settings s
  left join public.lp_visitors v on v.landing = s.landing
  group by s.landing;

-- ── RLS: todo es sólo para admins ───────────────────────────────────────────

alter table public.lp_settings enable row level security;
alter table public.lp_variables enable row level security;
alter table public.lp_options enable row level security;
alter table public.lp_visitors enable row level security;
alter table public.lp_assignments enable row level security;

create policy "lp_settings: admins" on public.lp_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lp_variables: admins" on public.lp_variables
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lp_options: admins" on public.lp_options
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Visitantes y asignaciones: los admins leen y borran (reiniciar datos); sólo
-- las funciones de abajo los crean.
create policy "lp_visitors: admins leen" on public.lp_visitors
  for select to authenticated using (public.is_admin());
create policy "lp_visitors: admins borran" on public.lp_visitors
  for delete to authenticated using (public.is_admin());
create policy "lp_assignments: admins leen" on public.lp_assignments
  for select to authenticated using (public.is_admin());
create policy "lp_assignments: admins borran" on public.lp_assignments
  for delete to authenticated using (public.is_admin());

revoke all on public.lp_settings, public.lp_variables, public.lp_options,
  public.lp_visitors, public.lp_assignments, public.lp_option_stats, public.lp_landing_totals
  from anon, authenticated;
grant select, update on public.lp_settings to authenticated;
grant select, update on public.lp_variables to authenticated;
grant select, insert, update, delete on public.lp_options to authenticated;
grant select, delete on public.lp_visitors, public.lp_assignments to authenticated;
grant select on public.lp_option_stats, public.lp_landing_totals to authenticated;

-- ── API pública (visitantes anónimos) ───────────────────────────────────────

-- Configuración que la landing necesita para elegir qué mostrar: variables,
-- opciones y sus conteos (visitantes y agendas) para el bandit.
create or replace function public.lp_public_config(p_landing text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'settings', jsonb_build_object(
      'auto_optimize', s.auto_optimize,
      'min_visitors_per_option', s.min_visitors_per_option,
      'min_conversions_to_win', s.min_conversions_to_win,
      'win_probability', s.win_probability,
      'traffic_floor', s.traffic_floor
    ),
    'variables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', var.id,
        'key', var.key,
        'enabled', var.enabled,
        'winner_option_id', var.winner_option_id,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', o.id,
            'label', o.label,
            'value', o.value,
            'is_control', o.is_control,
            'active', o.active,
            'position', o.position,
            'visitors', (select count(*) from public.lp_assignments a where a.option_id = o.id),
            'conversions', (
              select count(*) from public.lp_assignments a
              join public.lp_visitors v on v.id = a.visitor_id
              where a.option_id = o.id and v.converted_at is not null
            )
          ) order by o.position, o.created_at)
          from public.lp_options o where o.variable_id = var.id
        ), '[]'::jsonb)
      ) order by var.position, var.created_at)
      from public.lp_variables var where var.landing = s.landing
    ), '[]'::jsonb)
  )
  from public.lp_settings s
  where s.landing = p_landing;
$$;

-- Registra (o refresca) al visitante y lo que le tocó ver: {variable_id: option_id}.
-- Ignora variables apagadas o con ganador fijado y opciones pausadas. Tras
-- agendar, su combinación ya no cambia.
create or replace function public.lp_track_visit(
  p_landing text,
  p_visitor_id uuid,
  p_assignments jsonb,
  p_utm jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_converted timestamptz;
begin
  if not exists (select 1 from public.lp_settings where landing = p_landing) then
    raise exception 'Landing desconocida';
  end if;
  if jsonb_typeof(p_assignments) <> 'object'
     or (select count(*) from jsonb_object_keys(p_assignments)) > 20 then
    raise exception 'Asignaciones inválidas';
  end if;
  if p_utm is null or jsonb_typeof(p_utm) <> 'object' or pg_column_size(p_utm) > 2000 then
    p_utm := '{}'::jsonb;
  end if;

  insert into public.lp_visitors as v (id, landing, utm)
  values (p_visitor_id, p_landing, p_utm)
  on conflict (id) do update set last_seen_at = now()
    where v.landing = excluded.landing
  returning converted_at into v_converted;

  -- Sin fila devuelta: el id ya existe en otra landing. Con agenda: se congela.
  if not found or v_converted is not null then
    return;
  end if;

  insert into public.lp_assignments as a (visitor_id, variable_id, option_id)
  select p_visitor_id, var.id, o.id
  from jsonb_each_text(p_assignments) e
  join public.lp_variables var
    on var.id::text = e.key and var.landing = p_landing and var.enabled and var.winner_option_id is null
  join public.lp_options o
    on o.id::text = e.value and o.variable_id = var.id and o.active
  on conflict (visitor_id, variable_id) do update
    set option_id = excluded.option_id, assigned_at = now()
    where a.option_id <> excluded.option_id;
end;
$$;

-- Marca un evento del visitante (una vez): 'cta_click' o 'conversion' (agenda,
-- desde la página de gracias). Devuelve true si es la primera vez.
create or replace function public.lp_track_event(p_landing text, p_visitor_id uuid, p_event text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event = 'cta_click' then
    update public.lp_visitors set cta_clicked_at = now()
    where id = p_visitor_id and landing = p_landing and cta_clicked_at is null;
  elsif p_event = 'conversion' then
    update public.lp_visitors set converted_at = now()
    where id = p_visitor_id and landing = p_landing and converted_at is null;
  else
    raise exception 'Evento desconocido: %', p_event;
  end if;
  return found;
end;
$$;

revoke execute on function public.lp_public_config(text) from public;
revoke execute on function public.lp_track_visit(text, uuid, jsonb, jsonb) from public;
revoke execute on function public.lp_track_event(text, uuid, text) from public;
grant execute on function public.lp_public_config(text) to anon, authenticated;
grant execute on function public.lp_track_visit(text, uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.lp_track_event(text, uuid, text) to anon, authenticated;

-- ── Semilla: landing de Eduardo ─────────────────────────────────────────────
-- La opción "control" de cada variable es la landing original. El color del
-- botón empieza apagado: su efecto suele ser chico y tarda mucho en medirse.

insert into public.lp_settings (landing) values ('eduardo');

with vars as (
  insert into public.lp_variables (landing, key, name, description, enabled, position)
  values
    ('eduardo', 'headline', 'Titular del hero', 'El titular grande de arriba. Suele ser la variable con más impacto.', true, 1),
    ('eduardo', 'hero_image', 'Imagen del hero', 'La foto debajo del titular.', true, 2),
    ('eduardo', 'cta_text', 'Texto de los botones', 'El texto de todos los botones de agendar (y su subtítulo).', true, 3),
    ('eduardo', 'section_order', 'Orden de las secciones', 'En qué orden aparecen las secciones debajo del hero.', true, 4),
    ('eduardo', 'button_color', 'Color de los botones', 'El color de los botones de agendar.', false, 5)
  returning id, key
)
insert into public.lp_options (variable_id, label, value, is_control, position)
select vars.id, o.label, o.value::jsonb, o.is_control, o.position
from vars
join (values
  ('headline', 'Original: "Safe Again"',
    '{"before": "Branches Over Your Roof? Your Yard Should Feel ", "highlight": "Safe Again", "after": "."}', true, 0),
  ('headline', 'Respuesta honesta y gratis',
    '{"before": "Worried About That Tree? Get a ", "highlight": "Free, Honest Answer", "after": " Today."}', false, 1),
  ('headline', 'Local + estimado el mismo día',
    '{"before": "Murfreesboro''s Trusted Tree Removal — ", "highlight": "Free Same-Day Estimates", "after": ""}', false, 2),

  ('hero_image', 'Original: calle antes y después',
    '{"src": "https://assets.cdn.filesafe.space/Vyux6gA2uQ0it9GxuuhX/media/6ab835e51f3be2be1bd5dace.jpg", "alt": "A street blocked by a fallen tree during a storm, and the same street safe and clear afterward"}', true, 0),
  ('hero_image', 'Cuadrilla trabajando',
    '{"src": "https://assets.cdn.filesafe.space/Vyux6gA2uQ0it9GxuuhX/media/6ab835e53ae3da26fb86fe38.jpg", "alt": "Professional cutting down a tree with a chainsaw"}', false, 1),

  ('cta_text', 'Original: "Book My Free Estimate"',
    '{"label": "Book My Free Estimate", "sub": "Limited Weekly Availability"}', true, 0),
  ('cta_text', '"Get My Free Quote Today"',
    '{"label": "Get My Free Quote Today", "sub": "Takes Less Than a Minute"}', false, 1),
  ('cta_text', '"Check Available Times"',
    '{"label": "Check Available Times", "sub": "Free · No Obligation"}', false, 2),

  ('section_order', 'Original: señales primero',
    '{"order": ["signs", "services", "process", "ctaBand", "testimonials", "area", "why"]}', true, 0),
  ('section_order', 'Reseñas primero',
    '{"order": ["testimonials", "signs", "services", "process", "ctaBand", "area", "why"]}', false, 1),

  ('button_color', 'Original: naranja',
    '{"color": "#d9711f", "hover": "#b25a16"}', true, 0),
  ('button_color', 'Verde',
    '{"color": "#2f7d32", "hover": "#25632a"}', false, 1)
) as o (key, label, value, is_control, position) on o.key = vars.key;
