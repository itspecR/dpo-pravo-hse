'use strict';

/**
 * Второй фактор админки должен действовать на КАЖДОМ пути входа. До правки
 * 13.09.2026 (аудит, находка 2) альтернативный вход по HTTP Basic проверял
 * только пароль и выдавал тот же результат авторизации, что и cookie после
 * TOTP: знание пароля открывало заявки и изменяющие маршруты при прямом
 * запуске node admin-server.js, где Basic был включён по умолчанию.
 *
 * Проверяется живой сервер, а не текст файла: админка поднимается с
 * временным каталогом данных (DPO_DATA_DIR) и заранее записанными
 * учётными данными – в рабочие файлы проекта тест не пишет.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const { hashPassword } = require('../../lib/admin-credentials');
const { generateSecret, decodeBase32, totpAt } = require('../../lib/totp');

const ROOT = path.resolve(__dirname, '..', '..');
const PASSWORD = 'test-password-not-a-secret';
const SECRET = generateSecret();

async function credentials({ totpEnrolled }) {
  const { salt, hash } = await hashPassword(PASSWORD);
  return {
    username: 'admin',
    passwordHash: hash,
    passwordSalt: salt,
    algo: 'scrypt',
    totpSecret: SECRET,
    totpEnrolled,
  };
}

/** Свободный порт: фиксированные номера сталкиваются при параллельном прогоне. */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitFor(base, child, log) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      await fetch(`${base}/api/status`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`админка не поднялась: ${base}\n${log.join('')}`);
}

/** Поднимает админку во временном каталоге данных; env – поверх окружения. */
async function startAdmin({ totpEnrolled, env = {} }) {
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dpo-admin-totp-'));
  fs.writeFileSync(
    path.join(dir, '.admin-credentials.json'),
    JSON.stringify(await credentials({ totpEnrolled })),
    { mode: 0o600 },
  );
  const childEnv = { ...process.env, PORT: String(port), HOST: '127.0.0.1', DPO_DATA_DIR: dir, ...env };
  // Умолчание проверяется именно как умолчание: переменная снята, а не «0».
  if (!('ADMIN_ALLOW_BASIC' in env)) delete childEnv.ADMIN_ALLOW_BASIC;
  const child = spawn(process.execPath, ['admin-server.js'], {
    cwd: ROOT,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  child.stdout.on('data', (d) => log.push(String(d)));
  child.stderr.on('data', (d) => log.push(String(d)));
  const base = `http://127.0.0.1:${port}`;
  const stop = () =>
    new Promise((resolve) => {
      const done = () => {
        fs.rmSync(dir, { recursive: true, force: true });
        resolve();
      };
      if (child.exitCode !== null) return done();
      child.once('exit', done);
      child.kill('SIGTERM');
    });
  try {
    await waitFor(base, child, log);
  } catch (err) {
    await stop();
    throw err;
  }
  return { base, stop };
}

const basicHeader = { Authorization: 'Basic ' + Buffer.from(`admin:${PASSWORD}`).toString('base64') };

async function login(base, body) {
  return fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ username: 'admin', password: PASSWORD, ...body }),
  });
}

test('умолчание: Basic с верным паролем не открывает админку при подключённом TOTP', async () => {
  const { base, stop } = await startAdmin({ totpEnrolled: true });
  try {
    for (const route of ['/api/csrf', '/api/applications', '/api/status']) {
      const res = await fetch(base + route, { headers: basicHeader });
      assert.equal(res.status, 401, `${route} по Basic должен отвечать 401`);
    }
    const res = await fetch(`${base}/api/applications/status`, {
      method: 'POST',
      headers: { ...basicHeader, 'Content-Type': 'application/json', 'X-CSRF-Token': 'x' },
      body: JSON.stringify({ id: 'x', status: 'done' }),
    });
    assert.equal(res.status, 401, 'изменяющий маршрут по Basic должен отвечать 401');
  } finally {
    await stop();
  }
});

test('вход по cookie требует верный TOTP и после него открывает заявки', async () => {
  const { base, stop } = await startAdmin({ totpEnrolled: true });
  try {
    const noCode = await login(base, {});
    assert.equal(noCode.status, 401, 'вход без кода TOTP должен отвергаться');

    const code = totpAt(decodeBase32(SECRET));
    const ok = await login(base, { totp: code });
    assert.equal(ok.status, 200, 'вход с верным кодом TOTP должен проходить');
    const cookie = String(ok.headers.get('set-cookie') || '').split(';', 1)[0];
    assert.match(cookie, /^dpo_admin=/);

    const list = await fetch(`${base}/api/applications`, { headers: { Cookie: cookie } });
    assert.equal(list.status, 200, 'по сессии список заявок доступен');
    const csrf = await fetch(`${base}/api/csrf`, { headers: { Cookie: cookie } });
    assert.equal(csrf.status, 200);
  } finally {
    await stop();
  }
});

test('ADMIN_ALLOW_BASIC=1 не отменяет подключённый TOTP', async () => {
  const { base, stop } = await startAdmin({ totpEnrolled: true, env: { ADMIN_ALLOW_BASIC: '1' } });
  try {
    for (const route of ['/api/csrf', '/api/applications']) {
      const res = await fetch(base + route, { headers: basicHeader });
      assert.equal(res.status, 401, `${route}: Basic не должен обходить TOTP`);
    }
  } finally {
    await stop();
  }
});

test('ADMIN_ALLOW_BASIC=1 без подключённого TOTP оставляет Basic для автотестов', async () => {
  const { base, stop } = await startAdmin({ totpEnrolled: false, env: { ADMIN_ALLOW_BASIC: '1' } });
  try {
    const res = await fetch(`${base}/api/csrf`, { headers: basicHeader });
    assert.equal(res.status, 200);
  } finally {
    await stop();
  }
});
