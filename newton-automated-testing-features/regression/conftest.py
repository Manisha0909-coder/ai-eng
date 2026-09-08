import sys
import os
import contextlib
import atexit
from datetime import datetime
import pandas as pd
import pytest
from regression.create_replica_personas import (
    run_create_replicas,
    delete_replica_personas,
    delete_replica_sessions,
    ORIGINALS,
)

_cleanup: dict = {}
_last_persona: list[str | None] = [None]


def _run_cleanup() -> None:
    if not _cleanup:
        return
    warn_ids = _cleanup.get("warn_session_ids", set())
    sessions_to_delete = [s for s in _cleanup["session_ids"] if s not in warn_ids]
    with _live_output():
        delete_replica_personas(
            _cleanup["replica_ids"],
            _cleanup["replica_roles"],
            _cleanup["cookie_header"],
        )
        delete_replica_sessions(sessions_to_delete, _cleanup["cookie_header"])
        if warn_ids:
            print(f"\n⚠️  Preserved {len(warn_ids)} session(s) with tool errors (not deleted):")
            for sid in warn_ids:
                print(f"   {sid}")
    _cleanup.clear()


def pytest_addoption(parser):
    parser.addoption(
        "--persona",
        default="all",
        choices=["all", "graph", "asset_manager", "tender", "hr", "sales_dashboard", "qatar_tourism"],
        help="Persona to test (default: all)",
    )
    parser.addoption(
        "--include-disabled",
        action="store_true",
        default=False,
        help="Include disabled test cases",
    )
    parser.addoption(
        "--no-cleanup",
        action="store_true",
        default=False,
        help="Skip replica persona cleanup after tests (useful for debugging)",
    )


@contextlib.contextmanager
def _live_output():
    """Write directly to /dev/tty, bypassing pytest's fd-level stdout capture."""
    try:
        tty = open("/dev/tty", "w")
        old = sys.stdout
        sys.stdout = tty
        try:
            yield
        finally:
            sys.stdout = old
            tty.close()
    except OSError:
        yield


@pytest.hookimpl(tryfirst=True)
def pytest_runtest_logstart(nodeid, location):
    if "test_persona_query[" not in nodeid:
        return
    bracket = nodeid.split("test_persona_query[")[-1].rstrip("]")
    key = bracket.split("::")[0]
    if key != _last_persona[0]:
        _last_persona[0] = key
        if _cleanup:  # setup already done — safe to print heading now
            with _live_output():
                print(f"\n{'━' * 60}")
                print(f"  Persona: {key}")
                print(f"{'━' * 60}")


@pytest.fixture(scope="session")
def persona_filter(request):
    value = request.config.getoption("--persona")
    if value != "all":
        return value

    # Auto-detect persona from the collected test node IDs.
    # e.g. "...::test_persona_query[graph::Show_me_my_5...]" → "graph"
    personas: set[str] = set()
    for item in request.session.items:
        if "test_persona_query[" in item.nodeid:
            bracket = item.nodeid.split("test_persona_query[")[-1].rstrip("]")
            key = bracket.split("::")[0]
            if key in ORIGINALS:
                personas.add(key)

    if len(personas) == 1:
        return personas.pop()

    return None  # multiple or unknown personas → create all


@pytest.fixture(scope="session")
def regression_context(request, persona_filter):
    """Create replica personas once for the session, clean up after all tests."""
    with _live_output():
        replica_ids, replica_roles, cookie_header, failed_keys = run_create_replicas(
            persona_filter=persona_filter
        )
    if failed_keys:
        delete_replica_personas(replica_ids, replica_roles, cookie_header)
        pytest.exit(f"Replica setup failed for: {failed_keys} — cleaned up and aborted.", returncode=1)
    session_ids: list[str] = []
    warn_session_ids: set[str] = set()

    _cleanup.update({
        "replica_ids": replica_ids,
        "replica_roles": replica_roles,
        "cookie_header": cookie_header,
        "session_ids": session_ids,
        "warn_session_ids": warn_session_ids,
    })
    if not request.config.getoption("--no-cleanup"):
        atexit.register(_run_cleanup)
    else:
        with _live_output():
            print("⚠️  --no-cleanup set: skipping replica cleanup")

    # Print the heading for the first persona (logstart ran before setup, so it skipped it)
    if _last_persona[0]:
        with _live_output():
            print(f"\n{'━' * 60}")
            print(f"  Persona: {_last_persona[0]}")
            print(f"{'━' * 60}")

    yield {
        "replica_ids": replica_ids,
        "replica_roles": replica_roles,
        "cookie_header": cookie_header,
        "session_ids": session_ids,
        "warn_session_ids": warn_session_ids,
        "orig_to_replica": {ORIGINALS[k]: v for k, v in replica_ids.items()},
    }


@pytest.hookimpl(trylast=True)
def pytest_sessionfinish(session, exitstatus):
    from regression.test_regression import _results_log, RESULTS_DIR
    if not _results_log:
        return
    df = pd.DataFrame(_results_log)
    filename = os.path.join(
        RESULTS_DIR,
        f"regression_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.xlsx",
    )
    os.makedirs(RESULTS_DIR, exist_ok=True)
    df.to_excel(filename, index=False)

    def _print_result_files():
        all_files = sorted(
            (f for f in os.listdir(RESULTS_DIR) if f.endswith(".xlsx")),
            reverse=True,
        )
        with _live_output():
            print(f"\n📊 Result files in {RESULTS_DIR}:")
            for f in all_files:
                marker = " ← latest" if f == os.path.basename(filename) else ""
                print(f"   {f}{marker}")

    atexit.register(_print_result_files)
