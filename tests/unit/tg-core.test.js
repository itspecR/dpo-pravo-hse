'use strict';

/**
 * Мини-апп Telegram: чистая логика (js/tg-core.js). Проверка заявки
 * сверяется не с выдуманными ожиданиями, а с серверным parseApplication
 * на тех же данных: во втором этапе заявка уйдёт на сервер, и расхождение
 * клиента с сервером означало бы «на телефоне приняли – на сервере отказ».
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const core = require(path.join(ROOT, 'js', 'tg-core.js'));
const { parseApplication } = require(path.join(ROOT, 'lib', 'application-form.js'));

const IDS = ['494685723', '961021723'];
const NONE = { programId: null, campaign: null };

test('startapp: программа, метка и оба вместе в любом порядке', () => {
  assert.deepEqual(core.parseStartParam('p_494685723', IDS), { programId: '494685723', campaign: null });
  assert.deepEqual(core.parseStartParam('c_yuriy2', IDS), { programId: null, campaign: 'yuriy2' });
  assert.deepEqual(core.parseStartParam('p_494685723-c_yuriy2', IDS), { programId: '494685723', campaign: 'yuriy2' });
  assert.deepEqual(core.parseStartParam('c_yuriy2-p_961021723', IDS), { programId: '961021723', campaign: 'yuriy2' });
});

test('startapp: мусор, чужие символы и неизвестный id молча игнорируются', () => {
  for (const raw of [undefined, null, '', 42, 'x', 'p_', 'c_', 'q_1', 'p_000', 'p_494685723 c_a', 'c_a b', 'c_имя', 'p_494685723%2F']) {
    assert.deepEqual(core.parseStartParam(raw, IDS), NONE, String(raw));
  }
  assert.deepEqual(core.parseStartParam('c_' + 'a'.repeat(65), IDS), NONE, 'метка длиннее 64');
  assert.deepEqual(core.parseStartParam('p_494685723-' + 'x'.repeat(600), IDS), NONE, 'длиннее 512');
  assert.deepEqual(core.parseStartParam('p_494685723-zz', IDS), { programId: '494685723', campaign: null }, 'неизвестная часть не мешает известной');
  assert.equal(core.START_PARAM_MAX, 512);
});

const CASES = [
  { firstName: 'Анна', lastName: 'Соколова', phone: '+7 916 555-12-34', email: 'a.sokolova@example.ru', consent: true },
  { firstName: '  ', lastName: '', phone: '', email: '', consent: false },
  { firstName: 'А', lastName: 'Б', phone: '8 (916) 555 12 34', email: 'a@b.c', consent: true },
  { firstName: 'А', lastName: 'Б', phone: '+7 916 abc', email: 'a@b.ru', consent: true },
  { firstName: 'А', lastName: 'Б', phone: '12345', email: 'a@b.ru', consent: true },
  { firstName: 'А', lastName: 'Б', phone: '+7 916 555-12-34', email: 'victim@example.org?bcc=x%40evil.example', consent: true },
  { firstName: 'А', lastName: 'Б', phone: '+7 916 555-12-34', email: 'a@b.ru', consent: false },
  { firstName: 'А'.repeat(200), lastName: '  Б   В ', phone: '+7 916 555-12-34', email: 'a@b.ru', consent: true, position: 'Юрист', company: 'ООО «Право»' },
];

test('проверка заявки совпадает с серверным parseApplication на тех же данных', () => {
  for (const c of CASES) {
    const client = core.validateApplication(c);
    const server = parseApplication(c, { now: 0 });
    assert.equal(client.ok, server.ok, JSON.stringify(c));
    if (!server.ok) {
      assert.deepEqual(client.errors, server.errors, JSON.stringify(c));
    } else {
      for (const k of ['firstName', 'lastName', 'phone', 'email', 'position', 'company']) {
        assert.equal(client.values[k], server.application[k], `${k} в ${JSON.stringify(c)}`);
      }
    }
  }
});

test('согласие – только настоящее true, не строка', () => {
  const base = { firstName: 'А', lastName: 'Б', phone: '+7 916 555-12-34', email: 'a@b.ru' };
  assert.equal(core.validateApplication({ ...base, consent: 'on' }).ok, false);
  assert.equal(core.validateApplication({ ...base, consent: true }).ok, true);
  assert.equal(core.validateApplication(null).ok, false);
});

test('витрина: фильтр по сфере и поиск без учёта регистра и пробелов по краям', () => {
  const ps = [
    { id: '1', title: 'Корпоративное право', tagline: 'Сделки', sphere: 'corporate' },
    { id: '2', title: 'Нейроправо', tagline: 'Мозг и суд', sphere: 'digital' },
  ];
  const ids = (list) => list.map((p) => p.id);
  assert.deepEqual(ids(core.filterPrograms(ps, 'all', '')), ['1', '2']);
  assert.deepEqual(ids(core.filterPrograms(ps, 'digital', '')), ['2']);
  assert.deepEqual(ids(core.filterPrograms(ps, 'all', '  СДЕЛКИ ')), ['1']);
  assert.deepEqual(ids(core.filterPrograms(ps, 'corporate', 'мозг')), []);
});

test('цена: разряды и знак рубля через неразрывные пробелы, пусто без цены', () => {
  const nb = String.fromCharCode(160);
  assert.equal(core.formatPrice(390000), '390' + nb + '000' + nb + '₽');
  assert.equal(core.formatPrice(45000), '45' + nb + '000' + nb + '₽');
  assert.equal(core.formatPrice(null), '');
  assert.equal(core.formatPrice(0), '');
  assert.equal(core.formatPrice('100'), '');
});
