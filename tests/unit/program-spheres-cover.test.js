'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sphereOf, groupBySphere } = require('../../lib/program-spheres');

const ROOT = path.resolve(__dirname, '..', '..');
const store = JSON.parse(fs.readFileSync(path.join(ROOT, '.catalog-data.json'), 'utf8'));
const programs = store.programs || [];

// Вне сфер намеренно, по решению владельца 24.09.2026: программа для
// абитуриентов и учителей, ни в одну сферу не подходит.
const OUTSIDE_SPHERES = ['Право и обществознание'];

test('у каждой программы каталога есть сфера', () => {
  assert.ok(programs.length > 0);
  const { unassigned } = groupBySphere(programs);
  assert.deepEqual(
    unassigned.map((p) => p.title).filter((t) => !OUTSIDE_SPHERES.includes(t)),
    [],
    'программы без сферы снова выпали из панели «Направления»',
  );
});

test('ассистент и семейная медиация попадают в практику', () => {
  assert.equal(sphereOf({ title: 'Персональный ассистент' })?.id, 'practice');
  assert.equal(sphereOf({ title: 'Персональный ассистент PRO' })?.id, 'practice');
  assert.equal(
    sphereOf({ title: 'Имущественные отношения в семье: право и медиация' })?.id,
    'practice',
  );
});
