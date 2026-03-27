/**
 * =============================================================================
 * INVOICE AUTO-ENRICHMENT — Code-level guarantee for contact field population
 * =============================================================================
 *
 * When a contact is created from an invoice context, auto-applies structured
 * entity data (ΑΦΜ, ΔΟΥ, profession, address, ΓΕΜΗ) directly in the handler.
 *
 * This eliminates dependency on AI model following multi-step prompt instructions
 * (gpt-4o-mini repeatedly failed to call update_contact_field after create_contact).
 *
 * @module services/ai-pipeline/invoice-auto-enrichment
 * @see ADR-264 (Document Preview Mode)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type {
  InvoiceEntityResult,
  InvoiceEntity,
  InvoiceIssuer,
} from './invoice-entity-extractor';
import type { AgenticContext } from './tools/executor-shared';
import { buildAttribution, auditWrite } from './tools/executor-shared';
import type { ChatHistoryMessage } from './chat-history-service';

const logger = createModuleLogger('INVOICE_ENRICH');

// ============================================================================
// NAME MATCHING
// ============================================================================

/** Remove Greek accents and normalize for comparison (handles σ/ς mismatch) */
function normalizeGreekName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ς/g, 'σ') // Normalize final sigma → sigma (Σ.toLowerCase()=σ but typed=ς)
    .trim();
}

/** Check if two names refer to the same person (word-level overlap) */
function namesMatch(nameA: string, nameB: string): boolean {
  const wordsA = normalizeGreekName(nameA).split(/\s+/).filter(w => w.length > 1);
  const wordsB = normalizeGreekName(nameB).split(/\s+/).filter(w => w.length > 1);

  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const shorter = wordsA.length <= wordsB.length ? wordsA : wordsB;
  const longer = wordsA.length <= wordsB.length ? wordsB : wordsA;

  const matchCount = shorter.filter(w => longer.includes(w)).length;
  return matchCount >= Math.min(2, shorter.length);
}

/** Find which invoice entity (issuer or customer) matches the contact name */
function findMatchingEntity(
  displayName: string,
  entities: InvoiceEntityResult
): (InvoiceEntity | InvoiceIssuer) | null {
  if (entities.issuer.name && namesMatch(displayName, entities.issuer.name)) {
    return entities.issuer;
  }
  if (entities.customer.name && namesMatch(displayName, entities.customer.name)) {
    return entities.customer;
  }
  return null;
}

// ============================================================================
// AUTO-ENRICHMENT (Post-create_contact)
// ============================================================================

const PRIVATE_PROFESSION_VALUES = new Set([
  'ιδιωτησ', 'ιδιώτης', 'idiwtis', 'private',
]);

/**
 * Auto-enrich a newly created contact with invoice entity data.
 * Called by create_contact handler after successful creation.
 *
 * Applies: vatNumber, profession, taxOffice, registrationNumber (ΓΕΜΗ),
 *          address, phone (if not already set), email (if not already set).
 */
export async function autoEnrichFromInvoice(
  contactId: string,
  displayName: string,
  contactType: string,
  phoneAlreadySet: boolean,
  emailAlreadySet: boolean,
  ctx: AgenticContext
): Promise<void> {
  if (!ctx.invoiceEntities) return;

  const entity = findMatchingEntity(displayName, ctx.invoiceEntities);
  if (!entity) {
    logger.info('No invoice entity match for contact', { contactId, displayName });
    return;
  }

  const db = getAdminFirestore();
  const updatePayload: Record<string, unknown> = {};

  // vatNumber
  if (entity.vatNumber) {
    updatePayload.vatNumber = entity.vatNumber;
  }

  // profession (skip "ΙΔΙΩΤΗΣ")
  if (entity.profession) {
    const normalized = normalizeGreekName(entity.profession);
    if (!PRIVATE_PROFESSION_VALUES.has(normalized)) {
      updatePayload.profession = entity.profession;
    }
  }

  // taxOffice (store name directly — e.g., "Κατερίνης")
  if (entity.taxOffice) {
    updatePayload.taxOffice = entity.taxOffice;
  }

  // registrationNumber / ΓΕΜΗ (only on issuer)
  if ('registrationNumber' in entity && entity.registrationNumber) {
    updatePayload.registrationNumber = entity.registrationNumber;
  }

  // address
  const addressParts = [entity.street, entity.streetNumber].filter(Boolean).join(' ');
  const cityParts = [entity.postalCode, entity.city].filter(Boolean).join(' ');
  if (addressParts || cityParts) {
    const { parseGreekAddress } = await import('./tools/handlers/address-parser');
    const fullAddress = [addressParts, cityParts].filter(Boolean).join(', ');
    const parsed = parseGreekAddress(fullAddress);
    updatePayload.addresses = [{
      ...parsed,
      type: contactType === 'company' ? 'work' : 'home',
      isPrimary: true,
      country: parsed.country || 'GR',
    }];
  }

  // phone (only if not already set during create_contact)
  if (entity.phone && !phoneAlreadySet) {
    const { isValidPhone, cleanPhoneNumber } = await import('@/lib/validation/phone-validation');
    if (isValidPhone(entity.phone)) {
      updatePayload.phones = [{
        number: cleanPhoneNumber(entity.phone),
        type: contactType === 'company' ? 'main' : 'mobile',
        isPrimary: true,
      }];
    }
  }

  // email (only if not already set)
  if (entity.email && !emailAlreadySet) {
    const { isValidEmail } = await import('@/lib/validation/email-validation');
    if (isValidEmail(entity.email)) {
      updatePayload.emails = [{
        email: entity.email.toLowerCase().trim(),
        type: 'work',
        isPrimary: true,
      }];
    }
  }

  // Nothing to update
  const fieldCount = Object.keys(updatePayload).length;
  if (fieldCount === 0) {
    logger.info('No enrichable fields found', { contactId, displayName });
    return;
  }

  // Apply update
  updatePayload.updatedAt = new Date().toISOString();
  updatePayload.lastModifiedBy = buildAttribution(ctx);

  await db.collection(COLLECTIONS.CONTACTS).doc(contactId).update(updatePayload);
  await auditWrite(ctx, COLLECTIONS.CONTACTS, contactId, 'auto_enrich_invoice', updatePayload);

  logger.info('Contact auto-enriched from invoice', {
    contactId,
    displayName,
    fieldsSet: Object.keys(updatePayload).filter(k => k !== 'updatedAt' && k !== 'lastModifiedBy'),
    matchedEntity: entity === ctx.invoiceEntities.issuer ? 'issuer' : 'customer',
  });
}

// ============================================================================
// EXTRACT INVOICE ENTITIES FROM CHAT HISTORY
// ============================================================================

/** Parse a single entity block (ΕΚΔΟΤΗΣ or ΣΥΝΑΛΛΑΣΣΟΜΕΝΟΣ) from text */
function parseEntityBlock(block: string): InvoiceEntity {
  const field = (pattern: RegExp): string | null => {
    const match = block.match(pattern);
    return match ? match[1].trim() : null;
  };

  return {
    name: field(/Όνομα:\s*(.+)/),
    profession: field(/Επάγγελμα:\s*(.+)/),
    vatNumber: field(/ΑΦΜ:\s*(\S+)/),
    taxOffice: field(/ΔΟΥ:\s*(.+?)(?:\s*$|\s*\|)/m),
    street: null,
    streetNumber: null,
    postalCode: null,
    city: null,
    phone: field(/Τηλ:\s*(\S+)/),
    email: field(/Email:\s*(\S+)/),
  };
}

/** Parse issuer block (includes registrationNumber) */
function parseIssuerBlock(block: string): InvoiceIssuer {
  const base = parseEntityBlock(block);
  const gemiMatch = block.match(/ΓΕΜΗ:\s*(\S+)/);
  return {
    ...base,
    registrationNumber: gemiMatch ? gemiMatch[1].trim() : null,
  };
}

/**
 * Extract InvoiceEntityResult from chat history messages.
 * Scans for [Δεδομένα Τιμολογίου] block in recent messages.
 */
export function extractInvoiceEntitiesFromHistory(
  history: ReadonlyArray<ChatHistoryMessage>
): InvoiceEntityResult | null {
  for (const msg of history) {
    if (!msg.content.includes('[Δεδομένα Τιμολογίου]')) continue;

    const text = msg.content;

    // Split into ΕΚΔΟΤΗΣ and ΣΥΝΑΛΛΑΣΣΟΜΕΝΟΣ blocks
    const issuerIdx = text.indexOf('ΕΚΔΟΤΗΣ:');
    const customerIdx = text.indexOf('ΣΥΝΑΛΛΑΣΣΟΜΕΝΟΣ:');

    if (issuerIdx === -1 && customerIdx === -1) continue;

    const issuerBlock = issuerIdx !== -1
      ? text.slice(issuerIdx, customerIdx !== -1 ? customerIdx : undefined)
      : '';
    const customerBlock = customerIdx !== -1
      ? text.slice(customerIdx)
      : '';

    const issuer = issuerBlock ? parseIssuerBlock(issuerBlock) : {
      name: null, profession: null, vatNumber: null, taxOffice: null,
      street: null, streetNumber: null, postalCode: null, city: null,
      phone: null, email: null, registrationNumber: null,
    };
    const customer = customerBlock ? parseEntityBlock(customerBlock) : {
      name: null, profession: null, vatNumber: null, taxOffice: null,
      street: null, streetNumber: null, postalCode: null, city: null,
      phone: null, email: null,
    };

    // Parse address from "Οδός:" field into components
    const parseAddressField = (block: string, entity: InvoiceEntity): void => {
      const addressMatch = block.match(/Οδός:\s*(.+)/);
      if (!addressMatch) return;
      const fullAddr = addressMatch[1].trim();
      const parts = fullAddr.split(',').map(p => p.trim());
      if (parts.length >= 1) {
        entity.street = parts[0];
      }
      if (parts.length >= 2) {
        const cityPart = parts[1];
        const postalMatch = cityPart.match(/^(\d{5})\s+(.+)/);
        if (postalMatch) {
          entity.postalCode = postalMatch[1];
          entity.city = postalMatch[2];
        } else {
          entity.city = cityPart;
        }
      }
    };

    if (issuerBlock) parseAddressField(issuerBlock, issuer);
    if (customerBlock) parseAddressField(customerBlock, customer);

    // Parse invoice details
    const invoiceNumber = text.match(/Αρ\. Παραστατικού:\s*(\S+)/)?.[1] ?? null;
    const invoiceDate = text.match(/Ημερομηνία:\s*(\S+)/)?.[1] ?? null;
    const netAmount = text.match(/Καθαρό:\s*([\d.,]+)/)?.[1] ?? null;
    const vatAmount = text.match(/ΦΠΑ:\s*([\d.,]+)/)?.[1] ?? null;
    const totalAmount = text.match(/Σύνολο:\s*([\d.,]+)/)?.[1] ?? null;

    return {
      issuer,
      customer,
      invoiceDetails: { invoiceNumber, invoiceDate, netAmount, vatAmount, totalAmount },
    };
  }

  return null;
}
