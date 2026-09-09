"""
Image uploads to Supabase Storage.

Talks to the Storage REST API directly with the service key rather than
pulling in the Supabase SDK: it is one authenticated PUT, and the SDK
would drag a large dependency tree in for it.

Files are validated by sniffing their magic bytes, not by trusting the
filename or the Content-Type header, and they are stored under a
generated name so an upload can never overwrite an existing object or
escape the bucket with a crafted path.
"""
import mimetypes
import os
import re
import secrets
from datetime import datetime, timezone

import requests
from flask import Blueprint, g, request

import db
from config import Config
from utils.auth import admin_required
from utils.helpers import fail, ok, paginate_args, slugify, to_jsonable

bp = Blueprint("media", __name__, url_prefix="/api/admin/media")

MAX_BYTES = 8 * 1024 * 1024  # 8 MB

# Magic bytes -> (extension, mime). Only these are accepted.
SIGNATURES = [
    (b"\xff\xd8\xff", "jpg", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "png", "image/png"),
    (b"GIF87a", "gif", "image/gif"),
    (b"GIF89a", "gif", "image/gif"),
    (b"RIFF", "webp", "image/webp"),          # confirmed below
    (b"<svg", "svg", "image/svg+xml"),
    (b"<?xml", "svg", "image/svg+xml"),
]


def _sniff(head: bytes):
    for magic, ext, mime in SIGNATURES:
        if head.startswith(magic):
            if ext == "webp" and head[8:12] != b"WEBP":
                continue
            return ext, mime
    return None, None


def _configured():
    return bool(Config.SUPABASE_URL and Config.SUPABASE_SERVICE_KEY)


def _storage_url(path):
    base = Config.SUPABASE_URL.rstrip("/")
    return f"{base}/storage/v1/object/{Config.SUPABASE_BUCKET}/{path}"


def _public_url(path):
    base = Config.SUPABASE_URL.rstrip("/")
    return f"{base}/storage/v1/object/public/{Config.SUPABASE_BUCKET}/{path}"


@bp.get("")
@admin_required
def list_media():
    page, limit, offset = paginate_args(default_limit=60, max_limit=200)
    folder = request.args.get("folder")

    where, params = ["1=1"], []
    if folder:
        where.append("folder = %s")
        params.append(folder)
    clause = " and ".join(where)

    rows = db.query(
        f"""select id, url, path, filename, mime_type, size_bytes, alt, folder, created_at
              from media_assets where {clause}
              order by created_at desc limit %s offset %s""",
        (*params, limit, offset),
    )
    total = db.scalar(f"select count(*) from media_assets where {clause}", tuple(params))
    return ok(to_jsonable(rows), meta={"page": page, "limit": limit, "total": total,
                                       "enabled": _configured()})


@bp.post("")
@admin_required
def upload():
    if not _configured():
        return fail(
            "Image uploads need Supabase Storage. Add SUPABASE_URL and "
            "SUPABASE_SERVICE_KEY to the server environment, or paste an image "
            "URL into the field instead.",
            503, code="storage_unconfigured",
        )

    file = request.files.get("file")
    if not file:
        return fail("Choose a file to upload.", 422, errors={"file": "Required."})

    blob = file.read(MAX_BYTES + 1)
    if len(blob) > MAX_BYTES:
        return fail("That image is over 8 MB. Resize it and try again.", 413,
                    code="file_too_large")
    if not blob:
        return fail("That file is empty.", 422)

    ext, mime = _sniff(blob[:16])
    if not ext:
        return fail("That is not an image we can use. Upload a JPEG, PNG, WebP, GIF or SVG.",
                    415, code="unsupported_type")

    # A generated name: an upload can never overwrite an existing object,
    # and no part of the client's filename reaches the path.
    stem = slugify(os.path.splitext(file.filename or "image")[0])[:48] or "image"
    folder = slugify(request.form.get("folder") or "uploads")[:32] or "uploads"
    stamp = datetime.now(timezone.utc).strftime("%Y%m")
    path = f"{folder}/{stamp}/{stem}-{secrets.token_hex(6)}.{ext}"

    try:
        res = requests.post(
            _storage_url(path),
            data=blob,
            headers={
                "Authorization": f"Bearer {Config.SUPABASE_SERVICE_KEY}",
                "Content-Type": mime,
                "x-upsert": "false",
                "cache-control": "public, max-age=31536000, immutable",
            },
            timeout=45,
        )
    except requests.RequestException:
        return fail("Could not reach storage. Check the connection and try again.", 502,
                    code="storage_unreachable")

    if res.status_code >= 400:
        detail = ""
        try:
            detail = res.json().get("message") or res.json().get("error") or ""
        except ValueError:
            detail = res.text[:160]
        if res.status_code in (400, 404) and "bucket" in detail.lower():
            return fail(
                f"The bucket '{Config.SUPABASE_BUCKET}' does not exist. Create it in "
                "Supabase under Storage, and make it public.",
                400, code="bucket_missing",
            )
        return fail(f"Storage refused the upload. {detail}".strip(), 502, code="storage_error")

    url = _public_url(path)
    row = db.insert_returning(
        """insert into media_assets
             (bucket, path, url, filename, mime_type, size_bytes, alt, folder, uploaded_by)
           values (%s,%s,%s,%s,%s,%s,%s,%s,%s)
           returning id, url, path, filename, mime_type, size_bytes, alt, folder, created_at""",
        (Config.SUPABASE_BUCKET, path, url, file.filename or f"{stem}.{ext}",
         mime, len(blob), (request.form.get("alt") or "").strip()[:200], folder, g.user["id"]),
    )
    return ok(to_jsonable(row), message="Uploaded.", status=201)


@bp.patch("/<media_id>")
@admin_required
def update_media(media_id):
    data = request.get_json(silent=True) or {}
    if "alt" not in data:
        return fail("Nothing to change.", 422)
    row = db.insert_returning(
        "update media_assets set alt = %s where id = %s returning id, url, alt",
        ((data.get("alt") or "").strip()[:200], media_id),
    )
    if not row:
        return fail("That file no longer exists.", 404)
    return ok(to_jsonable(row), message="Saved.")


@bp.delete("/<media_id>")
@admin_required
def delete_media(media_id):
    row = db.query_one("select path, url from media_assets where id = %s", (media_id,))
    if not row:
        return fail("That file no longer exists.", 404)

    in_use = db.scalar(
        """select count(*) from products
            where hero_image = %s or gallery::text like %s""",
        (row["url"], f"%{row['url']}%"),
    )
    if in_use:
        return fail(
            "That image is still used by a product. Change the product first.",
            409, code="in_use",
        )

    if _configured():
        try:
            requests.delete(
                _storage_url(row["path"]),
                headers={"Authorization": f"Bearer {Config.SUPABASE_SERVICE_KEY}"},
                timeout=25,
            )
        except requests.RequestException:
            # The row goes either way: a stranded object is a smaller problem
            # than a library that lists files which are no longer there.
            pass

    db.execute("delete from media_assets where id = %s", (media_id,))
    return ok(message="Deleted.")
