/**
 * ADR-344 Phase 7.B — Zod validation for text-template Firestore payloads.
 *
 * The Phase 7.A AST (`DxfTextNode`) is large and structurally validated by
 * the parser/serializer pipeline (Phase 1). At the Firestore boundary we
 * therefore only enforce:
 *
 *   - cheap shape gates that catch obviously-malformed payloads
 *     (missing `paragraphs`, wrong attachment code, NaN rotation)
 *   - explicit `companyId` / `name` / `category` validation
 *   - `undefined`-rejection on every field (Firestore writes reject
 *     `undefined` per CLAUDE.md project memory)
 *
 * Deep semantic validation of `content` (rotation ranges, font availability,
 * paragraph attachment compatibility) lives in the editor — not here.
 */

import { z } from 'zod';
import type { TextTemplateCategory } from './template.types';

// ── Reusable scalar shapes ────────────────────────────────────────────────────

export const TEXT_TEMPLATE_NAME_MAX = 120;

const nonEmptyString = z.string().min(1, 'must be non-empty');

const categorySchema: z.ZodType<TextTemplateCategory> = z.enum([
  'title-block',
  'stamp',
  'revision',
  'notes',
  'scale-bar',
  'custom',
]);

const justificationSchema = z.enum([
  'TL', 'TC', 'TR',
  'ML', 'MC', 'MR',
  'BL', 'BC', 'BR',
]);

const finiteNumber = z.number().refine((n) => Number.isFinite(n), {
  message: 'must be a finite number',
});

// ── Content shape (lightweight DxfTextNode gate) ──────────────────────────────

/**
 * Minimal structural guard for `DxfTextNode`. We rely on the editor and the
 * Phase 1 serializer to produce correct DxfTextNode trees — at the Firestore
 * boundary we only catch payloads that would crash the renderer on load.
 */
const dxfTextNodeSchema = z
  .object({
    paragraphs: z.array(z.unknown()).min(1, 'template content must have at least one paragraph'),
    attachment: justificationSchema,
    lineSpacing: z.object({
      mode: z.enum(['multiple', 'exact', 'at-least']),
      factor: finiteNumber.positive(),
    }),
    rotation: finiteNumber,
    isAnnotative: z.boolean(),
    annotationScales: z.array(z.unknown()),
    currentScale: z.string(),
  })
  .passthrough();

// ── Public schemas ────────────────────────────────────────────────────────────

/** Validation schema for `createTextTemplate` input. */
export const createTextTemplateInputSchema = z
  .object({
    companyId: nonEmptyString,
    name: nonEmptyString.max(
      TEXT_TEMPLATE_NAME_MAX,
      `name exceeds maximum length of ${TEXT_TEMPLATE_NAME_MAX} characters`,
    ),
    category: categorySchema,
    content: dxfTextNodeSchema,
  })
  .strict();

/**
 * Validation schema for `updateTextTemplate` patches. At least one field
 * must be present — empty patches are rejected at the service layer.
 */
export const updateTextTemplateInputSchema = z
  .object({
    name: nonEmptyString
      .max(
        TEXT_TEMPLATE_NAME_MAX,
        `name exceeds maximum length of ${TEXT_TEMPLATE_NAME_MAX} characters`,
      )
      .optional(),
    category: categorySchema.optional(),
    content: dxfTextNodeSchema.optional(),
  })
  .strict()
  .refine(
    (patch) => patch.name !== undefined || patch.category !== undefined || patch.content !== undefined,
    { message: 'update patch must contain at least one field' },
  );

/** Flat string list of failures — easier to surface in audit / UI than ZodError. */
export function collectIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}
