import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!, service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return respond({ error: 'Sign in as an administrator.' }, 401);
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user) return respond({ error: 'Your session is invalid.' }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from('profiles').select('role,is_active').eq('id', user.id).single();
  if (profileError || profile?.role !== 'admin' || !profile.is_active) return respond({ error: 'Administrator access required.' }, 403);
  let body: Record<string, string>;
  try { body = await req.json(); } catch { return respond({ error: 'Invalid request body.' }, 400); }

  if (body.action === 'create') {
    const name = body.name?.trim(), email = body.email?.trim().toLowerCase(), password = body.password || '';
    if (!name || !/^[\p{L}][\p{L}\p{M} .'-]{0,98}[\p{L}\p{M}]$/u.test(name)) return respond({ error: 'Enter a valid doctor name.' }, 400);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: 'Enter a valid email address.' }, 400);
    if (password.length < 12) return respond({ error: 'Temporary password must be at least 12 characters.' }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: 'doctor' }, user_metadata: { full_name: name } });
    if (error) return respond({ error: error.message }, 400);
    const { error: profileError } = await admin.from('profiles').update({ role: 'doctor', full_name: name, email, is_active: true }).eq('id', data.user.id).select('id').single();
    if (profileError) { await admin.auth.admin.deleteUser(data.user.id); return respond({ error: 'Doctor profile setup failed. ' + profileError.message }, 500); }
    const { error: detailError } = await admin.from('staff_details').upsert({ doctor_id: data.user.id, qualification: body.qualification?.trim() || null, specialty: body.specialty?.trim() || 'General Practitioner' });
    if (detailError) { await admin.auth.admin.deleteUser(data.user.id); return respond({ error: 'Doctor account setup failed. ' + detailError.message }, 500); }
    return respond({ id: data.user.id, email, name });
  }
  if (body.action === 'deactivate' || body.action === 'reactivate') {
    const id = body.userId;
    if (!id || id === user.id) return respond({ error: 'Choose a different doctor account.' }, 400);
    const { data: target, error } = await admin.from('profiles').select('role').eq('id', id).single();
    if (error || target?.role !== 'doctor') return respond({ error: 'Doctor account not found.' }, 404);
    const active = body.action === 'reactivate';
    const { error: updateError } = await admin.from('profiles').update({ is_active: active }).eq('id', id);
    if (updateError) return respond({ error: updateError.message }, 500);
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' });
    if (authUpdateError) return respond({ error: authUpdateError.message }, 500);
    return respond({ id, is_active: active });
  }
  return respond({ error: 'Unsupported action.' }, 400);
});
