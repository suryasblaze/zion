"""
Postgres access.

Every query in this codebase is parameterised. There is no string
interpolation of user input anywhere near SQL; the only formatting that
happens is of column and table identifiers we control ourselves, and that
goes through psycopg.sql composition.
"""
from contextlib import contextmanager

from psycopg import connect
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import Config

_pool = None


def init_pool():
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=Config.DATABASE_URL,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row, "autocommit": True},
            open=True,
        )
    return _pool


def close_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def cursor():
    """A short-lived autocommit cursor. Use for reads and single writes."""
    pool = init_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            yield cur


@contextmanager
def transaction():
    """
    An explicit transaction. Everything inside commits together or not at
    all. This is what the referral and wallet paths run in, and it is the
    reason we speak Postgres directly instead of going through the
    Supabase REST API -- SELECT ... FOR UPDATE has no REST equivalent.
    """
    pool = init_pool()
    with pool.connection() as conn:
        prev = conn.autocommit
        conn.autocommit = False
        try:
            with conn.cursor() as cur:
                yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.autocommit = prev


# ------------------------------------------------------------------ reads
def query(sql, params=None):
    with cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchall()


def query_one(sql, params=None):
    with cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchone()


def scalar(sql, params=None):
    row = query_one(sql, params)
    if not row:
        return None
    return next(iter(row.values()))


# ----------------------------------------------------------------- writes
def execute(sql, params=None):
    with cursor() as cur:
        cur.execute(sql, params or ())
        return cur.rowcount


def insert_returning(sql, params=None):
    with cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchone()
