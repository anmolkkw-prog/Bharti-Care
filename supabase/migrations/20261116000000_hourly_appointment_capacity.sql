-- One-hour appointment ranges are stored by their start time.
-- Run this migration in the Supabase SQL Editor for an existing deployment.
create or replace function public.available_appointment_slots(p_date date)
returns table(slot_time time, remaining integer)
language plpgsql stable security definer set search_path = '' as $$
declare d uuid;
begin
  if public.current_role() <> 'patient' then raise exception 'Patient access required'; end if;
  select p.id into d from public.profiles p where p.role = 'doctor' and p.is_active order by p.created_at limit 1;
  if d is null then raise exception 'No active doctor is available'; end if;
  return query select s.t, 5 - count(a.id)::integer
    from unnest(case
      when extract(isodow from p_date)::integer = 6 then array['09:30','10:30','11:30','12:30']::time[]
      when extract(isodow from p_date)::integer between 1 and 5 then array['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']::time[]
      else array[]::time[]
    end) s(t)
    left join public.appointments a on a.doctor_id = d and a.appointment_date = p_date and a.appointment_time = s.t and a.status in ('pending','confirmed')
    where p_date >= (now() at time zone 'Asia/Kolkata')::date
      and (p_date > (now() at time zone 'Asia/Kolkata')::date or s.t > (now() at time zone 'Asia/Kolkata')::time)
    group by s.t having count(a.id) < 5 order by s.t;
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
  if taken >= 5 then raise exception 'This appointment time is fully booked'; end if;
  insert into public.appointments(patient_id, doctor_id, appointment_date, appointment_time, visit_type, comment)
  values(patient, d, p_date, p_time, trim(p_visit_type), nullif(trim(p_comment),'')) returning id into appointment;
  return appointment;
end $$;
revoke all on function public.book_appointment(date,time,text,text) from public;
grant execute on function public.book_appointment(date,time,text,text) to authenticated;
