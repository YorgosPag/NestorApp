/**
 * GREEK ADDRESS PARSER — Parse address strings into structured AddressInfo
 * @module services/ai-pipeline/tools/handlers/address-parser
 * @see ADR-171 (Autonomous AI Agent)
 */

import type { AddressInfo } from '@/types/contacts/contracts';

/** Label → AddressInfo.type mapping (SSoT) */
export const ADDRESS_LABEL_MAP: Record<string, AddressInfo['type']> = {
  'σπίτι': 'home', 'home': 'home', 'κατοικία': 'home',
  'εργασία': 'work', 'work': 'work', 'γραφείο': 'work', 'δουλειά': 'work',
  'αποστολή': 'shipping', 'shipping': 'shipping',
  'χρέωση': 'billing', 'billing': 'billing',
};

/**
 * Parse a Greek address string into structured AddressInfo fields.
 * Handles patterns like: "Τσιμισκή 42, Θεσσαλονίκη 54623"
 * or "Λ. Κηφισίας 120, Αθήνα, 11526"
 */
export function parseGreekAddress(
  raw: string
): Pick<AddressInfo, 'street' | 'number' | 'city' | 'postalCode' | 'country'> {
  const parts = raw.split(',').map(p => p.trim());

  // Extract postal code (5-digit Greek TK) from any part
  let postalCode = '';
  const tkRegex = /\b(\d{5})\b/;
  for (const part of parts) {
    const match = tkRegex.exec(part);
    if (match) {
      postalCode = match[1];
      break;
    }
  }

  // First part: street + number (e.g. "Τσιμισκή 42")
  let street = '';
  let number = '';
  if (parts.length > 0) {
    const streetPart = parts[0];
    const numMatch = /^(.+?)\s+(\d+[α-ωΑ-Ω]?)\s*$/.exec(streetPart);
    if (numMatch) {
      street = numMatch[1].trim();
      number = numMatch[2];
    } else {
      street = streetPart.replace(tkRegex, '').trim();
    }
  }

  // City: second part (cleaned of postal code)
  let city = '';
  if (parts.length > 1) {
    city = parts[1].replace(tkRegex, '').trim();
  }
  // If city is empty, check third part
  if (!city && parts.length > 2) {
    city = parts[2].replace(tkRegex, '').trim();
  }

  return { street, number, city, postalCode, country: 'GR' };
}
