'use client';

/**
 * ADR-510 Φ2E #5 — line Properties palette row/section.
 *
 * Γενικεύθηκε (ADR-507) στο κοινό `EntityPropertyRow`/`EntityPropertySection`
 * (SSoT — μοιράζεται με τη γραμμοσκίαση). Αυτό το module κρατά μόνο τα line-named
 * re-exports ώστε το import path του `LinePropertiesTab` να μένει σταθερό.
 */

export {
  EntityPropertyRow as LinePropertyRow,
  EntityPropertySection as LinePropertySection,
} from '../entity-properties/EntityPropertyRow';
