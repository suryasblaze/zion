"""
The messages themselves.

Each returns (subject, text, html). Plain text is not an afterthought:
some clients show it, spam filters read it, and a receipt that only
exists as HTML is a receipt some customers cannot read.

The HTML is one table of inline styles on purpose. Email clients are not
browsers -- Outlook drops <style> blocks, Gmail strips classes, flexbox
and grid are unreliable -- so this looks plainer than the shop does, and
renders the same everywhere, which matters more.
"""
from decimal import Decimal

from config import Config


def rupees(value):
    """
    Money as a customer reads it: Rs 1,49,900, not 149900.0.

    helpers.rupees() is for JSON -- it hands back a float, and a receipt
    rendered with it says "349.0", which looks like a bug to the person
    who just paid. Indian grouping puts the first separator after three
    digits and every two after that, which Python's own comma format
    does not do.
    """
    try:
        n = int(Decimal(str(value or 0)).quantize(Decimal("1")))
    except Exception:
        return "₹0"

    sign, n = ("-", -n) if n < 0 else ("", n)
    digits = str(n)
    if len(digits) <= 3:
        grouped = digits
    else:
        head, tail = digits[:-3], digits[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        grouped = ",".join(parts) + "," + tail
    return f"{sign}₹{grouped}"

GOLD = "#8F7222"
INK = "#171310"
SOFT = "#5F564B"
LINE = "#E3DFD5"
PAPER = "#FCFBF9"


def _shell(heading, lede, body_html, button=None, footer_note=None):
    """Common frame: wordmark, heading, body, optional button, footer."""
    site = Config.PUBLIC_SITE_URL
    cta = ""
    if button:
        label, href = button
        cta = f"""
        <tr><td style="padding:28px 0 4px;">
          <a href="{href}" style="background:{GOLD};color:{PAPER};text-decoration:none;
             padding:14px 28px;display:inline-block;font-size:15px;letter-spacing:.04em;">
            {label}</a>
        </td></tr>"""

    note = ""
    if footer_note:
        note = f"""<p style="margin:18px 0 0;color:{SOFT};font-size:12.5px;line-height:1.6;">
                     {footer_note}</p>"""

    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:{PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:{PAPER};padding:32px 16px;">
 <tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#ffffff;border:1px solid {LINE};">
   <tr><td style="padding:34px 34px 0;">
     <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:19px;
               letter-spacing:.26em;color:{INK};">ZION</p>
     <p style="margin:4px 0 0;font-size:10.5px;letter-spacing:.28em;
               text-transform:uppercase;color:{GOLD};">Herbal Teas</p>
   </td></tr>
   <tr><td style="padding:26px 34px 34px;font-family:Helvetica,Arial,sans-serif;">
     <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;
                font-size:24px;font-weight:normal;color:{INK};">{heading}</h1>
     <p style="margin:0 0 18px;color:{SOFT};font-size:15px;line-height:1.65;">{lede}</p>
     {body_html}
     <table role="presentation" cellpadding="0" cellspacing="0">{cta}</table>
     {note}
   </td></tr>
   <tr><td style="padding:18px 34px 30px;border-top:1px solid {LINE};
                  font-family:Helvetica,Arial,sans-serif;">
     <p style="margin:0;color:{SOFT};font-size:12px;line-height:1.6;">
       ZION Herbs · Tamil Nadu, India<br>
       <a href="{site}" style="color:{GOLD};">{site.split('//')[-1]}</a>
     </p>
   </td></tr>
  </table>
 </td></tr>
</table>
</body></html>"""


# ------------------------------------------------------- password reset

def password_reset(name, link, minutes):
    subject = "Reset your ZION password"
    text = f"""Hello {name or 'there'},

Someone asked to reset the password on your ZION account. If that was
you, open this link within {minutes} minutes:

{link}

It can be used once. If you did not ask for this, ignore this email --
your password has not changed and nobody has been given access.

ZION Herbs
{Config.PUBLIC_SITE_URL}
"""
    html = _shell(
        "Reset your password",
        f"Someone asked to reset the password on your ZION account. "
        f"If that was you, the link below works once, for {minutes} minutes.",
        "",
        button=("Choose a new password", link),
        footer_note=(
            "If you did not ask for this, you can ignore this email. Your password "
            "has not been changed and nobody has been given access to your account."
        ),
    )
    return subject, text, html


# --------------------------------------------------------- order placed

def order_receipt(order, items):
    number = order["order_number"]
    subject = f"Your ZION order {number}"

    lines = "\n".join(
        f"  {i['quantity']} x {i['product_name']} ({i['variant_label']})"
        f"  {rupees(i['line_total'])}"
        for i in items
    )
    text = f"""Thank you — we have your order.

Order {number}

{lines}

  Subtotal   {rupees(order.get('subtotal', 0))}
  Shipping   {rupees(order.get('shipping_total', 0))}
  Total      {rupees(order.get('total', 0))}

We will send another note when it ships, usually within a working day.

ZION Herbs
{Config.PUBLIC_SITE_URL}
"""

    rows = "".join(
        f"""<tr>
              <td style="padding:9px 0;border-bottom:1px solid {LINE};color:{INK};font-size:14px;">
                {i['quantity']} &times; {i['product_name']}
                <span style="color:{SOFT};">· {i['variant_label']}</span>
              </td>
              <td style="padding:9px 0;border-bottom:1px solid {LINE};text-align:right;
                         color:{INK};font-size:14px;white-space:nowrap;">
                {rupees(i['line_total'])}
              </td>
            </tr>"""
        for i in items
    )

    totals = "".join(
        f"""<tr>
              <td style="padding:5px 0;color:{SOFT};font-size:13.5px;">{label}</td>
              <td style="padding:5px 0;text-align:right;color:{SOFT};font-size:13.5px;">
                {rupees(value)}</td>
            </tr>"""
        for label, value in (
            ("Subtotal", order.get("subtotal", 0)),
            ("Shipping", order.get("shipping_total", 0)),
        )
    )

    body = f"""
      <p style="margin:0 0 14px;font-size:13px;letter-spacing:.12em;
                text-transform:uppercase;color:{SOFT};">Order {number}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        {rows}
        {totals}
        <tr>
          <td style="padding:12px 0 0;color:{INK};font-size:16px;">Total</td>
          <td style="padding:12px 0 0;text-align:right;color:{INK};font-size:19px;
                     font-family:Georgia,serif;">{rupees(order.get('total', 0))}</td>
        </tr>
      </table>"""

    html = _shell(
        "Thank you — we have your order",
        "We will send another note the moment it ships, usually within a working day.",
        body,
        button=("View your orders", f"{Config.PUBLIC_SITE_URL}/account"),
    )
    return subject, text, html


# -------------------------------------------------------- order shipped

def order_shipped(order):
    number = order["order_number"]
    subject = f"Your ZION order {number} is on its way"
    tracking = (order.get("tracking_number") or "").strip()

    track_line = f"\nTracking: {tracking}\n" if tracking else "\n"
    text = f"""Good news — order {number} has left us.
{track_line}
It is usually two to four days across Tamil Nadu, a little longer
elsewhere in India.

ZION Herbs
{Config.PUBLIC_SITE_URL}
"""

    body = ""
    if tracking:
        body = f"""<p style="margin:0 0 6px;font-size:12.5px;letter-spacing:.12em;
                             text-transform:uppercase;color:{SOFT};">Tracking</p>
                   <p style="margin:0;font-size:17px;color:{INK};">{tracking}</p>"""

    html = _shell(
        f"Order {number} is on its way",
        "It is usually two to four days across Tamil Nadu, a little longer elsewhere in India.",
        body,
        button=("View your orders", f"{Config.PUBLIC_SITE_URL}/account"),
    )
    return subject, text, html


# ------------------------------------------------------- status change

# What each step means to the person waiting, rather than what it means
# in the admin panel. "packed" is not here on purpose: it is an internal
# state, and an email that says nothing a customer can act on is one
# more reason to stop opening them.
STATUS_COPY = {
    "confirmed": (
        "Your order is confirmed",
        "We have checked it over and it is going into the packing queue. "
        "The next note will be when it leaves us.",
    ),
    "delivered": (
        "Your order has arrived",
        "It should be with you now. If anything is missing or damaged, reply to this "
        "email and we will put it right.",
    ),
    "cancelled": (
        "Your order has been cancelled",
        "Nothing further will be sent. Anything already paid is refunded to the original "
        "method, usually within five working days.",
    ),
    "refunded": (
        "Your order has been refunded",
        "The amount is on its way back to the method you paid with, usually within five "
        "working days.",
    ),
}


def order_status(order, status):
    """None when this status is not worth an email."""
    copy = STATUS_COPY.get(status)
    if not copy:
        return None

    heading, line = copy
    number = order["order_number"]
    subject = f"{heading.replace('Your order', f'Order {number}')}"

    text = f"""{heading}.

Order {number}

{line}

ZION Herbs
{Config.PUBLIC_SITE_URL}
"""
    html = _shell(
        heading,
        line,
        f"""<p style="margin:0;font-size:12.5px;letter-spacing:.12em;
                      text-transform:uppercase;color:{SOFT};">Order {number}</p>""",
        button=("View your orders", f"{Config.PUBLIC_SITE_URL}/account"),
    )
    return subject, text, html


# ------------------------------------------------------------ welcome

def welcome(name, *, set_by_admin=False, temp_note=None):
    subject = "Your ZION account"
    opening = (
        "We have set up an account for you."
        if set_by_admin
        else "Thank you for creating an account."
    )
    extra = f"\n{temp_note}\n" if temp_note else "\n"

    text = f"""Hello {name or 'there'},

{opening}
{extra}
You can sign in here:
{Config.PUBLIC_SITE_URL}/signin

Your account keeps your order history, your ZION Coins and your referral
link in one place.

ZION Herbs
{Config.PUBLIC_SITE_URL}
"""
    html = _shell(
        "Your ZION account",
        f"{opening} It keeps your order history, your ZION Coins and your referral "
        "link in one place.",
        f"""<p style="margin:0;color:{SOFT};font-size:14px;">{temp_note}</p>""" if temp_note else "",
        button=("Sign in", f"{Config.PUBLIC_SITE_URL}/signin"),
    )
    return subject, text, html
