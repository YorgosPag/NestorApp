# Ανιχνευτής προσώπων — YuNet (ADR-884 Φ2ζ ζ4)

Το μοντέλο που χρησιμοποιεί ο ψήστης των περιηγήσεων 360° για το **αυτόματο θόλωμα προσώπων**
(`src/server/spatial-tour/face-detection/`).

| | |
|---|---|
| Αρχείο | `face_detection_yunet_2026may.onnx` (δυναμικές διαστάσεις εισόδου `[1,3,height,width]`) |
| Πηγή | https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet — commit `26cc381e4d2594bb9f47a26eb8fd96c94a13660d` (2026-05-22) |
| Άδεια | **MIT** (κώδικας και βάρη) — `LICENSE` σε αυτόν τον φάκελο, © 2020 Shiqi Yu |
| sha256 | `ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0` |
| Runtime | `onnxruntime-web` (WASM, MIT) — όχι `onnxruntime-node`: το image είναι `node:22-alpine` (musl) |

- Το sha256 είναι **καρφωμένο στον κώδικα** (`TOUR_FACE_MODEL_SHA256`) και επαληθεύεται σε κάθε φόρτωση. Αλλαγμένο ή ελλιπές
  αρχείο ⇒ σφάλμα ανιχνευτή ⇒ το ψήσιμο **αναβάλλεται** (fail-closed). Ποτέ δεν δημοσιεύεται λήψη χωρίς σάρωση.
- Νέο μοντέλο ⇒ νέο αρχείο + νέο sha256 + **νέα** `TOUR_FACE_DETECTOR_VERSION` (οι λήψεις ξανασαρώνονται μέσω backfill).
- Στο image φτάνει με το `COPY data/models` του `Dockerfile`. Η διαδρομή αλλάζει με το env `FACE_MODEL_DIR`.
