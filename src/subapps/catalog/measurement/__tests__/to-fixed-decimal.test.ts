/**
 * ADR-923 §5.2 — στρογγύλευση σε N δεκαδικά **στο δεκαδικό**, όχι στο δυαδικό double.
 *
 * Ζωντανά (πίνακας MFP, Β6): 2835 W → kW με 2 δεκαδικά έγραφε «2,83», 3505 W «3,50», 10395 W «10,39» — το `toFixed`
 * στρογγύλευε τα 2,83499… / 3,50499… / 10,39499… του double. Ο τυπωμένος κατάλογος (και το Excel) γράφει 2,84 · 3,51 · 10,40.
 */
import { PLATFORM_MEASUREMENT_REGISTRY } from '../measurement-registry';
import { convertMeasurement, MeasurementConversionError, toFixedDecimal } from '../conversion';

describe('toFixedDecimal', () => {
  it('🔴 οι τρεις τιμές του MFP που ο δυαδικός δρόμος στρογγύλευε λάθος', () => {
    const power = PLATFORM_MEASUREMENT_REGISTRY.get('power')!;
    const kw = (watts: number) => toFixedDecimal(convertMeasurement(power, watts, 'W', 'kW'), 2);
    expect(kw(2835)).toBe('2.84');
    expect(kw(3505)).toBe('3.51');
    expect(kw(10395)).toBe('10.40');
    expect(kw(2915)).toBe('2.92');
  });

  it('μισό μακριά από το μηδέν, και για αρνητικά', () => {
    expect(toFixedDecimal(1.005, 2)).toBe('1.01');
    expect(toFixedDecimal(-1.005, 2)).toBe('-1.01');
    expect(toFixedDecimal(2.5, 0)).toBe('3');
    expect(toFixedDecimal(-2.5, 0)).toBe('-3');
  });

  it('συμπληρώνει μηδενικά · μηδέν δεκαδικά · πολύ μικρές και πολύ μεγάλες τιμές (εκθετική γραφή)', () => {
    expect(toFixedDecimal(1.8, 2)).toBe('1.80');
    expect(toFixedDecimal(472.2222, 0)).toBe('472');
    expect(toFixedDecimal(1e-7, 2)).toBe('0.00');
    expect(toFixedDecimal(1.25e-7, 9)).toBe('0.000000125');
    expect(toFixedDecimal(1e21, 1)).toBe('1e+21');
  });

  it('μη πεπερασμένη τιμή ⇒ σφάλμα με όνομα (όπως η υπόλοιπη μηχανή)', () => {
    expect(() => toFixedDecimal(Number.NaN, 2)).toThrow(MeasurementConversionError);
  });
});
