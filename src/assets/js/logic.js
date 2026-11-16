(() => {
  'use strict';
  const api = Object.freeze({
    isValidName: name => typeof name === 'string' && /^[\p{L}][\p{L}\p{M} .'-]{0,98}[\p{L}\p{M}]$/u.test(name.trim()),
    isValidPhone: phone => typeof phone === 'string' && (!phone.trim() || /^\+?[0-9 ()-]{7,20}$/.test(phone.trim())),
    slots: () => ['10:00','11:00','12:00','13:00','15:00','16:00','18:00','19:00','20:00','21:00'],
    isValidHeight: value => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 30 && Number(value) <= 250),
    isValidWeight: value => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 1 && Number(value) <= 500),
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ClinicLogic = api;
})();
