import { DEFAULT_CLAUSE_LIBRARY } from '@/config/subcontracts/default-clause-library';
import { clauseBody, list, paragraph, param } from '../clause-body-builders';
import { CLAUSE_PARAM_NODE, clauseBlocksToDoc, docToClauseBlocks, type ProseNode } from '../clause-body-doc';
import { clauseDraftOf, clauseKeyFromTitle, emptyClauseDraft, judgeClauseDraft, lockedParameterKeys, proposalBaseOf, sameClauseContent } from '../clause-draft';
import {
  bindingsForKind,
  newParameterDefinition,
  parameterKeyFromLabel,
  renameParameter,
  unreferencedParameters,
  withKind,
  withSource,
  withoutUnreferenced,
} from '../parameter-definition-edits';
import { parameterFromText } from '../parameter-from-text';
import { validateParameterDefinitions } from '../validate-parameter-definition';
import type { SubcontractClauseVersion } from '../../types/clause';
import { crewRatio, retentionBody, retentionRate } from './clause-fixtures';

const text = (value: string): ProseNode => ({ type: 'text', text: value });
const chip = (key: string): ProseNode => ({ type: CLAUSE_PARAM_NODE, attrs: { key } });

describe('clause-body-doc — σώμα ρήτρας ↔ έγγραφο επεξεργαστή (ADR-928 §5.22)', () => {
  it('στρογγυλή διαδρομή χωρίς απώλειες για κάθε μία από τις 29 σπαρμένες ρήτρες', () => {
    expect(DEFAULT_CLAUSE_LIBRARY).toHaveLength(29);
    expect(DEFAULT_CLAUSE_LIBRARY.some((draft) => draft.body.blocks.some((block) => block.kind === 'list'))).toBe(true);
    for (const draft of DEFAULT_CLAUSE_LIBRARY) {
      expect(docToClauseBlocks(clauseBlocksToDoc(draft.body.blocks))).toEqual(draft.body.blocks);
    }
  });

  it('η παράμετρος είναι κόμβος-άτομο με κλειδί· διαδοχικά κείμενα ενώνονται (π.χ. μετά από επικόλληση)', () => {
    const doc: ProseNode = { type: 'doc', content: [{ type: 'paragraph', content: [text('Κράτηση '), text('ίση με '), chip('rate'), text('.')] }] };
    expect(docToClauseBlocks(doc)).toEqual([paragraph('Κράτηση ίση με ', param('rate'), '.')]);
    expect(clauseBlocksToDoc([paragraph('α ', param('rate'))]).content?.[0].content?.[1]).toEqual(chip('rate'));
  });

  it('κενή παράγραφος και κενό στοιχείο λίστας δεν γίνονται μπλοκ (όπως στο χαρτί)· κενό έγγραφο ⇒ καμία παράγραφος', () => {
    const doc: ProseNode = {
      type: 'doc',
      content: [{ type: 'paragraph' }, { type: 'paragraph', content: [text('   ')] }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }],
    };
    expect(docToClauseBlocks(doc)).toEqual([]);
    expect(docToClauseBlocks(clauseBlocksToDoc([]))).toEqual([]);
  });

  it('εμφωλευμένη λίστα ισοπεδώνεται στη σειρά της — κανένα κείμενο δεν χάνεται', () => {
    const item = (...content: ProseNode[]): ProseNode => ({ type: 'listItem', content });
    const doc: ProseNode = {
      type: 'doc',
      content: [{
        type: 'orderedList',
        content: [
          item({ type: 'paragraph', content: [text('α')] }, { type: 'bulletList', content: [item({ type: 'paragraph', content: [text('α1')] })] }),
          item({ type: 'paragraph', content: [text('β')] }, { type: 'paragraph', content: [text('συνέχεια')] }),
        ],
      }],
    };
    expect(docToClauseBlocks(doc)).toEqual([list(true, 'α', 'α1', 'β συνέχεια')]);
  });
});

describe('parameter-from-text — «Κάνε το παράμετρο»', () => {
  it.each([
    ['5%', { kind: 'percent', value: 500 }],
    ['2,5 %', { kind: 'percent', value: 250 }],
    ['150 €', { kind: 'money', value: 15000 }],
    ['€1.200,50', { kind: 'money', value: 120050 }],
    ['30 ημέρες', { kind: 'days', value: 30 }],
    ['60 ημερολογιακές ημέρες', { kind: 'days', value: 60 }],
    ['10 days', { kind: 'days', value: 10 }],
  ])('%s ⇒ είδος και τιμή σε ακέραιες μονάδες', (selection, preferred) => {
    expect(parameterFromText(selection)).toEqual({ kind: preferred.kind, preferred });
  });

  it('ό,τι δεν αναγνωρίζεται γίνεται σύντομο κείμενο — ποτέ λάθος είδος· 2,5 ημέρες δεν είναι ημέρες', () => {
    expect(parameterFromText('  τον  εργοδότη ')).toEqual({ kind: 'text', preferred: { kind: 'text', value: 'τον εργοδότη' } });
    expect(parameterFromText('2,5 ημέρες').kind).toBe('text');
  });

  it('5,255% δεν στρογγυλεύεται σιωπηλά: ο κριτής το λέει άκυρο', () => {
    const guess = parameterFromText('5,255%');
    const definition = newParameterDefinition({ label: 'Κράτηση', kind: guess.kind, preferred: guess.preferred }, new Set());
    expect(validateParameterDefinitions([definition], 'parameters').map((issue) => issue.code)).toContain('parameterValueInvalid');
  });
});

describe('parameter-definition-edits — πράξεις στους ορισμούς', () => {
  it('το κλειδί γεννιέται από την ετικέτα, λατινικό και μοναδικό', () => {
    expect(parameterKeyFromLabel('Ποσοστό κράτησης', new Set())).toBe('pososto_kratisis');
    expect(parameterKeyFromLabel('Ποσοστό κράτησης', new Set(['pososto_kratisis']))).toBe('pososto_kratisis_2');
    expect(parameterKeyFromLabel('', new Set())).toBe('param');
    expect(parameterKeyFromLabel('30 ημέρες', new Set())).toBe('param_30_imeres');
  });

  it('νέος ορισμός με ετικέτα περνά τον κριτή για κάθε είδος χωρίς επιλογές/μέλη', () => {
    for (const kind of ['percent', 'money', 'days', 'weekday', 'milestone', 'unit', 'party'] as const) {
      const definition = newParameterDefinition({ label: 'Ετικέτα', kind }, new Set());
      expect(validateParameterDefinitions([definition], 'parameters')).toEqual([]);
    }
  });

  it('αλλαγή είδους = νέο σχήμα: χάνονται μέλη και ζώνη, μένουν κλειδί και ετικέτα', () => {
    const changed = withKind(crewRatio, 'percent');
    expect(changed).toEqual({ key: crewRatio.key, label: crewRatio.label, kind: 'percent', source: { kind: 'clause' }, preferred: { kind: 'percent', value: 0 }, tolerance: null });
    expect(withKind(crewRatio, 'ratio')).toBe(crewRatio);
  });

  it('δέσιμο μόνο σε όρο ίδιου είδους· για enum οι επιλογές γίνονται ακριβώς του όρου', () => {
    expect(bindingsForKind('percent')).toEqual(['retention.rate', 'withholding.rate', 'penalty.cap']);
    const plain = newParameterDefinition({ label: 'ΦΠΑ', kind: 'percent' }, new Set());
    expect(withSource(plain, 'cash.limitPerPayment')).toBe(plain);
    const vat = withSource(newParameterDefinition({ label: 'ΦΠΑ', kind: 'enum' }, new Set()), 'vat.treatment');
    expect(vat.options?.map((option) => option.key)).toEqual(['excluded', 'included']);
    expect(vat.preferred).toEqual({ kind: 'enum', value: 'excluded' });
    expect(withSource(vat, null).source).toEqual({ kind: 'clause' });
  });

  it('μετονομασία ξαναγράφει κάθε αναφορά του σώματος· πιασμένο ή άκυρο κλειδί ⇒ τίποτα', () => {
    const body = clauseBody('Κ', paragraph('α ', param('rate'), ' β ', param('rate')), list(false, ['γ ', param('rate')]));
    const renamed = renameParameter(body, [retentionRate], 'rate', 'percent_rate');
    expect(renamed.parameters[0].key).toBe('percent_rate');
    expect(JSON.stringify(renamed.body)).not.toContain('"rate"');
    expect(JSON.stringify(renamed.body).match(/percent_rate/g)).toHaveLength(3);
    expect(renameParameter(body, [retentionRate, crewRatio], 'rate', crewRatio.key).body).toBe(body);
    expect(renameParameter(body, [retentionRate], 'rate', 'Άκυρο').body).toBe(body);
  });

  it('αχρησιμοποίητες: μόνο όσες δεν τυπώνονται αφαιρούνται', () => {
    expect(unreferencedParameters(retentionBody, [retentionRate, crewRatio])).toEqual([crewRatio.key]);
    expect(withoutUnreferenced(retentionBody, [retentionRate, crewRatio])).toEqual([retentionRate]);
  });
});

describe('clause-draft — αφετηρία και ο ένας κριτής', () => {
  const version = (n: number, state: SubcontractClauseVersion['state']) => ({ version: n, state, body: retentionBody, parameters: [retentionRate] }) as unknown as SubcontractClauseVersion;

  it('βάση = η σε ισχύ, αλλιώς η νεότερη, αλλιώς καμία', () => {
    const versions = [version(1, 'superseded'), version(2, 'approved'), version(3, 'rejected')];
    expect(proposalBaseOf({ currentVersion: 2 }, versions)?.version).toBe(2);
    expect(proposalBaseOf({ currentVersion: null }, versions)?.version).toBe(3);
    expect(proposalBaseOf({ currentVersion: null }, [])).toBeNull();
  });

  it('νέα ρήτρα: ταυτότητα + πιασμένο κλειδί + περιεχόμενο, από τους κριτές του γραφέα', () => {
    const issues = judgeClauseDraft(emptyClauseDraft(), { mode: 'create', takenKeys: new Set() }).map((issue) => issue.code);
    expect(issues).toEqual(expect.arrayContaining(['clauseKeyInvalid', 'clauseTitleRequired', 'headingRequired', 'bodyEmpty']));
    const draft = { clauseKey: 'retention.performance', title: { el: 'Κράτηση' }, body: retentionBody, parameters: [retentionRate] };
    expect(judgeClauseDraft(draft, { mode: 'create', takenKeys: new Set(['retention.performance']) })).toEqual([{ code: 'clauseKeyTaken', path: 'clauseKey' }]);
    expect(judgeClauseDraft(draft, { mode: 'propose', takenKeys: new Set(['retention.performance']) })).toEqual([]);
  });

  it('κλειδί από τον τίτλο· ίδιο περιεχόμενο με τη βάση ⇒ καμία πρόταση· κλειδωμένα τα κλειδιά της βάσης', () => {
    expect(clauseKeyFromTitle('Ασφάλιση εργοταξίου', new Set())).toBe('asfalisi_ergotaxiou');
    const base = version(2, 'approved');
    const draft = clauseDraftOf({ clauseKey: 'retention.performance', title: { el: 'Κ' } }, base);
    expect(sameClauseContent(draft, base)).toBe(true);
    expect(sameClauseContent({ ...draft, parameters: [] }, base)).toBe(false);
    expect([...lockedParameterKeys(base)]).toEqual([retentionRate.key]);
  });
});
