import elDocument from '@/i18n/locales/el/subcontract-document.json';
import enDocument from '@/i18n/locales/en/subcontract-document.json';
import { sampleAgreement } from '../../agreements/__tests__/agreement-fixtures';
import { frozenClauseOf } from '../../agreements/agreement-snapshot';
import { crewRatio, paymentInstrument } from '../../clauses/__tests__/clause-fixtures';
import type { SubcontractClause, SubcontractClauseVersion } from '../../types/clause';
import type { ClauseParameterValue } from '../../types/clause-parameter';
import { buildAgreementDocument } from '../agreement-document-model';
import { documentLocaleOf } from '../document-locale';
import type { AgreementDocument } from '../document-types';
import { previewSnapshotOf } from '../preview-snapshot';
import { renderParameterValue } from '../render-parameter-value';
import { RETENTION_CLAUSE, sampleSnapshot } from './document-fixtures';

const plain = (text: string | null) => text?.replace(/ /g, ' ') ?? null;
const RAW_KEY = /\b(document|sections|parties|project|lines|totals|terms|plan|parameter|milestones)\.[a-zA-Z_.]+\b/;

function allText(document: AgreementDocument): string {
  return JSON.stringify(document);
}

function keysOf(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key));
}

describe('namespace subcontract-document', () => {
  it('ίδια κλειδιά σε el και en', () => {
    expect(keysOf(enDocument).sort()).toEqual(keysOf(elDocument).sort());
  });
});

describe('renderParameterValue — κάθε είδος, στη γλώσσα του εγγράφου', () => {
  const el = documentLocaleOf('el');
  const en = documentLocaleOf('en');
  it.each<[ClauseParameterValue, string, string]>([
    [{ kind: 'percent', value: 550 }, '5,5%', '5.5%'],
    [{ kind: 'money', value: 123_450 }, '1.234,50 €', '€1,234.50'],
    [{ kind: 'days', value: 1 }, '1 ημέρα', '1 day'],
    [{ kind: 'days', value: 15 }, '15 ημέρες', '15 days'],
    [{ kind: 'weekday', value: 5 }, 'Παρασκευή', 'Friday'],
    [{ kind: 'milestone', value: 'structure.frame_complete' }, 'ολοκλήρωση του φέροντος οργανισμού', 'completion of the load-bearing structure'],
    [{ kind: 'milestone', value: 'custom.unknown' }, 'custom.unknown', 'custom.unknown'],
    [{ kind: 'party', value: 'subcontractor' }, 'ο υπεργολάβος', 'the subcontractor'],
    [{ kind: 'text', value: 'Γ. Παπαδόπουλος' }, 'Γ. Παπαδόπουλος', 'Γ. Παπαδόπουλος'],
  ])('%j', (value, greek, english) => {
    expect(plain(renderParameterValue(value, undefined, el))).toBe(greek);
    expect(plain(renderParameterValue(value, undefined, en))).toBe(english);
  });

  it('enum και ratio από τις ετικέτες του ορισμού (εφεδρεία στο ελληνικό)', () => {
    expect(renderParameterValue({ kind: 'enum', value: 'cheque' }, paymentInstrument, en)).toBe('Επιταγή');
    expect(renderParameterValue({ kind: 'ratio', value: [2, 1, 1] }, crewRatio, el)).toBe('Τεχνίτες:Βοηθοί:Εργάτες = 2:1:1');
  });
});

describe('buildAgreementDocument', () => {
  const greek = buildAgreementDocument(sampleSnapshot(), 'el');
  const english = buildAgreementDocument(sampleSnapshot(), 'en');

  it('γραμμές: ποσό και ολογράφως όπου υπάρχει ποσότητα, «κατά επιμέτρηση» όπου όχι', () => {
    expect(plain(greek.lines[0].amount)).toBe('1.080 €');
    expect(greek.lines[0].amountInWords).toBe('χίλια ογδόντα ευρώ');
    expect(greek.lines[1]).toMatchObject({ quantity: null, amount: null, amountInWords: null });
  });

  it('σύνολο: «τουλάχιστον» όταν λείπουν ποσότητες, χωρίς ολογράφως', () => {
    expect(greek.totals.isLowerBound).toBe(true);
    expect(plain(greek.totals.value)).toBe('τουλάχιστον 1.080 €');
    expect(greek.totals.unpricedNote).toBe('1 γραμμή χωρίς εκτίμηση ποσότητας');
    expect(greek.totals.valueInWords).toBeNull();
  });

  it('ρήτρες: η παράμετρος αποδίδεται, η λείπουσα τιμή φαίνεται', () => {
    expect(greek.clauses[0].blocks[0]).toEqual({ kind: 'paragraph', inlines: [
      { kind: 'text', text: 'Από κάθε λογαριασμό παρακρατείται ποσό ίσο με ' },
      { kind: 'value', text: '5%', missing: false },
      { kind: 'text', text: ' της αξίας των πιστοποιούμενων εργασιών.' },
    ] });
    expect(greek.clauses[1].blocks[0]).toMatchObject({ inlines: expect.arrayContaining([{ kind: 'value', text: '[τιμή που λείπει]', missing: true }]) });
  });

  it('ελληνικό = αυθεντία: καμία σημείωση υπερισχύος, κανένα εύρημα', () => {
    expect(greek).toMatchObject({ isAuthoritative: true, prevailingNotice: null, issues: [] });
    expect(greek.clauses.every((clause) => clause.untranslatedNote === null)).toBe(true);
  });

  it('αγγλικό: ρήτρα υπερισχύος, μετάφραση όπου υπάρχει, ελληνικό με σημείωση και εύρημα όπου λείπει', () => {
    expect(english.prevailingNotice).toBe('This text is a translation. Only the Greek text is legally binding.');
    expect(english.clauses[0]).toMatchObject({ heading: 'Performance retention', untranslatedNote: null });
    expect(english.clauses[1].untranslatedNote).not.toBeNull();
    expect(english.issues).toEqual([{ code: 'translationMissing', path: 'clauses.1.translations.en' }]);
  });

  it('κανένα ωμό κλειδί σε καμία γλώσσα', () => {
    expect(allText(greek)).not.toMatch(RAW_KEY);
    expect(allText(english)).not.toMatch(RAW_KEY);
  });
});

describe('previewSnapshotOf — οι ίδιες συναρτήσεις με τον γραφέα', () => {
  const clause = { id: 'sccl_retention', clauseKey: 'retention.performance', title: RETENTION_CLAUSE.title, currentVersion: 1, isArchived: false } as SubcontractClause;
  const version = { version: 1, body: RETENTION_CLAUSE.body, parameters: RETENTION_CLAUSE.parameters, translations: {}, contentHash: 'h1', sourceHash: 's1' } as unknown as SubcontractClauseVersion;
  const agreement = sampleAgreement({ clauses: [sampleAgreement().clauses[0], sampleAgreement().clauses[1]] });

  it('παγώνει τη ρήτρα όπως το `issue`, και λέει ποια δεν μπορεί να αποδοθεί', () => {
    const { snapshot, unavailable } = previewSnapshotOf(agreement, [clause], new Map([['sccl_retention', version]]));
    expect(snapshot.frozenClauses).toEqual([frozenClauseOf(agreement.clauses[0], { clause, version }, agreement.terms)]);
    expect(unavailable).toEqual(['payment.instruments']);
  });

  it('καρφωμένη έκδοση ≠ έκδοση σε ισχύ ⇒ δεν μαντεύεται', () => {
    const newer = { ...clause, currentVersion: 2 } as SubcontractClause;
    const { unavailable } = previewSnapshotOf(agreement, [newer], new Map([['sccl_retention', { ...version, version: 2 } as SubcontractClauseVersion]]));
    expect(unavailable).toContain('retention.performance');
  });
});
