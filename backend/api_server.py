"""Local IndicXlit HTTP API for the Kannada editor frontend."""

from __future__ import annotations

import logging
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from inference_service import SUPPORTED_LANGS, service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("indicxlit-api")

# Ensure checkpoint loading works on PyTorch 2.6+.
os.environ.setdefault("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "1")

app = Flask(__name__)
# Any local origin: Vite picks a different port whenever the default is taken,
# and a hardcoded port list silently breaks transliteration when it does.
# The server only binds to 127.0.0.1, so this stays local either way.
CORS(
    app,
    resources={
        r"/*": {"origins": [r"http://localhost:\d+", r"http://127\.0\.0\.1:\d+"]}
    },
)


@app.get("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "model_loaded": service.ready,
            "supported_langs": sorted(SUPPORTED_LANGS),
        }
    )


@app.post("/transliterate")
def transliterate():
    if not service.ready:
        return jsonify({"error": "Model is still loading."}), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be JSON."}), 400

    text = payload.get("text", "")
    lang = payload.get("lang", "kn")

    if not isinstance(text, str) or not isinstance(lang, str):
        return jsonify({"error": "'text' and 'lang' must be strings."}), 400

    try:
        result = service.transliterate(text=text, lang=lang, rescore=False)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        logger.exception("Transliteration failed for text=%r lang=%r", text, lang)
        return jsonify({"error": "Internal transliteration error."}), 500

    return jsonify({"result": result})


def create_app():
    """Load the IndicXlit model once at process start."""
    logger.info("Loading IndicXlit model (one-time)...")
    service.load()
    logger.info("IndicXlit model ready.")
    return app


if __name__ == "__main__":
    create_app()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    # threaded=False avoids concurrent Fairseq/generator race conditions.
    app.run(host=host, port=port, debug=False, threaded=False)
