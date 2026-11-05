/**
 * @fileoverview **Το έργο και οι εντολές εργασίας στο έγγραφο** (ADR-928 §5.24) — στη γλώσσα του εγγράφου.
 * @module subapps/procurement/subcontracts/document/document-work-orders
 *
 * 🔑 Κύρια σύμβαση (AIA A421 · ConsensusDocs 755): το «Έργο» λέει ότι οι εργασίες ανατίθενται ανά έργο με εντολή
 *    εργασίας που **διέπεται από τους όρους της παρούσας**· κάθε εντολή (A422 · 756) είναι δική της ενότητα με αριθμό,
 *    ταυτότητα έργου, κτίρια, έναρξη, διάρκεια. Η αρίθμηση είναι **η ίδια** με της οθόνης (`workOrdersOf`).
 * 🔑 Κτίρια μόνο από το στιγμιότυπο του γραφέα (`buildings`)· έγγραφο χωρίς αυτό (πριν την §5.24) δεν τυπώνει κτίρια —
 *    ποτέ ταυτότητα στη θέση ονόματος.
 */

import { workOrdersOf, type WorkOrder } from '../agreements/work-orders';
import type { AgreementScope, ProjectIdentitySnapshot } from '../types/agreement';
import type { DocumentLocale } from './document-locale';
import type { DocumentField, DocumentWorkOrder } from './document-types';

type Row = readonly [string, string | null | undefined];

function fieldsOf(rows: readonly Row[], locale: DocumentLocale): DocumentField[] {
  return rows
    .filter((row): row is readonly [string, string] => typeof row[1] === 'string' && row[1].trim().length > 0)
    .map(([key, value]) => ({ label: locale.phrase(key), value }));
}

function buildingsOf(project: ProjectIdentitySnapshot, locale: DocumentLocale): string | null {
  const labels = (project.buildings ?? []).map((building) => building.label);
  return labels.length > 0 ? locale.list(labels) : null;
}

/** Η ταυτότητα ενός έργου ως πεδία — ίδια για συμφωνητικό ενός έργου και για εντολή εργασίας. */
export function projectIdentityFields(project: ProjectIdentitySnapshot, locale: DocumentLocale): DocumentField[] {
  return fieldsOf([
    ['project.name', project.name],
    ['project.address', project.address],
    ['project.license', project.licenseNumber],
    ['project.issuingAuthority', project.issuingAuthority],
    ['project.block', project.buildingBlock],
    ['project.plot', project.plotNumber],
    ['project.buildings', buildingsOf(project, locale)],
  ], locale);
}

/** Η ενότητα «Έργο»: ταυτότητα του ενός έργου, ή η δήλωση της κύριας σύμβασης. */
export function scopeFields(scope: AgreementScope, locale: DocumentLocale): DocumentField[] {
  if (scope.kind === 'single_project') return projectIdentityFields(scope.project, locale);
  return [{ label: locale.phrase('project.name'), value: locale.phrase('project.multi') }];
}

function workOrderOf({ number, assignment }: WorkOrder, locale: DocumentLocale): DocumentWorkOrder {
  const timing = fieldsOf([
    ['workOrders.start', assignment.startDate ? locale.day(assignment.startDate) : null],
    ['workOrders.duration', assignment.durationDays === null ? null : locale.phrase('workOrders.days', { days: assignment.durationDays })],
    ['workOrders.note', assignment.note],
  ], locale);
  return {
    number,
    heading: locale.phrase('workOrders.heading', { number }),
    fields: [...projectIdentityFields(assignment.project, locale), ...timing],
  };
}

/** Οι εντολές εργασίας με τη σειρά έκδοσης· `[]` για συμφωνητικό ενός έργου ή κύρια σύμβαση χωρίς εντολή ακόμη. */
export function workOrderSections(scope: AgreementScope, locale: DocumentLocale): DocumentWorkOrder[] {
  return workOrdersOf({ scope }).map((order) => workOrderOf(order, locale));
}
