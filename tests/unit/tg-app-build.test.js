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
  // С 14.09.2026 карточка показывает всё, что есть на странице программы
  // (решение владельца), но служебные и сырые поля каталога по-прежнему не уходят.
  const leaked = JSON.stringify(data);
  for (const key of ['"source"', '"locked"', '"image"', '"discounts"', '"taxRefund"', '"kind"', '"teacherPhotos"', '"teacherPages"']) {
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

test('полная карточка: всё содержимое страницы программы', () => {
  const p = data.programs.find((x) => x.id === '494685723');
  // Сравнение с исходником – после той же типографики, что делает генератор.
  const src = JSON.parse(JSON.stringify(catalog.programs.find((x) => String(x.id) === '494685723')).split(EM).join(EN));
  assert.equal(p.about, src.about);
  assert.equal(p.audienceIntro, src.audience.intro);
  assert.deepEqual(p.audience, src.audience.items, 'все пункты «Кому подойдёт», без обрезки');
  assert.equal(p.results.length, src.results.length);
  assert.deepEqual(p.advantages, src.advantages);
  assert.equal(p.language, 'русский');
  assert.ok(p.priceTerms.includes('Скидка для юридических лиц'));
  assert.equal(p.modules.length, 8);
  assert.ok(p.modules.every((m) => Array.isArray(m.topics) && m.topics.length > 0), 'подтемы модулей');
  assert.deepEqual(Object.keys(p.modules[0]).sort(), ['hours', 'title', 'topics']);
  assert.equal(p.teachers.length, 8);
  for (const t of p.teachers) {
    assert.deepEqual(Object.keys(t).sort(), ['about', 'name', 'page', 'photo']);
    assert.match(t.photo, /^\.\.\/images\/teachers\/[a-z0-9_.-]+$/i, t.name);
    assert.ok(fs.existsSync(path.join(ROOT, t.photo.slice(3))), `нет фото ${t.photo}`);
  }
  assert.equal(p.feedback.length, src.feedback.length);
  assert.deepEqual(Object.keys(p.feedback[0]).sort(), ['author', 'text']);
  assert.deepEqual(p.faq.map((x) => x.q), src.faq.map((x) => x.q));
  assert.deepEqual(p.admissionDocs, src.admissionDocs);
  assert.deepEqual(p.files.map((f) => f.title).sort(), ['Расписание занятий', 'Учебный план']);
  for (const f of p.files) {
    assert.deepEqual(Object.keys(f).sort(), ['path', 'size', 'title']);
    assert.match(f.path, /^\.\.\/files\/[a-z0-9_.-]+\.pdf$/i);
    assert.ok(fs.existsSync(path.join(ROOT, f.path.slice(3))), `нет файла ${f.path}`);
  }
  const withPages = data.programs.flatMap((x) => x.teachers).filter((t) => t.page);
  assert.ok(withPages.length > 0, 'личные страницы преподавателей не подхватились');
  assert.ok(withPages.every((t) => /^https:\/\/([a-z0-9-]+\.)*hse\.ru\//i.test(t.page)));
});

test('фото и страницы преподавателей, файлы и объявление – только безопасные и живые', () => {
  const store = {
    programs: [{
      id: '1',
      title: 'Т',
      teachers: [
        { name: 'Есть фото', about: 'а' },
        { name: 'Выход из папки', about: 'б' },
        { name: 'Нет файла', about: 'в' },
      ],
      files: [
        { kind: 'plan', size: '1 Мб', path: 'files/494685723-plan.pdf' },
        { kind: 'schedule', size: '1 Мб', path: 'files/nope-schedule.pdf' },
        { kind: 'plan', size: '1 Мб', path: '../.catalog-data.json' },
      ],
      notice: { date: '01.04.2026', text: 'старое', url: 'https://example.org/x' },
    }],
    teacherPhotos: {
      'Есть фото': 'images/teachers/anna-sorokina.jpg',
      'Выход из папки': 'images/teachers/../../.catalog-data.json',
      'Нет файла': 'images/teachers/nobody-here.jpg',
    },
    teacherPages: {
      'Есть фото': 'https://www.hse.ru/org/persons/1/',
      'Выход из папки': 'https://evil.example/hse.ru/',
      'Нет файла': 'http://www.hse.ru/org/persons/2/',
    },
  };
  const p = buildData(store, { now: NOW }).programs[0];
  assert.deepEqual(p.teachers.map((t) => t.photo), ['../images/teachers/anna-sorokina.jpg', null, null]);
  assert.deepEqual(p.teachers.map((t) => t.page), ['https://www.hse.ru/org/persons/1/', null, null]);
  assert.deepEqual(p.files, [{ title: 'Учебный план', size: '1 Мб', path: '../files/494685723-plan.pdf' }]);
  assert.equal(p.notice, null, 'объявление старше 90 дней не показывается');

  store.programs[0].notice = { date: '01.09.2026', text: 'свежее', url: 'javascript:alert(1)' };
  assert.deepEqual(buildData(store, { now: NOW }).programs[0].notice, { date: '01.09.2026', text: 'свежее', url: null });
  store.programs[0].notice = { date: '', text: 'без даты', url: 'https://disk.yandex.ru/i/x' };
  assert.deepEqual(buildData(store, { now: NOW }).programs[0].notice, { date: null, text: 'без даты', url: 'https://disk.yandex.ru/i/x' });
});

test('как на сайте: лид, склеенное описание списком, канон имён преподавателей', () => {
  const hk = data.programs.find((x) => x.id === '1025688553');
  assert.equal(hk.lead, hk.tagline, 'самостоятельный лид показывается, как about-lead на сайте');
  // Живой пример склейки («Персональный ассистент») исчез 24.09.2026: разбор
  // страниц теперь берёт описание из подзаголовка, а не пункты формата.
  // Текст – его прежний about с hse.ru.
  const glued = buildData({ programs: [{ id: '1', title: 'Т', about: 'Обучение смешанное, есть возможность пройти курс полностью в дистанционном формате, ведётся онлайн трансляция всех занятий из аудитории Записи занятий размещаются на образовательной платформе на следующий рабочий день Записи занятий доступны + 1 месяц после окончания обучения Удобный график для совмещения с работой Налоговый вычет 13%' }] }, { now: NOW }).programs[0];
  assert.ok(Array.isArray(glued.aboutItems) && glued.aboutItems.length >= 3, 'склеенный about разбит на пункты');
  assert.equal(data.programs.find((x) => x.id === '494685723').aboutItems, null);
  const prefix = buildData({ programs: [{ id: '1', title: 'Т', tagline: 'Начало длинного описания программы', about: 'Начало длинного описания программы и его продолжение.' }] }, { now: NOW }).programs[0];
  assert.equal(prefix.lead, null, 'лид-префикс описания не дублируется');
  const budnik = data.programs.find((x) => x.id === '472681893').teachers.find((t) => /Будник/.test(t.name));
  assert.equal(budnik.name, 'Будник Руслан Александрович');
  assert.match(budnik.page, /^https:\/\/www\.hse\.ru\//, 'страница находится по каноническому имени');
});

test('странные данные не роняют сборку и не проходят фильтры', () => {
  const p = buildData({
    programs: [{
      id: '1', title: 'Т',
      files: [{ kind: '__proto__', title: { x: 1 }, size: 5, path: 'files/494685723-plan.pdf' }],
      notice: { date: 20260901, text: 'текст', url: 'https://example.org/' },
      teachers: [{ name: 'Папка', about: 'а' }],
    }],
    teacherPhotos: { 'Папка': 'images/teachers/..' },
  }, { now: NOW }).programs[0];
  assert.deepEqual(p.files, [{ title: 'Документ', size: '', path: '../files/494685723-plan.pdf' }]);
  assert.equal(p.notice.date, null, 'дата не строкой – не выводится');
  assert.equal(p.teachers[0].photo, null, 'папка вместо файла – не фото');
});

test('условия цены: налоговый вычет и скидки одной строкой каждое', () => {
  const p = buildData({ programs: [{ id: '1', title: 'Т', taxRefund: '13%', discounts: ['Скидка выпускникам', ''] }] }, { now: NOW }).programs[0];
  assert.deepEqual(p.priceTerms, ['13% можно вернуть налоговым вычетом', 'Скидка выпускникам']);
});

test('длинное тире в текстах каталога становится коротким', () => {
  const d = buildData(
    {
      programs: [{
        id: '1', title: 'А ' + EM + ' Б', tagline: EM, about: EM, results: [EM], advantages: [EM],
        modules: [{ title: EM, hours: '', topics: [EM] }], audience: { intro: EM, items: [EM] },
        teachers: [{ name: EM, about: EM }], feedback: [{ text: EM, author: EM }], faq: [{ q: EM, a: EM }],
      }],
    },
    { now: NOW }
  );
  assert.equal(JSON.stringify(d).includes(EM), false);
  assert.equal(d.programs[0].title, 'А ' + EN + ' Б');
});

const { renderPage } = require(path.join(ROOT, 'scripts', 'build-tg-app.js'));
const { integrityFor, versionFor } = require(path.join(ROOT, 'lib', 'sri.js'));

test('страница: CSP без unsafe-inline, скрипт Telegram, свои скрипты по порядку и с integrity', () => {
  const html = renderPage(data);
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html);
  assert.ok(csp, 'нет CSP');
  assert.doesNotMatch(csp[1], /unsafe-inline|unsafe-eval/);
  assert.match(csp[1], /default-src 'none'/);
  assert.match(csp[1], /script-src 'self' https:\/\/telegram\.org/);
  assert.match(html, /<script src="https:\/\/telegram\.org\/js\/telegram-web-app\.js"><\/script>/);
  assert.match(
    html,
    /<script src="\.\.\/js\/tg-core\.js\?v=[0-9a-f]{10}" defer integrity="sha384-[^"]+"><\/script>\s*<script src="\.\.\/js\/tg-app\.js\?v=[0-9a-f]{10}" defer integrity="sha384-[^"]+"><\/script>/
  );
  assert.doesNotMatch(html, /\sstyle="/, 'инлайн-стиль заблокирует CSP');
  assert.doesNotMatch(html, /\son[a-z]+="/, 'инлайн-обработчик заблокирует CSP');
  for (const hook of ['<header class="bar" hidden>', '<main id="app">', '<div class="main-btn" hidden>', 'id="tg-data"']) {
    assert.ok(html.includes(hook), `нет разметки ${hook}`);
  }
});

test('название с </script> не закрывает блок данных и читается обратно без искажений', () => {
  const evil = '</script><script>alert(1)</script>';
  const html = renderPage(buildData({ programs: [{ id: '1', title: evil, feedback: [{ text: evil, author: evil }], faq: [{ q: evil, a: evil }] }] }, { now: NOW }));
  const block = /<script type="application\/json" id="tg-data">([\s\S]*?)<\/script>/.exec(html)[1];
  assert.equal(block.includes('<'), false, 'в блоке данных остался «<»');
  const back = JSON.parse(block).programs[0];
  assert.equal(back.title, evil);
  assert.equal(back.feedback[0].text, evil);
  assert.equal(back.faq[0].a, evil);
  assert.equal((html.match(/<script/g) || []).length, 4, 'появился лишний тег script');
});

test('tg/index.html собран из текущих скриптов: integrity совпадает с файлами', () => {
  // Правка js/tg-app.js или js/tg-core.js без пересборки ломает страницу:
  // браузер не исполнит скрипт с чужим хешем.
  const html = fs.readFileSync(path.join(ROOT, 'tg', 'index.html'), 'utf8');
  // Версия в адресе (?v=) – от содержимого файла: после выкладки WebView с
  // закэшированным старым скриптом иначе получил бы новую страницу со старым
  // файлом, и SRI оставил бы экран пустым (ревью 14.09.2026).
  const tags = [...html.matchAll(/<script src="\.\.\/(js\/[^"?]+)\?v=([0-9a-f]+)" defer integrity="([^"]+)"/g)];
  assert.equal(tags.length, 2);
  for (const m of tags) {
    assert.equal(m[3], integrityFor(m[1]), `${m[1]}: пересоберите node scripts/build-tg-app.js`);
    assert.equal(m[2], versionFor(m[1]), `${m[1]}: версия в адресе устарела`);
  }
  const css = /<link rel="stylesheet" href="tg-app\.css\?v=([0-9a-f]+)">/.exec(html);
  assert.ok(css, 'стили без версии в адресе');
  assert.equal(css[1], versionFor('tg/tg-app.css'));
});
