'use strict';

/**
 * Dockerfile делает COPY . ., поэтому единственный фильтр между рабочим
 * каталогом и слоем образа – .dockerignore. Закрытые пути создаёт работа
 * приложения (.admin-password.txt, .data/), backup (backups/) и оператор
 * (certs/, .env), и любой из них, забытый здесь, уезжает в образ (аудит
 * 13.09.2026, находка 1). Живую сборку проверяет tests/docker_context_test.py;
 * этот сторож работает без Docker и ловит пропажу строки.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const lines = fs
  .readFileSync(path.join(ROOT, '.dockerignore'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

test('закрытые файлы и каталоги исключены из контекста сборки', () => {
  const required = [
    '.admin-credentials.json',
    '.admin-password.txt',
    'АДМИН-ПАРОЛЬ.txt',
    '.admin-status.json',
    '.analytics',
    '.applications',
    '.data',
    'backups',
    'certs',
    '.env',
    '.env.*',
    '**/*.pem',
    '**/*.key',
    '.playwright-cli',
  ];
  for (const entry of required) {
    assert.ok(lines.includes(entry), `.dockerignore не содержит «${entry}»`);
  }
});

test('всё, что .gitignore прячет как секреты и ПДн, прячет и .dockerignore', () => {
  // Раздел .gitignore до первого пустого блока про лендинг: секреты,
  // состояние админки, заявки, .data, backups. Каталоги там с «/», в
  // .dockerignore – без.
  const git = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  const secretSection = git.slice(0, git.indexOf('# .catalog-data.json'));
  const entries = secretSection
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/\/$/, ''));
  assert.ok(entries.length >= 10, 'раздел секретов .gitignore не найден');
  for (const entry of entries) {
    assert.ok(lines.includes(entry), `.gitignore скрывает «${entry}», а .dockerignore – нет`);
  }
});
