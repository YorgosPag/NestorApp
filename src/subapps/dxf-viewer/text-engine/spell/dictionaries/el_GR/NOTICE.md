# el_GR Hunspell dictionary — license notice

This directory bundles the Greek (el_GR) Hunspell dictionary files
(`el_GR.aff`, `el_GR.dic`) sourced from the official LibreOffice
dictionaries repository:

  https://github.com/LibreOffice/dictionaries/tree/master/el_GR

## License

The dictionary is **tri-licensed** under one of:

  - **MPL 1.1** (Mozilla Public License 1.1)
  - GPL 2.0
  - LGPL 2.1

The Nestor application redistributes these files under **MPL 1.1** —
this allows commercial redistribution and proprietary use of the
surrounding application code; only modifications to the dictionary
files themselves must remain MPL.

## Attribution (per LibreOffice README)

Maintained 2015+ by Γιώργος Γέγος, with the kind help of Nick Demou.
Conversion work by Voula Sanida and Panayotis Vryonis. Many
contributors added words to the vocabulary over the years — see
upstream `README_el_GR.txt` for the full list.

## What you may NOT do (per MPL 1.1)

  - Modify `el_GR.aff` or `el_GR.dic` and ship the modifications under
    a license incompatible with MPL.

## What you MAY do (per MPL 1.1)

  - Ship the unmodified files inside any product, including commercial
    closed-source applications such as Nestor.
  - Charge for the application (the dictionary itself remains free).
  - Add company-specific terms via the Firestore-backed custom
    dictionary (collection `text_custom_dictionary`) — this is NOT a
    modification of the dictionary files; the custom dictionary is a
    separate data layer maintained by the operator.

## Reference

CLAUDE.md SOS. SOS. N.5 — MPL allowed only as a data-asset license,
never as an npm code dependency. This rule is documented in
ADR-344 §Q6 (2026-05-12).
