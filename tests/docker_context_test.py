#!/usr/bin/env python3
"""
Контекст сборки Docker не должен нести закрытые файлы рабочего каталога.

Dockerfile делает COPY . . – всё, что не отсеял .dockerignore, ложится в
слой образа, и получатель образа читает пароль, TOTP, журнал заявок и
TLS-ключ, к которым у него не было доступа на сервере (аудит 13.09.2026,
находка 1). Проверка собирает образ из СИНТЕТИЧЕСКОГО дерева: настоящие
Dockerfile и .dockerignore, заглушки исходников и файлы-маркеры на всех
закрытых путях. Затем образ разбирается (docker save) и каждый слой
просматривается целиком – bind-mount при запуске содержимое слоя не меняет.

  python tests/docker_context_test.py

Нужен работающий Docker. Если демон недоступен, проверка НЕ выполняется и
завершается кодом 2 – это не «прошло».
"""

from __future__ import annotations

import io
import shutil
import subprocess
import sys
import tarfile
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Закрытые пути, которые создаёт работа приложения или кладёт оператор.
# Значение – содержимое файла-маркера; каждый маркер уникален, чтобы по
# найденной строке было видно, какой именно путь просочился.
SECRET_FILES = {
    ".admin-password.txt": "one-time password + totp",
    "АДМИН-ПАРОЛЬ.txt": "legacy one-time password",
    ".admin-credentials.json": "scrypt hash + totp secret",
    ".admin-status.json": "admin status",
    ".data/.admin-credentials.json": "compose credentials",
    ".data/.admin-password.txt": "compose one-time password",
    ".data/.applications/2026-09.jsonl": "compose applications (PII)",
    ".data/.analytics/events/2026-09-13.jsonl": "compose analytics",
    ".applications/2026-09.jsonl": "direct-start applications (PII)",
    ".analytics/events/2026-09-13.jsonl": "direct-start analytics",
    "backups/2026-09-13T00-00-00/.applications/2026-09.jsonl": "backup copy (PII)",
    "certs/privkey.pem": "TLS private key",
    "certs/fullchain.pem": "TLS certificate",
    ".env": "environment secrets",
    ".env.production": "environment secrets (variant)",
    ".playwright-cli/state.json": "browser state, may hold credentials",
    ".catalog-schedule.json": "schedule",
}

# Исходники, которые в образе быть ОБЯЗАНЫ: иначе пустой контекст прошёл бы
# проверку «ничего не утекло» просто потому, что ничего не скопировалось.
KEEP_FILES = {
    "admin-server.js": "console.log('stub');\n",
    "intake-server.js": "console.log('stub');\n",
    "lib/data-dir.js": "module.exports = {};\n",
    "package.json": '{"name":"dpo-context-test","private":true}\n',
    "admin.html": "<!doctype html><title>stub</title>\n",
}


def docker_ready() -> bool:
    try:
        r = subprocess.run(["docker", "version", "--format", "{{.Server.Version}}"],
                           capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return False
    return r.returncode == 0 and bool(r.stdout.strip())


def build_context(ctx: Path, run_id: str) -> dict[str, str]:
    shutil.copy2(ROOT / "Dockerfile", ctx / "Dockerfile")
    shutil.copy2(ROOT / ".dockerignore", ctx / ".dockerignore")
    markers: dict[str, str] = {}
    for rel, what in SECRET_FILES.items():
        marker = f"DPO-SECRET-MARKER-{run_id}-{len(markers):02d}"
        p = ctx / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(f"{marker} {what}\n", encoding="utf-8")
        markers[rel] = marker
    for rel, body in KEEP_FILES.items():
        p = ctx / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body, encoding="utf-8")
    return markers


def layer_contents(image_tar: Path) -> tuple[set[str], bytes]:
    """Имена файлов и склеенное содержимое ВСЕХ слоёв образа."""
    names: set[str] = set()
    blob = io.BytesIO()
    with tarfile.open(image_tar) as outer:
        for member in outer.getmembers():
            if not member.isfile():
                continue
            data = outer.extractfile(member).read()
            try:
                inner = tarfile.open(fileobj=io.BytesIO(data))
            except tarfile.TarError:
                continue  # manifest, config – не слой
            with inner:
                for m in inner.getmembers():
                    names.add(m.name)
                    if m.isfile():
                        f = inner.extractfile(m)
                        if f is not None:
                            blob.write(f.read())
    return names, blob.getvalue()


def normalize(name: str) -> str:
    """Путь в слое относительно WORKDIR: «app/.data/x» → «.data/x»."""
    n = name[2:] if name.startswith("./") else name
    return n[4:] if n.startswith("app/") else n


def main() -> int:
    if not docker_ready():
        print("SKIP: Docker недоступен – проверка контекста сборки НЕ выполнена")
        return 2

    run_id = uuid.uuid4().hex[:12]
    tag = f"dpo-context-test:{run_id}"
    failures: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        ctx = Path(tmp) / "ctx"
        ctx.mkdir()
        markers = build_context(ctx, run_id)

        build = subprocess.run(
            ["docker", "build", "-q", "-t", tag, str(ctx)],
            capture_output=True, text=True, timeout=600,
        )
        if build.returncode != 0:
            print("FAIL: docker build не прошёл\n" + build.stderr)
            return 1
        try:
            image_tar = Path(tmp) / "image.tar"
            save = subprocess.run(["docker", "save", "-o", str(image_tar), tag],
                                  capture_output=True, text=True, timeout=600)
            if save.returncode != 0:
                print("FAIL: docker save не прошёл\n" + save.stderr)
                return 1
            names, blob = layer_contents(image_tar)
        finally:
            subprocess.run(["docker", "rmi", "-f", tag], capture_output=True)

    print(f"слои образа: файлов {len(names)}, байт {len(blob)}")

    for rel, body in KEEP_FILES.items():
        present = any(n.endswith(rel) for n in names)
        mark = "PASS" if present else "FAIL"
        print(f"  [{mark}] исходник в образе: {rel}")
        if not present:
            failures.append(f"исходник не скопирован: {rel}")

    for rel, marker in markers.items():
        leaked_name = [n for n in names if normalize(n) == rel]
        leaked_body = marker.encode() in blob
        ok = not leaked_name and not leaked_body
        mark = "PASS" if ok else "FAIL"
        print(f"  [{mark}] закрытый путь отсутствует в слоях: {rel}")
        if not ok:
            failures.append(f"утёк в слой образа: {rel}")

    print()
    if failures:
        print(f"ПРОВАЛ: {len(failures)}")
        for f in failures:
            print("  - " + f)
        return 1
    print("OK: закрытые пути в слои образа не попадают")
    return 0


if __name__ == "__main__":
    sys.exit(main())
