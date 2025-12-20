import { ObligationDocument, ObligationSection, ObligationArticle, ObligationParagraph } from '@/types/obligations';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateObligationDocument(document: ObligationDocument): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!document.title?.trim()) {
    errors.push('Ο τίτλος είναι υποχρεωτικός');
  }

  if (!document.projectName?.trim()) {
    errors.push('Το όνομα έργου είναι υποχρεωτικό');
  }

  if (!document.contractorCompany?.trim()) {
    errors.push('Η εταιρεία ανάδοχου είναι υποχρεωτική');
  }

  if (!document.owners || document.owners.length === 0) {
    errors.push('Απαιτείται τουλάχιστον ένας ιδιοκτήτης');
  }

  if (!document.sections || document.sections.length === 0) {
    warnings.push('Το έγγραφο δεν περιέχει ενότητες');
  }

  document.sections?.forEach((section, index) => {
    const sectionErrors = validateSection(section);
    sectionErrors.errors.forEach(error =>
      errors.push(`Ενότητα ${index + 1}: ${error}`)
    );
    sectionErrors.warnings.forEach(warning =>
      warnings.push(`Ενότητα ${index + 1}: ${warning}`)
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
    errors.push('Ο τίτλος ενότητας είναι υποχρεωτικός');
  }

  if (!section.number?.trim()) {
    errors.push('Ο αριθμός ενότητας είναι υποχρεωτικός');
  }

  if (!section.content?.trim()) {
    warnings.push('Η ενότητα δεν έχει περιεχόμενο');
  }

  if (section.content && section.content.length < 10) {
    warnings.push('Το περιεχόμενο της ενότητας είναι πολύ σύντομο');
  }

  section.articles?.forEach((article, index) => {
    const articleErrors = validateArticle(article);
    articleErrors.errors.forEach(error =>
      errors.push(`Άρθρο ${index + 1}: ${error}`)
    );
    articleErrors.warnings.forEach(warning =>
      warnings.push(`Άρθρο ${index + 1}: ${warning}`)
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
    errors.push('Ο τίτλος άρθρου είναι υποχρεωτικός');
  }

  if (!article.number?.trim()) {
    errors.push('Ο αριθμός άρθρου είναι υποχρεωτικός');
  }

  if (!article.content?.trim()) {
    warnings.push('Το άρθρο δεν έχει περιεχόμενο');
  }

  article.paragraphs?.forEach((paragraph, index) => {
    const paragraphErrors = validateParagraph(paragraph);
    paragraphErrors.errors.forEach(error =>
      errors.push(`Παράγραφος ${index + 1}: ${error}`)
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
    errors.push('Το περιεχόμενο παραγράφου είναι υποχρεωτικό');
  }

  if (!paragraph.number?.trim()) {
    errors.push('Ο αριθμός παραγράφου είναι υποχρεωτικός');
  }

  if (paragraph.content && paragraph.content.length < 5) {
    warnings.push('Το περιεχόμενο παραγράφου είναι πολύ σύντομο');
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