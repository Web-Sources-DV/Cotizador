-- Additive report; does not change existing profiles, authentication or data policies.
create table private.cotizador_usage_access (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table private.cotizador_usage_access enable row level security;
revoke all on private.cotizador_usage_access from public, anon, authenticated;
grant select on private.cotizador_usage_access to authenticated;
create policy "Read own report grant" on private.cotizador_usage_access
 for select to authenticated using (user_id=(select auth.uid()));

create function public.can_view_cotizador_usage()
returns boolean language sql stable security invoker set search_path=''
as $$
 select auth.uid() is not null
 and exists(select 1 from private.cotizador_usage_access a where a.user_id=auth.uid())
 and exists(select 1 from public.sqp_profiles p where p.id=auth.uid() and p.active)
$$;
revoke all on function public.can_view_cotizador_usage() from public,anon;
grant execute on function public.can_view_cotizador_usage() to authenticated;

create function private.cotizador_usage_date(value text)
returns date language plpgsql immutable security invoker set search_path=''
as $$
begin
 -- Existing quote dates are ISO timestamps; do not infer dates for legacy malformed data.
 if value is null or value !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' then return null; end if;
 return (value::timestamptz at time zone 'America/Panama')::date;
exception when invalid_datetime_format or datetime_field_overflow then return null;
end;
$$;
revoke all on function private.cotizador_usage_date(text) from public,anon;
grant execute on function private.cotizador_usage_date(text) to authenticated;

create function public.cotizador_usage_report(
 start_date date default ((now() at time zone 'America/Panama')::date-29),
 end_date date default (now() at time zone 'America/Panama')::date
) returns table(executive_id uuid, executive_name text, active boolean, total bigint, average_per_day numeric)
language plpgsql stable security invoker set search_path=''
as $$
begin
 if not public.can_view_cotizador_usage() then
  raise exception 'No tienes permiso para consultar este reporte.' using errcode='42501';
 end if;
 if start_date is null or end_date is null or end_date<start_date or end_date-start_date>365
    or end_date>(now() at time zone 'America/Panama')::date then
  raise exception 'Selecciona un rango de 1 a 366 días, sin fechas futuras.' using errcode='22023';
 end if;
 return query
 select p.id,p.name,p.active,count(q.id),
        round(count(q.id)::numeric/(end_date-start_date+1),2)
 from public.sqp_profiles p
 left join public.sqp_app_data q on q.bucket='quotes' and q.owner_id=p.id
   and private.cotizador_usage_date(q.payload->>'date') between start_date and end_date
 where p.role='EXECUTIVE' or p.id=auth.uid()
    or exists(select 1 from public.sqp_app_data a where a.bucket='quotes' and a.owner_id=p.id)
 group by p.id,p.name,p.active order by count(q.id) desc,p.name,p.id;
end;
$$;
revoke all on function public.cotizador_usage_report(date,date) from public,anon;
grant execute on function public.cotizador_usage_report(date,date) to authenticated;
