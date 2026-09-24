'use strict';

/**
 * Описание программы без микроразметки: у части страниц hse.ru нет ни
 * og:description, ни JSON-LD Course, а секция «О программе» занята пунктами
 * о формате обучения («Налоговый вычет 13%»). 24.09.2026 так на витрину
 * попало «Право и обществознание». Настоящее описание стоит под заголовком
 * программы, и его нужно брать раньше секции.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const { extract } = require(path.join(ROOT, 'scripts', 'fetch-program-descriptions.js'));
const FIXTURE = fs.readFileSync(path.join(ROOT, 'tests/fixtures/hse-program-page-no-ld.html'), 'utf8');

test('без микроразметки описание берётся из подзаголовка, а не из пунктов формата', () => {
  const { about } = extract(FIXTURE);
  assert.match(about, /^Программа станет важным шагом/);
  assert.doesNotMatch(about, /Налоговый вычет/);
});
