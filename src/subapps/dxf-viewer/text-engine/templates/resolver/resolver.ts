/**
 * ADR-344 Phase 7.C — Placeholder resolver (pure functions).
 *
 * Three public entry points:
 *   - `resolvePlaceholdersInString` — line-level substitution.
 *   - `resolvePlaceholdersInNode`   — walks a DxfTextNode, returns a new
 *                                     immutable node with runs/stacks resolved.
 *   - `resolveTemplate`             — convenience over a TextTemplate.
 *
 * Behaviour matrix (ADR-344 §4 Q5 follow-up, 2026-05-11, Giorgio):
 *   | input                                  | output                  |
 *   |----------------------------------------|-------------------------|
 *   | known path, value present              | the value (stringified) |
 *   | known path, value missing in scope     | empty string `''`       |
 *   | unknown path                           | original token (literal)|
 *
 * The resolver MUST NOT touch Firestore or any other I/O — keeping it pure
 * lets the management UI (Phase 7.D) preview templates with mocked scopes
 * and lets the unit tests run in milliseconds.
 */

import type { DxfTextNode, TextParagraph, TextRun, TextStack } from '../../types/text-ast.types';
import type { TextTemplate } from '../template.types';
import { extractPlaceholdersFromString } from '../extract-placeholders';
import {
  isKnownPlaceholder,
  PLACEHOLDER_REGISTRY,
  type PlaceholderPath,
  type PlaceholderSource,
} from './variables';
import {
  EMPTY_PLACEHOLDER_SCOPE,
  type PlaceholderScope,
  type PlaceholderScopeFormatting,
} from './scope.types';

/** `{{namespace.key}}` with optional inner whitespace — kept in sync with extract-placeholders.ts. */
const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)\s*\}\}/g;

// ── Scope readers ────────────────────────────────────────────────────────────

function readCompany(path: PlaceholderPath, scope: PlaceholderScope): string | undefined {
  const c = scope.company;
  if (!c) return undefined;
  if (path === 'company.name') return c.name;
  return undefined;
}

function readProject(path: PlaceholderPath, scope: PlaceholderScope): string | undefined {
  const p = scope.project;
  if (!p) return undefined;
  if (path === 'project.name') return p.name;
  if (path === 'project.code') return p.code;
  if (path === 'project.owner') return p.owner;
  return undefined;
}

function readDrawing(path: PlaceholderPath, scope: PlaceholderScope): string | undefined {
  const d = scope.drawing;
  if (!d) return undefined;
  if (path === 'drawing.title') return d.title;
  if (path === 'drawing.scale') return d.scale;
  if (path === 'drawing.sheetNumber') return d.sheetNumber;
  if (path === 'drawing.units') return d.units;
  return undefined;
}

function readUser(path: PlaceholderPath, scope: PlaceholderScope): string | undefined {
  const u = scope.user;
  if (!u) return undefined;
  if (path === 'user.fullName') return u.fullName;
  if (path === 'user.checkerName') return u.checkerName;
  if (path === 'user.title') return u.title;
  if (path === 'user.licenseNumber') return u.licenseNumber;
  return undefined;
}

function readRevision(path: PlaceholderPath, scope: PlaceholderScope): string | undefined {
  const r = scope.revision;
  if (!r) return undefined;
  if (path === 'revision.number') return r.number;
  if (path === 'revision.author') return r.author;
  if (path === 'revision.description') return r.description;
  if (path === 'revision.date') return r.date ? toShortDate(r.date, scope.formatting) : undefined;
  return undefined;
}

function readDate(path: PlaceholderPath, scope: PlaceholderScope): string | undefined {
  if (path !== 'date.today') return undefined;
  const today = scope.formatting?.today ?? new Date();
  return toShortDate(today, scope.formatting);
}

// Named toShortDate (not formatDate) to avoid intl-formatting SSoT conflict (ADR-314).
function toShortDate(value: Date, formatting: PlaceholderScopeFormatting | undefined): string {
  const locale = formatting?.locale === 'en' ? 'en-US' : 'el-GR';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

const READERS: Readonly<Record<
  PlaceholderSource,
  (path: PlaceholderPath, scope: PlaceholderScope) => string | undefined
>> = {
  company: readCompany,
  project: readProject,
  drawing: readDrawing,
  user: readUser,
  revision: readRevision,
  date: readDate,
};

function resolvePath(path: PlaceholderPath, scope: PlaceholderScope): string {
  const meta = PLACEHOLDER_REGISTRY[path];
  const value = READERS[meta.source](path, scope);
  return value ?? '';
}

// ── String-level resolver ────────────────────────────────────────────────────

/**
 * Substitute every `{{namespace.key}}` token inside `text`.
 *
 * Unknown paths are preserved verbatim (literal `{{x.y}}`); known paths
 * with missing scope values collapse to empty strings.
 */
export function resolvePlaceholdersInString(text: string, scope: PlaceholderScope): string {
  if (!text.includes('{{')) return text;
  return text.replace(PLACEHOLDER_REGEX, (match, rawPath: string) => {
    if (!isKnownPlaceholder(rawPath)) return match;
    return resolvePath(rawPath, scope);
  });
}

// ── DxfTextNode-level resolver ───────────────────────────────────────────────

function resolveRunOrStack(item: TextRun | TextStack, scope: PlaceholderScope): TextRun | TextStack {
  if ('text' in item) {
    const next = resolvePlaceholdersInString(item.text, scope);
    return next === item.text ? item : { ...item, text: next };
  }
  const top = resolvePlaceholdersInString(item.top, scope);
  const bottom = resolvePlaceholdersInString(item.bottom, scope);
  return top === item.top && bottom === item.bottom ? item : { ...item, top, bottom };
}

function resolveParagraph(para: TextParagraph, scope: PlaceholderScope): TextParagraph {
  let changed = false;
  const runs = para.runs.map((r) => {
    const next = resolveRunOrStack(r, scope);
    if (next !== r) changed = true;
    return next;
  });
  return changed ? { ...para, runs } : para;
}

/**
 * Walk a DxfTextNode and return a structurally-equal node with every
 * placeholder substituted. Style/attachment/columns/annotation scales etc.
 * are preserved by reference — only runs and stacks change.
 *
 * The returned node is a fresh object when at least one substitution
 * happened, the same reference otherwise (cheap memo guard for callers).
 */
export function resolvePlaceholdersInNode(node: DxfTextNode, scope: PlaceholderScope): DxfTextNode {
  let changed = false;
  const paragraphs = node.paragraphs.map((p) => {
    const next = resolveParagraph(p, scope);
    if (next !== p) changed = true;
    return next;
  });
  return changed ? { ...node, paragraphs } : node;
}

/**
 * Convenience wrapper — resolves the template's content and returns the
 * insertable DxfTextNode. Useful for the management UI preview and for the
 * "Insert template" command in Phase 7.D / future Phase 5/6 work.
 */
export function resolveTemplate(template: TextTemplate, scope: PlaceholderScope = EMPTY_PLACEHOLDER_SCOPE): DxfTextNode {
  return resolvePlaceholdersInNode(template.content, scope);
}

// ── Static analysis helper (re-exported for callers) ────────────────────────

/**
 * Distinguish, for a given string, the set of known vs unknown placeholder
 * paths it contains. The management UI (Phase 7.D) uses this to highlight
 * stale tokens in user-authored templates.
 */
export function classifyPlaceholders(text: string): { readonly known: readonly PlaceholderPath[]; readonly unknown: readonly string[] } {
  const known = new Set<PlaceholderPath>();
  const unknown = new Set<string>();
  for (const raw of extractPlaceholdersFromString(text)) {
    if (isKnownPlaceholder(raw)) known.add(raw);
    else unknown.add(raw);
  }
  return {
    known: [...known].sort(),
    unknown: [...unknown].sort(),
  };
}
