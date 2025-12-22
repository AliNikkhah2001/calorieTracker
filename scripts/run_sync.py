from __future__ import annotations

import json
import sys
import urllib.request
from urllib.error import HTTPError, URLError


def main(endpoint: str, username: str) -> int:
    endpoint = endpoint.rstrip("/")
    payload = json.dumps({"username": username, "state": {"info": "scheduled sync"}}).encode()
    req = urllib.request.Request(f"{endpoint}/api/sync-state", data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            print(resp.read().decode())
    except HTTPError as e:
        print(f"HTTP error: {e.code} {e.reason}")
        return 1
    except URLError as e:
        print(f"URL error: {e.reason}")
        return 1
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: run_sync.py <endpoint> <username>")
        sys.exit(1)
    sys.exit(main(sys.argv[1], sys.argv[2]))
