"""
Sending email.

Two rules shape all of this.

**Nothing here may break a request.** An order confirmation is sent after
the order exists. If the mail server is slow, down, or misconfigured, the
customer must still see their order number -- losing a receipt is an
annoyance, losing the sale is not. So every send happens on a background
thread and every failure is swallowed into email_log rather than raised.

**Nothing here may send twice.** The callers are retryable: a webhook can
arrive twice, a browser can resend, a user can double-tap. Each send
carries an idempotency key and the unique index on email_log decides the
race, not the application.

With no SMTP configured the service is a no-op that records 'skipped'.
That is deliberate: the shop runs without mail, and the log says plainly
what would have gone out, so turning SMTP on later is a change of
configuration rather than a change of behaviour.
"""
import logging
import smtplib
import threading
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

import db
from config import Config

log = logging.getLogger("zion.mail")


def configured():
    """True when enough is set to attempt a send."""
    return bool(Config.SMTP_HOST and Config.MAIL_FROM)


def _record(to_email, subject, template, status, *, error=None,
            reference_type=None, reference_id=None, idempotency_key=None):
    """
    Write the attempt down. Returns the row id, or None when the
    idempotency key was already used -- which is the caller's signal that
    this message has been handled and must not be sent again.
    """
    try:
        row = db.query_one(
            """insert into email_log
                   (to_email, subject, template, status, error,
                    reference_type, reference_id, idempotency_key)
               values (%s, %s, %s, %s, %s, %s, %s::uuid, %s)
               on conflict (idempotency_key) do nothing
               returning id""",
            (to_email, subject, template, status, error,
             reference_type, reference_id, idempotency_key),
        )
        return row["id"] if row else None
    except Exception:
        # Logging a send must never be the thing that breaks a checkout.
        log.exception("could not write email_log row")
        return None


def _mark(log_id, status, error=None):
    if not log_id:
        return
    try:
        db.execute(
            """update email_log
                  set status = %s,
                      error = %s,
                      sent_at = case when %s = 'sent' then now() else sent_at end
                where id = %s""",
            (status, error, status, log_id),
        )
    except Exception:
        log.exception("could not update email_log row %s", log_id)


def _deliver(to_email, subject, text, html, log_id):
    """The actual SMTP conversation. Runs on its own thread."""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = Config.MAIL_FROM
    msg["To"] = to_email
    msg["Message-ID"] = make_msgid(domain=Config.MAIL_DOMAIN or None)
    if Config.MAIL_REPLY_TO:
        msg["Reply-To"] = Config.MAIL_REPLY_TO
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        if Config.SMTP_SSL:
            server = smtplib.SMTP_SSL(Config.SMTP_HOST, Config.SMTP_PORT, timeout=20)
        else:
            server = smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=20)
        with server:
            server.ehlo()
            if Config.SMTP_STARTTLS and not Config.SMTP_SSL:
                server.starttls()
                server.ehlo()
            if Config.SMTP_USER:
                server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
            server.send_message(msg)
        _mark(log_id, "sent")
        log.info("sent %r to %s", subject, to_email)
    except Exception as exc:
        # Truncated: an SMTP server can return a very long refusal, and
        # the useful part is always at the front.
        _mark(log_id, "failed", str(exc)[:500])
        log.warning("email to %s failed: %s", to_email, exc)


def send(to_email, subject, text, html=None, *, template="generic",
         reference_type=None, reference_id=None, idempotency_key=None):
    """
    Queue one message. Returns True if it was handed to a thread.

    Never raises. Callers treat the result as advisory -- the email_log
    row is the record that matters.
    """
    to_email = (to_email or "").strip()
    if not to_email:
        return False

    if not configured():
        _record(to_email, subject, template, "skipped",
                error="SMTP is not configured",
                reference_type=reference_type, reference_id=reference_id,
                idempotency_key=idempotency_key)
        log.info("SMTP not configured; skipped %r to %s", subject, to_email)
        return False

    log_id = _record(to_email, subject, template, "queued",
                     reference_type=reference_type, reference_id=reference_id,
                     idempotency_key=idempotency_key)

    # A key that was already used returns no row: the message has been
    # dealt with by an earlier call, so this one stops here.
    if idempotency_key and log_id is None:
        log.info("duplicate suppressed for %s (%s)", to_email, idempotency_key)
        return False

    threading.Thread(
        target=_deliver,
        args=(to_email, subject, text, html, log_id),
        daemon=True,
        name="zion-mail",
    ).start()
    return True
