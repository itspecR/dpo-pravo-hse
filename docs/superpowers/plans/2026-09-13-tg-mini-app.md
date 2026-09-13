# Мини-апп Центра ДПО в Telegram – план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** страница `tg/index.html` – мини-приложение Telegram с витриной программ, карточкой программы, заявкой и честным демо-экраном с переходом к оплате на hse.ru, выложенная на публичное зеркало.

**Architecture:** генератор `scripts/build-tg-app.js` берёт `.catalog-data.json`, оставляет только поля экранов и встраивает их блоком JSON в `tg/index.html`. Чистая логика (разбор `startapp`, проверка заявки, фильтр, цена) живёт в `js/tg-core.js` и проверяется `node --test`, DOM и мост к Telegram WebApp – в `js/tg-app.js`. Выкладка идёт существующим `scripts/build-public.js` после добавления `tg` в белый список страниц.

**Tech Stack:** Node ≥ 18 (`node:test`), браузерный ES5-JavaScript без сборщика (как весь `js/`), CSS без препроцессора, `telegram-web-app.js` с telegram.org, `playwright-cli` для проверки в браузере.

**Spec:** `docs/superpowers/specs/2026-09-13-tg-mini-app-design.md`

## Global Constraints

- Типографика всех текстов: только короткое тире «–» (U+2013); длинное U+2014 запрещено и в коде, и в строках, и в документации.
- **Ловушка инструментов:** Write/Edit превращают escape-последовательности вида «обратный слеш, u, четыре hex-цифры» (коды 003C, 00A0, 2014) в сами символы. В коде этого плана таких последовательностей нет – вместо них `String.fromCharCode(...)`. После правки файла, где такая последовательность нужна, проверить его: `grep -n 'u003C' <файл>` – вхождение должно остаться текстом, а не превратиться в «<».
- `String.prototype.replace` с заменой, содержащей `$` – не использовать для подстановки данных в шаблоны, только `split/join` или шаблонные строки.
- CSP страницы мини-аппа: `default-src 'none'; script-src 'self' https://telegram.org; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'self'; form-action 'none'; object-src 'none'`. Никакого `'unsafe-inline'`: на странице нет атрибутов `style="…"`, `on…="…"` и инлайн-скриптов, кроме неисполняемого `type="application/json"`. Разметка в `js/tg-app.js` строится через `createElement`/`textContent`, не через `innerHTML`.
- Мини-апп не отправляет данные по сети и не пишет их в `localStorage`/`sessionStorage`/cookies.
- Тексты ошибок и регулярки проверки заявки – дословно как в `lib/application-form.js`.
- Облик: направление А (облик сайта целиком), токены из `programs/program.css`, движение по разделу 4.1 спецификации; `prefers-reduced-motion: reduce` отключает всю анимацию.
- Стиль браузерного кода: ES5 (`var`, `function`), IIFE, `'use strict'`, комментарии на русском – как `js/bot-reply.js` и `js/support-bot.js`.
- Полный прогон тестов: `node --test --test-timeout=180000 tests/unit/*.test.js` (без таймаута воркер `prerender-landing.test.js` иногда зависает).
- Коммиты – по одному на задачу, сообщение на английском в стиле репозитория (`feat(tg): …`), с трейлерами из системных указаний сессии. В `origin`/`mirror` не пушить и витрину не выкладывать без слова владельца (Task 5).

---

## Карта файлов

| Файл | Ответственность | Задача |
|---|---|---|
| `js/tg-core.js` (создать) | чистые функции: `parseStartParam`, `validateApplication`, `filterPrograms`, `formatPrice`; UMD – `require` в тестах, `window.DpoTgCore` в браузере | 1 |
| `tests/unit/tg-core.test.js` (создать) | startapp, паритет проверки заявки с сервером, фильтр, цена | 1 |
| `tests/unit/application-form-live-check.test.js` (изменить) | паритет литералов регулярок распространяется на `js/tg-core.js` | 1 |
| `scripts/build-tg-app.js` (создать) | `FIELDS`, `buildData`, `renderPage`, `build` | 2, 3 |
| `tests/unit/tg-app-build.test.js` (создать) | данные, формулы, типографика, CSP, экранирование, свежесть integrity | 2, 3 |
| `tg/tg-app.css` (создать) | стили облика А и движение | 3 |
| `js/tg-app.js` (создать) | экраны, стек «назад», мост к Telegram, запасные кнопки вне Telegram | 3 |
| `tg/index.html` (генерируется, коммитится) | страница мини-аппа | 3 |
| `lib/static-http.js` (изменить) | `tg` в `PAGE_DIRS` | 4 |
| `docker/nginx.conf` (изменить) | узкий проход `^/tg/[^/]+\.(html|css)$` | 4 |
| `tests/unit/build-public.test.js` (изменить) | `tg/index.html` и `tg/tg-app.css` в выкладке, SRI для `tg/` | 4 |
| `package.json` (изменить) | `build-tg`, пересборка мини-аппа в `update-catalog` и `update-details` | 4 |
| `DESIGN.md`, `README.md` (изменить) | раздел «Мини-апп Telegram», сборка, ссылки, BotFather, второй этап | 4 |

---

### Task 1: Чистая логика мини-аппа `js/tg-core.js`

**Files:**
- Create: `js/tg-core.js`
- Create: `tests/unit/tg-core.test.js`
- Modify: `tests/unit/application-form-live-check.test.js` (тест «регулярные выражения почты и телефона на клиенте те же, что на сервере», строки 15–33)

**Interfaces:**
- Consumes: `parseApplication(raw, { now })` из `lib/application-form.js` (только в тесте).
- Produces (объект `DpoTgCore` / `module.exports`):
  - `START_PARAM_MAX: 512`
  - `LIMITS: { firstName: 80, lastName: 80, phone: 40, email: 160, position: 120, company: 160 }`
  - `parseStartParam(raw: any, knownIds: string[]) -> { programId: string|null, campaign: string|null }`
  - `validateApplication(form: { firstName, lastName, phone, email, position, company, consent: boolean }) -> { ok: true, values: {firstName,lastName,phone,email,position,company} } | { ok: false, errors: Array<{ field: string, message: string }> }`
  - `filterPrograms(programs: Array<{sphere, title, tagline}>, sphere: string, query: string) -> Array`
  - `formatPrice(n: any) -> string` (пустая строка, если цены нет)

- [ ] **Step 1: Написать падающий тест**

Создать `tests/unit/tg-core.test.js`:

```js
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
```

- [ ] **Step 2: Запустить – тест падает**

Run: `node --test tests/unit/tg-core.test.js`
Expected: FAIL, `Cannot find module '.../js/tg-core.js'`.

- [ ] **Step 3: Написать реализацию**

Создать `js/tg-core.js`. Регулярки скопировать из `lib/application-form.js` дословно (строки 86 и 102) – тест паритета сравнивает текст литерала:

```js
/**
 * Мини-апп Telegram: чистая логика без DOM.
 *
 * Разбор параметра startapp, проверка заявки, фильтр витрины и цена.
 * DOM, экраны и мост к Telegram WebApp – в js/tg-app.js. Регулярки и
 * тексты ошибок совпадают с lib/application-form.js дословно: во втором
 * этапе заявка уйдёт на сервер, и расхождение означало бы «на телефоне
 * приняли – на сервере отказ» (сторожат tests/unit/tg-core.test.js и
 * tests/unit/application-form-live-check.test.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DpoTgCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Telegram пропускает в startapp только [A-Za-z0-9_-] и не длиннее 512.
  var START_PARAM_MAX = 512;
  var START_PARAM_SHAPE = /^[A-Za-z0-9_-]+$/;
  var PROGRAM_PART = /^p_([A-Za-z0-9_]{1,40})$/;
  var CAMPAIGN_PART = /^c_([A-Za-z0-9_]{1,64})$/;

  var PHONE_ALLOWED = /^[0-9+()\-\s.]+$/;
  var EMAIL_SHAPE = /^[^\s@,;?#%\/\\<>"&=:]+@[^\s@,;?#%\/\\<>"&=:]+\.[^\s@,;?#%\/\\<>"&=:]{2,}$/;
  var LIMITS = { firstName: 80, lastName: 80, phone: 40, email: 160, position: 120, company: 160 };
  var NBSP = String.fromCharCode(160);

  /**
   * «p_494685723-c_yuriy2» -> { programId: '494685723', campaign: 'yuriy2' }.
   * Части через «-», порядок любой; неизвестное молча игнорируется –
   * открывается витрина, а не ошибка.
   */
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

  /** Та же нормализация, что str() на сервере: пробелы схлопнуты, края сняты, длина обрезана. */
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

    // Галочка в интерфейсе даёт только true/false; строка – не согласие.
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
```

- [ ] **Step 4: Запустить – тест проходит**

Run: `node --test tests/unit/tg-core.test.js`
Expected: `ℹ pass 6`, `ℹ fail 0`.

Если падает паритет с сервером на кейсе с телефоном – сверить тексты ошибок с `lib/application-form.js:150-170`, они должны совпадать до символа.

- [ ] **Step 5: Распространить паритет литералов на мини-апп**

В `tests/unit/application-form-live-check.test.js` после строки
`const server = fs.readFileSync(path.join(ROOT, 'lib', 'application-form.js'), 'utf8');`
добавить:

```js
const tgCore = fs.readFileSync(path.join(ROOT, 'js', 'tg-core.js'), 'utf8');
```

и внутри цикла `for (const name of ['EMAIL_SHAPE', 'PHONE_ALLOWED'])` после строки с `assert.ok(client.includes(re), …)` добавить:

```js
    assert.ok(tgCore.includes(re), `${name} ${re} отсутствует в js/tg-core.js (мини-апп Telegram)`);
```

Run: `node --test tests/unit/application-form-live-check.test.js tests/unit/tg-core.test.js`
Expected: `ℹ fail 0`.

Проверить, что проверка работает: временно заменить в `js/tg-core.js` `{2,}` на `{3,}` в `EMAIL_SHAPE`, запустить ту же команду – ожидается FAIL «EMAIL_SHAPE … отсутствует в js/tg-core.js». Вернуть `{2,}`.

- [ ] **Step 6: Commit**

```bash
git add js/tg-core.js tests/unit/tg-core.test.js tests/unit/application-form-live-check.test.js
git commit -m "feat(tg): pure logic for the Telegram mini app – start param, application check, filter, price"
```

---

### Task 2: Данные мини-аппа – `buildData` в `scripts/build-tg-app.js`

**Files:**
- Create: `scripts/build-tg-app.js` (часть: константы, `buildData`, экспорт)
- Create: `tests/unit/tg-app-build.test.js` (часть: данные)

**Interfaces:**
- Consumes: `SPHERES`, `sphereOf` (`lib/program-spheres.js`); `docBadge`, `shortFormat` (`lib/program-labels.js`); `upcomingStartLabel(item, now)` (`lib/hse-catalog.js`); `buildPayUrl(id)` (`scripts/build-program-pages.js`, уже экспортируется, сборка там запускается только при `require.main === module`).
- Produces:
  - `FIELDS: string[]` – ровно `['id','title','sphere','badge','doc','format','duration','hours','startLabel','price','oldPrice','tagline','audience','results','modules','cover','thumb','pay']`
  - `buildData(catalog: {programs: object[]} | object[], opts?: { now?: Date }) -> { programs: Program[], spheres: Array<{ id: string, title: string, count: number }> }`
  - `Program.modules: Array<{ title: string, hours: string }>`; `cover`/`thumb`: `'../images/programs/…'` или `null`; `startLabel`: `'Старт: 14 октября 2026 г.'` или `null`.

- [ ] **Step 1: Написать падающий тест**

Создать `tests/unit/tg-app-build.test.js`:

```js
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
```

- [ ] **Step 2: Запустить – тест падает**

Run: `node --test tests/unit/tg-app-build.test.js`
Expected: FAIL, `Cannot find module '.../scripts/build-tg-app.js'`.

- [ ] **Step 3: Написать реализацию**

Создать `scripts/build-tg-app.js`:

```js
#!/usr/bin/env node
/**
 * Мини-апп Telegram: собирает tg/index.html из .catalog-data.json.
 *
 *   node scripts/build-tg-app.js
 *
 * Страница самодостаточна: каталог встроен блоком JSON, наружу уходят
 * только поля экранов (docs/superpowers/specs/2026-09-13-tg-mini-app-design.md,
 * раздел 3.2). Отзывы, преподаватели и служебные поля каталога на
 * страницу не попадают. Руками tg/index.html не править – перезапишется.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { SPHERES, sphereOf } = require('../lib/program-spheres');
const { docBadge, shortFormat } = require('../lib/program-labels');
const { upcomingStartLabel } = require('../lib/hse-catalog');
const { buildPayUrl } = require('./build-program-pages');

const ROOT = path.resolve(__dirname, '..');
const STORE = path.join(ROOT, '.catalog-data.json');
const OUT = path.join(ROOT, 'tg', 'index.html');

/** Та же строгая маска локальных обложек, что в lib/catalog-store.js. */
const IMAGE_PATH_RE = /^images\/programs\/[a-z0-9_.-]+$/i;
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

const FIELDS = Object.freeze([
  'id', 'title', 'sphere', 'badge', 'doc', 'format', 'duration', 'hours', 'startLabel',
  'price', 'oldPrice', 'tagline', 'audience', 'results', 'modules', 'cover', 'thumb', 'pay',
]);

/** Короткие подписи чипов сфер – согласованы владельцем на макете 13.09.2026. */
const SPHERE_CHIPS = Object.freeze({
  corporate: 'Корпоративное',
  digital: 'Цифровое и ИС',
  international: 'Международное',
  finance: 'Финансы и налоги',
  language: 'Языки',
  practice: 'Практика',
});

function localImage(rel) {
  if (!rel || !IMAGE_PATH_RE.test(rel)) return null;
  return fs.existsSync(path.join(ROOT, rel)) ? '../' + rel : null;
}

/** «Итоговый документ – диплом о … НИУ ВШЭ.» -> «Диплом о … НИУ ВШЭ». */
function docTitle(badge) {
  const m = badge && /–\s*(.+?)\.?$/.exec(badge.tip || '');
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : null;
}

/** Типографика владельца: длинное тире в текстах каталога – короткое. */
function typography(value) {
  if (typeof value === 'string') return value.split(EM_DASH).join(EN_DASH);
  if (Array.isArray(value)) return value.map(typography);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = typography(v);
    return out;
  }
  return value;
}

function programOf(p, now) {
  const id = String(p.id);
  const badge = docBadge(p.type);
  const sphere = sphereOf(p);
  // Та же цена, что на лендинге (priceOf в scripts/build-landing.js).
  const price = p.discountPrice != null ? p.discountPrice : p.educationPricing;
  const cover = localImage(p.image);
  const hasDiscount =
    typeof p.discountPrice === 'number' && typeof p.educationPricing === 'number' && p.discountPrice < p.educationPricing;
  return {
    id,
    title: p.title || '',
    sphere: sphere ? sphere.id : null,
    badge: badge ? badge.label : null,
    doc: docTitle(badge),
    format: shortFormat(p.studyFormat && p.studyFormat.title) || null,
    duration: p.duration || null,
    hours: p.hours || null,
    startLabel: upcomingStartLabel(p, now),
    price: typeof price === 'number' ? price : null,
    oldPrice: hasDiscount ? p.educationPricing : null,
    tagline: p.tagline || p.about || '',
    audience: ((p.audience && p.audience.items) || []).slice(0, 5),
    results: (p.results || []).slice(0, 5),
    modules: (p.modules || []).map((m) => ({ title: m.title || '', hours: m.hours || '' })),
    cover,
    thumb: localImage(`images/programs/thumbs/${id}.jpg`) || cover,
    pay: /^\d+$/.test(id) ? buildPayUrl(id) : null,
  };
}

function buildData(catalog, { now = new Date() } = {}) {
  const list = Array.isArray(catalog) ? catalog : (catalog && catalog.programs) || [];
  const programs = list.map((p) => programOf(p, now));
  const spheres = SPHERES.map((s) => ({
    id: s.id,
    title: SPHERE_CHIPS[s.id] || s.title,
    count: programs.filter((p) => p.sphere === s.id).length,
  })).filter((s) => s.count > 0);
  return typography({ programs, spheres });
}

module.exports = { FIELDS, buildData };
```

- [ ] **Step 4: Запустить – тест проходит**

Run: `node --test tests/unit/tg-app-build.test.js`
Expected: `ℹ pass 5`, `ℹ fail 0`.

Если падает `doc`: напечатать подсказку `node -e "console.log(require('./lib/program-labels').docBadge({shortTitle:'ПП'}))"` и сверить с регуляркой `docTitle` – в подсказке короткое тире «–».

- [ ] **Step 5: Commit**

```bash
git add scripts/build-tg-app.js tests/unit/tg-app-build.test.js
git commit -m "feat(tg): catalog data for the mini app – screen fields only, pay link and start label shared with the site"
```

---

### Task 3: Страница мини-аппа – разметка, стили, экраны, мост к Telegram

**Files:**
- Modify: `scripts/build-tg-app.js` (добавить `CSP`, `renderPage`, `build`, запуск)
- Modify: `tests/unit/tg-app-build.test.js` (добавить тесты страницы)
- Create: `tg/tg-app.css`
- Create: `js/tg-app.js`
- Create (генерируется): `tg/index.html`

**Interfaces:**
- Consumes: `buildData`, `FIELDS` (Task 2); `DpoTgCore.parseStartParam`, `validateApplication`, `filterPrograms`, `formatPrice`, `LIMITS` (Task 1); `scriptTag(src, { prefix })`, `integrityFor(rel)` (`lib/sri.js`).
- Produces:
  - `renderPage(data) -> string` (HTML), `build() -> void` (пишет `tg/index.html`); экспорт `{ FIELDS, buildData, renderPage, build }`.
  - DOM-контракт страницы, на который опирается `js/tg-app.js`: `header.bar[hidden] > button.bar-back[hidden] + span.bar-title`, `main#app`, `div.main-btn[hidden] > button`, `script#tg-data[type=application/json]`.
  - Порядок скриптов: `telegram-web-app.js` (синхронно, в `<head>`), затем `../js/tg-core.js` и `../js/tg-app.js` с `defer` и integrity.

- [ ] **Step 1: Написать падающий тест страницы**

В конец `tests/unit/tg-app-build.test.js` добавить:

```js
const { renderPage } = require(path.join(ROOT, 'scripts', 'build-tg-app.js'));
const { integrityFor } = require(path.join(ROOT, 'lib', 'sri.js'));

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
    /<script src="\.\.\/js\/tg-core\.js" defer integrity="sha384-[^"]+"><\/script>\s*<script src="\.\.\/js\/tg-app\.js" defer integrity="sha384-[^"]+"><\/script>/
  );
  assert.doesNotMatch(html, /\sstyle="/, 'инлайн-стиль заблокирует CSP');
  assert.doesNotMatch(html, /\son[a-z]+="/, 'инлайн-обработчик заблокирует CSP');
  for (const hook of ['<header class="bar" hidden>', '<main id="app">', '<div class="main-btn" hidden>', 'id="tg-data"']) {
    assert.ok(html.includes(hook), `нет разметки ${hook}`);
  }
});

test('название с </script> не закрывает блок данных и читается обратно без искажений', () => {
  const evil = '</script><script>alert(1)</script>';
  const html = renderPage(buildData({ programs: [{ id: '1', title: evil }] }, { now: NOW }));
  const block = /<script type="application\/json" id="tg-data">([\s\S]*?)<\/script>/.exec(html)[1];
  assert.equal(block.includes('<'), false, 'в блоке данных остался «<»');
  assert.equal(JSON.parse(block).programs[0].title, evil);
  assert.equal((html.match(/<script/g) || []).length, 4, 'появился лишний тег script');
});

test('tg/index.html собран из текущих скриптов: integrity совпадает с файлами', () => {
  // Правка js/tg-app.js или js/tg-core.js без пересборки ломает страницу:
  // браузер не исполнит скрипт с чужим хешем.
  const html = fs.readFileSync(path.join(ROOT, 'tg', 'index.html'), 'utf8');
  const tags = [...html.matchAll(/<script src="\.\.\/(js\/[^"]+)" defer integrity="([^"]+)"/g)];
  assert.equal(tags.length, 2);
  for (const m of tags) assert.equal(m[2], integrityFor(m[1]), `${m[1]}: пересоберите node scripts/build-tg-app.js`);
});
```

- [ ] **Step 2: Запустить – тесты падают**

Run: `node --test tests/unit/tg-app-build.test.js`
Expected: FAIL – `renderPage is not a function` и `ENOENT … tg/index.html`.

- [ ] **Step 3: Стили `tg/tg-app.css`**

Создать `tg/tg-app.css`:

```css
/* Мини-апп Telegram. Облик А – облик сайта целиком в любой теме Telegram
   (DESIGN.md, раздел «Мини-апп Telegram»). Токены – те же, что в
   programs/program.css; страницу собирает scripts/build-tg-app.js. */
:root {
  --bg: #FBF9F5;
  --bg-tint: #F2ECE1;
  --surface: 255 255 255;
  --ink: 33 30 27;
  --ink-soft: #48423A;
  --ink-mute: #6B6459;
  --accent: 22 88 218;
  --accent-dark: #1145AA;
  --error: #B00020;
  --cover-empty: #0B2A69;
  --line: rgb(var(--ink) / .1);
  --ease: cubic-bezier(.22, 1, .36, 1);
  --sans: 'HSE Sans', 'IBM Plex Sans', -apple-system, sans-serif;
  --slab: 'HSE Slab', 'Source Serif 4', Georgia, serif;
  --card-r: 14px;
  --btn-r: 12px;
}
* { box-sizing: border-box }
html { -webkit-text-size-adjust: 100% }
body { margin: 0; min-height: 100vh; background: var(--bg); color: rgb(var(--ink)); font: 400 15px/1.45 var(--sans) }
body.has-main { padding-bottom: calc(84px + env(safe-area-inset-bottom)) }
button, input { font: inherit; color: inherit }
a, button, input, label { touch-action: manipulation; -webkit-tap-highlight-color: transparent }
a:focus-visible, button:focus-visible, input:focus-visible {
  outline: 2px solid rgb(var(--accent)); outline-offset: 1px; box-shadow: 0 0 0 3px rgb(var(--accent) / .18) }
img { display: block; max-width: 100% }
[hidden] { display: none !important }

/* Своя шапка – только вне Telegram: внутри шапку и «назад» рисует Telegram */
.bar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px; height: 52px; padding: 0 16px;
  background: rgba(251, 249, 245, .92); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line) }
.bar-back { border: 0; background: none; padding: 8px 0; color: rgb(var(--accent)); font-size: 15px; cursor: pointer }
.bar-title { font-weight: 600 }

.screen { padding: 16px 16px 28px }
.eyebrow { margin: 4px 0 6px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-mute) }
.h1 { margin: 0 0 14px; font: 700 26px/1.1 var(--slab); text-wrap: balance }
.h1--sm { font-size: 23px }

/* Витрина */
.search { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; border-radius: 12px;
  background: rgb(var(--surface)); border: 1px solid var(--line); color: var(--ink-mute) }
.search:focus-within { border-color: rgb(var(--accent)) }
.search input { flex: 1; min-width: 0; border: 0; background: transparent; font-size: 16px; color: rgb(var(--ink)); outline: none }
.chips { display: flex; gap: 8px; overflow-x: auto; margin: 0 -16px; padding: 12px 16px 4px; scrollbar-width: none }
.chips::-webkit-scrollbar { display: none }
.chip { flex: none; min-height: 36px; border: 0; border-radius: 999px; padding: 9px 13px; background: var(--bg-tint); color: var(--ink-soft);
  font-size: 13px; font-weight: 600; line-height: 1; white-space: nowrap; cursor: pointer }
.chip small { margin-left: 4px; font-weight: 400; opacity: .65 }
.chip[aria-pressed="true"] { background: rgb(var(--ink)); color: var(--bg) }
.cards { display: flex; flex-direction: column; gap: 12px; margin-top: 10px }
.card { display: block; width: 100%; padding: 0; text-align: left; border: 1px solid var(--line); border-radius: var(--card-r);
  background: rgb(var(--surface)); overflow: hidden; cursor: pointer }
.cover { position: relative; display: block; aspect-ratio: 2 / 1; background: var(--cover-empty); overflow: hidden }
.cover img { width: 100%; height: 100%; object-fit: cover }
.tags { position: absolute; left: 10px; top: 10px; display: flex; gap: 6px }
.tag { padding: 6px 8px; border-radius: 999px; background: rgba(255, 255, 255, .92); color: rgb(var(--ink)); font-size: 11px; font-weight: 600; line-height: 1 }
.card-body { display: block; padding: 12px 14px 14px }
.card-title { margin: 0 0 10px; font: 700 17px/1.2 var(--slab); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden }
.meta { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 13px; color: var(--ink-mute) }
.price { font: 400 18px/1.2 var(--slab); color: rgb(var(--ink)) }
.price s { margin-left: 6px; font: 400 13px var(--sans); color: var(--ink-mute) }
.empty { padding: 40px 8px; text-align: center; color: var(--ink-mute) }

/* Программа */
.hero { margin: -16px -16px 16px; aspect-ratio: 16 / 10; background: var(--cover-empty); overflow: hidden }
.hero img { width: 100%; height: 100%; object-fit: cover }
.badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px }
.badge { padding: 6px 9px; border-radius: 999px; background: var(--bg-tint); color: var(--ink-soft); font-size: 12px; font-weight: 600; line-height: 1 }
.lead { margin: 0 0 16px; color: var(--ink-soft) }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin: 0 0 8px; background: var(--line); border: 1px solid var(--line);
  border-radius: var(--card-r); overflow: hidden }
.fact { margin: 0; padding: 11px 12px; background: rgb(var(--surface)) }
.fact dt { margin: 0 0 3px; font-size: 12px; color: var(--ink-mute) }
.fact dd { margin: 0; font-size: 14px; font-weight: 600 }
.h2 { margin: 22px 0 10px; font: 700 19px/1.2 var(--slab) }
.bul { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none }
.bul li { position: relative; padding-left: 16px; font-size: 14px; color: var(--ink-soft) }
.bul li::before { content: ''; position: absolute; left: 2px; top: .6em; width: 6px; height: 6px; border-radius: 50%; background: rgb(var(--accent)) }
.mods { margin: 0; padding: 0; list-style: none; border: 1px solid var(--line); border-radius: var(--card-r); background: rgb(var(--surface)); overflow: hidden }
.mods li { display: flex; justify-content: space-between; gap: 12px; padding: 11px 12px; border-top: 1px solid var(--line); font-size: 14px; line-height: 1.35 }
.mods li:first-child { border-top: 0 }
.mods span { flex: none; font-size: 12px; color: var(--ink-mute); white-space: nowrap }

/* Заявка */
.mini { display: flex; align-items: center; gap: 12px; margin: 0 0 18px; padding: 10px; border: 1px solid var(--line); border-radius: var(--card-r);
  background: rgb(var(--surface)) }
.mini-img { flex: none; width: 56px; height: 56px; border-radius: 10px; background: var(--cover-empty); overflow: hidden }
.mini-img img { width: 100%; height: 100%; object-fit: cover }
.mini b { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 14px; line-height: 1.25 }
.mini small { display: block; font-size: 13px; color: var(--ink-mute) }
.field { display: block; margin: 0 0 12px }
.field-label { display: block; margin: 0 0 5px; font-size: 13px; color: var(--ink-mute) }
.field-hint { color: rgb(var(--accent)) }
.field input { width: 100%; height: 46px; padding: 0 12px; border: 1px solid var(--line); border-radius: 12px; background: rgb(var(--surface)); font-size: 16px; outline: none }
.field input:focus { border-color: rgb(var(--accent)) }
.field input[aria-invalid="true"] { border-color: var(--error) }
.field-err { display: block; margin-top: 5px; font-size: 13px; color: var(--error) }
.check { display: flex; align-items: flex-start; gap: 10px; margin: 16px 0 4px; font-size: 13px; line-height: 1.4; color: var(--ink-soft) }
.check input { flex: none; width: 20px; height: 20px; margin: 0; accent-color: rgb(var(--accent)) }
.check a { color: rgb(var(--accent)); text-decoration: underline }

/* После отправки (демо) */
.plaque { margin: 0 0 18px; padding: 14px; border: 1.5px dashed rgb(var(--accent)); border-radius: var(--card-r); background: var(--bg-tint) }
.plaque b { display: block; margin: 0 0 6px; font: 700 18px/1.2 var(--slab) }
.plaque p { margin: 0; font-size: 14px; color: var(--ink-soft) }
.summary { margin: 0; border: 1px solid var(--line); border-radius: var(--card-r); background: rgb(var(--surface)); overflow: hidden }
.summary div { display: grid; grid-template-columns: 110px 1fr; gap: 10px; padding: 10px 12px; border-top: 1px solid var(--line); font-size: 14px }
.summary div:first-child { border-top: 0 }
.summary dt { color: var(--ink-mute) }
.summary dd { margin: 0; overflow-wrap: anywhere }
.ghost { display: block; width: 100%; height: 46px; margin: 14px 0 0; border: 1px solid var(--line); border-radius: var(--btn-r); background: transparent;
  color: rgb(var(--accent)); font-weight: 600; cursor: pointer }

/* Главная кнопка – только вне Telegram: внутри это нативная MainButton */
.main-btn { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; padding: 8px 12px calc(14px + env(safe-area-inset-bottom)); background: var(--bg) }
.main-btn button { width: 100%; height: 50px; border: 0; border-radius: var(--btn-r); background: rgb(var(--accent)); color: #fff; font-size: 16px; font-weight: 600; cursor: pointer }
.main-btn button:hover { background: var(--accent-dark) }
.noscript { padding: 24px 16px }

/* Движение (spec 4.1). Каскад карточек – только класс .cascade, который
   js/tg-app.js ставит при входе на витрину, но не при фильтре и поиске. */
@media (prefers-reduced-motion: no-preference) {
  .screen.in { animation: tg-push .34s var(--ease) both }
  .screen.in.back { animation-name: tg-pop }
  .cards.cascade .card { animation: tg-rise .42s var(--ease) both; animation-delay: calc(var(--i, 0) * 45ms) }
  .card, .chip, .ghost, .main-btn button { transition: transform .12s ease, background-color .18s ease, color .18s ease }
  .card:active { transform: scale(.985) }
  .chip:active, .ghost:active, .main-btn button:active { transform: scale(.97) }
  .plaque { animation: tg-rise .5s var(--ease) .08s both }
}
@keyframes tg-push { from { opacity: 0; transform: translateX(28px) } to { opacity: 1; transform: none } }
@keyframes tg-pop { from { opacity: 0; transform: translateX(-20px) } to { opacity: 1; transform: none } }
@keyframes tg-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
```

- [ ] **Step 4: Экраны и мост к Telegram `js/tg-app.js`**

Создать `js/tg-app.js`:

```js
/**
 * Мини-апп Telegram: экраны витрины, программы, заявки и демо-экрана.
 *
 * Чистая логика (startapp, проверка заявки, фильтр, цена) – в
 * js/tg-core.js (window.DpoTgCore); здесь только DOM и мост к Telegram
 * WebApp. Разметка строится через createElement и textContent: у страницы
 * CSP без 'unsafe-inline', и тексты каталога не проходят через innerHTML.
 *
 * Демо (spec 2026-09-13): заявка никуда не отправляется и не пишется в
 * хранилища браузера – данные живут только в памяти страницы.
 *
 * Вне Telegram (нет initData) те же экраны показывают свою шапку с
 * «назад» и свою кнопку внизу вместо нативных BackButton и MainButton.
 */
(function () {
  'use strict';

  var core = window.DpoTgCore;
  var data = JSON.parse(document.getElementById('tg-data').textContent);
  var tg = window.Telegram && window.Telegram.WebApp;
  var inTelegram = !!(tg && tg.initData);
  var BRAND_BG = '#FBF9F5';
  var ACCENT = '#1658DA';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var app = document.getElementById('app');
  var bar = document.querySelector('.bar');
  var barBack = document.querySelector('.bar-back');
  var mainWrap = document.querySelector('.main-btn');
  var mainButton = mainWrap.querySelector('button');

  var byId = {};
  data.programs.forEach(function (p) {
    byId[p.id] = p;
  });

  var unsafe = (inTelegram && tg.initDataUnsafe) || {};
  var rawStart = inTelegram ? unsafe.start_param : new URLSearchParams(window.location.search).get('startapp');
  var start = core.parseStartParam(rawStart, Object.keys(byId));
  var tgUser = unsafe.user || null;

  var state = {
    stack: [],
    sphere: 'all',
    query: '',
    listScroll: 0,
    programId: null,
    campaign: start.campaign,
    submitted: null,
    nameFromTelegram: !!(tgUser && tgUser.first_name),
    form: {
      firstName: (tgUser && tgUser.first_name) || '',
      lastName: (tgUser && tgUser.last_name) || '',
      phone: '',
      email: '',
      position: '',
      company: '',
      consent: false,
    },
  };
  var mainAction = null;

  /* ---------- DOM ---------- */

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false || c === '') return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function picture(src) {
    return src ? h('img', { src: src, alt: '', loading: 'lazy', decoding: 'async' }) : null;
  }

  function searchIcon() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    [['width', '16'], ['height', '16'], ['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'], ['aria-hidden', 'true']].forEach(function (a) {
      svg.setAttribute(a[0], a[1]);
    });
    var circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', '11');
    circle.setAttribute('cy', '11');
    circle.setAttribute('r', '7');
    var handle = document.createElementNS(SVG_NS, 'path');
    handle.setAttribute('d', 'm20 20-3.5-3.5');
    svg.appendChild(circle);
    svg.appendChild(handle);
    return svg;
  }

  /* ---------- Кнопки: нативные в Telegram, свои вне его ---------- */

  function setMain(label, action) {
    mainAction = label ? action : null;
    if (inTelegram) {
      if (label) tg.MainButton.setParams({ text: label, color: ACCENT, text_color: '#FFFFFF', is_active: true, is_visible: true });
      else tg.MainButton.hide();
      return;
    }
    mainWrap.hidden = !label;
    document.body.classList.toggle('has-main', !!label);
    mainButton.textContent = label || '';
  }

  function runMain() {
    if (mainAction) mainAction();
  }

  function setBack(visible) {
    if (inTelegram) {
      if (visible) tg.BackButton.show();
      else tg.BackButton.hide();
      return;
    }
    barBack.hidden = !visible;
  }

  function openExternal(url) {
    if (!url) return;
    if (inTelegram) tg.openLink(url);
    else window.open(url, '_blank', 'noopener');
  }

  function haptic(type) {
    if (inTelegram && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred(type);
  }

  /* ---------- Навигация ---------- */

  function current() {
    return state.stack[state.stack.length - 1];
  }

  function go(name) {
    if (current() === 'list') state.listScroll = window.scrollY;
    state.stack.push(name);
    show(name, 'forward');
  }

  function back() {
    if (state.stack.length < 2) return;
    state.stack.pop();
    show(current(), 'back');
  }

  function reset(name) {
    state.stack = [name];
    show(name, 'forward');
  }

  function show(name, direction) {
    if (name !== 'list' && !byId[state.programId]) {
      state.stack = ['list'];
      name = 'list';
    }
    var screen = SCREENS[name](direction);
    screen.classList.add('screen', 'in');
    if (direction === 'back') screen.classList.add('back');
    app.textContent = '';
    app.appendChild(screen);
    window.scrollTo(0, name === 'list' && direction === 'back' ? state.listScroll : 0);
    setBack(state.stack.length > 1);
  }

  /* ---------- Экран 1: витрина ---------- */

  function programCard(p, index) {
    var price = core.formatPrice(p.price);
    var card = h('button', { class: 'card', type: 'button', 'data-id': p.id }, [
      h('span', { class: 'cover' }, [
        picture(p.thumb),
        h('span', { class: 'tags' }, [p.badge && h('span', { class: 'tag', text: p.badge }), p.format && h('span', { class: 'tag', text: p.format })]),
      ]),
      h('span', { class: 'card-body' }, [
        h('span', { class: 'card-title', text: p.title }),
        h('span', { class: 'meta' }, [
          price ? h('span', { class: 'price' }, [price, p.oldPrice ? h('s', { text: core.formatPrice(p.oldPrice) }) : null]) : h('span'),
          p.startLabel ? h('span', { text: p.startLabel }) : null,
        ]),
      ]),
    ]);
    card.style.setProperty('--i', String(Math.min(index, 8)));
    return card;
  }

  function listScreen(direction) {
    var cards = h('div', { class: 'cards' });
    var chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Сферы' });
    var search = h('input', { type: 'search', placeholder: 'Название или тема', 'aria-label': 'Поиск программ', enterkeyhint: 'search' });
    search.value = state.query;

    [{ id: 'all', title: 'Все', count: data.programs.length }].concat(data.spheres).forEach(function (s) {
      chips.appendChild(
        h('button', { class: 'chip', type: 'button', 'data-sphere': s.id, 'aria-pressed': String(state.sphere === s.id) }, [
          s.title,
          h('small', { text: String(s.count) }),
        ])
      );
    });

    function fill(cascade) {
      var items = core.filterPrograms(data.programs, state.sphere, state.query);
      cards.classList.toggle('cascade', cascade);
      cards.textContent = '';
      if (!items.length) {
        cards.appendChild(h('p', { class: 'empty', text: 'Ничего не нашлось. Попробуйте другое слово или сферу.' }));
        return;
      }
      items.forEach(function (p, i) {
        cards.appendChild(programCard(p, i));
      });
    }

    chips.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      state.sphere = chip.getAttribute('data-sphere');
      Array.prototype.forEach.call(chips.children, function (c) {
        c.setAttribute('aria-pressed', String(c === chip));
      });
      fill(false);
    });
    search.addEventListener('input', function () {
      state.query = search.value;
      fill(false);
    });
    cards.addEventListener('click', function (e) {
      var card = e.target.closest('.card');
      if (!card) return;
      state.programId = card.getAttribute('data-id');
      go('program');
    });

    // Каскад – только при входе вперёд (открытие, «Вернуться к программам»);
    // при возврате «назад» список восстанавливает прокрутку и не мигает.
    fill(direction !== 'back');
    setMain(null);
    return h('section', { 'aria-label': 'Программы' }, [
      h('p', { class: 'eyebrow', text: 'Факультет права НИУ ВШЭ' }),
      h('h1', { class: 'h1', text: 'Программы Центра ДПО' }),
      h('label', { class: 'search' }, [searchIcon(), search]),
      chips,
      cards,
    ]);
  }

  /* ---------- Экран 2: программа ---------- */

  function bullets(title, items) {
    if (!items || !items.length) return null;
    return h('div', null, [
      h('h2', { class: 'h2', text: title }),
      h('ul', { class: 'bul' }, items.map(function (x) {
        return h('li', { text: x });
      })),
    ]);
  }

  function programScreen() {
    var p = byId[state.programId];
    var price = core.formatPrice(p.price);
    var facts = [
      ['Старт', p.startLabel ? p.startLabel.replace(/^Старт:\s*/, '') : null],
      ['Формат', p.format],
      ['Длительность', p.duration || p.hours],
      ['Документ', p.doc],
    ].filter(function (f) {
      return f[1];
    });

    setMain(price ? 'Подать заявку · ' + price : 'Подать заявку', function () {
      go('form');
    });

    return h('article', { 'aria-label': p.title }, [
      h('div', { class: 'hero' }, [picture(p.cover)]),
      h('div', { class: 'badges' }, [p.badge && h('span', { class: 'badge', text: p.badge }), p.format && h('span', { class: 'badge', text: p.format })]),
      h('h1', { class: 'h1 h1--sm', text: p.title }),
      p.tagline ? h('p', { class: 'lead', text: p.tagline }) : null,
      facts.length
        ? h('dl', { class: 'facts' }, facts.map(function (f) {
            return h('div', { class: 'fact' }, [h('dt', { text: f[0] }), h('dd', { text: f[1] })]);
          }))
        : null,
      bullets('Для кого', p.audience),
      bullets('Чему научитесь', p.results),
      p.modules.length ? h('h2', { class: 'h2', text: 'Программа' }) : null,
      p.modules.length
        ? h('ul', { class: 'mods' }, p.modules.map(function (m) {
            return h('li', null, [m.title, m.hours ? h('span', { text: m.hours }) : null]);
          }))
        : null,
    ]);
  }

  /* ---------- Экран 3: заявка ---------- */

  var FORM_FIELDS = [
    ['firstName', 'Имя', 'given-name', 'text'],
    ['lastName', 'Фамилия', 'family-name', 'text'],
    ['phone', 'Телефон', 'tel', 'tel'],
    ['email', 'E-mail', 'email', 'email'],
    ['position', 'Должность, если хотите', 'organization-title', 'text'],
    ['company', 'Место работы, если хотите', 'organization', 'text'],
  ];

  function formScreen() {
    var p = byId[state.programId];
    var f = state.form;
    var inputs = {};
    var errs = {};

    function clearError(name) {
      errs[name].hidden = true;
      errs[name].textContent = '';
      inputs[name].removeAttribute('aria-invalid');
    }

    var rows = FORM_FIELDS.map(function (d) {
      var name = d[0];
      var input = h('input', {
        name: name,
        type: d[3],
        autocomplete: d[2],
        inputmode: d[3] === 'tel' ? 'tel' : null,
        maxlength: String(core.LIMITS[name]),
        'aria-describedby': 'err-' + name,
      });
      input.value = f[name];
      input.addEventListener('input', function () {
        f[name] = input.value;
        clearError(name);
      });
      inputs[name] = input;
      errs[name] = h('span', { class: 'field-err', id: 'err-' + name, hidden: true });
      var hint = name === 'firstName' && state.nameFromTelegram ? h('span', { class: 'field-hint', text: ' · из профиля Telegram' }) : null;
      return h('label', { class: 'field' }, [h('span', { class: 'field-label' }, [d[1], hint]), input, errs[name]]);
    });

    var consent = h('input', { type: 'checkbox', name: 'consent', 'aria-describedby': 'err-consent' });
    consent.checked = f.consent;
    consent.addEventListener('change', function () {
      f.consent = consent.checked;
      clearError('consent');
    });
    inputs.consent = consent;
    errs.consent = h('span', { class: 'field-err', id: 'err-consent', hidden: true });

    var policy = h('a', { href: '../privacy.html', target: '_blank', rel: 'noopener', text: 'Политикой обработки персональных данных' });
    policy.addEventListener('click', function (e) {
      if (!inTelegram) return;
      e.preventDefault();
      tg.openLink(policy.href);
    });

    function submit() {
      Object.keys(errs).forEach(clearError);
      var result = core.validateApplication(f);
      if (!result.ok) {
        result.errors.forEach(function (e) {
          errs[e.field].textContent = e.message;
          errs[e.field].hidden = false;
          inputs[e.field].setAttribute('aria-invalid', 'true');
        });
        inputs[result.errors[0].field].focus();
        haptic('error');
        return;
      }
      state.submitted = result.values;
      haptic('success');
      go('demo');
    }

    var form = h('form', { novalidate: true, 'aria-label': 'Данные для заявки' }, rows.concat([
      h('label', { class: 'check' }, [
        consent,
        h('span', null, ['Я подтверждаю, что ознакомился с ', policy, ', и даю согласие на обработку моих персональных данных для рассмотрения заявки.']),
      ]),
      errs.consent,
    ]));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });

    setMain('Отправить заявку', submit);
    var price = core.formatPrice(p.price);
    return h('section', { 'aria-label': 'Заявка' }, [
      h('h1', { class: 'h1 h1--sm', text: 'Заявка' }),
      h('div', { class: 'mini' }, [
        h('span', { class: 'mini-img' }, [picture(p.thumb)]),
        h('span', null, [h('b', { text: p.title }), h('small', { text: [price, p.startLabel].filter(Boolean).join(' · ') })]),
      ]),
      form,
    ]);
  }

  /* ---------- Экран 4: после отправки (демо) ---------- */

  function demoScreen() {
    var p = byId[state.programId];
    var v = state.submitted;
    if (!v) {
      state.stack.pop();
      return formScreen();
    }
    var rows = [['Программа', p.title], ['Имя', v.firstName + ' ' + v.lastName], ['Телефон', v.phone], ['E-mail', v.email]];
    if (v.position) rows.push(['Должность', v.position]);
    if (v.company) rows.push(['Место работы', v.company]);
    if (state.campaign) rows.push(['Метка', state.campaign]);
    rows.push(['Откуда', inTelegram ? 'Telegram, мини-приложение' : 'Мини-приложение в браузере']);

    setMain(p.pay ? 'Перейти к оплате на hse.ru' : null, function () {
      openExternal(p.pay);
    });

    var again = h('button', { class: 'ghost', type: 'button', text: 'Вернуться к программам' });
    again.addEventListener('click', function () {
      state.listScroll = 0;
      reset('list');
    });

    return h('section', { 'aria-label': 'Заявка готова' }, [
      h('h1', { class: 'h1 h1--sm', text: 'Заявка готова' }),
      h('div', { class: 'plaque', role: 'status' }, [
        h('b', { text: 'Демо: заявка не отправлена' }),
        h('p', { text: 'В рабочей версии эти данные уйдут в учебный офис Центра ДПО, и менеджер свяжется с вами. Сейчас они не покидают телефон.' }),
      ]),
      h('dl', { class: 'summary' }, rows.map(function (r) {
        return h('div', null, [h('dt', { text: r[0] }), h('dd', { text: r[1] })]);
      })),
      again,
    ]);
  }

  var SCREENS = { list: listScreen, program: programScreen, form: formScreen, demo: demoScreen };

  /* ---------- Запуск ---------- */

  if (inTelegram) {
    tg.ready();
    tg.expand();
    if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) {
      tg.setHeaderColor(BRAND_BG);
      tg.setBackgroundColor(BRAND_BG);
    }
    tg.MainButton.onClick(runMain);
    tg.BackButton.onClick(back);
  } else {
    bar.hidden = false;
    mainButton.addEventListener('click', runMain);
    barBack.addEventListener('click', back);
  }

  if (start.programId) {
    state.programId = start.programId;
    state.stack = ['list'];
    go('program');
  } else {
    reset('list');
  }
})();
```

- [ ] **Step 5: Разметка и сборка в `scripts/build-tg-app.js`**

В `scripts/build-tg-app.js`:

1) после `const { buildPayUrl } = require('./build-program-pages');` добавить:

```js
const { scriptTag } = require('../lib/sri');
```

2) после `const EN_DASH = String.fromCharCode(0x2013);` добавить (обратный слеш собирается кодом, а не пишется литералом – см. ловушку в Global Constraints):

```js
// «<» в JSON уходит в escape-последовательность с кодом 003C: для HTML-парсера это не тег, для JSON.parse тот
// же символ. Иначе «</script» из названия закрыл бы блок данных (аудит 13.09.2026).
const LT_ESCAPED = String.fromCharCode(92) + 'u003C';

const CSP = [
  "default-src 'none'",
  "script-src 'self' https://telegram.org",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');
```

3) заменить строку `module.exports = { FIELDS, buildData };` на:

```js
function renderPage(data) {
  const json = JSON.stringify(data).split('<').join(LT_ESCAPED);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#FBF9F5">
<title>Программы Центра ДПО · мини-приложение</title>
<link rel="icon" type="image/png" sizes="32x32" href="../images/logo/favicon-32.png">
<link rel="stylesheet" href="../fonts/fonts-hse.css">
<link rel="stylesheet" href="tg-app.css">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
</head>
<body>
<header class="bar" hidden>
  <button class="bar-back" type="button" hidden>‹ Назад</button>
  <span class="bar-title">Центр ДПО</span>
</header>
<main id="app"></main>
<div class="main-btn" hidden><button type="button"></button></div>
<noscript><p class="noscript">Для витрины программ нужен JavaScript.</p></noscript>
<script type="application/json" id="tg-data">${json}</script>
${scriptTag('js/tg-core.js', { prefix: '../' })}
${scriptTag('js/tg-app.js', { prefix: '../' })}
</body>
</html>
`;
}

function build() {
  if (!fs.existsSync(STORE)) {
    console.error('Нет .catalog-data.json – сначала запустите node update-catalog.js');
    process.exit(1);
  }
  const data = buildData(JSON.parse(fs.readFileSync(STORE, 'utf8')));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, renderPage(data), 'utf8');
  console.log(`tg/index.html: ${data.programs.length} программ, ${(fs.statSync(OUT).size / 1024).toFixed(0)} КБ`);
}

if (require.main === module) build();

module.exports = { FIELDS, buildData, renderPage, build };
```

Проверить ловушку: `grep -n "fromCharCode(92)" scripts/build-tg-app.js` – строка на месте; `grep -c 'u003C' scripts/build-tg-app.js` – ровно 1 (строка `LT_ESCAPED`).

- [ ] **Step 6: Собрать страницу и прогнать тесты**

Run: `node scripts/build-tg-app.js && node --test tests/unit/tg-app-build.test.js tests/unit/tg-core.test.js`
Expected: `tg/index.html: 27 программ, … КБ`; `ℹ fail 0` (8 тестов в `tg-app-build`, 6 в `tg-core`).

Проверить типографику сгенерированного файла: `perl -CSD -ne 'print "EMDASH $.\n" if /\x{2014}/' tg/index.html tg/tg-app.css js/tg-app.js js/tg-core.js` – пусто.

- [ ] **Step 7: Проверить в браузере (Playwright, ширина телефона)**

`tg/` ещё не в белом списке превью-сервера (Task 4), поэтому раздать корень репозитория простым статическим сервером:

```bash
# сервер – в фоне (Bash с run_in_background или nohup), остановить в конце шага
nohup python3 -m http.server 5190 --bind 127.0.0.1 --directory ~/dpo-pravo-hse >/dev/null 2>&1 &
playwright-cli -s=tg open "http://127.0.0.1:5190/tg/"
playwright-cli -s=tg resize 360 740
playwright-cli -s=tg console
```
Expected: `Total messages: 0 (Errors: 0, Warnings: 0)`. Витрина: заголовок «Программы Центра ДПО», 7 чипов, 27 карточек.

Путь по экранам (каждую команду `eval` проверять по результату):

```bash
playwright-cli -s=tg eval "() => document.querySelectorAll('.card').length"            # 27
playwright-cli -s=tg eval "() => { document.querySelector('[data-sphere=language]').click(); return document.querySelectorAll('.card').length }"   # 3
playwright-cli -s=tg eval "() => document.querySelector('.cards').classList.contains('cascade')"   # false
playwright-cli -s=tg eval "() => { document.querySelector('.card').click(); return [document.querySelector('h1').textContent, document.querySelector('.main-btn button').textContent, document.querySelector('.bar-back').hidden] }"
# [название программы, «Подать заявку · …», false]
playwright-cli -s=tg eval "() => { document.querySelector('.main-btn button').click(); document.querySelector('.main-btn button').click(); return [...document.querySelectorAll('.field-err:not([hidden])')].map(e => e.textContent) }"
# ['Укажите имя.', 'Укажите фамилию.', 'Укажите телефон.', 'Укажите электронную почту.', 'Без согласия на обработку персональных данных заявку принять нельзя.']
playwright-cli -s=tg eval "() => { const set = (n, v) => { const i = document.querySelector('input[name=' + n + ']'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }; set('firstName', 'Анна'); set('lastName', 'Соколова'); set('phone', '+7 916 555-12-34'); set('email', 'a.sokolova@example.ru'); const c = document.querySelector('input[name=consent]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); return document.querySelectorAll('.field-err:not([hidden])').length }"   # 0
playwright-cli -s=tg eval "() => { document.querySelector('.main-btn button').click(); return [document.querySelector('.plaque b').textContent, document.querySelector('.main-btn button').textContent] }"
# ['Демо: заявка не отправлена', 'Перейти к оплате на hse.ru']
playwright-cli -s=tg eval "() => [localStorage.length, sessionStorage.length, document.cookie]"   # [0, 0, '']
playwright-cli -s=tg eval "() => { document.querySelector('.bar-back').click(); return document.querySelector('input[name=phone]').value }"   # '+7 916 555-12-34'
playwright-cli -s=tg goto "http://127.0.0.1:5190/tg/?startapp=p_494685723-c_yuriy2"
playwright-cli -s=tg eval "() => [document.querySelector('h1').textContent, document.querySelector('.bar-back').hidden]"   # ['Бизнес-медиация', false]
playwright-cli -s=tg console   # Errors: 0
playwright-cli -s=tg screenshot --filename=tg-list.png
playwright-cli -s=tg close
pkill -f 'http.server 5190'
```

Скриншот открыть (Read) и сверить с обликом А из спецификации: кремовый фон, слэб-серифные заголовки, тёмный активный чип, синие кнопки, без теней.

Если браузер пишет ошибку CSP – найти по тексту, какой ресурс заблокирован, и убрать источник (инлайн-стиль, инлайн-обработчик), а не ослаблять CSP.

- [ ] **Step 8: Полный прогон и commit**

Run: `node --test --test-timeout=180000 tests/unit/*.test.js`
Expected: `ℹ fail 0`.

```bash
git add scripts/build-tg-app.js tests/unit/tg-app-build.test.js tg/tg-app.css tg/index.html js/tg-app.js
git commit -m "feat(tg): mini app page – storefront, program, application and demo screens with Telegram bridge"
```

---

### Task 4: Выкладка и документация

**Files:**
- Modify: `lib/static-http.js:65` (`PAGE_DIRS`)
- Modify: `docker/nginx.conf` (после блока `location ~ "^/programs/[^/]+\.(html|css)$"`, строки 122–128)
- Modify: `tests/unit/build-public.test.js`
- Modify: `package.json` (`scripts`)
- Modify: `DESIGN.md` (раздел `## Components`, после подраздела «Маскот «Ворона Шерлок» (только лендинг)»)
- Modify: `README.md` (после раздела «Заявки на программы»)

**Interfaces:**
- Consumes: `build()` из `scripts/build-tg-app.js` (Task 3); `syncIntegrity()` в `scripts/build-public.js` уже обходит все `PAGE_DIRS`.
- Produces: `tg/index.html` и `tg/tg-app.css` в `.public/`; `npm run build-tg`.

- [ ] **Step 1: Написать падающий тест выкладки**

В `tests/unit/build-public.test.js`:

1) в массив первого теста `'в выкладке есть всё, ради чего она существует'` после `'content/programs-index.json',` добавить:

```js
    'tg/index.html',
    'tg/tg-app.css',
```

2) в последнем тесте (`'integrity каждого скрипта совпадает с файлом, который уезжает на витрину'`) заменить построение `pages`:

```js
  const pages = fs.readdirSync(OUT).filter((f) => f.endsWith('.html'))
    .concat(fs.readdirSync(path.join(OUT, 'programs')).filter((f) => f.endsWith('.html')).map((f) => path.join('programs', f)));
```

на:

```js
  const pages = fs.readdirSync(OUT).filter((f) => f.endsWith('.html'));
  for (const dir of ['programs', 'tg']) {
    pages.push(...fs.readdirSync(path.join(OUT, dir)).filter((f) => f.endsWith('.html')).map((f) => path.join(dir, f)));
  }
```

Run: `node --test tests/unit/build-public.test.js`
Expected: FAIL – `в публичной выкладке нет tg/index.html`.

- [ ] **Step 2: Белый список, nginx и скрипты npm**

`lib/static-http.js`, строка 65:

```js
const PAGE_DIRS = new Set(['programs', 'tg']);
```

Над этой строкой в комментарии к `PAGE_DIRS` дописать строку: ` * tg/ – мини-приложение Telegram (scripts/build-tg-app.js).`

`docker/nginx.conf` – сразу после закрывающей `}` блока `location ~ "^/programs/[^/]+\.(html|css)$"` добавить (своего `add_header` внутри нет, общие заголовки наследуются):

```nginx

    # tg/ – мини-приложение Telegram (scripts/build-tg-app.js), тот же узкий
    # проход, что у programs/. ВНИМАНИЕ для второго этапа: общие заголовки
    # X-Frame-Options DENY и frame-ancestors 'none' не дадут открыть мини-апп
    # в Telegram Web и Desktop – там он живёт во фрейме web.telegram.org.
    # Демо на GitHub Pages этих заголовков не получает.
    location ~ "^/tg/[^/]+\.(html|css)$" {
        try_files $uri =404;
    }
```

`package.json`, в `scripts`:
- добавить после `"build-programs": …,` строку `"build-tg": "node scripts/build-tg-app.js",`
- в `"update-catalog"` и `"update-details"` дописать в конец команды ` && node scripts/build-tg-app.js` – иначе после обновления каталога мини-апп покажет старые цены и даты.

Run: `node --test tests/unit/build-public.test.js`
Expected: `ℹ fail 0`.

Run: `node -e "const {isAllowedStatic,resolveSafe}=require('./lib/static-http');console.log(isAllowedStatic(resolveSafe('/tg/index.html',process.cwd())), isAllowedStatic(resolveSafe('/tg/x/y.html',process.cwd())), isAllowedStatic(resolveSafe('/tg/a.js',process.cwd())))"`
Expected: `true false false`. Если имена функций другие – взять их из `module.exports` в `lib/static-http.js` (там же, где `PAGE_DIRS`).

- [ ] **Step 3: `DESIGN.md` – раздел мини-аппа**

В `DESIGN.md` после подраздела `### Маскот «Ворона Шерлок» (только лендинг)` (перед `## Motion`) вставить:

```markdown
### Мини-апп Telegram (`tg/`)

Решение владельца 13.09.2026 по живому макету из трёх направлений: **А – облик сайта целиком** в любой теме Telegram. Тёмная тема пользователя на мини-апп не влияет: шапку и фон листа страница красит в `#FBF9F5` (`setHeaderColor`, `setBackgroundColor`). Отвергнуты «Б – тема Telegram с акцентами ДПО» и «В – ночная версия витрины в тёмной теме».

- Токены – те же, что в `programs/program.css`; новых цветов нет. Пустая обложка – `#0B2A69`, ошибка поля – `status-error`.
- Заголовки HSE Slab, текст HSE Sans; скругления карточек 14px, кнопок 12px; без теней в покое; чипы сфер на пергаменте, активный чип – тёмный.
- Главная кнопка и «назад» внутри Telegram нативные (`MainButton` цветом `#1658DA`, `BackButton`); вне Telegram страница рисует свои.
- Движение – с анимацией (решение владельца): экран вперёд `translateX(28px)` + прозрачность 340 мс, назад с `-20px`; каскад карточек 420 мс с шагом 45 мс, не больше 8 ступеней, только при входе на витрину вперёд; нажатие `scale(.985)` у карточки и `scale(.97)` у кнопок и чипов, 120 мс; плашка демо-экрана поднимается с задержкой 80 мс. Кривая `cubic-bezier(.22,1,.36,1)`. `prefers-reduced-motion: reduce` отключает всё.
```

- [ ] **Step 4: `README.md` – сборка, ссылки, бот**

В `README.md` после раздела «Заявки на программы» (перед следующим заголовком того же уровня) вставить раздел того же уровня, что «Заявки на программы»:

```markdown
## Мини-приложение Telegram

Витрина программ, карточка и заявка внутри Telegram: `tg/index.html`, собирается `npm run build-tg` (и автоматически в `update-catalog` / `update-details`). Устройство – `docs/superpowers/specs/2026-09-13-tg-mini-app-design.md`.

**Сейчас это демо.** Заявка не отправляется: после проверки полей показывается экран «Демо: заявка не отправлена» и кнопка оплаты в корзину hse.ru. Данные не уходят в сеть и не сохраняются в браузере.

**Адрес для бота:** `https://itspecr.github.io/dpo-pravo-hse/tg/` (выкладывается вместе с витриной, `npm run publish-mirror`).

**Подключение бота (делает владелец):** `@BotFather` → `/newbot` → Bot Settings → Configure Mini App → Main App → адрес выше. Токен бота для демо не нужен.

**Ссылки для рассылок:** `t.me/<бот>?startapp=<параметр>`, части через `-`:

| Параметр | Что откроется |
|---|---|
| `p_494685723` | сразу программа с этим id |
| `c_yuriy2` | витрина, в заявке будет метка `yuriy2` |
| `p_494685723-c_yuriy2` | программа и метка |

Допустимы латиница, цифры и `_`, до 512 символов; неизвестное молча игнорируется. Вне Telegram то же самое проверяется адресом `…/tg/?startapp=p_494685723-c_yuriy2`.

**Второй этап (не сделан):** приём заявки в `intake-server.js` с проверкой подписи `initData` токеном бота, уведомление менеджерам, боевой HTTPS-адрес. Для него в nginx придётся разрешить фрейм с `web.telegram.org` на `/tg/` – сейчас общие заголовки это запрещают (комментарий в `docker/nginx.conf`).
```

Проверить типографику: `perl -CSD -ne 'print "EMDASH $ARGV:$.\n" if /\x{2014}/' README.md DESIGN.md docker/nginx.conf lib/static-http.js` – новых вхождений нет (если старые строки файла уже содержат U+2014, не трогать их – правка хирургическая).

- [ ] **Step 5: Собрать выкладку и проверить в браузере**

Run: `node --test --test-timeout=180000 tests/unit/*.test.js`
Expected: `ℹ fail 0`.

Run: `node scripts/build-public.js`
Expected: в отчёте `страницы программ: 30` (28 + `tg/index.html` + `tg/tg-app.css`), `хеши integrity пересчитаны: 245` (243 + 2), пререндер лендинга без ошибок.

Проверить сжатую выкладку в браузере – в ней скрипты минифицированы, а integrity пересчитан:

```bash
nohup python3 -m http.server 5191 --bind 127.0.0.1 --directory ~/dpo-pravo-hse/.public >/dev/null 2>&1 &
playwright-cli -s=pub open "http://127.0.0.1:5191/tg/?startapp=p_494685723-c_yuriy2"
playwright-cli -s=pub console     # Errors: 0
playwright-cli -s=pub eval "() => [document.querySelector('h1').textContent, typeof window.DpoTgCore]"   # ['Бизнес-медиация', 'object']
playwright-cli -s=pub close
pkill -f 'http.server 5191'
```

- [ ] **Step 6: Commit**

```bash
git add lib/static-http.js docker/nginx.conf tests/unit/build-public.test.js package.json DESIGN.md README.md
git commit -m "feat(tg): publish the mini app with the showcase and document bot setup and start links"
```

---

### Task 5: Выкладка на зеркало (только со слова владельца)

**Files:** нет изменений в коде.

- [ ] **Step 1: Спросить владельца**

Показать итог: коммиты Task 1–4, число тестов, скриншот `tg-list.png`. Спросить разрешение на `git push origin main`, `git push mirror main` и `npm run publish-mirror`. Без явного «да» – остановиться.

- [ ] **Step 2: Отправить и выложить**

```bash
git switch main && git merge --ff-only feat/tg-mini-app && node scripts/build-tg-app.js && git status --short
```
Пересборка обновляет метки старта; если `tg/index.html` изменился, закоммитить его отдельно: `chore(tg): rebuild mini app page before publishing`.

```bash
git push -q origin main && git push -q mirror main
npm run publish-mirror
```
Expected: `Выложено в https://github.com/itspecR/dpo-pravo-hse.git -> ветка gh-pages.`

Дождаться сборки Pages:

```bash
for i in $(seq 1 30); do s=$(gh api repos/itspecR/dpo-pravo-hse/pages/builds/latest --jq '.status'); echo "$s"; [ "$s" = built ] && break; sleep 10; done
```

- [ ] **Step 3: Проверить живое зеркало**

```bash
playwright-cli -s=live open "https://itspecr.github.io/dpo-pravo-hse/tg/?startapp=p_494685723-c_yuriy2&v=1"
playwright-cli -s=live resize 360 740
playwright-cli -s=live console     # Errors: 0
playwright-cli -s=live eval "() => [document.querySelector('h1').textContent, document.querySelectorAll('script[integrity]').length]"   # ['Бизнес-медиация', 2]
playwright-cli -s=live goto "https://itspecr.github.io/dpo-pravo-hse/tg/?v=1"
playwright-cli -s=live eval "() => document.querySelectorAll('.card').length"   # 27
playwright-cli -s=live close
```

- [ ] **Step 4: Передать владельцу шаги BotFather**

Сообщить адрес `https://itspecr.github.io/dpo-pravo-hse/tg/`, три шага из README («Подключение бота») и попросить прислать username бота – не токен. После ответа собрать владельцу готовые ссылки `t.me/<бот>?startapp=…` на 2–3 программы и проверку на телефоне делает владелец.
