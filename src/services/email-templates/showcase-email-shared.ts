/**
 * @fileoverview Showcase email — shared section renderers (SSoT, ADR-316).
 * @description Pure string-templating helpers shared across every showcase
 *              email template (property, project). One renderer per generic
 *              block (section title, key/value table, photo grid, media list,
 *              CTA button) so per-entity templates stay small and aligned on
 *              the Pagonis visual identity.
 * @note Inline styles are REQUIRED by email clients (Outlook, Gmail, Apple
 *       Mail). The CLAUDE.md N.3 ban does not apply here.
 */

import 'server-only';

import { BRAND, escapeHtml } from './base-email-template';

export { BRAND, escapeHtml };

export interface ShowcaseEmailMedia {
  id: string;
  url: string;
  displayName?: string | null;
  previewUrl?: string | null;
}

export interface ShowcaseKeyValueRow {
  label: string;
  value: string | number | undefined | null;
  unit?: string;
}

export function renderKeyValueTable(rows: ShowcaseKeyValueRow[]): string {
  const visible = rows.filter((r) => r.value !== undefined && r.value !== null && r.value !== '');
  if (visible.length === 0) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${visible
      .map((r) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.grayLight};width:50%;">${escapeHtml(r.label)}</td>
        <td style="padding:6px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.navyDark};text-align:right;font-weight:600;">${escapeHtml(String(r.value))}${r.unit ? `&nbsp;${escapeHtml(r.unit)}` : ''}</td>
      </tr>`)
      .join('')}
  </table>`;
}

export function renderSectionTitle(text: string): string {
  return `<h2 style="margin:24px 0 12px;padding:0;font-size:16px;color:${BRAND.navyDark};border-left:3px solid ${BRAND.navy};padding-left:10px;">${escapeHtml(text)}</h2>`;
}

export interface ShowcaseHeroParams {
  /** Main heading (entity name / number). */
  name: string;
  /** Optional code value (rendered only when both value & label present). */
  code?: string | null;
  /** Localized label for the code line (e.g. labels.specs.code). */
  codeLabel?: string;
  /** Pre-joined subtitle bits (e.g. `[typeLabel, statusLabel].join(' · ')`). */
  subtitleBits?: string;
  /** Optional multi-line description. */
  description?: string | null;
}

/**
 * Shared showcase hero block — name heading + optional code / subtitle /
 * description lines. One SSoT for every per-entity showcase email so the
 * Pagonis visual identity stays aligned (ADR-590). Entities that lack a
 * subtitle simply omit `subtitleBits`.
 */
export function renderShowcaseHero(params: ShowcaseHeroParams): string {
  const { name, code, codeLabel, subtitleBits, description } = params;
  const codeHtml = code && codeLabel
    ? `<p style="margin:4px 0 0;font-size:12px;color:${BRAND.grayLight};">${escapeHtml(codeLabel)}: ${escapeHtml(code)}</p>`
    : '';
  const subtitleHtml = subtitleBits
    ? `<p style="margin:6px 0 0;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(subtitleBits)}</p>`
    : '';
  const descHtml = description
    ? `<p style="margin:12px 0 0;font-size:14px;color:${BRAND.navyDark};line-height:1.6;white-space:pre-line;">${escapeHtml(description)}</p>`
    : '';
  return `<section>
    <h1 style="margin:0;padding:0;font-size:22px;color:${BRAND.navyDark};">${escapeHtml(name)}</h1>
    ${codeHtml}${subtitleHtml}${descHtml}
  </section>`;
}

/**
 * Shared showcase money formatter — Greek locale, EUR, whole-euro (no
 * decimals). Returns `undefined` for non-numeric input so callers can skip
 * the row entirely. SSoT for every showcase specs table (ADR-590).
 */
export function formatShowcaseMoney(value: number | null | undefined): string | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Shared showcase progress formatter — rounded integer percent (ADR-590). */
export function formatShowcasePercent(value: number | null | undefined): string | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return `${Math.round(value)}%`;
}

export function renderPhotoGrid(
  photos: ShowcaseEmailMedia[] | undefined,
  title: string,
): string {
  if (!photos || photos.length === 0) return '';
  const cells = photos.slice(0, 12).map((photo) =>
    `<td style="padding:4px;width:50%;vertical-align:top;">
      <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.displayName ?? title)}" width="260" height="180" style="display:block;width:100%;max-width:260px;height:180px;object-fit:cover;border-radius:6px;border:1px solid ${BRAND.border};" />
    </td>`,
  );
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td style="width:50%;"></td>'}</tr>`);
  }
  return `${renderSectionTitle(title)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows.join('')}</table>`;
}

export function renderMediaList(
  media: ShowcaseEmailMedia[] | undefined,
  title: string,
  emptyLabel?: string,
): string {
  if (!media || media.length === 0) {
    return emptyLabel ? `${renderSectionTitle(title)}<p style="margin:0;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(emptyLabel)}</p>` : '';
  }
  const imgs = media.map((m) => {
    const src = m.previewUrl ?? m.url;
    return `<div style="margin:6px 0;">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(m.displayName ?? title)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:6px;border:1px solid ${BRAND.border};" />
    </div>`;
  }).join('');
  return `${renderSectionTitle(title)}${imgs}`;
}

export function renderShareCta(shareUrl: string, ctaLabel: string): string {
  return `<div style="margin:28px 0 8px;text-align:center;">
    <a href="${escapeHtml(shareUrl)}" style="display:inline-block;background-color:${BRAND.navy};color:${BRAND.white};padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(ctaLabel)}</a>
  </div>`;
}

export interface SharedTextFallbackParams {
  subject: string;
  heading: string;
  intro: string;
  description?: string | null;
  shareUrl?: string;
}

export function buildSharedTextFallback(params: SharedTextFallbackParams): string {
  const { subject, heading, intro, description, shareUrl } = params;
  const lines = [subject, '', intro, '', heading];
  if (description) lines.push('', description);
  if (shareUrl) lines.push('', shareUrl);
  return lines.join('\n');
}
