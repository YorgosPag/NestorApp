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

export interface ProjectShareData {
  title: string;
  text: string;
  url: string;
}

const DESCRIPTION_MAX_LENGTH = 200;

const STATUS_I18N_KEY: Record<ProjectStatus, string> = {
  planning: 'projects:status.planning',
  in_progress: 'projects:status.inProgress',
  completed: 'projects:status.completed',
  on_hold: 'projects:status.onHold',
  cancelled: 'projects:status.cancelled',
  deleted: 'projects:status.cancelled',
};

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
    lines.push(`📊 ${t('projects:share.status')}: ${t(STATUS_I18N_KEY[project.status])}`);
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
  if (project.status) parts.push(t(STATUS_I18N_KEY[project.status]));
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
