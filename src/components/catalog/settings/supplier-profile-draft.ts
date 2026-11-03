/**
 * Οι καθαρές πράξεις του επεξεργαστή προφίλ (ADR-923 §22 Υ8): χωρίς React, ώστε να κρίνονται χωρίς οθόνη.
 *
 * @module components/catalog/settings/supplier-profile-draft
 */

import { MAX_PORTFOLIO_YEAR, MIN_PORTFOLIO_YEAR, type CatalogPortfolioProject, type CatalogSupplierProfileDefinition } from '@/subapps/catalog/types/supplier-profile';

export const emptyProject = (id: string): CatalogPortfolioProject => ({ id, title: {}, description: {}, year: null, assetIds: [] });

export function withProject(profile: CatalogSupplierProfileDefinition, project: CatalogPortfolioProject): CatalogSupplierProfileDefinition {
  return { ...profile, projects: profile.projects.map((candidate) => (candidate.id === project.id ? project : candidate)) };
}

export function withoutProject(profile: CatalogSupplierProfileDefinition, projectId: string): CatalogSupplierProfileDefinition {
  return { ...profile, projects: profile.projects.filter((project) => project.id !== projectId) };
}

/** Κενό ⇒ χωρίς έτος. Ό,τι δεν είναι έγκυρο έτος επίσης, αντί να φτάσει ως 400 χωρίς διαδρομή. */
export function yearOfInput(raw: string): number | null {
  const year = Number(raw);
  return raw.trim() !== '' && Number.isInteger(year) && year >= MIN_PORTFOLIO_YEAR && year <= MAX_PORTFOLIO_YEAR ? year : null;
}

export function withAsset(project: CatalogPortfolioProject, assetId: string): CatalogPortfolioProject {
  return project.assetIds.includes(assetId) ? project : { ...project, assetIds: [...project.assetIds, assetId] };
}

export function withoutAsset(project: CatalogPortfolioProject, assetId: string): CatalogPortfolioProject {
  return { ...project, assetIds: project.assetIds.filter((id) => id !== assetId) };
}
