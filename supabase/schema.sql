-- Run this once in Supabase SQL Editor. The browser uses only the anon key.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'patient' check (role in ('patient', 'doctor', 'admin')),
  full_name text,
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.current_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.is_active = true
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce(public.current_role() = 'admin', false) $$;
create or replace function public.is_doctor() returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce(public.current_role() = 'doctor', false) $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  assigned_role text := case when new.raw_app_meta_data ->> 'role' in ('doctor', 'admin') then new.raw_app_meta_data ->> 'role' else 'patient' end;
  patient_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  patient_phone text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  patient_height text := nullif(trim(new.raw_user_meta_data ->> 'height_cm'), '');
  patient_weight text := nullif(trim(new.raw_user_meta_data ->> 'weight_kg'), '');
begin
  if assigned_role = 'patient' then
    if patient_name is null or patient_phone is null then
      raise exception 'Patient name and phone are required.';
    end if;
    if patient_phone !~ '^\+?[0-9 ()-]{7,20}$' then
      raise exception 'Enter a valid patient phone number.';
    end if;
    if patient_height is null or patient_height !~ '^[0-9]+([.][0-9]+)?$' then
      raise exception 'Patient height is required and must be numeric.';
    end if;
    if patient_height::numeric not between 30 and 250 then
      raise exception 'Patient height must be between 30 and 250 cm.';
    end if;
    if patient_weight is null or patient_weight !~ '^[0-9]+([.][0-9]+)?$' then
      raise exception 'Patient weight is required and must be numeric.';
    end if;
    if patient_weight::numeric not between 1 and 500 then
      raise exception 'Patient weight must be between 1 and 500 kg.';
    end if;
  end if;

  insert into public.profiles (id, role, full_name, email, phone)
  values (
    new.id,
    assigned_role,
    patient_name,
    new.email,
    patient_phone
  ) on conflict (id) do nothing;
  insert into public.health_profiles(patient_id, height_cm, weight_kg)
  values (
    new.id,
    case when (new.raw_user_meta_data ->> 'height_cm') ~ '^[0-9]+([.][0-9]+)?$' then (new.raw_user_meta_data ->> 'height_cm')::numeric else null end,
    case when (new.raw_user_meta_data ->> 'weight_kg') ~ '^[0-9]+([.][0-9]+)?$' then (new.raw_user_meta_data ->> 'weight_kg')::numeric else null end
  ) on conflict (patient_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table if not exists public.health_profiles (
  patient_id uuid primary key references public.profiles(id) on delete cascade,
  height_cm numeric(5,1) check (height_cm is null or height_cm between 30 and 250),
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 1 and 500),
  medical_history text check (medical_history is null or char_length(medical_history) <= 5000),
  updated_at timestamptz not null default now()
);
alter table public.health_profiles enable row level security;

create table if not exists public.staff_details (
  doctor_id uuid primary key references public.profiles(id) on delete cascade,
  qualification text,
  specialty text not null default 'General Practitioner',
  created_at timestamptz not null default now()
);
alter table public.staff_details enable row level security;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  doctor_id uuid not null references public.profiles(id),
  appointment_date date not null,
  appointment_time time not null,
  visit_type text not null check (char_length(visit_type) between 1 and 100),
  comment text check (comment is null or char_length(comment) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  visit_summary text check (visit_summary is null or char_length(visit_summary) <= 2000),
  created_at timestamptz not null default now(),
  constraint appointment_slot check (
    appointment_time = any(array['09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']::time[])
  )
);
-- Keep the table constraint compatible with prior appointment rows while allowing clinic hours.
alter table public.appointments drop constraint if exists appointment_slot;
alter table public.appointments add constraint appointment_slot check (
  appointment_time = any(array['09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']::time[])
);
create index if not exists appointments_date_time_idx on public.appointments(appointment_date, appointment_time, doctor_id);
create index if not exists appointments_patient_idx on public.appointments(patient_id, appointment_date desc);
alter table public.appointments enable row level security;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments') then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.profiles(id),
  doctor_id uuid not null references public.profiles(id),
  medication text not null check (char_length(medication) between 1 and 1000),
  instructions text check (instructions is null or char_length(instructions) <= 4000),
  created_at timestamptz not null default now()
);
alter table public.prescriptions enable row level security;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.profiles(id),
  rating smallint not null check (rating between 1 and 5),
  message text check (message is null or char_length(message) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;

-- Profiles expose patient identity to clinic staff, and only a user's own profile to that user.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (public.current_role() = 'admin') or (public.current_role() = 'doctor' and role = 'patient'));
revoke update, insert, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists health_read on public.health_profiles;
create policy health_read on public.health_profiles for select to authenticated
using (patient_id = (select auth.uid()) or public.current_role() in ('doctor','admin'));
drop policy if exists health_patient_insert on public.health_profiles;
create policy health_patient_insert on public.health_profiles for insert to authenticated
with check (patient_id = (select auth.uid()) and public.current_role() = 'patient'
  and height_cm is not null and weight_kg is not null and nullif(btrim(medical_history), '') is not null);
drop policy if exists health_patient_update on public.health_profiles;
create policy health_patient_update on public.health_profiles for update to authenticated
using (patient_id = (select auth.uid()) and public.current_role() = 'patient')
with check (patient_id = (select auth.uid()) and public.current_role() = 'patient'
  and height_cm is not null and weight_kg is not null and nullif(btrim(medical_history), '') is not null);
grant select, insert, update on public.health_profiles to authenticated;

drop policy if exists staff_details_read on public.staff_details;
create policy staff_details_read on public.staff_details for select to authenticated
using (public.current_role() in ('doctor','admin') or doctor_id = (select auth.uid()));
grant select on public.staff_details to authenticated;

drop policy if exists appointments_read on public.appointments;
create policy appointments_read on public.appointments for select to authenticated
using (patient_id = (select auth.uid()) or (doctor_id = (select auth.uid()) and public.current_role() = 'doctor') or public.current_role() = 'admin');
drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments for update to authenticated
using ((doctor_id = (select auth.uid()) and public.current_role() = 'doctor') or public.current_role() = 'admin')
with check ((doctor_id = (select auth.uid()) and public.current_role() = 'doctor') or public.current_role() = 'admin');
grant select on public.appointments to authenticated;
grant update (status, visit_summary) on public.appointments to authenticated;

drop policy if exists prescriptions_read on public.prescriptions;
create policy prescriptions_read on public.prescriptions for select to authenticated
using (patient_id = (select auth.uid()) or doctor_id = (select auth.uid()) and public.current_role() = 'doctor' or public.current_role() = 'admin');
drop policy if exists prescriptions_staff_write on public.prescriptions;
create policy prescriptions_staff_write on public.prescriptions for insert to authenticated
with check (public.current_role() in ('doctor','admin') and exists (
  select 1 from public.appointments a where a.id = prescriptions.appointment_id
  and a.patient_id = prescriptions.patient_id and a.doctor_id = prescriptions.doctor_id
  and (a.doctor_id = (select auth.uid()) or public.current_role() = 'admin')
));
create policy prescriptions_staff_update on public.prescriptions for update to authenticated
using ((doctor_id = (select auth.uid()) and public.current_role() = 'doctor') or public.current_role() = 'admin')
with check ((doctor_id = (select auth.uid()) and public.current_role() = 'doctor') or public.current_role() = 'admin');
grant select, insert, update on public.prescriptions to authenticated;

drop policy if exists feedback_read on public.feedback;
create policy feedback_read on public.feedback for select to authenticated
using (patient_id = (select auth.uid()) or public.current_role() in ('doctor','admin'));
drop policy if exists feedback_patient_write on public.feedback;
create policy feedback_patient_write on public.feedback for insert to authenticated
with check (patient_id = (select auth.uid()) and public.current_role() = 'patient'
  and message is not null and nullif(btrim(message), '') is not null
  and exists (select 1 from public.appointments a where a.id = appointment_id and a.patient_id = (select auth.uid()) and a.status = 'completed'));
grant select, insert on public.feedback to authenticated;

create or replace function public.available_appointment_slots(p_date date)
returns table(slot_time time, remaining integer)
language plpgsql stable security definer set search_path = '' as $$
declare d uuid;
begin
  if public.current_role() <> 'patient' then raise exception 'Patient access required'; end if;
  select p.id into d from public.profiles p where p.role = 'doctor' and p.is_active order by p.created_at limit 1;
  if d is null then raise exception 'No active doctor is available'; end if;
  return query select s.t, 10 - count(a.id)::integer
    from unnest(case
      when extract(isodow from p_date)::integer = 6 then array['09:30','10:30','11:30','12:30']::time[]
      when extract(isodow from p_date)::integer between 1 and 5 then array['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']::time[]
      else array[]::time[]
    end) s(t)
    left join public.appointments a on a.doctor_id = d and a.appointment_date = p_date and a.appointment_time = s.t and a.status in ('pending','confirmed')
    where p_date >= (now() at time zone 'Asia/Kolkata')::date
      and (p_date > (now() at time zone 'Asia/Kolkata')::date or s.t > (now() at time zone 'Asia/Kolkata')::time)
    group by s.t having count(a.id) < 10 order by s.t;
end $$;
revoke all on function public.available_appointment_slots(date) from public;
grant execute on function public.available_appointment_slots(date) to authenticated;

create or replace function public.book_appointment(p_date date, p_time time, p_visit_type text, p_comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare patient uuid := auth.uid(); d uuid; appointment uuid; taken integer;
begin
  if patient is null or public.current_role() <> 'patient' then raise exception 'Patient access required'; end if;
  if p_date < (now() at time zone 'Asia/Kolkata')::date or (p_date = (now() at time zone 'Asia/Kolkata')::date and p_time <= (now() at time zone 'Asia/Kolkata')::time) then raise exception 'Choose a future appointment time'; end if;
  if not (
    (extract(isodow from p_date)::integer between 1 and 5 and p_time = any(array['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']::time[]))
    or (extract(isodow from p_date)::integer = 6 and p_time = any(array['09:30','10:30','11:30','12:30']::time[]))
  ) then raise exception 'That appointment time is unavailable'; end if;
  if p_visit_type is null or char_length(trim(p_visit_type)) not between 1 and 100 then raise exception 'Choose a visit type'; end if;
  if p_comment is null or nullif(trim(p_comment), '') is null then raise exception 'Add a note for the clinic'; end if;
  if char_length(p_comment) > 1000 then raise exception 'Description is too long'; end if;
  select p.id into d from public.profiles p where p.role = 'doctor' and p.is_active order by p.created_at limit 1;
  if d is null then raise exception 'No active doctor is available'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_date::text || p_time::text || d::text, 0));
  select count(*) into taken from public.appointments a where a.doctor_id = d and a.appointment_date = p_date and a.appointment_time = p_time and a.status in ('pending','confirmed');
  if taken >= 10 then raise exception 'This appointment time is fully booked'; end if;
  insert into public.appointments(patient_id, doctor_id, appointment_date, appointment_time, visit_type, comment)
  values(patient, d, p_date, p_time, trim(p_visit_type), nullif(trim(p_comment),'')) returning id into appointment;
  return appointment;
end $$;
revoke all on function public.book_appointment(date,time,text,text) from public;
grant execute on function public.book_appointment(date,time,text,text) to authenticated;

-- Only the Supabase service role (manage-doctor Edge Function) can create staff profiles.
revoke insert, update, delete on public.staff_details from anon, authenticated;
grant select on public.staff_details to authenticated;
