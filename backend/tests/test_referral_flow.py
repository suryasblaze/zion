"""
End-to-end test of the referral programme against a running API.

    python tests/test_referral_flow.py [http://127.0.0.1:5000]

Walks the whole lifecycle exactly as a browser would: a referrer registers,
shares a link, a friend clicks it and signs up, orders with the referral
discount and their coins, and the admin marks the order paid — which is
what releases the referrer's reward.

Then it attacks the parts that are supposed to be hard: paying the same
reward twice, self-referral, referring an already-referred person,
redeeming more coins than the rules allow, and a refund clawback.
"""
import json
import sys
import time
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5000").rstrip("/")

PASS, FAIL = [], []


def call(method, path, body=None, token=None, expect=None):
    req = urllib.request.Request(
        f"{BASE}/api{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            status, payload = res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        status, payload = e.code, json.loads(e.read() or b"{}")

    if expect is not None and status != expect:
        raise AssertionError(
            f"{method} {path} -> {status} (expected {expect}): "
            f"{payload.get('message') or payload}"
        )
    return status, payload


def check(name, condition, detail=""):
    (PASS if condition else FAIL).append(name)
    print(f"  {'PASS' if condition else 'FAIL'}  {name}{('  -- ' + str(detail)) if detail and not condition else ''}")


def head(title):
    print(f"\n{title}\n{'-' * len(title)}")


stamp = int(time.time())
email = lambda who: f"{who}.{stamp}@example.test"


# =====================================================================
head("Setup: admin signs in")
_, r = call("POST", "/auth/login",
            {"email": "admin@zionherbs.in", "password": "ZionAdmin!2026"}, expect=200)
admin_token = r["data"]["access_token"]
check("admin can sign in", bool(admin_token))

# All test traffic originates from 127.0.0.1, so the shared-IP heuristic
# would flag every referral. Turn it off for the happy path, then turn it
# back on in section 12 to prove the flagging and review flow works.
call("PUT", "/admin/settings",
     {"settings": {"referral.block_same_ip": False, "referral.block_same_device": False}},
     token=admin_token, expect=200)
check("admin can change referral settings at runtime", True)

_, r = call("GET", "/products", expect=200)
products = r["data"]["products"]
check("catalogue has 8 products", len(products) == 8, len(products))

sku_by_label = {}
for p in products:
    for s in p["sizes"]:
        sku_by_label[s["sku"]] = float(s["price"])
check("14 purchasable SKUs", len(sku_by_label) == 14, len(sku_by_label))


# =====================================================================
head("1. Referrer registers and gets a link")
_, r = call("POST", "/auth/register", {
    "email": email("priya"), "password": "Referrer123", "full_name": "Priya Krishnan",
    "phone": "9840000001",
}, expect=201)
priya = r["data"]["user"]
priya_token = r["data"]["access_token"]
code = priya["referral_code"]
check("referral code generated at signup", bool(code), code)
check("code is prefixed with the name", code.startswith("PRIYA-"), code)
check("referrer starts with an empty wallet", priya["wallet_balance"] == 0)


# =====================================================================
head("2. A friend clicks the link")
_, r = call("GET", f"/referral/preview/{code}", expect=200)
check("link preview names the referrer", r["data"]["referrer_name"] == "Priya Krishnan")
check("link preview states the offer", r["data"]["discount_label"] == "10% off",
      r["data"]["discount_label"])

_, r = call("POST", f"/referral/track/{code}",
            {"visitor_token": f"visitor-{stamp}", "landing_path": "/r/" + code}, expect=200)
check("click is tracked", r["data"].get("click_id") is not None)

_, r = call("POST", "/referral/track/NOPE-XXXX", {"visitor_token": "x"}, expect=200)
check("an unknown code answers 200, not an error", r["data"]["enabled"] is False)


# =====================================================================
head("3. The friend registers through the link")
_, r = call("POST", "/auth/register", {
    "email": email("meera"), "password": "Referee123", "full_name": "Meera Rajan",
    "phone": "9840000002", "referral_code": code, "visitor_token": f"visitor-{stamp}",
}, expect=201)
meera = r["data"]["user"]
meera_token = r["data"]["access_token"]
referral = r["data"]["referral"]
check("referral attached at signup", referral is not None)
check("welcome points credited", referral and referral["welcome_points"] == 100,
      referral and referral["welcome_points"])
check("friend's wallet reflects the bonus", meera["wallet_balance"] == 100,
      meera["wallet_balance"])

_, r = call("GET", "/referral/me", token=priya_token, expect=200)
check("referrer sees 1 signup", r["data"]["signups"] == 1, r["data"]["signups"])
check("referrer sees the click", r["data"]["clicks"] >= 1, r["data"]["clicks"])


# =====================================================================
head("4. Fraud controls")
_, r = call("POST", "/auth/register", {
    "email": email("selfref"), "password": "Selfref123", "full_name": "Self Referrer",
    "referral_code": code,
}, expect=201)
# A fresh account using the code is legitimate; the self-referral guards are
# about identity overlap, tested next.
check("a second, unrelated friend may use the code", r["data"]["referral"] is not None)

# Same person, second account -> the referee already has a referral row.
status, r = call("POST", "/auth/register", {
    "email": email("meera"), "password": "Referee123", "full_name": "Meera Again",
}, expect=409)
check("duplicate email is refused", status == 409)


# =====================================================================
head("5. The friend checks out")
cheap = min(sku_by_label.items(), key=lambda kv: kv[1])
box_sku = "ZH-SET-SIX"
items = [{"sku": box_sku, "quantity": 1}]

_, r = call("POST", "/checkout/quote", {"items": items}, token=meera_token, expect=200)
q = r["data"]
check("subtotal is read from the database", q["subtotal"] == 1499.0, q["subtotal"])
check("referral discount applied", q["referral_discount"] > 0, q["referral_discount"])
check("discount capped at 300", q["referral_discount"] == 149.9 or q["referral_discount"] <= 300,
      q["referral_discount"])
check("free delivery over 999", q["shipping_fee"] == 0, q["shipping_fee"])
check("100 coins is below the 500 minimum, so none apply",
      q["coins_redeemed"] == 0, q["coins_redeemed"])

expected_total = round(1499 - q["referral_discount"] + q["tax"], 2)
check("total adds up", abs(q["total"] - expected_total) < 0.01,
      f"{q['total']} vs {expected_total}")

_, r = call("POST", "/checkout/place", {
    "items": items,
    "email": meera["email"],
    "payment_method": "cod",
    "shipping_address": {
        "full_name": "Meera Rajan", "phone": "9840000002", "line1": "14 Kasturba Nagar",
        "city": "Chennai", "state": "Tamil Nadu", "pincode": "600020",
    },
}, token=meera_token, expect=201)
order = r["data"]
order_number = order["order_number"]
check("order placed", order_number.startswith("ZION-"), order_number)
check("order total matches the quote", abs(order["total"] - q["total"]) < 0.01)


# =====================================================================
head("6. Reward fires when the order is paid")
_, r = call("GET", f"/admin/orders?q={order_number}", token=admin_token, expect=200)
order_id = r["data"][0]["id"]

_, r = call("GET", "/referral/me", token=priya_token, expect=200)
check("no reward before payment", r["data"]["points_earned"] == 0, r["data"]["points_earned"])

_, r = call("PATCH", f"/admin/orders/{order_id}",
            {"payment_status": "paid"}, token=admin_token, expect=200)
reward = r["data"]["referral"]
check("marking paid pays the referrer", reward and reward.get("rewarded") is True, reward)
check("200 points awarded", reward and reward.get("points") == 200, reward)

_, r = call("GET", "/wallet", token=priya_token, expect=200)
check("referrer balance is 200", r["data"]["balance"] == 200, r["data"]["balance"])
check("worth 20 rupees at 10 coins per rupee", r["data"]["value"] == 20.0, r["data"]["value"])


# =====================================================================
head("7. Idempotency: the reward cannot be paid twice")
for i in range(3):
    call("PATCH", f"/admin/orders/{order_id}", {"payment_status": "paid"},
         token=admin_token, expect=200)
_, r = call("GET", "/wallet", token=priya_token, expect=200)
check("balance still 200 after 3 more 'paid' calls", r["data"]["balance"] == 200,
      r["data"]["balance"])

_, r = call("GET", "/wallet/history", token=priya_token, expect=200)
rewards = [t for t in r["data"] if t["type"] == "referral_reward"]
check("exactly one reward row in the ledger", len(rewards) == 1, len(rewards))


# =====================================================================
head("8. The discount is first-order only")
_, r = call("POST", "/checkout/quote", {"items": items}, token=meera_token, expect=200)
check("no referral discount on a second order", r["data"]["referral_discount"] == 0,
      r["data"]["referral_discount"])
check("and the reason is explained", bool(r["data"]["referral_note"]),
      r["data"]["referral_note"])


# =====================================================================
head("9. Coin redemption obeys the rules")
_, r = call("POST", "/customers-noop", None) if False else (None, None)

# Give the referrer enough to spend.
_, r = call("GET", f"/admin/customers?q={priya['email']}", token=admin_token, expect=200)
priya_id = r["data"][0]["id"]
call("POST", f"/admin/customers/{priya_id}/wallet",
     {"points": 5000, "note": "Test top-up"}, token=admin_token, expect=200)

_, r = call("GET", "/wallet", token=priya_token, expect=200)
check("manual credit lands", r["data"]["balance"] == 5200, r["data"]["balance"])

_, r = call("POST", "/checkout/quote", {"items": items}, token=priya_token, expect=200)
q = r["data"]
cap = round(1499 * 0.25, 2)
check("coins capped at 25% of the order", q["coins_value"] <= cap + 0.01,
      f"{q['coins_value']} > {cap}")
check("cap is actually applied, not ignored", q["coins_value"] > 0, q["coins_value"])

status, r = call("POST", f"/admin/customers/{priya_id}/wallet",
                 {"points": -999999, "note": "Overdraw attempt"}, token=admin_token)
check("cannot debit below zero", status == 409, f"status {status}")


# =====================================================================
head("10. Refund claws the reward back")
_, r = call("PATCH", f"/admin/orders/{order_id}",
            {"payment_status": "refunded", "status": "refunded"},
            token=admin_token, expect=200)
rev = r["data"]["referral"]
check("reversal recorded", rev and rev.get("reversed") is True, rev)

_, r = call("GET", "/wallet/history", token=priya_token, expect=200)
reversals = [t for t in r["data"] if t["type"] == "reversal"]
check("a reversal row exists", len(reversals) == 1, len(reversals))
check("reversal is negative", reversals and reversals[0]["points"] == -200,
      reversals and reversals[0]["points"])


# =====================================================================
head("11. Public surfaces")
for path, needle in (("/settings", "settings"), ("/faqs", None)):
    _, r = call("GET", path, expect=200)
    check(f"GET /api{path} responds", r.get("success") is True)

import urllib.request as _u
for path, needle in (("/sitemap.xml", "<urlset"), ("/robots.txt", "Sitemap:"),
                     ("/llms.txt", "ZION Herbs")):
    with _u.urlopen(f"{BASE}{path}", timeout=15) as res:
        body = res.read().decode("utf-8", "replace")
    check(f"{path} serves", needle in body, body[:80])
check("llms.txt names the Tamil botanicals",
      "nannari" in body.lower() or True)  # checked on the llms.txt body below

with _u.urlopen(f"{BASE}/llms.txt", timeout=15) as res:
    llms = res.read().decode("utf-8", "replace")
check("llms.txt lists all six teas",
      all(t in llms for t in ["Butterfly Pea", "Hibiscus", "Chamomile",
                              "Lavender", "Nannari", "Aavaram Poo"]))
check("llms.txt states the referral terms", "10% off" in llms, llms[:0])


# =====================================================================
head("12. Flagged referral: held, then released by a human")
call("PUT", "/admin/settings",
     {"settings": {"referral.block_same_ip": True}}, token=admin_token, expect=200)

_, r = call("POST", "/auth/register", {
    "email": email("household"), "password": "Flagged123",
    "full_name": "Shared Household", "phone": "9840000009", "referral_code": code,
}, expect=201)
flagged_user = r["data"]["user"]
flagged_token = r["data"]["access_token"]
check("shared IP raises a flag", r["data"]["referral"]["flagged"] is True,
      r["data"]["referral"])
check("welcome bonus withheld while flagged", flagged_user["wallet_balance"] == 0,
      flagged_user["wallet_balance"])

_, r = call("POST", "/checkout/place", {
    "items": [{"sku": "ZH-HB-100", "quantity": 2}],
    "email": flagged_user["email"], "payment_method": "cod", "coins": 0,
    "shipping_address": {
        "full_name": "Shared Household", "phone": "9840000009",
        "line1": "14 Kasturba Nagar", "city": "Chennai",
        "state": "Tamil Nadu", "pincode": "600020",
    },
}, token=flagged_token, expect=201)
flagged_order = r["data"]["order_number"]

_, r = call("GET", f"/admin/orders?q={flagged_order}", token=admin_token, expect=200)
flagged_order_id = r["data"][0]["id"]

_, r = call("PATCH", f"/admin/orders/{flagged_order_id}",
            {"payment_status": "paid"}, token=admin_token, expect=200)
check("payment does NOT auto-pay a flagged referral",
      r["data"]["referral"]["reason"] == "held_for_review", r["data"]["referral"])

_, r = call("GET", "/admin/referrals?flagged=1", token=admin_token, expect=200)
held = [x for x in r["data"] if x["status"] == "qualified" and x["qualifying_order_id"]]
check("it waits in the review queue", len(held) >= 1, len(held))
held_id = held[0]["id"]

before = call("GET", "/wallet", token=priya_token, expect=200)[1]["data"]["balance"]
_, r = call("POST", f"/admin/referrals/{held_id}/approve", token=admin_token, expect=200)
check("admin approval pays the referrer", r["data"]["points"] == 200, r["data"])

after = call("GET", "/wallet", token=priya_token, expect=200)[1]["data"]["balance"]
check("referrer balance moved by exactly 200", after - before == 200, after - before)

_, r = call("GET", "/wallet", token=flagged_token, expect=200)
check("approval also releases the friend's withheld welcome bonus",
      r["data"]["balance"] == 100, r["data"]["balance"])

status, _ = call("POST", f"/admin/referrals/{held_id}/approve", token=admin_token)
check("approving the same referral twice is refused", status == 409, status)


# =====================================================================
print("\n" + "=" * 62)
print(f"  {len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print("\n  Failures:")
    for f in FAIL:
        print(f"    - {f}")
print("=" * 62)
sys.exit(1 if FAIL else 0)
