'use client';

/**
 * ADR-344 Phase 7.D / ADR-651 Φάση Θ — ο **ΕΝΑΣ** HTTP client των text templates.
 *
 * **Γιατί υπάρχει** (N.18): οι ΓΡΑΦΕΣ των προτύπων περνούν υποχρεωτικά από τα API routes
 * (Admin SDK + `EntityAuditService` + Zod — ADR-195/N.6), ενώ οι ΑΝΑΓΝΩΣΕΙΣ της βιβλιοθήκης
 * περνούν από τον `ScopedLibraryService` (client SDK). Δύο καταναλωτές χρειάζονται τις ίδιες
 * γραφές — ο manager (`useTextTemplateMutations`, optimistic CRUD) και η **βιβλιοθήκη
 * πινακίδας** (`text-template-library.service`, αποθήκευση/δημοσίευση/απόσπαση). Αντί για δύο
 * σετ πανομοιότυπων `fetch` wrappers (sibling clone — ακριβώς αυτό που πιάνει το jscpd), το
 * σύρμα ζει **εδώ, μία φορά**, και οι δύο συνθέτουν από πάνω τη δική τους σημασιολογία.
 *
 * Ο **wire τύπος** ζει επίσης εδώ (και όχι στο `ui/`) ώστε το `text-engine` να μην εξαρτάται
 * ποτέ από το UI layer.
 *
 * @see ./text-template.service.ts — ο server-only ιδιοκτήτης (audit/Zod/enterprise ids)
 * @see ./text-template-library.service.ts — reads μέσω ScopedLibraryService, writes από εδώ
 */

import type {
  SerializedUserTextTemplate,
  TextTemplate,
  TextTemplateCreateFields,
  TextTemplateUpdateFields,
} from './template.types';

const ENDPOINT = '/api/dxf/text-templates';

// ─── Wire ────────────────────────────────────────────────────────────────────

/**
 * Ο wire τύπος δηλώνεται στο **ουδέτερο** `template.types.ts` (τον διαβάζει και ο server
 * serializer)· εδώ απλώς επανεξάγεται για τους client καταναλωτές. Μία λίστα πεδίων (N.18).
 */
export type { SerializedUserTextTemplate };

/**
 * Wire → canonical {@link TextTemplate}, ώστε built-ins και Firestore έγγραφα να έχουν το
 * ΙΔΙΟ σχήμα για κάθε καταναλωτή (manager grid, ribbon picker, resolver).
 */
export function deserializeUserTemplate(wire: SerializedUserTextTemplate): TextTemplate {
  return {
    id: wire.id,
    companyId: wire.companyId,
    name: wire.name,
    category: wire.category,
    content: wire.content,
    placeholders: wire.placeholders,
    isDefault: false,
    // Το `TextTemplate.locale` είναι προαιρετικό (τα built-ins το έχουν πάντα)· `null` από το
    // Firestore σημαίνει «άγνωστη γλώσσα» ⇒ το πεδίο απλώς λείπει, δεν γίνεται `null`.
    ...(wire.locale ? { locale: wire.locale } : {}),
    scope: wire.scope,
    projectId: wire.projectId,
    parentId: wire.parentId,
    parentSyncedAt: wire.parentSyncedAt,
    ...(wire.titleBlock ? { titleBlock: wire.titleBlock } : {}),
    createdAt: new Date(wire.createdAt),
    updatedAt: new Date(wire.updatedAt),
  };
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class TextTemplateApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: readonly string[];

  constructor(status: number, message: string, code?: string, details?: readonly string[]) {
    super(message);
    this.name = 'TextTemplateApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiEnvelope {
  readonly success?: boolean;
  readonly template?: SerializedUserTextTemplate;
  readonly templates?: readonly SerializedUserTextTemplate[];
  readonly error?: string;
  readonly code?: string;
  readonly details?: readonly string[];
}

async function readEnvelope(res: Response): Promise<ApiEnvelope> {
  try {
    return (await res.json()) as ApiEnvelope;
  } catch {
    return { success: false, error: `HTTP ${res.status}` };
  }
}

/** Κάθε κλήση περνά από εδώ: ένα σημείο για credentials, headers και error mapping. */
async function request(path: string, init?: RequestInit): Promise<ApiEnvelope> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: init?.body
      ? { 'Content-Type': 'application/json', Accept: 'application/json' }
      : { Accept: 'application/json' },
    ...init,
  });
  const body = await readEnvelope(res);
  if (!res.ok || body.success !== true) {
    throw new TextTemplateApiError(
      res.status,
      body.error ?? `Request failed with status ${res.status}`,
      body.code,
      body.details,
    );
  }
  return body;
}

// ─── Payloads ────────────────────────────────────────────────────────────────
// Ο client payload ΕΙΝΑΙ το SSoT field-list (N.18): ο server input το επεκτείνει μόνο με το
// server-provided `companyId`. Δύο πανομοιότυπα interfaces ήταν sibling clone — μία διόρθωση
// (π.χ. το `locale` της Φάσης Κ) ξεχνιόταν στο άλλο.

export type CreateTextTemplatePayload = TextTemplateCreateFields;

export type UpdateTextTemplatePayload = TextTemplateUpdateFields;

// ─── Operations ──────────────────────────────────────────────────────────────

/** Όλα τα πρότυπα του tenant (server list — ο manager· η βιβλιοθήκη διαβάζει scoped). */
export async function apiListTextTemplates(): Promise<readonly TextTemplate[]> {
  const body = await request(ENDPOINT, { method: 'GET' });
  return (body.templates ?? []).map(deserializeUserTemplate);
}

function requireTemplate(body: ApiEnvelope): TextTemplate {
  if (!body.template) {
    throw new TextTemplateApiError(500, 'Response did not carry a template', 'MALFORMED_RESPONSE');
  }
  return deserializeUserTemplate(body.template);
}

export async function apiCreateTextTemplate(
  payload: CreateTextTemplatePayload,
): Promise<TextTemplate> {
  const body = await request(ENDPOINT, { method: 'POST', body: JSON.stringify(payload) });
  return requireTemplate(body);
}

export async function apiUpdateTextTemplate(
  templateId: string,
  payload: UpdateTextTemplatePayload,
): Promise<TextTemplate> {
  const body = await request(`${ENDPOINT}/${encodeURIComponent(templateId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return requireTemplate(body);
}

export async function apiDeleteTextTemplate(templateId: string): Promise<void> {
  await request(`${ENDPOINT}/${encodeURIComponent(templateId)}`, { method: 'DELETE' });
}
