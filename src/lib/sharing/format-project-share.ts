/**
 * =============================================================================
 * 🏢 ENTERPRISE: Project Share Formatter — SSoT for project share content
 * =============================================================================
 *
 * Pure function that transforms a `Project` (or list of projects) into the
 * `ShareData` payload consumed by the ADR-147 unified share surface
 * (`ShareModal` → `UserAuthPermissionPanel`).
 *
 * This is the SINGLE source of truth for "what fields of a project are
 * shared": business essentials only (name, status, progress, company,
 * address, dates, area, description). Internal metadata (IDs, riskLevel,
 * budget, audit fields) is intentionally excluded, following the Google
 * Contacts/Drive pattern: share only what the recipient needs.
 *
 * Adding/removing a shared field = one edit here. No other file touches.
 *
 * @module lib/sharing/format-project-share
 * @see ADR-147 Unified Share Surface (Phase C)
 */

import type { TFunction } from 'i18next';
import type { Project, ProjectStatus } from '@/types/project';
import { PROJECT_STATUS_LABELS } from '@/constants/project-statuses';
import { splitNamespacedLabelKey } from '@/core/badges/badge-label-key';

export interface ProjectShareData {
  title: string;
  text: string;
  url: string;
}

const DESCRIPTION_MAX_LENGTH = 200;

/**
 * 🔴 ADR-812 — ΤΟ ΟΓΔΟΟ ΣΩΜΑ ΕΦΥΓΕ. Οι ετικέτες έρχονται από το ΛΕΞΙΛΟΓΙΟ.
 *
 * Εδώ ζούσε δικός του πίνακας κλειδιών με τα ίδια έξι κλειδιά σε **άλλη
 * ορθογραφία** (`projects:status.…` αντί `projects.status.…`) — δηλαδή δύο
 * γραφές του ίδιου κλειδιού σε δύο αρχεία. Το κόστος το είχε ήδη πληρώσει το
 * repo: όσο έλειπε η γραμμή για τον κάδο, το κοινοποιημένο κείμενο παρουσίαζε
 * **διαγραμμένο** έργο ως «Ακυρωμένο».
 *
 * Ο μετασχηματισμός `<ns>.<κλειδί>` → `{ns, key}` ζει σε ΕΝΑ σημείο
 * (`splitNamespacedLabelKey`) και τον καταναλώνουν και τα badges και αυτό.
 *
 * ⚠️ ΧΩΡΙΣ `!` ΕΠΙΤΗΔΕΣ: ο resolver επιστρέφει `null` όταν η ετικέτα δεν είναι
 * κλειδί με namespace, και μια σιωπηλή πτώση θα ζωγράφιζε ωμό κλειδί στο
 * κοινοποιημένο κείμενο (N.11). Η άγκυρα `Κ8` του
 * `constants/__tests__/project-status-vocabulary.test.ts` κλειδώνει ότι κάθε
 * ετικέτα του λεξιλογίου ΕΙΝΑΙ κλειδί· εδώ επαληθεύεται ξανά σε χρόνο
 * εκτέλεσης αντί να θεωρείται δεδομένο.
 */
function translateStatus(status: ProjectStatus, t: TFunction): string {
  const parsed = splitNamespacedLabelKey(PROJECT_STATUS_LABELS[status]);
  return parsed ? t(parsed.key, { ns: parsed.ns }) : status;
}
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function resolveAddress(project: Project): string {
  const primary = project.addresses?.find(a => a.isPrimary) ?? project.addresses?.[0];
  if (primary) {
    const parts = [primary.street, primary.city, primary.postalCode].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  const legacy = [project.address, project.city].filter(Boolean);
  return legacy.join(', ');
}

function resolveCompanyName(project: Project): string {
  return project.linkedCompanyName ?? project.company ?? '';
}

function formatDateRange(project: Project, t: TFunction): string | null {
  if (!project.startDate && !project.completionDate) return null;
  const parts: string[] = [];
  if (project.startDate) {
    parts.push(`${t('projects:share.startDate')}: ${project.startDate}`);
  }
  if (project.completionDate) {
    parts.push(`${t('projects:share.completionDate')}: ${project.completionDate}`);
  }
  return parts.join(' → ');
}

function buildSingleProjectLines(project: Project, t: TFunction): string[] {
  const lines: string[] = [];
  lines.push(`🏗️ ${project.name}`);

  if (project.status) {
    lines.push(`📊 ${t('projects:share.status')}: ${translateStatus(project.status, t)}`);
  }
  if (typeof project.progress === 'number') {
    lines.push(`📈 ${t('projects:share.progress')}: ${project.progress}%`);
  }

  const companyName = resolveCompanyName(project);
  if (companyName) {
    lines.push(`🏢 ${t('projects:share.company')}: ${companyName}`);
  }

  const address = resolveAddress(project);
  if (address) {
    lines.push(`📍 ${t('projects:share.address')}: ${address}`);
  }

  const dateRange = formatDateRange(project, t);
  if (dateRange) {
    lines.push(`📅 ${dateRange}`);
  }

  if (project.totalArea && project.totalArea > 0) {
    lines.push(`📐 ${t('projects:share.area')}: ${project.totalArea} m²`);
  }

  if (project.description) {
    lines.push(`📝 ${truncate(project.description, DESCRIPTION_MAX_LENGTH)}`);
  }

  return lines;
}

function formatSingleProject(project: Project, t: TFunction): ProjectShareData {
  return {
    title: t('projects:share.modalTitle', { name: project.name }),
    text: buildSingleProjectLines(project, t).join('\n'),
    url: '',
  };
}

function buildCompactLine(project: Project, t: TFunction): string {
  const parts: string[] = [project.name];
  const address = resolveAddress(project);
  if (address) parts.push(address);
  if (typeof project.progress === 'number') parts.push(`${project.progress}%`);
  if (project.status) parts.push(translateStatus(project.status, t));
  return `🏗️ ${parts.join(' — ')}`;
}

function formatProjectList(projects: Project[], t: TFunction): ProjectShareData {
  const header = t('projects:share.modalTitleMultiple', { count: projects.length });
  const lines = [header, '', ...projects.map(p => buildCompactLine(p, t))];
  return {
    title: header,
    text: lines.join('\n'),
    url: '',
  };
}

export function formatProjectsForShare(
  projects: Project[],
  t: TFunction,
): ProjectShareData {
  if (projects.length === 0) {
    return { title: '', text: '', url: '' };
  }
  if (projects.length === 1) {
    return formatSingleProject(projects[0], t);
  }
  return formatProjectList(projects, t);
}
