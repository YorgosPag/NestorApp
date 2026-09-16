# 🚨 ΠΟΤΕ `TMP` / `TEMP` / `TMPDIR` ΩΣ ΜΕΤΑΒΛΗΤΗ SHELL ΣΕ GIT BASH

**Μετρημένο 2026-09-16 (ADR-598 G13 / CHECK 12).**

## Ο κανόνας
Σε scripts και inline εντολές Git Bash (commit scripts, προσωρινά index, οτιδήποτε):
- ❌ `TMP="…"`, `TEMP="…"`, `TMPDIR="…"` — ΠΟΤΕ, ούτε για ένα αρχείο, ούτε «τοπικά».
- ✅ Άλλο όνομα: `IDX=…`, `WORK_INDEX=…`, `T=…`.

## Γιατί
- Στο Git Bash τα `TMP`/`TEMP` είναι **εξαγόμενες** μεταβλητές των Windows. Ανάθεση χωρίς `export`
  αλλάζει την **εξαγόμενη** τιμή.
- Το `git.exe` δίνει στα παιδιά του (hooks) `TMPDIR` = την τιμή του `TMP`. Αποδείχθηκε με
  `git -c alias…`, χωρίς hook: `TMP=<αρχείο>` ⇒ `TMPDIR=<αρχείο>` ⇒ `mktemp: … Not a directory`.
- Περιστατικό: ο παλιός CHECK 12 έκανε `$(mktemp)` → κενό → `> ""` → exit 1, με `2>/dev/null` ⇒ ψευδές
  «license-checker produced no output». Μια εβδομάδα διάγνωσης έψαχνε το `core.hooksPath`.
  A/B: μόνο η μετονομασία `TMP`→`IDX` ⇒ ❌→✅ (3/3).

## Και για όσους γράφουν πύλες
- Κράτα την έξοδο εργαλείων **στη μνήμη** (`spawnSync`, `maxBuffer`), όχι σε προσωρινό αρχείο.
- Ποτέ `2>/dev/null` σε εντολή που κρίνει πύλη: το stderr είναι η απόδειξη.
- Ταξινόμηση αποτυχίας: `scripts/lib/spawn-outcome.js` (SSoT).
