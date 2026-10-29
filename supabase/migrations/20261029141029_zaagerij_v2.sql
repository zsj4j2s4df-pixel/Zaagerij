-- Standalone Zaagerij tables. Existing applications are not altered.
create table public.zaagerij_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 team_id uuid not null,
 role text not null check(role in ('office','workshop'))
);
alter table public.zaagerij_members enable row level security;
create policy member_self on public.zaagerij_members for select to authenticated using(user_id=(select auth.uid()));
grant select on public.zaagerij_members to authenticated;
revoke all on public.zaagerij_members from anon;
create table public.zaagerij_projects (
 id uuid primary key,
 team_id uuid not null,
 version integer not null check(version>0),
 document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<2000000),
 updated_at timestamptz not null default now()
);
alter table public.zaagerij_projects enable row level security;
create index zaagerij_project_team on public.zaagerij_projects(team_id);
create policy project_read on public.zaagerij_projects for select to authenticated using(team_id in (select team_id from public.zaagerij_members where user_id=(select auth.uid())));
create policy project_insert on public.zaagerij_projects for insert to authenticated with check(team_id in (select team_id from public.zaagerij_members where user_id=(select auth.uid()) and role='office'));
create policy project_update on public.zaagerij_projects for update to authenticated using(team_id in (select team_id from public.zaagerij_members where user_id=(select auth.uid()) and role='office')) with check(team_id in (select team_id from public.zaagerij_members where user_id=(select auth.uid()) and role='office'));
grant select,insert,update on public.zaagerij_projects to authenticated;
revoke all on public.zaagerij_projects from anon;
create function public.zaagerij_publish(p_id uuid,p_document jsonb,p_base integer) returns integer language plpgsql security invoker set search_path='' as $$
declare current_version integer; member_team uuid;
begin
 select team_id into member_team from public.zaagerij_members where user_id=auth.uid() and role='office';
 if member_team is null then raise exception 'Alleen kantoor kan een nieuwe lijstversie publiceren.'; end if;
 select version into current_version from public.zaagerij_projects where id=p_id for update;
 if current_version is null then
   if p_base<>0 then raise exception 'Versieconflict. Haal eerst de actuele kantoorversie op.'; end if;
   insert into public.zaagerij_projects(id,team_id,version,document) values(p_id,member_team,1,p_document);
   return 1;
 end if;
 if current_version<>p_base then raise exception 'Versieconflict. De lijst is elders gewijzigd; niets is overschreven.';end if;
 update public.zaagerij_projects set version=version+1,document=p_document,updated_at=now() where id=p_id;
 return current_version+1;
end;$$;
revoke all on function public.zaagerij_publish(uuid,jsonb,integer) from public;
grant execute on function public.zaagerij_publish(uuid,jsonb,integer) to authenticated;
create table public.zaagerij_progress (
 project_id uuid not null references public.zaagerij_projects(id) on delete cascade,
 unit text not null check(length(unit)<150),
 event jsonb not null,
 user_id uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(project_id,unit)
);
alter table public.zaagerij_progress enable row level security;
create policy progress_read on public.zaagerij_progress for select to authenticated using(exists(select 1 from public.zaagerij_projects p where p.id=project_id));
create policy progress_insert on public.zaagerij_progress for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.zaagerij_projects p where p.id=project_id));
create policy progress_update on public.zaagerij_progress for update to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.zaagerij_projects p where p.id=project_id)) with check(user_id=(select auth.uid()) and exists(select 1 from public.zaagerij_projects p where p.id=project_id));
grant select,insert,update on public.zaagerij_progress to authenticated;
revoke all on public.zaagerij_progress from anon;
-- Atomic per-user daily AI quota; table cannot be updated from the Data API.
create schema if not exists zaagerij_private;
create table zaagerij_private.ai_usage(user_id uuid not null,day date not null default current_date,used integer not null default 0,primary key(user_id,day));
revoke all on zaagerij_private.ai_usage from public,anon,authenticated;
create function zaagerij_private.take_ai_quota() returns boolean language plpgsql security definer set search_path='' as $$
declare count_used integer;
begin
 if auth.uid() is null or not exists(select 1 from public.zaagerij_members where user_id=auth.uid()) then return false;end if;
 insert into zaagerij_private.ai_usage(user_id,day,used) values(auth.uid(),current_date,1)
 on conflict(user_id,day) do update set used=zaagerij_private.ai_usage.used+1 where zaagerij_private.ai_usage.used<30 returning used into count_used;
 return count_used is not null;
end;$$;
revoke all on function zaagerij_private.take_ai_quota() from public;
grant usage on schema zaagerij_private to authenticated;
grant execute on function zaagerij_private.take_ai_quota() to authenticated;
create function public.zaagerij_ai_quota() returns boolean language sql security invoker set search_path='' as $$ select zaagerij_private.take_ai_quota(); $$;
revoke all on function public.zaagerij_ai_quota() from public;
grant execute on function public.zaagerij_ai_quota() to authenticated;
