/**
 * ADR-944 §3.7 — **φραγμός ανά διεύθυνση, όχι ανά πλήθος**: η ανίχνευση ΔΕΝ μπλοκάρει πια καμία αφαίρεση· λέει ποια
 * κλειδιά email αφαιρούνται, και ο server απαντά ποια είναι άγκυρες λογαριασμού.
 *
 * Α1 — αφαίρεση του τελευταίου email ⇒ `lastEmailRemoved` (isRemoval) + preview, ΚΑΝΕΝΑΣ φραγμός πελάτη.
 * Α2 — αφαίρεση του τελευταίου τηλεφώνου ⇒ `lastPhoneRemoved` + preview.
 * Α3 — αφαίρεση ΕΝΟΣ από πολλά email ⇒ το κλειδί του στο `removedEmailKeys` (η άγκυρα μπορεί να είναι οποιοδήποτε).
 * Α4 — ίδιο email με άλλα κεφαλαία/κενά ⇒ ΔΕΝ μετρά ως αφαίρεση (SSoT `emailKeyOf`).
 * Α5 — κλειδί που ζούσε μόνο στο αποθηκευμένο `emailKeys` (παλαιό επίπεδο `email`) ⇒ μετρά ως αφαιρούμενο.
 * Α6 — καμία αλλαγή ⇒ κανένα preview.
 */

import type { Contact, EmailInfo, PhoneInfo } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';

import { detectCommunicationChanges, removedEmailKeysOf } from '../communication-impact-guard';

function email(address: string, isPrimary = false): EmailInfo {
  return { email: address, type: 'personal', isPrimary };
}

function phone(number: string): PhoneInfo {
  return { number, type: 'mobile', isPrimary: true };
}

function contact(emails: EmailInfo[], phones: PhoneInfo[] = [], emailKeys?: string[]): Contact {
  return { id: 'cont_1', type: 'individual', firstName: 'Γεωργία', lastName: 'Ζέρβα', emails, phones, emailKeys } as Contact;
}

function form(emails: EmailInfo[], phones: PhoneInfo[] = []): ContactFormData {
  return { emails, phones } as ContactFormData;
}

describe('detectCommunicationChanges — ADR-944 §3.7', () => {
  it('Α1 — αφαίρεση του τελευταίου email ⇒ preview, όχι φραγμός', () => {
    const detection = detectCommunicationChanges(contact([email('l5-test@example.com', true)]), form([]));
    expect(detection.changes.map((c) => [c.changeType, c.isRemoval])).toEqual([['lastEmailRemoved', true]]);
    expect(detection.removedEmailKeys).toEqual(['l5-test@example.com']);
    expect(detection.requiresImpactPreview).toBe(true);
    expect(detection).not.toHaveProperty('hasUnsafeRemoval');
  });

  it('Α2 — αφαίρεση του τελευταίου τηλεφώνου ⇒ preview', () => {
    const detection = detectCommunicationChanges(contact([], [phone('6900000000')]), form([], []));
    expect(detection.changes.map((c) => c.changeType)).toEqual(['lastPhoneRemoved']);
    expect(detection.removedEmailKeys).toEqual([]);
    expect(detection.requiresImpactPreview).toBe(true);
  });

  it('Α3 — αφαίρεση ενός από πολλά ⇒ μόνο αυτό στο removedEmailKeys', () => {
    const before = contact([email('a@x.gr', true), email('b@x.gr')]);
    const detection = detectCommunicationChanges(before, form([email('a@x.gr', true)]));
    expect(detection.changes).toEqual([]);
    expect(detection.removedEmailKeys).toEqual(['b@x.gr']);
    expect(detection.requiresImpactPreview).toBe(true);
  });

  it('Α4 — ίδιο email με άλλα κεφαλαία/κενά ⇒ όχι αφαίρεση', () => {
    const before = contact([email('Pro@Example.gr', true)]);
    expect(removedEmailKeysOf(before, form([email('  pro@example.GR ', true)]))).toEqual([]);
  });

  it('Α5 — κλειδί μόνο στο αποθηκευμένο emailKeys ⇒ αφαιρούμενο', () => {
    const before = contact([email('a@x.gr', true)], [], ['a@x.gr', 'legacy@x.gr']);
    expect(removedEmailKeysOf(before, form([email('a@x.gr', true)]))).toEqual(['legacy@x.gr']);
  });

  it('Α6 — καμία αλλαγή ⇒ κανένα preview', () => {
    const before = contact([email('a@x.gr', true)], [phone('6900000000')]);
    const detection = detectCommunicationChanges(before, form([email('a@x.gr', true)], [phone('6900000000')]));
    expect(detection.hasChanges).toBe(false);
    expect(detection.requiresImpactPreview).toBe(false);
  });
});
