'use strict';

/**
 * Мини-апп Telegram: генератор scripts/build-tg-app.js. Данные – на
 * настоящем каталоге проекта; экранирование и типографика – на
 * подложенных записях, где опасное содержимое задано явно.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const { FIELDS, buildData } = require(path.join(ROOT, 'scripts', 'build-tg-app.js'));
const { buildPayUrl } = require(path.join(ROOT, 'scripts', 'build-program-pages.js'));

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, '.catalog-data.json'), 'utf8'));
const NOW = new Date('2026-09-13T12:00:00+03:00');
const data = buildData(catalog, { now: NOW });
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

test('в данных все программы каталога и ровно поля экранов', () => {
  assert.equal(data.programs.length, catalog.programs.length);
  assert.ok(data.programs.length >= 27, 'каталог неожиданно пуст');
  for (const p of data.programs) assert.deepEqual(Object.keys(p).sort(), [...FIELDS].sort(), p.id);
  const leaked = JSON.stringify(data);
  for (const key of ['"teachers"', '"feedback"', '"faq"', '"files"', '"discounts"', '"source"', '"locked"']) {
    assert.equal(leaked.includes(key), false, `на страницу утекло поле ${key}`);
  }
  assert.ok(data.programs.filter((p) => p.cover).length > 20, 'обложки не нашлись на диске');
  assert.ok(data.programs.every((p) => p.cover === null || /^\.\.\/images\/programs\/[a-z0-9_.-]+$/i.test(p.cover)));
  assert.ok(data.programs.some((p) => p.thumb !== p.cover), 'миниатюры должны быть найдены, отличны от обложек');
  assert.ok(data.programs.every((p) => p.thumb === null || /^\.\.\/images\/programs\/(thumbs\/)?[a-z0-9_.-]+$/i.test(p.thumb)));
});

test('сферы: только непустые, счётчики сходятся с программами', () => {
  assert.ok(data.spheres.length >= 6);
  for (const s of data.spheres) {
    assert.ok(s.count > 0);
    assert.equal(s.count, data.programs.filter((p) => p.sphere === s.id).length, s.id);
  }
});

test('ссылка оплаты – та же формула, что на страницах программ', () => {
  for (const p of data.programs) {
    if (/^\d+$/.test(p.id)) assert.equal(p.pay, buildPayUrl(p.id), p.id);
    else assert.equal(p.pay, null, p.id);
  }
});

test('документ, цена и подпись старта считаются из каталога', () => {
  const p = data.programs.find((x) => x.id === '494685723');
  assert.equal(p.badge, 'ПП');
  assert.equal(p.doc, 'Диплом о профессиональной переподготовке НИУ ВШЭ');
  assert.equal(p.price, 390000);
  assert.equal(p.startLabel, 'Старт: 14 октября 2026 г.');
  const later = buildData(catalog, { now: new Date('2027-01-01T00:00:00+03:00') });
  assert.equal(later.programs.find((x) => x.id === '494685723').startLabel, null, 'прошедший старт не показывается');
});

test('длинное тире в текстах каталога становится коротким', () => {
  const d = buildData(
    { programs: [{ id: '1', title: 'А ' + EM + ' Б', tagline: EM, results: [EM], modules: [{ title: EM, hours: '' }], audience: { items: [EM] } }] },
    { now: NOW }
  );
  assert.equal(JSON.stringify(d).includes(EM), false);
  assert.equal(d.programs[0].title, 'А ' + EN + ' Б');
});
