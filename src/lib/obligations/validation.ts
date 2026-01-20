import { ObligationDocument, ObligationSection, ObligationArticle, ObligationParagraph } from '@/types/obligations';
// 🏢 ENTERPRISE: i18n support for validation messages
import i18n from '@/i18n/config';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 🏢 ENTERPRISE: Helper function to get translated validation message
const t = (key: string, params?: Record<string, unknown>): string => {
  return i18n.t(`validation.${key}`, { ns: 'obligations', ...params });
};

export function validateObligationDocument(document: ObligationDocument): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!document.title?.trim()) {
    errors.push(t('document.titleRequired'));
  }

  if (!document.projectName?.trim()) {
    errors.push(t('document.projectNameRequired'));
  }

  if (!document.contractorCompany?.trim()) {
    errors.push(t('document.contractorRequired'));
  }

  if (!document.owners || document.owners.length === 0) {
    errors.push(t('document.ownersRequired'));
  }

  if (!document.sections || document.sections.length === 0) {
    warnings.push(t('document.noSections'));
  }

  document.sections?.forEach((section, index) => {
    const sectionErrors = validateSection(section);
    const prefix = t('section.prefix', { index: index + 1 });
    sectionErrors.errors.forEach(error =>
      errors.push(`${prefix}: ${error}`)
    );
    sectionErrors.warnings.forEach(warning =>
      warnings.push(`${prefix}: ${warning}`)
    );
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateSection(section: ObligationSection): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!section.title?.trim()) {
    errors.push(t('section.titleRequired'));
  }

  if (!section.number?.trim()) {
    errors.push(t('section.numberRequired'));
  }

  if (!section.content?.trim()) {
    warnings.push(t('section.noContent'));
  }

  if (section.content && section.content.length < 10) {
    warnings.push(t('section.contentTooShort'));
  }

  section.articles?.forEach((article, index) => {
    const articleErrors = validateArticle(article);
    const prefix = t('article.prefix', { index: index + 1 });
    articleErrors.errors.forEach(error =>
      errors.push(`${prefix}: ${error}`)
    );
    articleErrors.warnings.forEach(warning =>
      warnings.push(`${prefix}: ${warning}`)
    );
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateArticle(article: ObligationArticle): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!article.title?.trim()) {
    errors.push(t('article.titleRequired'));
  }

  if (!article.number?.trim()) {
    errors.push(t('article.numberRequired'));
  }

  if (!article.content?.trim()) {
    warnings.push(t('article.noContent'));
  }

  article.paragraphs?.forEach((paragraph, index) => {
    const paragraphErrors = validateParagraph(paragraph);
    const prefix = t('paragraph.prefix', { index: index + 1 });
    paragraphErrors.errors.forEach(error =>
      errors.push(`${prefix}: ${error}`)
    );
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateParagraph(paragraph: ObligationParagraph): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!paragraph.content?.trim()) {
    errors.push(t('paragraph.contentRequired'));
  }

  if (!paragraph.number?.trim()) {
    errors.push(t('paragraph.numberRequired'));
  }

  if (paragraph.content && paragraph.content.length < 5) {
    warnings.push(t('paragraph.contentTooShort'));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function isValidSectionOrder(sections: ObligationSection[]): boolean {
  if (!sections || sections.length === 0) return true;

  for (let i = 0; i < sections.length - 1; i++) {
    if (sections[i].order >= sections[i + 1].order) {
      return false;
    }
  }
  return true;
}

export function hasValidRequiredSections(sections: ObligationSection[]): boolean {
  if (!sections) return false;

  const requiredSections = sections.filter(s => s.isRequired);
  return requiredSections.every(section =>
    section.content && section.content.trim().length > 0
  );
}