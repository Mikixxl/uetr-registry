#!/usr/bin/env python3
"""Check every tracker URL in the registry still resolves.

Exit 1 if any verified entry is unreachable, so the weekly workflow fails
loudly rather than letting the registry rot. Pending entries are reported
but do not fail the run.
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "data" / "trackers.json"
UA = "Mozilla/5.0 (compatible; IFB-UETR-Registry-LinkCheck/1.0; +https://uetr.ifcifb.com)"
TIMEOUT = 25


def probe(url: str) -> tuple[bool, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            code = resp.getcode()
            return (200 <= code < 400, f"HTTP {code}")
    except urllib.error.HTTPError as e:
        # 401/403 means the endpoint is alive but gated, which is information,
        # not rot. Treat as reachable and let a human read the note.
        return (e.code in (401, 403), f"HTTP {e.code}")
    except Exception as e:  # noqa: BLE001
        return (False, type(e).__name__)


def main() -> int:
    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    failures = []

    for t in data["trackers"]:
        for key in ("url", "resolved_url"):
            url = t.get(key)
            if not url:
                continue
            ok, detail = probe(url)
            flag = "ok  " if ok else "DEAD"
            print(f"{flag} {t['id']:<32} {key:<13} {detail:<12} {url}")
            if not ok and t.get("status") == "verified":
                failures.append(f"{t['id']} ({key}): {detail}")

    if failures:
        print("\nRegistry entries need attention:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1

    print("\nAll verified entries reachable.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
