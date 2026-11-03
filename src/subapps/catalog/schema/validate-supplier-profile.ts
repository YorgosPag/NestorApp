/**
 * Σημασιολογική επικύρωση του προφίλ παρόχου (ADR-923 §22 Υ8): ίδια συνάρτηση σε πελάτη και διακομιστή.
 *
 * Έργο χωρίς εικόνα δεν αποθηκεύεται: το portfolio δείχνει δουλειά, και κάρτα χωρίς εξώφυλλο δεν λέει τίποτα.
 * Η ιδιοκτησία των μέσων κρίνεται στον γραφέα, γιατί θέλει ανάγνωση.
 *
 * @module subapps/catalog/schema/validate-supplier-profile
 */

import { hasAnyLocalizedText } from '@/i18n/localized-text';
import { isValidEmail } from '@/lib/validation/email-validation';

import {
  MAX_PORTFOLIO_PROJECTS,
  MAX_PORTFOLIO_PROJECT_IMAGES,
  type CatalogPortfolioProject,
  type CatalogQuoteIntake,
  type CatalogSupplierProfileDefinition,
} from '../types/supplier-profile';
import { IssueCollector, reportDuplicates, type CatalogIssue } from './catalog-issues';

function validateProject(project: CatalogPortfolioProject, index: number, collector: IssueCollector): void {
  const path = `projects[${index}]`;
  if (!hasAnyLocalizedText(project.title)) collector.add('labelRequired', `${path}.title`);
  if (project.assetIds.length === 0) collector.add('portfolioProjectImagesRequired', `${path}.assetIds`);
  if (project.assetIds.length > MAX_PORTFOLIO_PROJECT_IMAGES) collector.add('tooMany', `${path}.assetIds`, { max: MAX_PORTFOLIO_PROJECT_IMAGES });
  reportDuplicates(collector, project.assetIds, (position) => `${path}.assetIds[${position}]`);
}

export function validateSupplierProfile(profile: CatalogSupplierProfileDefinition): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (profile.projects.length > MAX_PORTFOLIO_PROJECTS) collector.add('tooMany', 'projects', { max: MAX_PORTFOLIO_PROJECTS });
  profile.projects.forEach((project, index) => validateProject(project, index, collector));
  reportDuplicates(collector, profile.projects.map((project) => project.id), (index) => `projects[${index}].id`);
  return collector.issues;
}

/**
 * Η ρύθμιση αιτημάτων προσφοράς (ADR-923 §5.13 Ε6β). Ενεργή χωρίς παραλήπτη δεν αποθηκεύεται: θα ήταν υπόσχεση προς τον αγοραστή
 * που κανείς δεν διαβάζει. Ανενεργή μπορεί να κρατά το email, για να ξαναγίνει ενεργή με ένα κλικ.
 */
export function validateQuoteIntake(intake: CatalogQuoteIntake): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  const path = 'quoteIntake.recipientEmail';
  if (intake.recipientEmail === null) {
    if (intake.enabled) collector.add('quoteRecipientEmailRequired', path);
  } else if (!isValidEmail(intake.recipientEmail)) {
    collector.add('emailInvalid', path);
  }
  return collector.issues;
}

/** Η μία ερώτηση «δέχεται αιτήματα;» για την προβολή και για τον διακομιστή του RFQ: ενεργή **και** έγκυρη. */
export function quoteIntakeAccepts(intake: CatalogQuoteIntake): boolean {
  return intake.enabled && validateQuoteIntake(intake).length === 0;
}
