"""Canonical Runner identifiers and their corresponding R2 storage names.

The NestJS backend stores positive PostgreSQL integer IDs, whereas Cloudflare
R2 requires bucket names at least three characters long. Keep logical IDs
unpadded everywhere except at the R2 boundary.
"""

import re

NAME = re.compile(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\Z")
MAX_POSTGRES_ID = 2_147_483_647


def canonical_competition_id(value: str) -> str:
    """Normalize numeric DB IDs; keep legacy named demo buckets intact."""
    if not isinstance(value, str) or not 1 <= len(value) <= 63 or not NAME.fullmatch(value):
        raise ValueError("Invalid competition ID")
    if value.isascii() and value.isdecimal():
        number = int(value)
        if not 1 <= number <= MAX_POSTGRES_ID:
            raise ValueError("Invalid competition ID")
        return str(number)
    if len(value) < 3:
        raise ValueError("Named competition IDs need at least 3 characters")
    return value


def canonical_task_id(value: str) -> str:
    """Normalize numeric challenge IDs, preserving existing slug-based demos."""
    if not isinstance(value, str) or not 1 <= len(value) <= 63 or not NAME.fullmatch(value):
        raise ValueError("Invalid challenge ID")
    if value.isascii() and value.isdecimal():
        number = int(value)
        if not 1 <= number <= MAX_POSTGRES_ID:
            raise ValueError("Invalid challenge ID")
        return str(number)
    return value


def competition_bucket(value: str) -> str:
    """Match backend R2Service.competitionBucket: 1 -> '001', 1234 -> '1234'."""
    canonical = canonical_competition_id(value)
    return canonical.zfill(3) if canonical.isascii() and canonical.isdecimal() else canonical
