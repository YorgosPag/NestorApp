# ADR-041: Distance Label Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Drawing System |
| **Canonical Location** | `renderDistanceLabel()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `renderDistanceLabel()` from `distance-label-utils.ts`

---

## Changelog

- **2026-07-16** — Type-safety hardening (no behavior change): `beginDistanceLabel`
  now types its `defaults` bag (and the returned `opts`) as
  `Required<DistanceLabelOptions>`. The bag is exhaustive by construction
  (`opts = { ...defaults, ...options }`), so this makes the guarantee explicit and
  lets downstream reads drop optional-chaining.
