# Смоук-тест сайта ДПО

Автоматическая проверка ключевых сценариев публичных страниц перед релизом —
вместо ручного обхода в браузере. Playwright + headless Chromium.

## Запуск

```bash
tests/run.sh
```

При первом запуске сам создаёт локальное окружение (`.venv-tests`, через `uv`)
и ставит Playwright + Chromium. Требуется только [uv](https://docs.astral.sh/uv/);
Node не нужен для smoke (сервер — `python -m http.server`). Security-тесты
поднимают Node (`admin-server.js`, `static-server.js`).

Выход `0` — всё прошло, `1` — есть провалы (годится для CI).

## Что проверяется (smoke)

**index.html** — заголовок, CSP после рендера, favicon, theme-color, шрифты HSE,
hero, версия для слабовидящих (вкл/выкл и после ре-рендеров), куки-баннер,
email из data-атрибутов, юридические ссылки, консоль, битые ресурсы, ноль
внешних запросов (152-ФЗ).

**Каталог программ.html** — карточки (≥17), фильтры, favicon, «← На лендинг»,
консоль, битые ресурсы, ноль внешних запросов.

**privacy.html** — заголовок, версия для слабовидящих, сброс cookie-согласия,
email, консоль, битые ресурсы.

## Security-тесты (`tests/security_test.py`)

- static-server: deny secrets/dotfiles; no CORS on `/api/collect`; refuse non-loopback HOST
- admin-server: 401 without auth; collect rejects foreign Origin; update without auth → 401
- unit: `isHseHost`, CSP on catalog/privacy/index

```bash
python tests/security_test.py
# или
npm run test:security
```

`tests/run.sh` гоняет smoke **и** security подряд.

Регрессии аудита 13.09.2026 (`docs/security-fixes-2026-09-13.md`) лежат в
юнит-тестах: `landing-top5-escape` (вложенный script лендинга),
`admin-basic-totp` (живая админка: Basic не обходит TOTP),
`application-form` и `admin-applications-ui` (адрес заявителя и mailto:),
`dockerignore` (сторож `.dockerignore`).

## Контекст сборки Docker (`tests/docker_context_test.py`)

Собирает образ из синтетического дерева с файлами-маркерами на закрытых
путях (`.data/`, `backups/`, `certs/`, `.admin-password.txt`, `.env` …) и
просматривает все слои через `docker save`: маркеров быть не должно, а
исходники – должны. Нужен запущенный Docker; без него код выхода 2, это не
«прошло». В `tests/run.sh` не входит.

```bash
python tests/docker_context_test.py
```

## Замечания

- Каждая страница смоука — свежий контекст (чистый `localStorage`).
- Перед публикацией: `npm run check-deploy` (падает, если остался `example.com`).
- Окружение `.venv-tests/` в git не коммитится.
