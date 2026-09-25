'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const { BRANCHES, branchesFor } = require('../../js/program-branches');
const programs = require('../../.catalog-data.json').programs;
const catalog = fs.readFileSync(path.join(ROOT, 'Каталог программ.html'), 'utf8');

test('каждая область права в опросе ведёт хотя бы к одной программе', () => {
  for (const branch of BRANCHES) {
    assert.ok(programs.some((program) => branchesFor(program).includes(branch)), branch.title);
  }
});

test('поисковый индекс каталога знает области программ', () => {
  const lines = catalog.split('\n').filter((line) => line.includes('<div class="card" data-type='));
  assert.equal(lines.length, programs.length);
  for (const program of programs) {
    const line = lines.find((item) => item.includes(`data-id="${program.id}"`));
    assert.ok(line, `Карточка ${program.id} не найдена`);
    const search = /data-search="([^"]*)"/.exec(line)?.[1] || '';
    for (const branch of branchesFor(program)) {
      assert.ok(search.includes(branch.title.toLowerCase()), `${program.title}: ${branch.title}`);
    }
  }
});
