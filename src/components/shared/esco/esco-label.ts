import type { EscoLanguage } from '@/types/contacts/esco-types';

/**
 * Bilingual ESCO label picker (ADR-601).
 * SSoT for the `language === 'el' ? labels.el : labels.en` selection shared by
 * EscoOccupationPicker and EscoSkillPicker (display + secondary label).
 */
export function pickBilingualLabel(
  labels: { el: string; en: string },
  language: EscoLanguage,
): string {
  return language === 'el' ? labels.el : labels.en;
}

/**
 * Resolve the active + secondary ESCO display language (ADR-601).
 * SSoT for the `language ?? (i18n.language === 'el' ? 'el' : 'en')` derivation
 * shared by EscoOccupationPicker and EscoSkillPicker.
 */
export function resolveEscoLang(
  language: EscoLanguage | undefined,
  i18nLanguage: string,
): { lang: EscoLanguage; otherLang: EscoLanguage } {
  const lang: EscoLanguage = language ?? (i18nLanguage === 'el' ? 'el' : 'en');
  return { lang, otherLang: lang === 'el' ? 'en' : 'el' };
}
