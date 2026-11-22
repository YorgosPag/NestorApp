/**
 * @fileoverview Άγκυρες του **φράχτη «όχι φυσικό πρόσωπο»** και του χάρτη ΓΕΜΗ — ADR-948 §8.3.
 *
 * 🔴 Τα σενάρια που φυλάνε: ατομική επιχείρηση που αποθηκεύεται (GDPR) · νέος κωδικός που
 * περνά σιωπηλά · κωδικός που άλλαξε νόημα στον κατάλογο και κρατά την παλιά κατάταξη.
 * Οι κωδικοί είναι οι **ζωντανοί** του καταλόγου (2026-11-22), όχι των συνθετικών fixtures.
 */

import {
  findGemiCompanyStatus,
  findGemiLegalForm,
  GEMI_COMPANY_STATUSES,
  GEMI_LEGAL_FORMS,
} from '@/config/company-registry/gemi-legal-forms';
import { VOCAB_GEMI_STATUSES, VOCAB_LEGAL_FORMS } from '@/config/vocabulary/options/company';
import { classifyRegistryLegalForm } from '@/lib/company/registry-legal-person';

const code = (id: string, label: string) => ({ id, label });

describe('Α — ο φράχτης', () => {
  it('Α1 — ΑΕ (1) περνά ως οντότητα με ELF W2NK και κατηγορία ae', () => {
    const verdict = classifyRegistryLegalForm(code('1', 'ΑΕ'));
    expect(verdict.kind).toBe('entity');
    if (verdict.kind === 'entity') {
      expect(verdict.entry.elf).toBe('W2NK');
      expect(verdict.entry.contactLegalForm).toBe('ae');
    }
  });

  it('Α2 — ΑΤΟΜΙΚΗ (16) ⇒ άρνηση natural-person', () => {
    expect(classifyRegistryLegalForm(code('16', 'ΑΤΟΜΙΚΗ'))).toEqual({ kind: 'refused', reason: 'natural-person', gemiId: '16' });
  });

  it.each([['0', 'Inadequate Info'], ['9', 'ΚΟΙΝΩΝΙΑ'], ['17', 'ΕΝΩΣΗ ΠΡΟΣΩΠΩΝ'], ['64', 'ΛΟΙΠΩΝ ΥΠΟΧΡΕΩΝ']])(
    'Α3 — %s (%s) ⇒ άρνηση unclassifiable',
    (id, label) => {
      expect(classifyRegistryLegalForm(code(id, label))).toEqual({ kind: 'refused', reason: 'unclassifiable', gemiId: id });
    },
  );

  it('Α4 — κοινοπραξία (14) περνά, αν και χωρίς νομική προσωπικότητα', () => {
    const verdict = classifyRegistryLegalForm(code('14', 'Κοινοπραξία'));
    expect(verdict.kind).toBe('entity');
    if (verdict.kind === 'entity') expect(verdict.entry.legalPersonality).toBe('no');
  });

  it('Α5 — υποκατάστημα αλλοδαπής (15) περνά, χωρίς κατηγορία επαφής', () => {
    const verdict = classifyRegistryLegalForm(code('15', 'Υποκατάστημα Αλλοδαπής'));
    expect(verdict.kind).toBe('entity');
    if (verdict.kind === 'entity') expect(verdict.entry.contactLegalForm).toBeNull();
  });

  it('Α6 — χωρίς νομική μορφή ⇒ άρνηση no-legal-form', () => {
    expect(classifyRegistryLegalForm(null)).toEqual({ kind: 'refused', reason: 'no-legal-form', gemiId: null });
  });

  it('Α7 — κωδικός εκτός χάρτη ⇒ άρνηση unmapped (fail-closed)', () => {
    expect(classifyRegistryLegalForm(code('99', 'Νέα Μορφή'))).toEqual({ kind: 'refused', reason: 'unmapped', gemiId: '99' });
  });

  it('Α8 — ίδιος κωδικός, άλλη περιγραφή ⇒ άρνηση catalog-drift', () => {
    expect(classifyRegistryLegalForm(code('1', 'ΑΤΟΜΙΚΗ'))).toEqual({ kind: 'refused', reason: 'catalog-drift', gemiId: '1' });
  });

  it('Α9 — κενά και μορφή Unicode δεν είναι ολίσθηση', () => {
    expect(classifyRegistryLegalForm(code('1', '  ΑΕ ')).kind).toBe('entity');
    expect(classifyRegistryLegalForm(code('19', 'ΙΚΕ'.normalize('NFD'))).kind).toBe('entity');
  });

  it('Α10 — η ολίσθηση ελέγχεται ΠΡΙΝ το υποκείμενο: «ΑΕ» στον κωδικό 16 δεν περνά', () => {
    expect(classifyRegistryLegalForm(code('16', 'ΑΕ'))).toEqual({ kind: 'refused', reason: 'catalog-drift', gemiId: '16' });
  });
});

describe('Β — ο χάρτης', () => {
  it('Β1 — 26 νομικές μορφές και 12 καταστάσεις, όπως ο ζωντανός κατάλογος', () => {
    expect(GEMI_LEGAL_FORMS).toHaveLength(26);
    expect(GEMI_COMPANY_STATUSES).toHaveLength(12);
  });

  it('Β2 — κανένας κωδικός δύο φορές', () => {
    expect(new Set(GEMI_LEGAL_FORMS.map((e) => e.gemiId)).size).toBe(GEMI_LEGAL_FORMS.length);
    expect(new Set(GEMI_COMPANY_STATUSES.map((e) => e.gemiId)).size).toBe(GEMI_COMPANY_STATUSES.length);
  });

  it('Β3 — κάθε κατηγορία επαφής υπάρχει στο λεξιλόγιο', () => {
    const allowed = new Set<string>(VOCAB_LEGAL_FORMS.map((o) => o.value));
    for (const entry of GEMI_LEGAL_FORMS) {
      if (entry.contactLegalForm !== null) expect(allowed.has(entry.contactLegalForm)).toBe(true);
    }
  });

  it('Β4 — κάθε κατάσταση επαφής υπάρχει στο λεξιλόγιο', () => {
    const allowed = new Set<string>(VOCAB_GEMI_STATUSES.map((o) => o.value));
    for (const entry of GEMI_COMPANY_STATUSES) {
      for (const status of entry.contactStatuses) expect(allowed.has(status)).toBe(true);
    }
  });

  it('Β5 — μόνο η «Ενεργή» (3) είναι ενεργή, και λέγεται active', () => {
    const active = GEMI_COMPANY_STATUSES.filter((e) => e.isActive);
    expect(active.map((e) => e.gemiId)).toEqual(['3']);
    expect(findGemiCompanyStatus('3')?.contactStatuses).toEqual(['active']);
  });

  it('Β6 — κάθε γραμμή έχει πηγή· η ατομική είναι το μόνο φυσικό πρόσωπο', () => {
    for (const entry of GEMI_LEGAL_FORMS) expect(entry.basis.trim()).not.toBe('');
    expect(GEMI_LEGAL_FORMS.filter((e) => e.subject === 'natural-person').map((e) => e.gemiId)).toEqual(['16']);
  });

  it('Β7 — άγνωστος κωδικός ⇒ null και στους δύο χάρτες', () => {
    expect(findGemiLegalForm('99')).toBeNull();
    expect(findGemiCompanyStatus('99')).toBeNull();
  });
});
