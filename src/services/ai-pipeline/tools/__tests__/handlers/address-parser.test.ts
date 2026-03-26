/* eslint-disable no-restricted-syntax */
/**
 * ADDRESS PARSER — Unit Tests (Google-level)
 *
 * Tests ADDRESS_LABEL_MAP and parseGreekAddress for Greek address parsing.
 * Covers street+number extraction, postal code detection, city inference.
 *
 * @see ADR-171 (Autonomous AI Agent)
 * @module __tests__/handlers/address-parser
 */

// ── Mocks ──
jest.mock('@/types/contacts/contracts', () => ({}));

// ── Import after mocks ──
import { ADDRESS_LABEL_MAP, parseGreekAddress } from '../../handlers/address-parser';

// ============================================================================
// ADDRESS_LABEL_MAP
// ============================================================================

describe('ADDRESS_LABEL_MAP', () => {
  it('maps Greek home labels to "home"', () => {
    expect(ADDRESS_LABEL_MAP['σπίτι']).toBe('home');
    expect(ADDRESS_LABEL_MAP['κατοικία']).toBe('home');
  });

  it('maps English home label to "home"', () => {
    expect(ADDRESS_LABEL_MAP['home']).toBe('home');
  });

  it('maps Greek work labels to "work"', () => {
    expect(ADDRESS_LABEL_MAP['εργασία']).toBe('work');
    expect(ADDRESS_LABEL_MAP['γραφείο']).toBe('work');
    expect(ADDRESS_LABEL_MAP['δουλειά']).toBe('work');
  });

  it('maps English work label to "work"', () => {
    expect(ADDRESS_LABEL_MAP['work']).toBe('work');
  });

  it('maps shipping and billing labels', () => {
    expect(ADDRESS_LABEL_MAP['αποστολή']).toBe('shipping');
    expect(ADDRESS_LABEL_MAP['shipping']).toBe('shipping');
    expect(ADDRESS_LABEL_MAP['χρέωση']).toBe('billing');
    expect(ADDRESS_LABEL_MAP['billing']).toBe('billing');
  });
});

// ============================================================================
// parseGreekAddress
// ============================================================================

describe('parseGreekAddress', () => {
  it('parses "Τσιμισκή 42, Θεσσαλονίκη 54623"', () => {
    const result = parseGreekAddress('Τσιμισκή 42, Θεσσαλονίκη 54623');
    expect(result).toEqual({
      street: 'Τσιμισκή',
      number: '42',
      city: 'Θεσσαλονίκη',
      postalCode: '54623',
      country: 'GR',
    });
  });

  it('parses "Λ. Κηφισίας 120, Αθήνα, 11526"', () => {
    const result = parseGreekAddress('Λ. Κηφισίας 120, Αθήνα, 11526');
    expect(result).toEqual({
      street: 'Λ. Κηφισίας',
      number: '120',
      city: 'Αθήνα',
      postalCode: '11526',
      country: 'GR',
    });
  });

  it('handles street without number: "Ερμού, Αθήνα"', () => {
    const result = parseGreekAddress('Ερμού, Αθήνα');
    expect(result.street).toBe('Ερμού');
    expect(result.number).toBe('');
    expect(result.city).toBe('Αθήνα');
  });

  it('handles only street with number: "Ερμού 15"', () => {
    const result = parseGreekAddress('Ερμού 15');
    expect(result.street).toBe('Ερμού');
    expect(result.number).toBe('15');
    expect(result.city).toBe('');
    expect(result.postalCode).toBe('');
    expect(result.country).toBe('GR');
  });

  it('finds postal code in city part: "Τσιμισκή 42, 54623 Θεσσαλονίκη"', () => {
    const result = parseGreekAddress('Τσιμισκή 42, 54623 Θεσσαλονίκη');
    expect(result.postalCode).toBe('54623');
    expect(result.city).toBe('Θεσσαλονίκη');
  });

  it('handles no postal code: "Ερμού 15, Αθήνα"', () => {
    const result = parseGreekAddress('Ερμού 15, Αθήνα');
    expect(result.postalCode).toBe('');
    expect(result.street).toBe('Ερμού');
    expect(result.number).toBe('15');
    expect(result.city).toBe('Αθήνα');
  });

  it('returns empty fields for empty string', () => {
    const result = parseGreekAddress('');
    expect(result).toEqual({
      street: '',
      number: '',
      city: '',
      postalCode: '',
      country: 'GR',
    });
  });

  it('handles three comma-separated parts', () => {
    const result = parseGreekAddress('Ερμού 15, Αθήνα, 10563');
    expect(result.street).toBe('Ερμού');
    expect(result.number).toBe('15');
    expect(result.city).toBe('Αθήνα');
    expect(result.postalCode).toBe('10563');
  });

  it('handles number with Greek letter suffix: "Ερμού 42α, Αθήνα"', () => {
    const result = parseGreekAddress('Ερμού 42α, Αθήνα');
    expect(result.street).toBe('Ερμού');
    expect(result.number).toBe('42α');
    expect(result.city).toBe('Αθήνα');
  });
});
