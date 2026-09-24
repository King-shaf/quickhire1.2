import os
import threading
from typing import Optional, Any

_global_supabase_client: Optional[Any] = None
_client_lock = threading.Lock()


def _safe_django_settings():
    """Load SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from Django settings if
    Django is configured; otherwise fall back to environment variables."""
    try:
        from django.conf import settings
        url = getattr(settings, 'SUPABASE_URL', '') or os.environ.get('SUPABASE_URL', '')
        key = getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
        return url, key
    except Exception:
        return os.environ.get('SUPABASE_URL', ''), os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')


def get_supabase() -> Any:
    """Return the singleton Supabase client, creating it once on first call."""
    global _global_supabase_client
    if _global_supabase_client is not None:
        return _global_supabase_client

    with _client_lock:
        if _global_supabase_client is not None:
            return _global_supabase_client

        try:
            from supabase import create_client
        except ImportError as e:
            raise RuntimeError(
                "The 'supabase' package is not installed. "
                "Run: pip install supabase>=2.0.0"
            ) from e

        url, key = _safe_django_settings()
        if not url or not key:
            raise RuntimeError(
                "Supabase credentials are not set. Configure SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY in Django settings or environment variables."
            )

        _global_supabase_client = create_client(url, key)
        return _global_supabase_client


def sb_table(table_name: str) -> Any:
    """Shortcut: get_supabase().table(table_name)"""
    return get_supabase().table(table_name)
