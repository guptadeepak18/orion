import time
from typing import Any, Optional, List, Set, Dict, Tuple
import logging

logger = logging.getLogger("crc_one.cache")


class _AwaitableNone:
    """Helper that allows synchronous cache methods to be optionally awaited without error."""
    def __await__(self):
        async def _wrap():
            return None
        return _wrap().__await__()


_AWAITABLE_NONE = _AwaitableNone()


class FastMemoryCache:
    """
    Ultra-fast in-memory TTL cache with prefix and tag-based invalidation.
    Operates in microseconds (< 0.05ms) without external network dependencies.
    Used to eliminate high-latency cross-continental roundtrips for read-heavy routes.
    """

    def __init__(self, default_ttl_seconds: int = 60, max_size: int = 2000):
        self._default_ttl = default_ttl_seconds
        self._max_size = max_size
        # key -> (value, expires_at_monotonic, set_of_tags)
        self._store: Dict[str, Tuple[Any, float, Set[str]]] = {}
        # tag -> set of keys
        self._tag_index: Dict[str, Set[str]] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at, _ = entry
        if time.monotonic() > expires_at:
            self._remove_key(key)
            return None
        return value

    def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: Optional[int] = None,
        tags: Optional[List[str]] = None,
    ) -> _AwaitableNone:
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        # Enforce max size with pruning of expired entries
        if len(self._store) >= self._max_size:
            now = time.monotonic()
            expired_keys = [k for k, (_, exp, _) in self._store.items() if now > exp]
            for k in expired_keys:
                self._remove_key(k)
            if len(self._store) >= self._max_size:
                oldest_key = next(iter(self._store))
                self._remove_key(oldest_key)

        tag_set = set(tags or [])
        expires_at = time.monotonic() + max(1, ttl)
        self._store[key] = (value, expires_at, tag_set)

        for tag in tag_set:
            if tag not in self._tag_index:
                self._tag_index[tag] = set()
            self._tag_index[tag].add(key)

        return _AWAITABLE_NONE

    def _remove_key(self, key: str) -> None:
        entry = self._store.pop(key, None)
        if entry:
            _, _, tag_set = entry
            for tag in tag_set:
                if tag in self._tag_index:
                    self._tag_index[tag].discard(key)
                    if not self._tag_index[tag]:
                        del self._tag_index[tag]

    def invalidate_prefix(self, prefix: str) -> int:
        keys_to_del = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_del:
            self._remove_key(k)
        return len(keys_to_del)

    def invalidate_tags(self, *tags: str) -> _AwaitableNone:
        count = 0
        for tag in tags:
            keys_to_delete = list(self._tag_index.get(tag, set()))
            for key in keys_to_delete:
                self._remove_key(key)
                count += 1
        if count > 0:
            logger.debug(f"[CACHE] Invalidated {count} keys for tags: {tags}")
        return _AWAITABLE_NONE

    def clear(self) -> _AwaitableNone:
        self._store.clear()
        self._tag_index.clear()
        return _AWAITABLE_NONE


# Global cache instances (aliased for complete backward compatibility)
cache = FastMemoryCache(default_ttl_seconds=60, max_size=2000)
memory_cache = cache
