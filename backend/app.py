"""ZION Herbs API. Run: python app.py"""
import traceback

from flask import Flask, jsonify, request
from flask_cors import CORS

import db
from config import Config
from utils.helpers import fail


def create_app():
    Config.validate()

    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 9 * 1024 * 1024  # uploads
    app.url_map.strict_slashes = False

    CORS(
        app,
        resources={r"/api/*": {"origins": Config.CORS_ORIGINS}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    )

    db.init_pool()

    from controllers.admin_controller import bp as admin_bp
    from controllers.auth_controller import bp as auth_bp
    from controllers.catalog_controller import bp as catalog_bp
    from controllers.checkout_controller import bp as checkout_bp
    from controllers.content_controller import bp as content_bp
    from controllers.media_controller import bp as media_bp
    from controllers.payment_controller import bp as payment_bp
    from controllers.referral_controller import bp as referral_bp
    from controllers.seo_controller import bp as seo_bp
    from controllers.wallet_controller import bp as wallet_bp

    for blueprint in (auth_bp, catalog_bp, checkout_bp, referral_bp,
                      wallet_bp, content_bp, admin_bp, seo_bp,
                      payment_bp, media_bp):
        app.register_blueprint(blueprint)

    @app.get("/api/health")
    def health():
        try:
            db.scalar("select 1")
            return jsonify({"success": True, "status": "ok", "database": "connected"})
        except Exception as exc:
            return jsonify({"success": False, "status": "degraded", "error": str(exc)}), 503

    # ---------------------------------------------------------- errors
    @app.errorhandler(404)
    def not_found(_):
        return fail(f"No route matches {request.path}.", 404, code="not_found")

    @app.errorhandler(405)
    def bad_method(_):
        return fail(f"{request.method} is not allowed here.", 405, code="method_not_allowed")

    @app.errorhandler(413)
    def too_large(_):
        return fail("That file is too large.", 413, code="payload_too_large")

    @app.errorhandler(Exception)
    def unhandled(exc):
        # Log the detail; never leak internals to the client.
        app.logger.error("Unhandled: %s\n%s", exc, traceback.format_exc())
        if Config.DEBUG:
            return fail(f"{type(exc).__name__}: {exc}", 500, code="server_error")
        return fail("Something went wrong on our side. Please try again.", 500,
                    code="server_error")

    @app.teardown_appcontext
    def _teardown(_):
        pass

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
