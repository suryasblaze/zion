"""
Send one real email, and say exactly what happened.

    python send_test_email.py you@example.com

The point is the failure cases. "The receipt never arrived" has a dozen
causes -- wrong host, wrong port, credentials refused, TLS refused, the
provider rejecting the From address, the message delivered and filed as
spam -- and the API cannot tell you which, because it sends on a
background thread and swallows the error into email_log by design.

This does the same send in the foreground, with the error printed.

It does not touch email_log: a test is not a record of a message the
shop sent, and polluting that table makes the real failures harder to
find later.
"""
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import make_msgid

from config import Config

GREEN, RED, YELLOW, DIM, OFF = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"


def ok(msg):
    print(f"  {GREEN}ok{OFF}  {msg}")


def bad(msg, hint=None):
    print(f"  {RED}--{OFF}  {msg}")
    if hint:
        print(f"      {DIM}{hint}{OFF}")


def warn(msg, hint=None):
    print(f"  {YELLOW}--{OFF}  {msg}")
    if hint:
        print(f"      {DIM}{hint}{OFF}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    to = sys.argv[1].strip()

    print("\nZION Herbs - test email")
    print("=" * 46)

    # ------------------------------------------------ configuration
    print("\nConfiguration\n" + "-" * 46)
    if not Config.SMTP_HOST:
        bad("SMTP_HOST is not set",
            "Nothing is sent while this is empty. The shop knows, and says so "
            "instead of claiming it emailed a receipt.")
        return 1
    if not Config.MAIL_FROM:
        bad("MAIL_FROM is not set", "Set it to an address on a domain you control.")
        return 1

    ok(f"host    {Config.SMTP_HOST}:{Config.SMTP_PORT}")
    ok(f"from    {Config.MAIL_FROM}")
    ok(f"user    {Config.SMTP_USER or '(none - no authentication)'}")

    mode = "implicit TLS" if Config.SMTP_SSL else (
        "STARTTLS" if Config.SMTP_STARTTLS else "NONE")
    if mode == "NONE":
        warn("transport is unencrypted",
             "Credentials will not be sent over it -- the sender refuses. "
             "Use port 587 with SMTP_STARTTLS=true, or 465 with SMTP_SSL=true.")
    else:
        ok(f"tls     {mode}")

    if Config.PUBLIC_SITE_URL.startswith("http://localhost"):
        warn("PUBLIC_SITE_URL is still localhost",
             "Reset links in real emails would point at your laptop.")

    # -------------------------------------------------------- send
    print("\nSending\n" + "-" * 46)

    msg = EmailMessage()
    msg["Subject"] = "ZION test email"
    msg["From"] = Config.MAIL_FROM
    msg["To"] = to
    msg["Message-ID"] = make_msgid(domain=Config.MAIL_DOMAIN or None)
    if Config.MAIL_REPLY_TO:
        msg["Reply-To"] = Config.MAIL_REPLY_TO
    msg.set_content(
        "This is a test from the ZION Herbs shop.\n\n"
        "If you are reading it, receipts and password reset links will reach "
        "customers the same way.\n\n"
        f"Sent via {Config.SMTP_HOST} as {Config.MAIL_FROM}.\n"
    )

    ctx = ssl.create_default_context()
    try:
        if Config.SMTP_SSL:
            server = smtplib.SMTP_SSL(Config.SMTP_HOST, Config.SMTP_PORT,
                                      timeout=20, context=ctx)
        else:
            server = smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=20)

        with server:
            server.ehlo()
            ok("connected")

            if Config.SMTP_STARTTLS and not Config.SMTP_SSL:
                server.starttls(context=ctx)
                server.ehlo()
                ok("STARTTLS negotiated and certificate verified")
            elif Config.SMTP_SSL:
                ok("certificate verified")

            if Config.SMTP_USER:
                if not isinstance(server.sock, ssl.SSLSocket):
                    bad("refusing to authenticate over an unencrypted connection",
                        "SMTP AUTH is base64, not encryption. Turn on TLS first.")
                    return 1
                server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
                ok("authenticated")

            server.send_message(msg)
            ok(f"accepted for delivery to {to}")

    except smtplib.SMTPAuthenticationError as exc:
        bad(f"the server refused those credentials: {exc}",
            "For most providers SMTP_USER is an API key name or the full "
            "address, not the mailbox's login.")
        return 1
    except smtplib.SMTPSenderRefused as exc:
        bad(f"the server refused the From address: {exc}",
            f"{Config.MAIL_FROM} must be on a domain verified with this provider.")
        return 1
    except ssl.SSLCertVerificationError as exc:
        bad(f"certificate could not be verified: {exc}",
            "Use a properly issued certificate, or add its CA to this server's "
            "trust store. Do not turn verification off -- the password goes "
            "over this connection.")
        return 1
    except (smtplib.SMTPException, OSError) as exc:
        bad(f"{type(exc).__name__}: {exc}",
            "A timeout here is usually the provider's port being blocked "
            "outbound. Many hosts block 25; 587 and 465 are normally open.")
        return 1

    # ------------------------------------------------------- after
    print("\n" + "=" * 46)
    print(f"  Sent. Now go and look in {to}.\n")
    print(f"  {DIM}Accepted is not delivered. If it is not there in a few")
    print("  minutes, check spam -- and if it landed there, the fix is")
    print("  SPF and DKIM records on the sending domain, not this code.")
    print(f"  Most providers show both in their dashboard.{OFF}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
