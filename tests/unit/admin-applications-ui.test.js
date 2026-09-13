'use strict';

/**
 * Вкладка заявок должна уметь то, что собирает форма: фильтры, корпоративные
 * поля, кликабельные телефон и почту, бейдж новых и проверку SMTP.
 * Разметка собирается в admin.html – тест читает исходник, чтобы поля не
 * выпали при следующей правке панели.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'admin.html'), 'utf8');

test('на вкладке заявок есть бейдж новых и фильтры статуса/темы', () => {
  assert.match(src, /id="appBadge"/);
  assert.match(src, /data-app-status="new"/);
  assert.match(src, /data-app-topic="course-idea"/);
  assert.match(src, /data-app-topic="teaching"/);
});

test('карточка заявки показывает организацию и даёт tel/mailto', () => {
  assert.match(src, /applicantType === 'corporate'/);
  assert.match(src, /employeesCount/);
  assert.match(src, /timeframe/);
  assert.match(src, /telHref/);
  assert.match(src, /mailto:/);
  assert.match(src, /corp-mark/);
});

test('диагностика умеет предупреждение почты и пробное письмо', () => {
  assert.match(src, /id="mailTestBtn"/);
  assert.match(src, /\/api\/mail\/test/);
  assert.match(src, /c\.warn/);
  assert.match(src, /id="mailBanner"/);
});

// Ссылка mailto: строится из адреса заявителя. HTML-экранирование защищает
// атрибут, но не URI: «?bcc=» внутри адреса стало бы параметром почтового
// клиента (аудит 13.09.2026, находка 4). Функция mailtoHref вырезается из
// исходника и исполняется – проверяется результат, а не наличие строки.
const vm = require('node:vm');

function mailtoHrefFromSource() {
  const m = /const mailtoHref = \(email\) => \{[\s\S]*?\n  \};/.exec(src);
  assert.ok(m, 'в admin.html нет функции mailtoHref');
  return vm.runInNewContext(`${m[0]}; mailtoHref`, {});
}

test('mailto: кодирует разделители URI и не добавляет параметров почтового клиента', () => {
  const mailtoHref = mailtoHrefFromSource();
  const href = mailtoHref('victim@example.org?bcc=attacker%40evil.example&subject=x#y');
  assert.ok(href.startsWith('mailto:'));
  assert.doesNotMatch(href, /[?#&]/, 'в ссылке остались разделители параметров');
  assert.doesNotMatch(href, /%40evil/, 'процентная последовательность не перекодирована');
  assert.equal(href, 'mailto:victim@example.org%3Fbcc%3Dattacker%2540evil.example%26subject%3Dx%23y');
});

test('mailto: обычный адрес и plus-addressing остаются читаемыми', () => {
  const mailtoHref = mailtoHrefFromSource();
  assert.equal(mailtoHref('anna.petrova+dpo@example.org'), 'mailto:anna.petrova+dpo@example.org');
  assert.equal(mailtoHref("o'hara@example.org"), "mailto:o'hara@example.org");
  assert.equal(mailtoHref(''), '');
  assert.equal(mailtoHref(undefined), '');
});

test('карточка заявки строит почтовую ссылку через mailtoHref', () => {
  assert.match(src, /mailtoHref\(a\.email\)/);
  assert.doesNotMatch(src, /`mailto:\$\{a\.email\}`/);
});
