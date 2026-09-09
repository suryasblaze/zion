"""The customer's wallet: balance, ledger, and a redemption quote."""
from flask import Blueprint, g, request

from services import wallet_service
from utils.auth import login_required
from utils.helpers import fail, ok, paginate_args, to_jsonable

bp = Blueprint("wallet", __name__, url_prefix="/api/wallet")


@bp.get("")
@login_required
def summary():
    return ok(to_jsonable(wallet_service.summary(g.user["id"])))


@bp.get("/history")
@login_required
def history():
    page, limit, offset = paginate_args(default_limit=50)
    rows = wallet_service.history(g.user["id"], limit, offset)
    return ok(to_jsonable(rows), meta={"page": page, "limit": limit})


@bp.get("/quote")
@login_required
def quote():
    """
    How many coins can be spent on an order of this size. Read-only --
    the actual debit happens inside the order transaction, never here.
    """
    try:
        subtotal = float(request.args.get("subtotal", 0))
    except ValueError:
        return fail("Subtotal must be a number.", 422)

    requested = request.args.get("points")
    try:
        requested = int(requested) if requested not in (None, "") else None
    except ValueError:
        return fail("Points must be a whole number.", 422)

    return ok(to_jsonable(
        wallet_service.redemption_quote(g.user["id"], subtotal, requested)
    ))
