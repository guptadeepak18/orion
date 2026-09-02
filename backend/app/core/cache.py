import time
from typing import Any, Dict, Optional, Tuple

class SimpleTtlCache:
    '''Ultra-fast in-memory TTL cache for reducing database roundtrips on frequently-accessed static data.'''
    def __init__(self, default_ttl_seconds: int = 30):
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._default_ttl = default_ttl_seconds

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            expiry, value = self._cache[key]
            if time.time() < expiry:
                return value
            else:
                del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None):
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        self._cache[key] = (time.time() + ttl, value)

    def invalidate_prefix(self, prefix: str):
        keys_to_del = [k for k in self._cache if k.startswith(prefix)]
        for k in keys_to_del:
            self._cache.pop(k, None)

    def clear(self):
        self._cache.clear()

memory_cache = SimpleTtlCache(default_ttl_seconds=30)
