const test = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../src/assets/js/logic.js');

test('name validation accepts ordinary names and Unicode names', () => {
  for (const name of ['Bharti Sharma', 'Li', "O'Neil", 'Anne-Marie', 'डॉ. भारती', 'José Álvarez']) assert.equal(logic.isValidName(name), true, name);
});

test('name validation rejects missing, numeric, and malformed names', () => {
  for (const name of ['', '   ', '12345', 'Bharti123', 'A', 'A@B']) assert.equal(logic.isValidName(name), false, JSON.stringify(name));
  assert.equal(logic.isValidName(null), false);
});

test('email validation accepts normal addresses and rejects malformed input', () => {
  for (const email of ['patient@example.com', 'name+clinic@sub.example.in', ' patient@example.com ']) assert.equal(logic.isValidEmail(email), true, email);
  for (const email of ['', 'patient', 'patient@', '@example.com', 'patient@example', 'name with spaces@example.com']) assert.equal(logic.isValidEmail(email), false, email);
});

test('phone is optional but validates entered values', () => {
  for (const phone of ['', '   ', '+91 98765 43210', '9876543210', '(212) 555-0100']) assert.equal(logic.isValidPhone(phone), true, phone);
  for (const phone of ['12', 'abcdefghij', '123456789012345678901']) assert.equal(logic.isValidPhone(phone), false, phone);
});

test('health measurements accept optional blank or values within bounds', () => {
  assert.equal(logic.isValidHeight(''), true); assert.equal(logic.isValidHeight('30'), true); assert.equal(logic.isValidHeight('250'), true);
  assert.equal(logic.isValidHeight('29.9'), false); assert.equal(logic.isValidHeight('251'), false); assert.equal(logic.isValidHeight('abc'), false);
  assert.equal(logic.isValidWeight(''), true); assert.equal(logic.isValidWeight('1'), true); assert.equal(logic.isValidWeight('500'), true);
  assert.equal(logic.isValidWeight('0'), false); assert.equal(logic.isValidWeight('501'), false); assert.equal(logic.isValidWeight('abc'), false);
});

test('appointment slots match the weekday and Saturday booking schedule', () => {
  assert.deepEqual(logic.slots('2026-11-16'), ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']);
  assert.deepEqual(logic.slots('2026-11-21'), ['09:30','10:30','11:30','12:30']);
  assert.deepEqual(logic.slots('2026-11-22'), []);
  assert.deepEqual(logic.slots('invalid'), []);
});
