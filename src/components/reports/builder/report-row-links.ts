/**
 * @module components/reports/builder/report-row-links
 * @enterprise ADR-242 Βήμα 5 · ADR-268 — Report Builder links (pure, no React)
 *
 * Two questions, one resolver (`getEntityHref`) underneath:
 *  - the ROW link (primary cell): the entity the domain declares, by the id the server projected under
 *    `REPORT_ROW_LINK_ID_KEY` — a floor opens its building even when the building column was not picked;
 *  - a REFERENCE cell link (Κτίριο, Ακίνητο, Επαφή…): the referenced domain's OWN page, like a linked record
 *    in Airtable/Notion. Only domains that link rows to THEMSELVES qualify — a floor id is not a building id.
 *
 * Absent id ⇒ `null` ⇒ plain text. Never a broken URL.
 */

import { getEntityHref, type EntityHref } from '@/lib/navigation/entity-href';
import { getDomainDefinition } from '@/config/report-builder/domain-definitions';
import {
  REPORT_ROW_LINK_ID_KEY,
  type BuilderDomainId,
  type DomainDefinition,
} from '@/config/report-builder/report-builder-types';

export function resolveReportRowHref(
  domain: DomainDefinition,
  row: Record<string, unknown>,
): EntityHref | null {
  if ('unlinked' in domain.entityLink) return null;
  const id = row[REPORT_ROW_LINK_ID_KEY];
  return typeof id === 'string' && id !== '' ? getEntityHref(domain.entityLink.type, id) : null;
}

export function resolveReportRefHref(refDomain: BuilderDomainId, id: string): EntityHref | null {
  const link = getDomainDefinition(refDomain).entityLink;
  if ('unlinked' in link || (link.idField ?? 'id') !== 'id' || id === '') return null;
  return getEntityHref(link.type, id);
}
