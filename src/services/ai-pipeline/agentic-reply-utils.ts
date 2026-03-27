/**
 * =============================================================================
 * AGENTIC REPLY UTILS — Post-processing for AI Agent Responses
 * =============================================================================
 *
 * Utilities for cleaning, formatting, and extracting structured data from
 * raw AI text replies. Extracted from agentic-loop.ts (Google file size standard).
 *
 * @module services/ai-pipeline/agentic-reply-utils
 * @see ADR-171 (Autonomous AI Agent)
 */

import { safeJsonParse } from '@/lib/json-utils';
import { isNonEmptyString } from '@/lib/type-guards';
import type { InvoiceEntityResult, InvoiceEntity, InvoiceIssuer } from './invoice-entity-extractor';

/**
 * Extract [SUGGESTIONS] block from AI answer and strip filler phrases.
 *
 * Handles two cases:
 *   1. With closing tag: [SUGGESTIONS]...[/SUGGESTIONS]
 *   2. Without closing tag: [SUGGESTIONS]... (to end of string)
 */
export function extractSuggestions(rawAnswer: string): { cleanAnswer: string; suggestions: string[] } {
  const regexClosed = /\[SUGGESTIONS\]\n?([\s\S]*?)\[\/SUGGESTIONS\]/;
  const regexOpen = /\[SUGGESTIONS\]\n?([\s\S]*)$/;

  const match = rawAnswer.match(regexClosed) ?? rawAnswer.match(regexOpen);

  let cleanAnswer: string;
  let suggestions: string[] = [];

  if (match) {
    cleanAnswer = rawAnswer.replace(match[0], '').trim();
    suggestions = match[1]
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= 40)
      .slice(0, 3);
  } else {
    cleanAnswer = rawAnswer;
  }

  cleanAnswer = stripGenericClosingPhrases(cleanAnswer);

  // Fallback: if AI forgot [SUGGESTIONS], generate context-aware defaults
  if (suggestions.length === 0) {
    suggestions = inferFallbackSuggestions(cleanAnswer);
  }

  return { cleanAnswer, suggestions };
}

/**
 * Infer context-aware fallback suggestions when the AI omits [SUGGESTIONS].
 * Analyzes the AI response content to generate relevant follow-up actions.
 */
function inferFallbackSuggestions(answer: string): string[] {
  const lower = answer.toLowerCase();

  // Invoice/receipt with entity data — offer targeted contact creation
  if ((lower.includes('εκδότη') || lower.includes('εκδοτη')) && lower.includes('συναλλασσόμεν')) {
    return ['Δημιούργησε και τις δύο επαφές', 'Επαφή εκδότη', 'Επαφή συναλλασσόμενου'];
  }

  // Document/file analysis response
  if (lower.includes('έγγραφο') || lower.includes('αρχείο') || lower.includes('pdf') || lower.includes('ανάλυση')) {
    return ['Σύνδεση με επαφή', 'Αποθήκευση στα έγγραφα', 'Κάτι άλλο'];
  }

  // Contact-related response
  if (lower.includes('επαφή') || lower.includes('επαφές') || lower.includes('τηλέφωνο') || lower.includes('email')) {
    return ['Λεπτομέρειες επαφής', 'Στείλε email', 'Δημιουργία ραντεβού'];
  }

  // Property/unit-related response
  if (lower.includes('ακίνητο') || lower.includes('μονάδ') || lower.includes('τ.μ.') || lower.includes('unit')) {
    return ['Τιμή ακινήτου', 'Πρόοδος πληρωμών', 'Στοιχεία αγοραστή'];
  }

  // Project-related response
  if (lower.includes('έργο') || lower.includes('κτήριο') || lower.includes('project')) {
    return ['Κτήρια του έργου', 'Φάσεις κατασκευής', 'Επαφές έργου'];
  }

  // Task/appointment response
  if (lower.includes('ραντεβού') || lower.includes('εργασία') || lower.includes('task')) {
    return ['Προσθήκη ραντεβού', 'Λίστα εργασιών', 'Υπενθύμιση'];
  }

  // Success confirmation
  if (lower.includes('✅') || lower.includes('ολοκληρώθηκε')) {
    return ['Δες λεπτομέρειες', 'Νέα ενέργεια'];
  }

  // Generic fallback
  return ['Λίστα επαφών', 'Λίστα έργων', 'Βοήθεια'];
}

/** Remove filler phrases like "Αν χρειάζεσαι...", "Μη διστάσεις...", "Ενημέρωσέ με" */
export function stripGenericClosingPhrases(text: string): string {
  // Strip technical tool/ID footers that should never reach the user
  const technicalPatterns = [
    /\n*\(Tools used:.*\)/gi,
    /\n*\[Tools used:.*\]/gi,
    /\n*Tools used:.*$/gim,
    /\n*Document IDs?:.*$/gim,
    /\n*\(IDs?:.*\)/gi,
  ];
  let cleaned = text;
  for (const pattern of technicalPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  const fillerPatterns = [
    /\n*Αν χρειάζεσαι[^\n]*/gi,
    /\n*Εάν χρειάζεσαι[^\n]*/gi,
    /\n*Μη διστάσεις[^\n]*/gi,
    /\n*Μην διστάσεις[^\n]*/gi,
    /\n*Ενημέρωσέ με[^\n]*/gi,
    /\n*Αν θέλεις περισσότερ[^\n]*/gi,
    /\n*Εάν θέλεις περισσότερ[^\n]*/gi,
    /\n*Είμαι εδώ για[^\n]*/gi,
    /\n*Πώς μπορώ να σε εξυπηρετήσω[^\n]*/gi,
    /\n*Θα μπορούσες να ελέγξεις[^\n]*/gi,
  ];

  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

/**
 * Clean AI text reply — strip JSON wrapping if present
 */
export function cleanAITextReply(rawText: string): string {
  const trimmed = rawText.trim();

  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;

  if (candidate.startsWith('{')) {
    const parsed = safeJsonParse<Record<string, unknown>>(candidate, null as unknown as Record<string, unknown>);
    if (parsed !== null) {
      const textValue = parsed.response ?? parsed.message ?? parsed.error ?? parsed.text;
      if (isNonEmptyString(textValue)) {
        return textValue;
      }
    }
  }

  return trimmed;
}

/**
 * Prepend attachment metadata to user message so the AI knows
 * which files were sent and their fileRecordIds.
 */
// ============================================================================
// DOCUMENT PREVIEW ENRICHMENT (ADR-264)
// ============================================================================

export interface DocumentPreviewData {
  fileRecordId: string;
  filename: string;
  summary: string;
  documentType: string;
  suggestedActions: string[];
  confidence: number;
  /** All person/company names extracted from the document */
  extractedNames?: string[];
  /** Structured invoice entity data — only for documentType === 'invoice' */
  invoiceEntities?: InvoiceEntityResult | null;
}

/**
 * Prepend document analysis results to the user message so the AI
 * can describe the document and offer actions without calling tools.
 */
export function enrichWithDocumentPreview(
  message: string,
  previews: ReadonlyArray<DocumentPreviewData>
): string {
  if (previews.length === 0) return message;

  const blocks = previews.map(p => {
    const actions = p.suggestedActions.length > 0
      ? `Προτεινόμενες ενέργειες: ${p.suggestedActions.join(', ')}`
      : '';
    const confidenceNote = p.confidence < 0.5
      ? '(Χαμηλή εμπιστοσύνη αναγνώρισης)'
      : '';

    const namesLine = p.extractedNames && p.extractedNames.length > 0
      ? `Πρόσωπα/Εταιρείες: ${p.extractedNames.join(', ')}`
      : '';

    const invoiceLine = p.invoiceEntities
      ? formatInvoiceEntities(p.invoiceEntities)
      : '';

    return [
      `[Ανάλυση Εγγράφου: ${p.filename}, fileRecordId: ${p.fileRecordId}]`,
      `Τύπος: ${p.documentType}`,
      `Περίληψη: ${p.summary}`,
      namesLine,
      actions,
      confidenceNote,
      invoiceLine,
    ].filter(Boolean).join('\n');
  });

  return `${blocks.join('\n\n')}\n\n${message}`;
}

// ============================================================================
// INVOICE ENTITY ENRICHMENT
// ============================================================================

function formatEntityBlock(label: string, entity: InvoiceEntity | InvoiceIssuer): string {
  const lines: string[] = [`${label}:`];
  if (entity.name) lines.push(`  Όνομα: ${entity.name}`);
  if (entity.profession) lines.push(`  Επάγγελμα: ${entity.profession}`);

  const vatDoy = [
    entity.vatNumber ? `ΑΦΜ: ${entity.vatNumber}` : null,
    entity.taxOffice ? `ΔΟΥ: ${entity.taxOffice}` : null,
  ].filter(Boolean).join(' | ');
  if (vatDoy) lines.push(`  ${vatDoy}`);

  if ('registrationNumber' in entity && entity.registrationNumber) {
    lines.push(`  ΓΕΜΗ: ${entity.registrationNumber}`);
  }

  const addressParts = [
    entity.street,
    entity.streetNumber,
  ].filter(Boolean).join(' ');
  const cityParts = [
    entity.postalCode,
    entity.city,
  ].filter(Boolean).join(' ');
  const fullAddress = [addressParts, cityParts].filter(Boolean).join(', ');
  if (fullAddress) lines.push(`  Οδός: ${fullAddress}`);

  if (entity.phone) lines.push(`  Τηλ: ${entity.phone}`);
  if (entity.email) lines.push(`  Email: ${entity.email}`);

  return lines.join('\n');
}

function formatInvoiceEntities(entities: InvoiceEntityResult): string {
  const { invoiceDetails: inv, issuer, customer } = entities;

  const headerParts = [
    inv.invoiceNumber ? `Αρ. Παραστατικού: ${inv.invoiceNumber}` : null,
    inv.invoiceDate ? `Ημερομηνία: ${inv.invoiceDate}` : null,
  ].filter(Boolean).join(' | ');

  const amountParts = [
    inv.netAmount ? `Καθαρό: ${inv.netAmount}€` : null,
    inv.vatAmount ? `ΦΠΑ: ${inv.vatAmount}€` : null,
    inv.totalAmount ? `Σύνολο: ${inv.totalAmount}€` : null,
  ].filter(Boolean).join(' | ');

  const sections = ['[Δεδομένα Τιμολογίου]'];
  if (headerParts) sections.push(headerParts);
  if (amountParts) sections.push(amountParts);

  const hasIssuerData = issuer.name || issuer.vatNumber;
  const hasCustomerData = customer.name || customer.vatNumber;

  if (hasIssuerData) sections.push('', formatEntityBlock('ΕΚΔΟΤΗΣ', issuer));
  if (hasCustomerData) sections.push('', formatEntityBlock('ΣΥΝΑΛΛΑΣΣΟΜΕΝΟΣ', customer));

  return sections.join('\n');
}

// ============================================================================
// ATTACHMENT METADATA ENRICHMENT
// ============================================================================

export function enrichWithAttachments(
  message: string,
  attachments?: ReadonlyArray<{ fileRecordId: string; filename: string; contentType: string }>
): string {
  if (!attachments || attachments.length === 0) return message;

  const desc = attachments.map(a => {
    const type = a.contentType.startsWith('image/') ? 'Φωτογραφία' : 'Έγγραφο';
    return `[Συνημμένο ${type}: ${a.filename}, fileRecordId: ${a.fileRecordId}]`;
  }).join('\n');

  return `${desc}\n\n${message.trim() || '(χωρίς κείμενο)'}`;
}
