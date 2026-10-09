"""Copy all Django data from one database to another."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from config.environment import LOCAL, POSTGRES_ENGINE, SQLITE_ENGINE, database_for_environment

SRC_DIR = Path(__file__).resolve().parents[3]
BASE_DIR = SRC_DIR.parent
MANAGE_PY = SRC_DIR / "manage.py"

# Everything we persist for a full store clone (users, catalog, orders, JWT blacklist, etc.).
DATA_APPS = (
    "contenttypes",
    "auth",
    "accounts",
    "catalog",
    "commerce",
    "token_blacklist",
)


def _engine_for_url(database_url: str) -> str:
    if not database_url.strip():
        return SQLITE_ENGINE
    cfg = database_for_environment(
        LOCAL,
        base_dir=BASE_DIR,
        database_url=database_url.strip(),
        ssl_require=False,
    )
    return cfg["ENGINE"]


def _postgres_url(database_url: str) -> str:
    cfg = database_for_environment(
        LOCAL,
        base_dir=BASE_DIR,
        database_url=database_url.strip(),
        ssl_require=False,
    )
    if cfg["ENGINE"] != POSTGRES_ENGINE:
        raise CommandError("Expected a PostgreSQL DATABASE_URL (postgres:// or postgresql://).")
    user = cfg["USER"]
    password = cfg["PASSWORD"]
    host = cfg["HOST"]
    port = cfg["PORT"] or 5432
    name = cfg["NAME"]
    options = cfg.get("OPTIONS") or {}
    sslmode = options.get("sslmode")
    auth = f"{user}:{password}@" if password else f"{user}@"
    url = f"postgresql://{auth}{host}:{port}/{name}"
    if sslmode:
        url = f"{url}?sslmode={sslmode}"
    return url


def _run_manage(database_url: str | None, argv: list[str]) -> None:
    env = os.environ.copy()
    env["ENVIRONMENT"] = env.get("ENVIRONMENT") or LOCAL
    if database_url is None:
        env.pop("DATABASE_URL", None)
    else:
        env["DATABASE_URL"] = database_url
        env.setdefault("DATABASE_SSL_REQUIRE", "False")
    result = subprocess.run(
        [sys.executable, str(MANAGE_PY), *argv],
        cwd=SRC_DIR,
        env=env,
    )
    if result.returncode != 0:
        raise CommandError(f"manage.py {' '.join(argv)} failed (exit {result.returncode}).")


def _copy_postgres_pg_dump(source_url: str, target_url: str, *, dump_path: Path) -> None:
    pg_dump = shutil.which("pg_dump")
    pg_restore = shutil.which("pg_restore")
    if not pg_dump or not pg_restore:
        raise CommandError("pg_dump/pg_restore not found on PATH.")

    source = _postgres_url(source_url)
    target = _postgres_url(target_url)

    dump_cmd = [
        pg_dump,
        "--dbname",
        source,
        "--format=custom",
        "--no-owner",
        "--no-acl",
        "--file",
        str(dump_path),
    ]
    subprocess.run(dump_cmd, check=True)

    restore_cmd = [
        pg_restore,
        "--dbname",
        target,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-acl",
        str(dump_path),
    ]
    subprocess.run(restore_cmd, check=True)


def _copy_dumpdata(source_url: str | None, target_url: str | None, *, dump_file: Path) -> None:
    with dump_file.open("w", encoding="utf-8") as handle:
        prev_url = os.environ.get("DATABASE_URL")
        try:
            if source_url:
                os.environ["DATABASE_URL"] = source_url
                os.environ.setdefault("DATABASE_SSL_REQUIRE", "False")
            elif "DATABASE_URL" in os.environ:
                del os.environ["DATABASE_URL"]
            call_command(
                "dumpdata",
                *DATA_APPS,
                natural_foreign=True,
                natural_primary=True,
                indent=2,
                stdout=handle,
            )
        finally:
            if prev_url is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = prev_url

    _run_manage(target_url, ["migrate", "--noinput"])
    _run_manage(target_url, ["flush", "--no-input"])
    _run_manage(target_url, ["loaddata", str(dump_file)])


class Command(BaseCommand):
    help = (
        "Copy all application data from a source database to a target database. "
        "PostgreSQL to PostgreSQL uses pg_dump/pg_restore when available; otherwise dumpdata/loaddata."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--source-url",
            type=str,
            default=os.environ.get("SOURCE_DATABASE_URL", ""),
            help="Source DATABASE_URL (postgres://...). Omit to use local SQLite (db.sqlite3).",
        )
        parser.add_argument(
            "--target-url",
            type=str,
            default=os.environ.get("TARGET_DATABASE_URL", ""),
            help="Target DATABASE_URL (postgres://...). Omit to use local SQLite.",
        )
        parser.add_argument(
            "--method",
            choices=("auto", "pg_dump", "dumpdata"),
            default="auto",
            help="Copy strategy (default: auto).",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Skip confirmation (target data will be replaced).",
        )
        parser.add_argument(
            "--keep-dump",
            type=str,
            default="",
            help="Keep the intermediate dump file at this path (dumpdata JSON or pg custom format).",
        )

    def handle(self, *args, **options):
        source_url = (options["source_url"] or "").strip()
        target_url = (options["target_url"] or "").strip()
        if not source_url and not target_url:
            raise CommandError("Pass --source-url and --target-url (or SOURCE_/TARGET_DATABASE_URL env vars).")
        if source_url == target_url:
            raise CommandError("Source and target URLs must differ.")

        source_engine = _engine_for_url(source_url)
        target_engine = _engine_for_url(target_url)

        if not options["yes"]:
            self.stdout.write(
                "This will REPLACE all data in the target database "
                f"({target_engine}, source: {source_engine})."
            )
            confirm = input("Type 'yes' to continue: ").strip().lower()
            if confirm != "yes":
                self.stdout.write("Aborted.")
                return

        method = options["method"]
        if method == "auto":
            both_pg = source_engine == POSTGRES_ENGINE and target_engine == POSTGRES_ENGINE
            method = "pg_dump" if both_pg and shutil.which("pg_dump") else "dumpdata"

        keep_dump = options["keep_dump"].strip()
        suffix = ".dump" if method == "pg_dump" else ".json"
        if keep_dump:
            dump_path = Path(keep_dump)
        else:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            dump_path = Path(tmp.name)
            tmp.close()

        try:
            if method == "pg_dump":
                if source_engine != POSTGRES_ENGINE or target_engine != POSTGRES_ENGINE:
                    raise CommandError("pg_dump method requires PostgreSQL on both sides.")
                self.stdout.write("pg_dump (source) then pg_restore --clean (target)...")
                _copy_postgres_pg_dump(source_url, target_url, dump_path=dump_path)
            else:
                self.stdout.write("Using dumpdata, flush, loaddata...")
                source_for_dump = source_url or None
                target_for_load = target_url or None
                _copy_dumpdata(source_for_dump, target_for_load, dump_file=dump_path)

            self.stdout.write(
                self.style.SUCCESS(
                    "Database copy finished. Product images still live in Cloudinary/local storage; "
                    "rows point at the same files if CLOUDINARY_* matches the source environment."
                )
            )
        finally:
            if not keep_dump and dump_path.is_file():
                dump_path.unlink(missing_ok=True)
