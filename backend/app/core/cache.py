import time
import asyncio
from typing import Any, Optional, List, Set, Dict, Tuple, Callable
from functools import wraps
import logging

logger = logging.getLogger("crc_one.cache")


class FastMemoryCache:
    """
    Ultra-lightweight, in-memory TTL cache with tag-based invalidation.
    Operates in microseconds (< 0.05ms) without external network dependencies.
    Used to eliminate high-latency cross-continental roundtrips for read-heavy routes.
    """

    def __init__(self, max_size: int = 1000):
        self._max_size = max_size
        # key -> (data, expires_at_monotonic, set_of_tags)
        self._store: Dict[str, Tuple[Any, float, Set[str]]] = {}
        # tag -> set of keys
        self._tag_index: Dict[str, Set[str]] = {}
        self._lock = asyncio.Lock()

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            return None
        data, expires_at, _ = entry
        if time.monotonic() > expires_at:
            # Expired; eagerly clean up
            self._store.pop(key, None)
            return None
        return data

    async def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: int = 60,
        tags: Optional[List[str]] = None,
    ) -> None:
        async with self._lock:
            # Enforce max size with simple pruning of expired or oldest entries
            if len(self._store) >= self._max_size:
                now = time.monotonic()
                expired_keys = [k for k, (_, exp, _) in self._store.items() if now > exp]
                for k in expired_keys:
                    self._remove_key(k)
                if len(self._store) >= self._max_size:
                    # Drop oldest entry
                    oldest_key = next(iter(self._store))
                    self._remove_key(oldest_key)

            tag_set = set(tags or [])
            expires_at = time.monotonic() + max(1, ttl_seconds)
            self._store[key] = (value, expires_at, tag_set)

            for tag in tag_set:
                if tag not in self._tag_index:
                    self._tag_index[tag] = set()
                self._tag_index[tag].add(key)

    def _remove_key(self, key: str) -> None:
        entry = self._store.pop(key, None)
        if entry:
            _, _, tag_set = entry
            for tag in tag_set:
                if tag in self._tag_index:
                    self._tag_index[tag].discard(key)
                    if not self._tag_index[tag]:
                        del self._tag_index[tag]

    async def invalidate_tags(self, *tags: str) -> int:
        """Invalidates all cached keys associated with any of the provided tags."""
        count = 0
        async with self._lock:
            for tag in tags:
                keys_to_delete = list(self._tag_index.get(tag, set()))
                for key in keys_to_delete:
                    self._remove_key(key)
                    count += 1
        if count > 0:
            logger.debug(f"[CACHE] Invalidated {count} keys for tags: {tags}")
        return count

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()
            self._tag_index.clear()


# Global cache instance
cache = FastMemoryCache(max_size=2000)
