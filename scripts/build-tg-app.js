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

/** Разрешает миниатюру из папки thumbs/ по id программы. */
function resolveThumb(id) {
  // Защита от трюков с путями: только буквы, цифры, дефис, подчеркивание.
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const thumbRel = `images/programs/thumbs/${id}.jpg`;
  return fs.existsSync(path.join(ROOT, thumbRel)) ? '../' + thumbRel : null;
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
    audience: ((p.audience && p.audience.items) || []).slice(0, 5),
    results: (p.results || []).slice(0, 5),
    modules: (p.modules || []).map((m) => ({ title: m.title || '', hours: m.hours || '' })),
    cover,
    thumb,
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
