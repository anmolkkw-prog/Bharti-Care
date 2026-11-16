(() => {
  'use strict';
  const PAGE = document.body.dataset.page || 'landing';
  const ROLE_PAGE = { patient: 'patient', doctor: 'doctor', admin: 'admin' };
  const sb = window.supabase;
  const cfg = window.SUPABASE_CONFIG || {};
  const client = sb && cfg.url && cfg.anonKey && !cfg.url.includes('your-project') && !cfg.anonKey.includes('your-anon-key')
    ? sb.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  const logic = window.ClinicLogic;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const message = (el, text, success = false) => { if (!el) return; el.textContent = text || ''; el.classList.toggle('success', success); };
  const toast = (text, error = false) => { const el = $('#toast'); if (!el) return; el.textContent = text; el.classList.toggle('error', error); el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3600); };
  const errorText = error => error?.message || 'Something went wrong. Please try again.';
  const emailDeliveryErrorText = error => {
    const detail = errorText(error);
    if (/email address not authorized/i.test(detail)) return 'Supabase’s built-in email sender only delivers to project team addresses. Configure a custom SMTP provider in Supabase Auth settings to send verification codes to patients.';
    if (error?.status === 429 || /rate limit|too many requests/i.test(detail)) return 'Email sending is temporarily rate-limited. Wait a minute before trying again. Supabase’s built-in sender also has a low project-wide limit; configure custom SMTP for patient sign-up.';
    if (/error sending confirmation email|sending.*email/i.test(detail)) return 'Supabase could not send the verification email. Check Authentication logs and your SMTP settings, then try again.';
    return detail;
  };
  const functionErrorText = async (error, functionName) => {
    const detail = errorText(error);
    if (error?.name === 'FunctionsFetchError' || /failed to send a request to the edge function/i.test(detail)) {
      const project = cfg.url ? ` for ${cfg.url.replace(/^https?:\/\//, '')}` : '';
      return `Could not reach the ${functionName} Edge Function${project}. Deploy it with “supabase functions deploy ${functionName}” and check the browser Network panel for network or CORS errors.`;
    }
    const response = error?.context;
    if (response && typeof response.clone === 'function') {
      let serverMessage = '';
      try {
        const body = await response.clone().json();
        serverMessage = body?.error || body?.message || '';
      } catch {}
      if (serverMessage) return `${serverMessage} (HTTP ${response.status})`;
      if (response.status) return `${detail} (HTTP ${response.status})`;
    }
    return detail;
  };
  const localDate = (date = new Date()) => { const d = new Date(date); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const formatDate = value => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const formatTime = value => { if (!value) return '—'; const [h, m] = value.slice(0, 5).split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
  const initials = name => (name || 'Patient').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  const statusBadge = status => `<span class="badge ${esc(status)}">${esc(status)}</span>`;
  const profileName = profile => profile?.full_name || profile?.email || 'Patient';
  const isValidName = logic.isValidName;

  async function getSessionProfile() {
    if (!client) throw new Error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY, then run npm run build.');
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (!session) return null;
    const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', session.user.id).single();
    if (profileError) throw profileError;
    return { session, profile };
  }

  async function signOut() { if (client) await client.auth.signOut(); location.href = '/'; }
  function setTabs() {
    $$('.dash-tab').forEach(button => button.addEventListener('click', () => activatePanel(button.dataset.panel)));
    $$('[data-panel-link]').forEach(button => button.addEventListener('click', () => activatePanel(button.dataset.panelLink)));
    $$('[data-signout]').forEach(button => button.addEventListener('click', signOut));
  }
  function activatePanel(name) {
    $$('.dash-tab').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
    if (PAGE === 'patient') { if (name === 'appointments') loadPatientAppointments(); if (name === 'prescriptions') loadPrescriptions('patient'); if (name === 'health') loadHealth(); }
    if (PAGE === 'doctor') { if (name === 'patients') loadDoctorPatients(); if (name === 'prescriptions') loadPrescriptions('doctor'); }
    if (PAGE === 'admin') { if (name === 'appointments') loadAdminAppointments(); if (name === 'patients') loadAdminPatients(); if (name === 'prescriptions') loadAdminPrescriptions(); if (name === 'team') loadAdminTeam(); }
  }
  function showEmpty(target, text) { const el = typeof target === 'string' ? $(target) : target; if (el) el.innerHTML = `<div class="empty-state">${esc(text)}</div>`; }
  function appointmentCard(row, options = {}) {
    const patient = row.patient || row.profiles || {};
    const doctor = row.doctor || row.doctors || {};
    const patientLabel = options.patient ? '' : `<div><strong>${esc(profileName(patient))}</strong><p>${esc(patient.email || '')}${patient.phone ? ` · ${esc(patient.phone)}` : ''}</p></div>`;
    const idLabel = options.admin ? `<p>Patient ID: ${esc(row.patient_id || '')}</p>` : '';
    const buttons = options.doctor ? `<div class="data-actions">${row.status === 'pending' ? `<button class="small-button" data-confirm="${esc(row.id)}">Confirm</button>` : ''}${row.status === 'confirmed' ? `<button class="small-button" data-complete="${esc(row.id)}">Complete visit</button>` : ''}<button class="small-button" data-open-visit="${esc(row.id)}">Details & notes</button></div>` : (options.patient && row.status === 'completed' && !row.feedback ? `<div class="data-actions"><button class="small-button" data-feedback="${esc(row.id)}">Leave feedback</button></div>` : (options.admin && ['pending','confirmed'].includes(row.status) ? `<div class="data-actions"><button class="small-button" data-admin-status="${esc(row.id)}" data-status="${row.status === 'pending' ? 'confirmed' : 'completed'}">${row.status === 'pending' ? 'Confirm' : 'Mark completed'}</button></div>` : ''));
    const feedbackData = Array.isArray(row.feedback) ? row.feedback[0] : row.feedback;
    const feedback = feedbackData ? `<p><strong>Patient feedback${feedbackData.rating ? ` · ${esc(feedbackData.rating)}/5` : ''}:</strong> ${esc(feedbackData.message || '')}</p>` : '';
    const note = row.visit_summary ? `<p><strong>Visit summary:</strong> ${esc(row.visit_summary)}</p>` : '';
    return `<article class="data-card"><div class="data-card-main"><div><span class="eyebrow">${esc(row.visit_type || 'Appointment')}</span><h3>${options.patient ? esc(row.doctor_name || 'Dr. Bharati Pujari') : esc(profileName(patient))}</h3><p>${esc(formatDate(row.appointment_date))} · ${esc(formatTime(row.appointment_time))}</p>${idLabel}</div>${patientLabel}<div><p>${esc(row.comment || 'No additional notes')}</p></div><div>${statusBadge(row.status)}</div>${buttons}</div>${note}${feedback}</article>`;
  }

  async function initLanding() {
    $('#year').textContent = new Date().getFullYear();
    if (!client) { message($('#auth-message'), 'Set up your Supabase project to enable sign in.'); }
    const { data: { session } = {} } = client ? await client.auth.getSession() : { data: {} };
    if (session) {
      const { data: p } = await client.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
      if (p?.role && ROLE_PAGE[p.role]) location.replace(`/${ROLE_PAGE[p.role]}.html`);
    }
    let mode = 'login';
    const role = $('#role'), signup = $('#signup-fields'), form = $('#auth-form'), email = $('#email'), password = $('#password');
    const credentials = $('#credentials-fields'), verification = $('#verification-fields');
    let verificationEmail = '';
    let resendInterval = null;
    const startResendCooldown = () => {
      const button = $('#resend-otp');
      if (resendInterval) clearInterval(resendInterval);
      let seconds = 60;
      button.disabled = true;
      button.textContent = `Resend code in ${seconds}s`;
      resendInterval = setInterval(() => {
        seconds -= 1;
        if (seconds <= 0) {
          clearInterval(resendInterval); resendInterval = null;
          button.disabled = false; button.textContent = 'Resend code';
          return;
        }
        button.textContent = `Resend code in ${seconds}s`;
      }, 1000);
    };
    const setMode = next => {
      mode = next;
      verificationEmail = '';
      if (resendInterval) { clearInterval(resendInterval); resendInterval = null; }
      $('#resend-otp').disabled = false; $('#resend-otp').textContent = 'Resend code';
      credentials.classList.remove('hidden'); verification.classList.add('hidden');
      $('#signup-otp').value = '';
      $$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.authTab === mode));
      signup.classList.toggle('hidden', mode !== 'signup');
      role.disabled = mode === 'signup'; if (mode === 'signup') role.value = 'patient';
      password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      $('#auth-submit').innerHTML = mode === 'signup' ? 'Create your account <span>↗</span>' : 'Sign in <span>↗</span>';
      message($('#auth-message'), '');
      message($('#auth-message-otp'), '');
    };
    $$('.auth-tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.authTab)));
    $('#forgot-password').addEventListener('click', async () => {
      const emailValue = email.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) return message($('#auth-message'), 'Enter the doctor’s account email first.');
      const button = $('#forgot-password'); button.disabled = true;
      message($('#auth-message'), 'Sending a password reset link…');
      try {
        const { error } = await client.auth.resetPasswordForEmail(emailValue, { redirectTo: `${location.origin}/reset-password.html` });
        if (error) throw error;
        message($('#auth-message'), 'If an account exists for this email, a reset link has been sent. Check the inbox and spam folder.', true);
      } catch (error) { message($('#auth-message'), errorText(error)); }
      finally { button.disabled = false; }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!client) return message($('#auth-message'), 'Add your Supabase URL and anon key in .env, then run npm run build.');
      if (verificationEmail) {
        const verifyButton = $('#verify-otp');
        const token = $('#signup-otp').value.trim();
        if (!/^\d{6}$/.test(token)) return message($('#auth-message-otp'), 'Enter the 6-digit code from your email.');
        verifyButton.disabled = true; message($('#auth-message-otp'), 'Verifying your email…');
        try {
          const { data, error } = await client.auth.verifyOtp({ email: verificationEmail, token, type: 'signup' });
          if (error) throw error;
          if (!data.session) throw new Error('Email verification did not create a session. Please sign in.');
          message($('#auth-message-otp'), 'Email verified. Opening your patient portal…', true);
          setTimeout(() => location.replace('/patient.html'), 600);
        } catch (error) { message($('#auth-message-otp'), errorText(error)); }
        finally { verifyButton.disabled = false; }
        return;
      }
      const emailValue = email.value.trim().toLowerCase(), passwordValue = password.value;
      const submit = $('#auth-submit'); submit.disabled = true; message($('#auth-message'), '');
      try {
        let data;
        if (!logic.isValidEmail(emailValue)) throw new Error('Enter a valid email address, such as name@example.com.');
        if (mode === 'signup') {
          const name = $('#full-name').value.trim(), phone = $('#phone').value.trim();
          const height = $('#signup-height').value, weight = $('#signup-weight').value;
          if (!isValidName(name)) throw new Error('Please enter a valid name using letters, spaces, apostrophes, periods or hyphens.');
          if (!logic.isValidPhone(phone)) throw new Error('Please enter a valid phone number, or leave it blank.');
          if (!logic.isValidHeight(height)) throw new Error('Height must be between 30 and 250 cm.');
          if (!logic.isValidWeight(weight)) throw new Error('Weight must be between 1 and 500 kg.');
          if (passwordValue.length < 8) throw new Error('Password must be at least 8 characters.');
          const result = await client.auth.signUp({ email: emailValue, password: passwordValue, options: { data: { full_name: name, phone: phone || null, height_cm: height ? Number(height) : null, weight_kg: weight ? Number(weight) : null } } });
          data = result.data; if (result.error) throw result.error;
          if (data.session) {
            await client.auth.signOut();
            throw new Error('Email OTP verification is disabled for this Supabase project. Turn on Email → Confirm email in Supabase Auth settings, then try again.');
          }
          verificationEmail = emailValue;
          $('#verification-email').textContent = emailValue;
          credentials.classList.add('hidden'); verification.classList.remove('hidden');
          password.value = '';
          message($('#auth-message-otp'), 'If this address can receive a new sign-up code, it should arrive shortly. Check your inbox and spam folder.', true);
          startResendCooldown();
          $('#signup-otp').focus(); return;
        }
        const result = await client.auth.signInWithPassword({ email: emailValue, password: passwordValue });
        data = result.data; if (result.error) throw result.error;
        const { data: profile, error: pErr } = await client.from('profiles').select('role, is_active').eq('id', data.user.id).single();
        if (pErr) throw pErr;
        if (!profile.is_active) { await client.auth.signOut(); throw new Error('This account is disabled. Contact the clinic administrator.'); }
        const target = ROLE_PAGE[profile.role]; if (!target) throw new Error('Your account has no portal role. Contact the clinic administrator.');
        if (role.value !== profile.role) {
          const hint = profile.role === 'patient' && role.value === 'doctor' ? ' Doctor accounts must be created by an administrator in Care team.' : '';
          throw new Error(`This account is registered for the ${profile.role} portal. Select “${profile.role}” to continue.${hint}`);
        }
        location.replace(`/${target}.html`);
      } catch (err) { message($('#auth-message'), mode === 'signup' ? emailDeliveryErrorText(err) : errorText(err)); }
      finally { submit.disabled = false; }
    });
    $('#resend-otp').addEventListener('click', async () => {
      if (!verificationEmail) return;
      const button = $('#resend-otp'); button.disabled = true;
      message($('#auth-message-otp'), 'Sending a new code…');
      try {
        const { error } = await client.auth.resend({ type: 'signup', email: verificationEmail });
        if (error) throw error;
        message($('#auth-message-otp'), 'If this address can receive a new sign-up code, it should arrive shortly. Check your inbox and spam folder.', true);
        startResendCooldown();
      } catch (error) { message($('#auth-message-otp'), emailDeliveryErrorText(error)); button.disabled = false; }
    });
    $('#cancel-verification').addEventListener('click', () => {
      verificationEmail = '';
      if (resendInterval) { clearInterval(resendInterval); resendInterval = null; }
      $('#resend-otp').disabled = false; $('#resend-otp').textContent = 'Resend code';
      verification.classList.add('hidden'); credentials.classList.remove('hidden');
      email.focus(); message($('#auth-message-otp'), '');
    });
    role.addEventListener('change', () => { if (role.value !== 'patient' && mode === 'signup') setMode('login'); });
  }

  async function initPortal() {
    if (!client) { document.body.innerHTML = '<main class="app-main"><div class="empty-state">Supabase is not configured. Add your project URL and anon key in .env and run npm run build.</div></main>'; return; }
    let auth;
    try { auth = await getSessionProfile(); } catch (error) { toast(errorText(error), true); setTimeout(() => location.replace('/'), 1200); return; }
    if (!auth) return location.replace('/');
    if (auth.profile.role !== PAGE || !auth.profile.is_active) return location.replace(ROLE_PAGE[auth.profile.role] ? `/${ROLE_PAGE[auth.profile.role]}.html` : '/');
    $('#current-user').textContent = auth.profile.full_name || auth.session.user.email;
    if (PAGE === 'patient') { $('#patient-name').textContent = auth.profile.full_name || 'there'; setTabs(); bindPatient(); await Promise.all([loadPatientAppointments(), loadHealth(), loadPrescriptions('patient')]); }
    if (PAGE === 'doctor') { $('#doctor-name').textContent = auth.profile.full_name || 'Doctor'; setTabs(); bindDoctor(auth.session.user.id); await loadDoctorAppointments(); }
    if (PAGE === 'admin') { setTabs(); bindAdmin(); await loadAdminOverview(); }
  }

  async function initPasswordRecovery() {
    const form = $('#password-recovery-form');
    const status = $('#password-recovery-message');
    if (!client) return message(status, 'Password reset is unavailable until Supabase is configured.');
    const { data: { session } = {}, error } = await client.auth.getSession();
    if (error) return message(status, errorText(error));
    if (!session) return message(status, 'This reset link is invalid or expired. Request a new password reset email.');
    form.hidden = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const password = form.elements.password.value;
      const confirm = form.elements.confirm_password.value;
      if (password.length < 12) return message(status, 'Use at least 12 characters for the new password.');
      if (password !== confirm) return message(status, 'The passwords do not match.');
      const submit = $('#password-recovery-submit'); submit.disabled = true;
      message(status, 'Updating password…');
      try {
        const { error: updateError } = await client.auth.updateUser({ password });
        if (updateError) throw updateError;
        await client.auth.signOut();
        form.hidden = true;
        status.innerHTML = 'Password updated. <a href="/">Return to sign in</a>.';
        status.classList.add('success');
      } catch (updateError) { message(status, errorText(updateError)); }
      finally { submit.disabled = false; }
    });
  }

  async function loadPatientAppointments() {
    const { data, error } = await client.from('appointments').select('*, doctor:profiles!appointments_doctor_id_fkey(full_name), feedback(rating,message)').order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true });
    if (error) { showEmpty('#patient-appointments', errorText(error)); return; }
    const future = (data || []).filter(a => a.appointment_date >= localDate() && !['cancelled', 'completed'].includes(a.status));
    $('#upcoming-count').textContent = future.length;
    $('#patient-upcoming').innerHTML = future.length ? future.slice(0, 3).map(a => appointmentCard({ ...a, doctor_name: a.doctor?.full_name }, { patient: true })).join('') : '<div class="empty-state">No upcoming visits. You can request an appointment below.</div>';
    $('#patient-appointments').innerHTML = data?.length ? data.map(a => appointmentCard({ ...a, doctor_name: a.doctor?.full_name }, { patient: true })).join('') : '<div class="empty-state">No appointments yet. Send a request below to get started.</div>';
    bindAppointmentActions();
  }
  async function loadHealth() {
    const { data, error } = await client.from('health_profiles').select('*').maybeSingle(); if (error) return message($('#health-message'), errorText(error));
    const form = $('#health-form'); if (!form || !data) return;
    form.elements.height_cm.value = data.height_cm ?? ''; form.elements.weight_kg.value = data.weight_kg ?? ''; form.elements.medical_history.value = data.medical_history || '';
  }
  async function loadPrescriptions(view) {
    const target = view === 'patient' ? '#patient-prescriptions' : '#doctor-prescriptions'; if (!$(target)) return;
    const { data, error } = await client.from('prescriptions').select('*, patient:profiles!prescriptions_patient_id_fkey(full_name,email), doctor:profiles!prescriptions_doctor_id_fkey(full_name)').order('created_at', { ascending: false });
    if (error) return showEmpty(target, errorText(error));
    $(target).innerHTML = data?.length ? data.map(p => `<article class="data-card"><div class="data-card-main"><div><span class="eyebrow">PRESCRIPTION · ${esc(formatDate(p.created_at.slice(0, 10)))}</span><h3>${view === 'patient' ? `From ${esc(p.doctor?.full_name || 'your doctor')}` : esc(p.patient?.full_name || p.patient?.email || 'Patient')}</h3></div><div><p>${esc(p.medication)}</p><p>${esc(p.instructions || '')}</p></div><div><p>Appointment: ${esc(p.appointment_id || '—')}</p></div></div></article>`).join('') : '<div class="empty-state">Prescriptions shared by your care team will appear here.</div>';
  }
  function bindPatient() {
    const requestForm = $('#appointment-request-form');
    const requestDate = $('#request-date');
    requestDate.min = localDate();
    requestDate.addEventListener('change', loadAvailableSlots);
    requestForm.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = $('#appointment-request-submit');
      const date = form.elements.appointment_date.value;
      const time = form.elements.appointment_time.value;
      const visitType = form.elements.visit_type.value;
      if (!date || !time || !visitType) return message($('#appointment-request-message'), 'Choose a date, an available time, and a visit type.');
      submit.disabled = true;
      message($('#appointment-request-message'), 'Sending your request…');
      try {
        const phone = form.elements.contact_phone.value.trim();
        if (!logic.isValidPhone(phone) || !phone) throw new Error('Enter a valid phone number for the clinic to confirm your request.');
        const note = form.elements.comment.value.trim();
        const { error } = await client.rpc('book_appointment', {
          p_date: date, p_time: time, p_visit_type: visitType,
          p_comment: [`Call back: ${phone}`, note].filter(Boolean).join('\n\n'),
        });
        if (error) throw error;
        message($('#appointment-request-message'), 'Request sent. The clinic will contact you to confirm the appointment.', true);
        toast('Appointment request sent.');
        form.reset();
        requestDate.min = localDate();
        $('#request-time').innerHTML = '<option value="">Choose a date first</option>';
        $('#request-time').disabled = true;
        await loadPatientAppointments();
      } catch (error) {
        message($('#appointment-request-message'), errorText(error));
        await loadAvailableSlots();
      } finally { submit.disabled = false; }
    });
    $('#health-form').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.currentTarget;
      const height = f.elements.height_cm.value, weight = f.elements.weight_kg.value;
      if (!logic.isValidHeight(height)) return message($('#health-message'), 'Height must be between 30 and 250 cm.');
      if (!logic.isValidWeight(weight)) return message($('#health-message'), 'Weight must be between 1 and 500 kg.');
      const payload = { height_cm: height ? +height : null, weight_kg: weight ? +weight : null, medical_history: f.elements.medical_history.value.trim() || null };
      const { error } = await client.from('health_profiles').upsert(payload, { onConflict: 'patient_id' });
      message($('#health-message'), error ? errorText(error) : 'Health profile saved.', !error); if (!error) toast('Health profile saved.');
    });
  }
  async function loadAvailableSlots() {
    const form = $('#appointment-request-form');
    const date = form?.elements.appointment_date.value;
    const select = $('#request-time');
    if (!date || !select) return;
    select.disabled = true;
    select.innerHTML = '<option value="">Checking times…</option>';
    const { data, error } = await client.rpc('available_appointment_slots', { p_date: date });
    if (error) {
      select.innerHTML = '<option value="">Could not load times</option>';
      return message($('#appointment-request-message'), errorText(error));
    }
    const slots = (data || []).filter(slot => Number(slot.remaining) > 0);
    select.innerHTML = slots.length
      ? '<option value="">Choose a time</option>' + slots.map(slot => `<option value="${esc(slot.slot_time.slice(0, 5))}">${esc(formatTime(slot.slot_time))}</option>`).join('')
      : '<option value="">No times available on this date</option>';
    select.disabled = !slots.length;
    message($('#appointment-request-message'), slots.length ? '' : 'No online request times are available for this date. Please choose another date or call the clinic.');
  }
  function bindAppointmentActions() {
    $$('[data-feedback]').forEach(button => button.addEventListener('click', () => {
      const form = $('#feedback-form'); form.elements.appointment_id.value = button.dataset.feedback; form.reset(); form.elements.appointment_id.value = button.dataset.feedback; $('#feedback-dialog').showModal();
    }));
    if ($('#feedback-close-bound')) return;
    $$('[data-feedback-close]').forEach(button => button.addEventListener('click', () => $('#feedback-dialog').close()));
    $('#feedback-form').addEventListener('submit', async event => {
      event.preventDefault(); const f = event.currentTarget;
      const { error } = await client.from('feedback').insert({ appointment_id: f.elements.appointment_id.value, rating: Number(f.elements.rating.value), message: f.elements.message.value.trim() || null });
      if (error) return message($('#feedback-status'), errorText(error));
      $('#feedback-dialog').close(); toast('Thank you for your feedback.'); await loadPatientAppointments();
    });
    const marker = document.createElement('i'); marker.id = 'feedback-close-bound'; marker.hidden = true; document.body.append(marker);
  }

  async function loadDoctorAppointments() {
    const date = $('#doctor-date'); if (!date.value) date.value = localDate();
    const { data, error } = await client.from('appointments').select('*, patient:profiles!appointments_patient_id_fkey(full_name,email,phone), feedback(message)').eq('appointment_date', date.value).order('appointment_time');
    if (error) return showEmpty('#doctor-appointments', errorText(error));
    const rows = data || []; $('#doctor-today-count').textContent = rows.length; $('#doctor-pending-count').textContent = rows.filter(x => x.status === 'pending').length; $('#doctor-confirmed-count').textContent = rows.filter(x => x.status === 'confirmed').length;
    $('#doctor-appointments').innerHTML = rows.length ? rows.map(a => appointmentCard(a, { doctor: true })).join('') : '<div class="empty-state">No appointments for this date.</div>';
    bindDoctorActions();
  }
  function bindDoctor(doctorId) {
    $('#doctor-date').addEventListener('change', loadDoctorAppointments);
    $('#patient-search').addEventListener('input', event => filterCards('#doctor-patients', event.target.value));
    client.channel('doctor-appointment-notifications').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${doctorId}` }, payload => {
      toast(`New appointment request for ${formatDate(payload.new.appointment_date)}.`);
      if (payload.new.appointment_date === $('#doctor-date').value) loadDoctorAppointments();
    }).subscribe();
  }
  function filterCards(target, term) { const query = term.trim().toLowerCase(); $$('.data-card', $(target)).forEach(card => card.classList.toggle('hidden', !card.textContent.toLowerCase().includes(query))); }
  async function loadDoctorPatients() {
    const { data, error } = await client.from('profiles').select('id,full_name,email,phone,created_at,health_profiles(height_cm,weight_kg,medical_history)').eq('role', 'patient').order('full_name');
    if (error) return showEmpty('#doctor-patients', errorText(error));
    $('#doctor-patients').innerHTML = data?.length ? data.map(p => { const h = Array.isArray(p.health_profiles) ? p.health_profiles[0] : p.health_profiles; return `<article class="data-card"><div class="data-card-main"><div><span class="eyebrow">PATIENT · ${esc(p.id.slice(0, 8))}</span><h3>${esc(p.full_name || 'Patient')}</h3><p>${esc(p.email || '')} · ${esc(p.phone || 'No phone')}</p></div><div><p>Height: ${h?.height_cm ? `${esc(h.height_cm)} cm` : '—'}</p><p>Weight: ${h?.weight_kg ? `${esc(h.weight_kg)} kg` : '—'}</p></div><div><p><strong>Medical history</strong></p><p>${esc(h?.medical_history || 'No history added')}</p></div><div><span class="badge">Patient</span></div></div></article>`; }).join('') : '<div class="empty-state">Patient profiles will appear here.</div>';
  }
  function bindDoctorActions() {
    $$('[data-confirm]').forEach(b => b.addEventListener('click', async () => updateAppointment(b.dataset.confirm, 'confirmed')));
    $$('[data-complete]').forEach(b => b.addEventListener('click', async () => openAppointmentDialog(b.dataset.complete)));
    $$('[data-open-visit]').forEach(b => b.addEventListener('click', () => openAppointmentDialog(b.dataset.openVisit)));
  }
  async function updateAppointment(id, status) {
    const { error } = await client.from('appointments').update({ status }).eq('id', id);
    if (error) toast(errorText(error), true); else { toast(`Appointment ${status}.`); await loadDoctorAppointments(); }
  }
  async function openAppointmentDialog(id) {
    const { data: a, error } = await client.from('appointments').select('*, patient:profiles!appointments_patient_id_fkey(full_name,email,phone)').eq('id', id).single();
    if (error) return toast(errorText(error), true);
    const { data: hp } = await client.from('health_profiles').select('height_cm,weight_kg,medical_history').eq('patient_id', a.patient_id).maybeSingle();
    $('#appointment-detail').innerHTML = `<div class="detail-grid"><div><strong>Patient</strong>${esc(profileName(a.patient))}</div><div><strong>Patient ID</strong>${esc(a.patient_id)}</div><div><strong>Email / phone</strong>${esc(a.patient?.email || '')} · ${esc(a.patient?.phone || '—')}</div><div><strong>Visit</strong>${esc(formatDate(a.appointment_date))} · ${esc(formatTime(a.appointment_time))}</div><div><strong>Height / weight</strong>${hp?.height_cm ? `${esc(hp.height_cm)} cm` : '—'} · ${hp?.weight_kg ? `${esc(hp.weight_kg)} kg` : '—'}</div><div class="span-two"><strong>Medical history</strong>${esc(hp?.medical_history || 'None provided')}</div><div class="span-two"><strong>Concern</strong>${esc(a.visit_type)} — ${esc(a.comment || 'No additional notes')}</div></div>`;
    const form = $('#appointment-update-form'); form.dataset.id = a.id; form.elements.summary.value = a.visit_summary || ''; form.elements.prescription.value = '';
    const { data: oldRx } = await client.from('prescriptions').select('medication,instructions').eq('appointment_id', id).maybeSingle();
    if (oldRx) { form.elements.prescription.value = [oldRx.medication, oldRx.instructions].filter(Boolean).join('\n'); }
    $('#appointment-dialog').showModal();
  }
  function bindDoctorForm() {
    $('[data-dialog-close]').addEventListener('click', () => $('#appointment-dialog').close());
    $('#appointment-update-form').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.currentTarget, id = f.dataset.id;
      const { error } = await client.from('appointments').update({ visit_summary: f.elements.summary.value.trim() || null, status: 'completed' }).eq('id', id);
      if (error) return message($('#appointment-action-message'), errorText(error));
      const rxText = f.elements.prescription.value.trim();
      if (rxText) {
        const lines = rxText.split('\n'), medication = lines.shift().trim(), instructions = lines.join('\n').trim() || null;
        const { data: appointment } = await client.from('appointments').select('patient_id,doctor_id').eq('id', id).single();
        const { error: rxError } = await client.from('prescriptions').upsert({ appointment_id: id, patient_id: appointment.patient_id, doctor_id: appointment.doctor_id, medication, instructions }, { onConflict: 'appointment_id' });
        if (rxError) return message($('#appointment-action-message'), errorText(rxError));
      }
      message($('#appointment-action-message'), 'Visit notes saved.', true); toast('Visit notes saved.'); await loadDoctorAppointments();
    });
  }

  async function loadAdminOverview() {
    const results = await Promise.all([
      client.from('appointments').select('id,status,appointment_date,appointment_time,visit_type,patient_id,comment,profiles!appointments_patient_id_fkey(full_name,email,phone)').order('created_at', { ascending: false }).limit(8),
      client.from('appointments').select('id,status', { count: 'exact', head: true }),
      client.from('appointments').select('id,status', { count: 'exact', head: true }).eq('status', 'pending'),
      client.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'patient'),
      client.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'doctor').eq('is_active', true)
    ]);
    const [recent, total, pending, patients, doctors] = results;
    $('#admin-total').textContent = total.count ?? '—'; $('#admin-pending').textContent = pending.count ?? '—'; $('#admin-patients-count').textContent = patients.count ?? '—'; $('#admin-doctors-count').textContent = doctors.count ?? '—';
    $('#admin-recent').innerHTML = recent.data?.length ? recent.data.map(a => appointmentCard({ ...a, patient: a.profiles }, { admin: true })).join('') : `<div class="empty-state">${esc(recent.error?.message || 'No appointments yet.')}</div>`;
    bindAdminAppointmentActions();
  }
  async function loadAdminAppointments() {
    let query = client.from('appointments').select('*, patient:profiles!appointments_patient_id_fkey(full_name,email,phone), doctor:profiles!appointments_doctor_id_fkey(full_name), feedback(message)').order('appointment_date', { ascending: false }).order('appointment_time');
    const status = $('#admin-status-filter').value, date = $('#admin-date-filter').value;
    if (status !== 'all') query = query.eq('status', status); if (date) query = query.eq('appointment_date', date);
    const { data, error } = await query; if (error) return showEmpty('#admin-appointments', errorText(error));
    $('#admin-appointments').innerHTML = data?.length ? data.map(a => appointmentCard({ ...a, patient: a.patient }, { admin: true })).join('') : '<div class="empty-state">No appointments match these filters.</div>';
    bindAdminAppointmentActions();
  }
  async function loadAdminPatients() {
    const { data, error } = await client.from('profiles').select('id,full_name,email,phone,created_at,health_profiles(height_cm,weight_kg,medical_history)').eq('role', 'patient').order('created_at', { ascending: false });
    if (error) return showEmpty('#admin-patients', errorText(error));
    $('#admin-patients').innerHTML = data?.length ? data.map(p => { const h = Array.isArray(p.health_profiles) ? p.health_profiles[0] : p.health_profiles; return `<article class="data-card"><div class="data-card-main"><div><span class="eyebrow">PATIENT ID · ${esc(p.id)}</span><h3>${esc(p.full_name || 'Patient')}</h3><p>${esc(p.email || '')} · ${esc(p.phone || 'No phone')}</p></div><div><p>Height: ${h?.height_cm ? `${esc(h.height_cm)} cm` : '—'}</p><p>Weight: ${h?.weight_kg ? `${esc(h.weight_kg)} kg` : '—'}</p></div><div><p>${esc(h?.medical_history || 'No history added')}</p></div><div><span class="badge">Patient</span></div></div></article>`; }).join('') : '<div class="empty-state">No patient accounts found.</div>';
  }
  async function loadAdminPrescriptions() {
    const { data, error } = await client.from('prescriptions').select('*, patient:profiles!prescriptions_patient_id_fkey(full_name,email), doctor:profiles!prescriptions_doctor_id_fkey(full_name)').order('created_at', { ascending: false });
    if (error) return showEmpty('#admin-prescriptions', errorText(error));
    $('#admin-prescriptions').innerHTML = data?.length ? data.map(p => `<article class="data-card"><div class="data-card-main"><div><span class="eyebrow">${esc(formatDate(p.created_at.slice(0, 10)))}</span><h3>${esc(p.patient?.full_name || p.patient?.email || 'Patient')}</h3><p>Patient ID: ${esc(p.patient_id)}</p></div><div><p>${esc(p.medication)}</p><p>${esc(p.instructions || '')}</p></div><div><p>Prescribed by ${esc(p.doctor?.full_name || 'Doctor')}</p></div><div><span class="badge">${esc(p.appointment_id.slice(0, 8))}</span></div></div></article>`).join('') : '<div class="empty-state">Prescriptions shared by the care team will appear here.</div>';
  }
  async function loadAdminTeam() {
    const { data, error } = await client.from('profiles').select('id,full_name,email,is_active,staff_details(qualification,specialty)').eq('role', 'doctor').order('full_name');
    if (error) return showEmpty('#admin-team', errorText(error));
    $('#admin-team').innerHTML = data?.length ? data.map(d => `<article class="data-card"><div class="data-card-main"><div><span class="eyebrow">DOCTOR · ${esc(d.id.slice(0, 8))}</span><h3>${esc(d.full_name || 'Doctor')}</h3><p>${esc(d.email || '')}</p></div><div><p>${esc(d.staff_details?.[0]?.qualification || '—')}</p><p>${esc(d.staff_details?.[0]?.specialty || 'Obstetrics & Gynecology')}</p></div><div>${d.is_active ? '<span class="badge confirmed">Active</span>' : '<span class="badge cancelled">Inactive</span>'}</div><div class="data-actions"><button class="small-button" data-staff-reset="${esc(d.id)}" data-staff-name="${esc(d.full_name || 'Doctor')}">Reset password</button><button class="small-button ${d.is_active ? 'danger' : ''}" data-staff-toggle="${esc(d.id)}" data-active="${d.is_active}">${d.is_active ? 'Deactivate' : 'Reactivate'}</button></div></div></article>`).join('') : '<div class="empty-state">No doctors yet. Add your first doctor account.</div>';
    $$('[data-staff-reset]').forEach(button => button.addEventListener('click', () => {
      const form = $('#staff-password-form'); form.reset(); form.dataset.userId = button.dataset.staffReset;
      $('#staff-password-doctor').textContent = `Set a new login password for ${button.dataset.staffName}.`;
      message($('#staff-password-message'), ''); $('#staff-password-dialog').showModal();
    }));
    $$('[data-staff-toggle]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; const active = b.dataset.active === 'true';
      try {
        const { error: updateError } = await client.functions.invoke('manage-doctor', { body: { action: active ? 'deactivate' : 'reactivate', userId: b.dataset.staffToggle } });
        if (updateError) toast(await functionErrorText(updateError, 'manage-doctor'), true); else { toast(active ? 'Doctor deactivated.' : 'Doctor reactivated.'); await loadAdminTeam(); }
      } catch (error) { toast(await functionErrorText(error, 'manage-doctor'), true); }
      finally { b.disabled = false; }
    }));
  }
  function bindAdmin() {
    $('#admin-date-filter').addEventListener('change', loadAdminAppointments); $('#admin-status-filter').addEventListener('change', loadAdminAppointments);
    $('#admin-patient-search').addEventListener('input', e => filterCards('#admin-patients', e.target.value));
    $('[data-open-staff]').addEventListener('click', () => $('#staff-card').classList.remove('hidden')); $('[data-close-staff]').addEventListener('click', () => $('#staff-card').classList.add('hidden'));
    $$('[data-password-dialog-close]').forEach(button => button.addEventListener('click', () => $('#staff-password-dialog').close()));
    $('#staff-password-form').addEventListener('submit', async e => {
      e.preventDefault(); const form = e.currentTarget, password = form.elements.password.value;
      if (password.length < 12) return message($('#staff-password-message'), 'Use at least 12 characters for the new password.');
      if (password !== form.elements.confirm_password.value) return message($('#staff-password-message'), 'The passwords do not match.');
      const submit = form.querySelector('button[type="submit"]'); submit.disabled = true;
      try {
        const { error } = await client.functions.invoke('manage-doctor', { body: { action: 'reset-password', userId: form.dataset.userId, password } });
        if (error) return message($('#staff-password-message'), await functionErrorText(error, 'manage-doctor'));
        $('#staff-password-dialog').close(); form.reset(); toast('Doctor password updated. Share the new password securely.');
      } catch (error) { message($('#staff-password-message'), await functionErrorText(error, 'manage-doctor')); }
      finally { submit.disabled = false; }
    });
    $('#staff-form').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.currentTarget, payload = Object.fromEntries(new FormData(f));
      if (!isValidName(payload.name)) return message($('#staff-message'), 'Please enter a valid name.');
      if (payload.password.length < 12) return message($('#staff-message'), 'Temporary password must be at least 12 characters.');
      const submit = f.querySelector('button[type="submit"]'); submit.disabled = true;
      try {
        const { error } = await client.functions.invoke('manage-doctor', { body: { action: 'create', ...payload } });
        if (error) return message($('#staff-message'), await functionErrorText(error, 'manage-doctor'));
        message($('#staff-message'), 'Doctor account created.', true); toast('Doctor account created.'); f.reset(); await loadAdminTeam();
      } catch (error) { message($('#staff-message'), await functionErrorText(error, 'manage-doctor')); }
      finally { submit.disabled = false; }
    });
  }
  function bindAdminAppointmentActions() { $$('[data-admin-status]').forEach(b => b.addEventListener('click', () => updateAdminAppointment(b.dataset.adminStatus, b.dataset.status))); }
  async function updateAdminAppointment(id, status) {
    const { error } = await client.from('appointments').update({ status }).eq('id', id);
    if (error) toast(errorText(error), true); else { toast(`Appointment ${status}.`); await loadAdminAppointments(); await loadAdminOverview(); }
  }

  if (PAGE === 'landing') initLanding();
  else if (PAGE === 'reset-password') initPasswordRecovery();
  else initPortal().then(() => { if (PAGE === 'doctor') bindDoctorForm(); }).catch(error => toast(errorText(error), true));
})();
