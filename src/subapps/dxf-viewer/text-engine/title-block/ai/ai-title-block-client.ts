'use client';
/**
 * ADR-651 Φάση Δ — client προς τα AI routes της πινακίδας.
 *
 * Thin fetch helpers (μοτίβο `placeholder-scope-client`): same-origin ⇒ ο `withAuth` διαβάζει
 * το session cookie, κανένα Authorization header στον client. Graceful: κάθε αποτυχία ⇒ `null`
 * (generation) ή `[]` (compliance) — ο διάλογος πέφτει σε manual preset, ποτέ crash.
 *
 * Το AI τρέχει **μόνο** πίσω από αυτά τα routes (κλειδί OpenAI ποτέ στον client).
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { AiComplianceWarning } from './ai-title-block-schema';
import type { AiTitleBlockResult } from './ai-title-block-reconcile';
import type { TitleBlockLocale } from '../title-block-presets';

const logger = createModuleLogger('AiTitleBlockClient');

const FROM_IMAGE_ENDPOINT = '/api/dxf/text-templates/ai/from-image';
const FROM_TEXT_ENDPOINT = '/api/dxf/text-templates/ai/from-text';
const VALIDATE_ENDPOINT = '/api/dxf/text-templates/ai/validate';
const TRANSLATE_ENDPOINT = '/api/dxf/text-templates/ai/translate';

interface GenerateResponse {
  readonly success?: boolean;
  readonly result?: AiTitleBlockResult;
}

interface ValidateResponse {
  readonly success?: boolean;
  readonly warnings?: readonly AiComplianceWarning[];
}

async function postJson<T>(endpoint: string, body: unknown): Promise<T | null> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

/** Εικόνα (base64 data-URI) → reconciled πινακίδα, ή `null` σε αποτυχία. */
export async function requestTitleBlockFromImage(
  imageDataUrl: string,
  locale: TitleBlockLocale,
): Promise<AiTitleBlockResult | null> {
  try {
    const payload = await postJson<GenerateResponse>(FROM_IMAGE_ENDPOINT, { imageDataUrl, locale });
    return payload?.result ?? null;
  } catch (error) {
    logger.warn('AI title-block from image request failed', { error: getErrorMessage(error) });
    return null;
  }
}

/** Περιγραφή → reconciled πινακίδα, ή `null` σε αποτυχία. */
export async function requestTitleBlockFromText(
  prompt: string,
  locale: TitleBlockLocale,
): Promise<AiTitleBlockResult | null> {
  try {
    const payload = await postJson<GenerateResponse>(FROM_TEXT_ENDPOINT, { prompt, locale });
    return payload?.result ?? null;
  } catch (error) {
    logger.warn('AI title-block from text request failed', { error: getErrorMessage(error) });
    return null;
  }
}

interface TranslateResponse {
  readonly success?: boolean;
  readonly translations?: Readonly<Record<string, string>>;
}

/**
 * ADR-651 Φάση Κ — προτάσεις μετάφρασης για τις ετικέτες που **δεν ήξερε το λεξικό**.
 *
 * Αποτυχία ⇒ κενός χάρτης: ο διάλογος δείχνει τους όρους αμετάφραστους και ο χρήστης τους
 * γράφει μόνος του. Η μεταγλώττιση δεν εξαρτάται ΠΟΤΕ από το AI.
 */
export async function requestTermTranslations(
  terms: readonly string[],
  from: TitleBlockLocale,
  to: TitleBlockLocale,
): Promise<Readonly<Record<string, string>>> {
  if (terms.length === 0 || from === to) return {};
  try {
    const payload = await postJson<TranslateResponse>(TRANSLATE_ENDPOINT, { terms, from, to });
    return payload?.translations ?? {};
  } catch (error) {
    logger.warn('AI title-block term translation failed', { error: getErrorMessage(error) });
    return {};
  }
}

export interface AiComplianceRequest {
  readonly content: AiTitleBlockResult['template']['content'];
  readonly locale: TitleBlockLocale;
  readonly withStampBox: boolean;
  readonly stampImageUrl?: string;
  readonly projectId?: string;
  readonly drawing?: { readonly scale?: string; readonly title?: string; readonly sheetNumber?: string };
}

/** AI semantic compliance → προειδοποιήσεις (κενό σε αποτυχία — ο rule-based μένει η βάση). */
export async function requestAiCompliance(
  request: AiComplianceRequest,
): Promise<readonly AiComplianceWarning[]> {
  try {
    const payload = await postJson<ValidateResponse>(VALIDATE_ENDPOINT, request);
    return payload?.warnings ?? [];
  } catch (error) {
    logger.warn('AI title-block compliance request failed', { error: getErrorMessage(error) });
    return [];
  }
}
