-- Transactional fixtures only. No production users or quotes are changed.
begin;
select set_config('test.report_owner',gen_random_uuid()::text,true),
       set_config('test.executive',gen_random_uuid()::text,true),
       set_config('test.other_admin',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_app_meta_data)
values (current_setting('test.report_owner')::uuid,'usage-owner@example.invalid','{"role":"ADMIN"}'),
       (current_setting('test.executive')::uuid,'usage-executive@example.invalid','{"role":"EXECUTIVE"}'),
       (current_setting('test.other_admin')::uuid,'usage-admin@example.invalid','{"role":"ADMIN"}');
insert into private.cotizador_usage_access values(current_setting('test.report_owner')::uuid);
insert into public.sqp_app_data(bucket,id,owner_id,payload)
select 'quotes',gen_random_uuid()::text,current_setting('test.executive')::uuid,
 jsonb_build_object('date',to_char((now() at time zone 'America/Panama')::date - n,'YYYY-MM-DD')||'T12:00:00Z')
from unnest(array[0,29,30]) n;
insert into public.sqp_app_data(bucket,id,owner_id,payload)
values ('quotes',gen_random_uuid()::text,current_setting('test.executive')::uuid,'{"date":"broken"}');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.report_owner'),true);
do $$
declare result record;
begin
 if not public.can_view_cotizador_usage() then raise exception 'Owner denied'; end if;
 select * into result from public.cotizador_usage_report() where executive_id=current_setting('test.executive')::uuid;
 if result.total is distinct from 2::bigint or result.average_per_day is distinct from 0.07::numeric then
  raise exception 'Incorrect total or 30-day average';
 end if;
 select * into result from public.cotizador_usage_report((now() at time zone 'America/Panama')::date,(now() at time zone 'America/Panama')::date)
 where executive_id=current_setting('test.executive')::uuid;
 if result.total<>1 or result.average_per_day<>1 then raise exception 'Single day calculation failed'; end if;
 begin perform public.cotizador_usage_report(current_date,current_date-1);
  raise exception 'Reversed dates accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cotizador_usage_report(null,null);
  raise exception 'Null dates accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.cotizador_usage_report(current_date-367,current_date);
  raise exception 'Oversized range accepted'; exception when invalid_parameter_value then null; end;
 if private.cotizador_usage_date('2026-10-02T03:00:00Z') <> date '2026-10-01' then
  raise exception 'Panama timezone boundary failed'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.executive'),true);
do $$ begin
 if public.can_view_cotizador_usage() then raise exception 'Executive allowed'; end if;
 begin perform public.cotizador_usage_report(); raise exception 'Executive report exposed';
 exception when insufficient_privilege then null; end;
 begin insert into private.cotizador_usage_access values(auth.uid()); raise exception 'Self-grant allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other_admin'),true);
do $$ begin
 if public.can_view_cotizador_usage() then raise exception 'Other admin allowed'; end if;
 begin perform public.cotizador_usage_report(); raise exception 'Other admin report exposed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.sqp_profiles set active=false where id=current_setting('test.report_owner')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.report_owner'),true);
do $$ begin
 if public.can_view_cotizador_usage() then raise exception 'Inactive owner allowed'; end if;
 begin perform public.cotizador_usage_report(); raise exception 'Inactive owner report exposed';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform public.cotizador_usage_report(); raise exception 'Anonymous report exposed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: averages, date boundaries, owner, executive, other admin, inactive and anonymous permissions' as result;
