/**
 * @fileoverview Section Category Labels
 * @description i18n keys for obligation section categories
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */
import type { SectionCategory } from "@/types/obligations";

// 🏢 ENTERPRISE: i18n keys for category labels
// Labels are translated at runtime by components using useTranslation
export const categoryLabels: Record<SectionCategory, string> = {
  general: "obligations.categories.general",
  construction: "obligations.categories.construction",
  materials: "obligations.categories.materials",
  systems: "obligations.categories.systems",
  finishes: "obligations.categories.finishes",
  installations: "obligations.categories.installations",
  safety: "obligations.categories.safety",
  environment: "obligations.categories.environment",
};
