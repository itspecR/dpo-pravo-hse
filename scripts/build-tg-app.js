#!/usr/bin/env node
/**
 * Мини-апп Telegram: собирает tg/index.html из .catalog-data.json.
 *
 *   node scripts/build-tg-app.js
 *
 * Страница самодостаточна: каталог встроен блоком JSON, наружу уходят
 * только поля экранов (docs/superpowers/specs/2026-09-13-tg-mini-app-design.md,
 * раздел 3.2). С 14.09.2026 карточка показывает всё, что есть на странице
 * программы (решение владельца): преподаватели, план с подтемами, файлы,
 * отзывы, вопросы. Служебные поля каталога на страницу не попадают.
 * Руками tg/index.html не править – перезапишется.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { SPHERES, sphereOf } = require('../lib/program-spheres');
const { docBadge, shortFormat } = require('../lib/program-labels');
const { upcomingStartLabel } = require('../lib/hse-catalog');
const { isNoticeFresh } = require('../lib/catalog-store');
const { buildPayUrl } = require('./build-program-pages');
const { scriptTag } = require('../lib/sri');

const ROOT = path.resolve(__dirname, '..');
const STORE = path.join(ROOT, '.catalog-data.json');
const OUT = path.join(ROOT, 'tg', 'index.html');

/** Та же строгая маска локальных обложек, что в lib/catalog-store.js. */
const IMAGE_PATH_RE = /^images\/programs\/[a-z0-9_.-]+$/i;
/** Маски фото и страниц преподавателей – как в lib/catalog-store.js. */
const TEACHER_PHOTO_RE = /^images\/teachers\/[a-z0-9_.-]+$/i;
const TEACHER_PAGE_RE = /^https:\/\/([a-z0-9-]+\.)*hse\.ru(\/|$)/i;
/** Наши копии PDF программы (files/<id>-plan.pdf), как на страницах программ. */
const FILE_PATH_RE = /^files\/[a-z0-9_.-]+\.pdf$/i;
const FILE_LABELS = Object.freeze({ plan: 'Учебный план', schedule: 'Расписание занятий' });
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
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

const FIELDS = Object.freeze([
  'id', 'title', 'sphere', 'badge', 'doc', 'format', 'duration', 'hours', 'startLabel',
  'price', 'oldPrice', 'tagline', 'audience', 'results', 'modules', 'cover', 'thumb', 'pay',
  'about', 'audienceIntro', 'advantages', 'language', 'schedule', 'priceTerms', 'notice',
  'files', 'teachers', 'feedback', 'admissionDocs', 'faq',
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

/** Разрешает миниатюру из папки thumbs/ по id программы. */
function resolveThumb(id) {
  // Защита от трюков с путями: только буквы, цифры, дефис, подчеркивание.
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const thumbRel = `images/programs/thumbs/${id}.jpg`;
  return fs.existsSync(path.join(ROOT, thumbRel)) ? '../' + thumbRel : null;
}

function existing(rel, re) {
  return rel && re.test(rel) && fs.existsSync(path.join(ROOT, rel)) ? '../' + rel : null;
}

const texts = (list) => (Array.isArray(list) ? list.filter((x) => typeof x === 'string' && x.trim()) : []);

/** Свежее объявление «Важно» (та же проверка, что на страницах программ); ссылка – только https. */
function noticeOf(notice, now) {
  if (!isNoticeFresh(notice, now.getTime())) return null;
  const url = typeof notice.url === 'string' && /^https:\/\//i.test(notice.url) ? notice.url : null;
  return { date: notice.date || null, text: notice.text, url };
}

function teachersOf(p, photos, pages) {
  return (p.teachers || []).filter((t) => t && t.name).map((t) => ({
    name: t.name,
    about: t.about || '',
    photo: existing(photos[t.name], TEACHER_PHOTO_RE),
    page: typeof pages[t.name] === 'string' && TEACHER_PAGE_RE.test(pages[t.name]) ? pages[t.name] : null,
  }));
}

function filesOf(p) {
  return (p.files || [])
    .map((f) => ({ f, path: f && existing(f.path, FILE_PATH_RE) }))
    .filter((x) => x.path)
    .map(({ f, path: rel }) => ({ title: FILE_LABELS[f.kind] || f.title || 'Документ', size: f.size || '', path: rel }));
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

function programOf(p, now, photos, pages) {
  const id = String(p.id);
  const badge = docBadge(p.type);
  const sphere = sphereOf(p);
  // Та же цена, что на лендинге (priceOf в scripts/build-landing.js).
  const price = p.discountPrice != null ? p.discountPrice : p.educationPricing;
  const cover = localImage(p.image);
  const thumb = resolveThumb(id) || cover;
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
    audience: texts(p.audience && p.audience.items),
    results: texts(p.results),
    modules: (p.modules || []).map((m) => ({ title: m.title || '', hours: m.hours || '', topics: texts(m.topics) })),
    cover,
    thumb,
    pay: /^\d+$/.test(id) ? buildPayUrl(id) : null,
    about: p.about || '',
    audienceIntro: (p.audience && p.audience.intro) || null,
    advantages: texts(p.advantages),
    language: p.language || null,
    schedule: p.schedule || null,
    priceTerms: (p.taxRefund ? [`${p.taxRefund} можно вернуть налоговым вычетом`] : []).concat(texts(p.discounts)),
    notice: noticeOf(p.notice, now),
    files: filesOf(p),
    teachers: teachersOf(p, photos, pages),
    feedback: (p.feedback || []).filter((f) => f && f.text).map((f) => ({ text: f.text, author: f.author || '' })),
    admissionDocs: texts(p.admissionDocs),
    faq: (p.faq || []).filter((x) => x && x.q && x.a).map((x) => ({ q: x.q, a: x.a })),
  };
}

function buildData(catalog, { now = new Date() } = {}) {
  const list = Array.isArray(catalog) ? catalog : (catalog && catalog.programs) || [];
  const photos = (catalog && catalog.teacherPhotos) || {};
  const pages = (catalog && catalog.teacherPages) || {};
  const programs = list.map((p) => programOf(p, now, photos, pages));
  const spheres = SPHERES.map((s) => ({
    id: s.id,
    title: SPHERE_CHIPS[s.id] || s.title,
    count: programs.filter((p) => p.sphere === s.id).length,
  })).filter((s) => s.count > 0);
  return typography({ programs, spheres });
}

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
