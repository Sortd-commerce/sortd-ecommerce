import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def get_json(url: str, *, timeout: float = 5.0) -> dict[str, Any] | list[Any] | None:
    request = Request(url, headers={"User-Agent": "sortd-backend", "Accept": "application/json"})
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None
