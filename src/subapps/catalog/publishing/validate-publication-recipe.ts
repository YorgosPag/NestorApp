/**
 * Η **σημασιολογική** επικύρωση μιας συνταγής έκδοσης (ADR-923 §5.6): ίδια συνάρτηση σε φόρμα και γραφέα, ευρήματα ως
 * κωδικοί (N.11). Η δομή είναι δουλειά του zod (`schema/zod/publication.schema.ts`).
 * @module subapps/catalog/publishing/validate-publication-recipe
 */

import { CATALOG_CODE_PATTERN } from '../vocabulary/catalog-limits';
import { IssueCollector, type CatalogIssue } from '../schema/catalog-issues';
import type { PublicationRecipeDefinition, PublicationTheme } from '../types/publication';
import type { LayoutColour } from './layout-model';
import { isPublicationFontCode } from './publication-fonts';

const RGB_PATTERN = /^#[0-9a-f]{6}$/i;

function colourValid(colour: LayoutColour): boolean {
  return RGB_PATTERN.test(colour.rgb) && colour.cmyk.length === 4 && colour.cmyk.every((part) => Number.isFinite(part) && part >= 0 && part <= 100);
}

function checkTheme(theme: PublicationTheme, issues: IssueCollector): void {
  if (!isPublicationFontCode(theme.fontCode)) issues.add('publicationFontNotLicensed', 'theme.fontCode');
  if (!colourValid(theme.primary)) issues.add('publicationColourInvalid', 'theme.primary');
  if (!colourValid(theme.accent)) issues.add('publicationColourInvalid', 'theme.accent');
}

export function validatePublicationRecipe(recipe: PublicationRecipeDefinition): readonly CatalogIssue[] {
  const issues = new IssueCollector();
  if (!CATALOG_CODE_PATTERN.test(recipe.code)) issues.add('invalidCode', 'code');
  if (!recipe.title[recipe.language]?.trim()) issues.add('publicationTitleRequired', `title.${recipe.language}`);
  if (recipe.profiles.length === 0) issues.add('publicationProfileRequired', 'profiles');
  if (recipe.scope.kind === 'categories' && recipe.scope.categoryIds.length === 0) issues.add('publicationScopeEmpty', 'scope.categoryIds');
  if (recipe.scope.kind === 'selection' && recipe.scope.entries.length === 0) issues.add('publicationScopeEmpty', 'scope.entries');
  checkTheme(recipe.theme, issues);
  return issues.issues;
}
