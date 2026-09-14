'use strict';

/**
 * Страница программы показывает то, что мы перенесли с маркетплейса
 * 09.09.2026: подтемы модулей раскрытием, файлы программы, объём/язык/
 * график в карточке фактов, преимущества, документы для приёма и условия
 * оплаты под ценой.
 *
 * Проверяем СГЕНЕРИРОВАННУЮ страницу, а не генератор: между ними стоит
 * сборка, и «в генераторе есть» ещё не значит «на странице видно».
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// «Цифровое право для бизнеса»: у неё есть всё сразу – подтемы, оба файла,
// график занятий, скидки и вычет. Если страница переименуется, тест
// упадёт на чтении файла, и это правильно: проверять нужно живую.
const PAGE = 'programs/tsifrovoe-pravo-dlya-biznesa-837181759.html';
const html = read(PAGE);
const css = read('programs/program.css');

test('подтемы модулей выводятся раскрытием', () => {
  assert.match(html, /<details>\s*<summary>/, 'модули больше не раскрываются');
  assert.match(html, /class="module-topics"/, 'списка подтем нет');
  assert.match(html, /Основные источники цифрового права/, 'подтемы не попали на страницу');
  // Модуль без подтем остаётся обычной строкой – пустая стрелка обещала бы
  // содержимое, которого нет.
  const openRows = (html.match(/class="module-open"/g) || []).length;
  const details = (html.match(/<details>/g) || []).length;
  assert.equal(openRows, details, 'раскрытие и класс строки разошлись');
});

test('файлы программы ведут на НАШУ копию, а не на hse.ru', () => {
  assert.match(html, /<h2>Документы программы<\/h2>/, 'блока файлов нет');
  assert.match(html, /href="\.\.\/files\/837181759-plan\.pdf" download/, 'учебный план не подставлен');
  assert.ok(
    fs.existsSync(path.join(ROOT, 'files/837181759-plan.pdf')),
    'файла нет на диске – ссылка будет битой',
  );
  const links = [...html.matchAll(/class="file" href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(links.length >= 1, 'ссылок на файлы нет');
  assert.ok(links.every((h) => h.startsWith('../files/')), 'ссылка ведёт мимо нашего зеркала');
});

test('карточка фактов: объём, язык и график занятий', () => {
  assert.match(html, /<dt>Объём<\/dt><dd>68 часов<\/dd>/);
  assert.match(html, /<dt>Язык<\/dt><dd>русский<\/dd>/);
  assert.match(html, /<dt>График занятий<\/dt>/);
});

test('условия оплаты под ценой: вычет и скидки', () => {
  assert.match(html, /class="price-terms"/, 'условий оплаты нет');
  assert.match(html, /можно вернуть налоговым вычетом/);
  assert.match(html, /Скидки 5-10% студентам/);
});

test('преимущества и документы для приёма', () => {
  assert.match(html, /<h2>Преимущества программы<\/h2>/);
  assert.match(html, /<h2>Документы для приёма на обучение<\/h2>/);
  assert.match(html, /Паспорт/);
});

test('сетка строки модуля не достаёт до подтем', () => {
  // Правило .modules li без «>» доставало до вложенных <li> подтем, и план
  // рассыпался в столбец по слову на строку. Вес .modules > li.module-open
  // обязан перебивать .modules > li – иначе details попадает в колонку
  // шириной 28px. Оба дефекта были в браузере и не видны по коду.
  assert.match(css, /\.modules > li\{/, 'сетка модуля снова достаёт до подтем');
  assert.match(css, /\.modules > li\.module-open\{display:block/, 'вес правила раскрытия занижен');
});

// Ссылки на личные страницы hse.ru (владелец 14.09.2026): ссылкой служит само
// имя. Адреса – из справочника teacherPages, который ведётся руками.
const store = JSON.parse(read('.catalog-data.json'));
const escAttr = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('имя преподавателя со страницей на hse.ru – ссылка на неё', () => {
  const program = store.programs.find((p) => p.id === '837181759');
  const linked = program.teachers.filter((t) => store.teacherPages[t.name]);
  assert.ok(linked.length > 0, 'у проверочной программы нет преподавателей с адресом');
  for (const t of linked) {
    const re = new RegExp(
      `<p class="teacher-name"><a href="${escAttr(store.teacherPages[t.name])}" target="_blank" rel="noopener noreferrer">` +
        `${escAttr(t.name)}<span aria-hidden="true"> ↗</span></a></p>`,
    );
    assert.match(html, re, `${t.name}: имя не ведёт на страницу hse.ru`);
  }
  assert.match(css, /\.teacher-name a\{[^}]*position:relative;display:inline-block;padding:10px 0;margin:-10px 0/, 'мишень ссылки-имени меньше 44px');
});

test('без адреса или с адресом не на hse.ru имя остаётся текстом', () => {
  const { renderPage } = require(path.join(ROOT, 'scripts', 'build-program-pages.js'));
  const page = renderPage(
    { id: '1', title: 'Т', teachers: [{ name: 'Иванов Иван' }, { name: 'Петров Пётр' }, { name: 'Сидоров Сидор' }] },
    null,
    { 'Иванов Иван': 'https://www.hse.ru/org/persons/1/', 'Петров Пётр': 'https://evil.example/hse.ru' },
  );
  assert.match(page, /<p class="teacher-name"><a href="https:\/\/www\.hse\.ru\/org\/persons\/1\/"/);
  assert.match(page, /<p class="teacher-name">Петров Пётр<\/p>/, 'ссылка не на hse.ru попала на страницу');
  assert.match(page, /<p class="teacher-name">Сидоров Сидор<\/p>/);
});
