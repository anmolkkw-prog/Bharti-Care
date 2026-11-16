(() => {
  'use strict';
  const api = Object.freeze({
    isValidEmail: email => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    isValidName: name => typeof name === 'string' && /^[\p{L}][\p{L}\p{M} .'-]{0,98}[\p{L}\p{M}]$/u.test(name.trim()),
    isValidPhone: phone => typeof phone === 'string' && (!phone.trim() || /^\+?[0-9 ()-]{7,20}$/.test(phone.trim())),
    slots: value => {
      const date = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T12:00:00`) : (value || new Date());
      if (Number.isNaN(date.getTime())) return [];
      if (date.getDay() === 6) return ['09:30','10:30','11:30','12:30'];
      if (date.getDay() === 0) return [];
      return ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
    },
    isValidHeight: value => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 30 && Number(value) <= 250),
    isValidWeight: value => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 1 && Number(value) <= 500),
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ClinicLogic = api;
})();
