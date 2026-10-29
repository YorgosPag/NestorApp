import { validateDiscountRule } from '@/subapps/catalog/schema/validate-pricing';
import { chainTextOf, isReadableChain, percentOfStep, stepsFromChainText } from '../discount-chain-input';

const greek = (value: number) => String(value).replace('.', ',');
const issuesOf = (text: string) => validateDiscountRule({ kind: 'chain', steps: stepsFromChainText(text) }).map((issue) => `${issue.code}@${issue.path}`);

describe('discount-chain-input — «50 + 10» όπως το λέει ο έμπορος', () => {
  it('διαβάζει κάθε γραφή: με/χωρίς κενά, με %, με κόμμα ή τελεία', () => {
    expect(stepsFromChainText('50+10')).toEqual([5000, 1000]);
    expect(stepsFromChainText(' 50 + 10 ')).toEqual([5000, 1000]);
    expect(stepsFromChainText('50% + 10,5%')).toEqual([5000, 1050]);
    expect(stepsFromChainText('52.25')).toEqual([5225]);
  });

  it('κενό = καμία έκπτωση (έγκυρο: η ειδικότερη «0%» εξαιρεί)', () => {
    expect(stepsFromChainText('   ')).toEqual([]);
    expect(issuesOf('')).toEqual([]);
  });

  it('τρίτο δεκαδικό ⇒ άκυρο βήμα, ποτέ σιωπηλή στρογγύλευση (και το «1.000» δεν γίνεται 1%)', () => {
    expect(stepsFromChainText('10,125')).toEqual([Number.NaN]);
    expect(stepsFromChainText('1.000')).toEqual([Number.NaN]);
    expect(issuesOf('50 + 10,125')).toEqual(['discountStepInvalid@rule.steps']);
  });

  it('άκυρα βήματα ⇒ NaN στη θέση τους: κείμενο, αρνητικό, >100, κενό ανάμεσα σε δύο «+»', () => {
    expect(stepsFromChainText('abc')).toEqual([Number.NaN]);
    expect(stepsFromChainText('-5')).toEqual([Number.NaN]);
    expect(stepsFromChainText('101')).toEqual([Number.NaN]);
    expect(stepsFromChainText('50 + + 10')).toEqual([5000, Number.NaN, 1000]);
    expect(isReadableChain(stepsFromChainText('50+'))).toBe(false);
  });

  it('έως 5 βήματα — το έκτο το λέει η ΙΔΙΑ επικύρωση με τον γραφέα', () => {
    expect(issuesOf('1+1+1+1+1')).toEqual([]);
    expect(issuesOf('1+1+1+1+1+1')).toEqual(['tooMany@rule.steps']);
  });

  it('εκτύπωση ↔ ανάγνωση: ίδιο αποτέλεσμα (στρογγυλή διαδρομή)', () => {
    const steps = [5000, 1050, 25];
    const text = chainTextOf(steps, greek);
    expect(text).toBe('50 + 10,5 + 0,25');
    expect(stepsFromChainText(text)).toEqual(steps);
    expect(percentOfStep(5225)).toBe(52.25);
  });
});
