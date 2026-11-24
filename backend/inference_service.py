"""IndicXlit inference wrapper — loads the model once and serves candidates."""

from __future__ import annotations

import contextlib
import io
import threading
import os
import re
from typing import List, Optional

# Fairseq/PyTorch 2.6+ checkpoint unpickling
os.environ.setdefault("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "1")

from xlit_translit import Model

SUPPORTED_LANGS = frozenset(
    {
        "as",
        "bn",
        "brx",
        "gom",
        "gu",
        "hi",
        "kn",
        "ks",
        "mai",
        "ml",
        "mni",
        "mr",
        "ne",
        "or",
        "pa",
        "sa",
        "sd",
        "si",
        "ta",
        "te",
        "ur",
    }
)

_ROMAN_WORD = re.compile(r"^[A-Za-z]+$")


class TransliterationService:
    """Thin wrapper around the official AI4Bharat IndicXlit inference code."""

    def __init__(self, beam: int = 5, nbest: int = 5):
        if beam < nbest:
            raise ValueError("beam must be >= nbest")
        self.beam = beam
        self.nbest = nbest
        self._model: Optional[Model] = None
        # Fairseq's generator is not thread-safe: one word at a time.
        self._lock = threading.Lock()

    def load(self) -> None:
        if self._model is not None:
            return
        # Suppress Fairseq interactive logging noise during load/warmup.
        with contextlib.redirect_stdout(io.StringIO()):
            self._model = Model(beam=self.beam, nbest=self.nbest)

    @property
    def ready(self) -> bool:
        return self._model is not None

    def transliterate(
        self,
        text: str,
        lang: str = "kn",
        rescore: bool = False,
    ) -> List[str]:
        if self._model is None:
            raise RuntimeError("Model is not loaded. Call load() at startup.")

        lang = (lang or "kn").strip().lower()
        if lang not in SUPPORTED_LANGS:
            raise ValueError(
                f"Unsupported lang '{lang}'. Supported: {sorted(SUPPORTED_LANGS)}"
            )

        word = (text or "").strip()
        if not word:
            return []
        if not _ROMAN_WORD.match(word):
            raise ValueError("Only a single Roman/English alphabetic word is supported.")

        buf = io.StringIO()
        with self._lock, contextlib.redirect_stdout(buf):
            result = self._model.translate_word(word, lang, rescore=rescore)

        if not result:
            return []
        # Deduplicate while preserving beam order.
        seen = set()
        candidates: List[str] = []
        for item in result:
            if item and item not in seen:
                seen.add(item)
                candidates.append(item)
        return candidates


# Process-wide singleton used by the HTTP layer.
service = TransliterationService(beam=5, nbest=5)
