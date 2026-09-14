(function (root, factory) {
if (typeof module === 'object' && module.exports) module.exports = factory();
else root.DpoTgCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var START_PARAM_MAX = 512;
var START_PARAM_SHAPE = /^[A-Za-z0-9_-]+$/;
var PROGRAM_PART = /^p_([A-Za-z0-9_]{1,40})$/;
var CAMPAIGN_PART = /^c_([A-Za-z0-9_]{1,64})$/;
var PHONE_ALLOWED = /^[0-9+()\-\s.]+$/;
var EMAIL_SHAPE = /^[^\s@,;?#%\/\\<>"&=:]+@[^\s@,;?#%\/\\<>"&=:]+\.[^\s@,;?#%\/\\<>"&=:]{2,}$/;
var LIMITS = { firstName: 80, lastName: 80, phone: 40, email: 160, position: 120, company: 160 };
var NBSP = String.fromCharCode(160);
function parseStartParam(raw, knownIds) {
var out = { programId: null, campaign: null };
if (typeof raw !== 'string' || !raw || raw.length > START_PARAM_MAX || !START_PARAM_SHAPE.test(raw)) return out;
raw.split('-').forEach(function (part) {
var m = PROGRAM_PART.exec(part);
if (m && out.programId === null && knownIds.indexOf(m[1]) !== -1) {
out.programId = m[1];
return;
}
m = CAMPAIGN_PART.exec(part);
if (m && out.campaign === null) out.campaign = m[1];
});
return out;
}
function str(value, max) {
if (value == null) return '';
var s = String(value).replace(/\s+/g, ' ').trim();
return s.length > max ? s.slice(0, max) : s;
}
function validateApplication(form) {
var f = form || {};
var errors = [];
var values = {};
function add(field, message) {
errors.push({ field: field, message: message });
}
Object.keys(LIMITS).forEach(function (k) {
values[k] = str(f[k], LIMITS[k]);
});
if (!values.firstName) add('firstName', 'Укажите имя.');
if (!values.lastName) add('lastName', 'Укажите фамилию.');
if (!values.phone) {
add('phone', 'Укажите телефон.');
} else if (!PHONE_ALLOWED.test(values.phone)) {
add('phone', 'В телефоне допустимы только цифры, пробелы и знаки + ( ) -');
} else {
var digits = values.phone.replace(/\D/g, '').length;
if (digits < 10 || digits > 15) add('phone', 'Проверьте телефон: нужен номер с кодом страны или города.');
}
if (!values.email) add('email', 'Укажите электронную почту.');
else if (!EMAIL_SHAPE.test(values.email)) add('email', 'Проверьте адрес почты: похоже, в нём опечатка.');
if (f.consent !== true) add('consent', 'Без согласия на обработку персональных данных заявку принять нельзя.');
return errors.length ? { ok: false, errors: errors } : { ok: true, values: values };
}
function filterPrograms(programs, sphere, query) {
var q = String(query || '').trim().toLowerCase();
return programs.filter(function (p) {
if (sphere && sphere !== 'all' && p.sphere !== sphere) return false;
if (!q) return true;
return (String(p.title || '') + ' ' + String(p.tagline || '')).toLowerCase().indexOf(q) !== -1;
});
}
function formatPrice(n) {
if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '';
return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) + NBSP + '₽';
}
return {
START_PARAM_MAX: START_PARAM_MAX,
LIMITS: LIMITS,
parseStartParam: parseStartParam,
validateApplication: validateApplication,
filterPrograms: filterPrograms,
formatPrice: formatPrice,
};
});
