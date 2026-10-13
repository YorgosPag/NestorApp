/**
 * ADR-777 §8.95 — **ο γεννήτορας των τιμών αναφοράς ενέργειας**: τα δύο καθαρά βήματα που μετατρέπουν ό,τι δίνουν οι
 * πηγές σε €/kWh ανά εξάμηνο. Το δίκτυο δεν αγγίζεται εδώ.
 */

const {
  semesterPricesFromJsonStat,
  oilSemesterPrices,
  semesterOf,
  OIL_KWH_PER_LITRE,
  MIN_OIL_WEEKS,
} = require('../generate-energy-reference-prices');

/** Το σχήμα που επιστρέφει το API της Eurostat για ένα ερώτημα με μία τιμή σε κάθε διάσταση εκτός χρόνου. */
function jsonStat(timeIndex, value) {
  return { updated: '2026-10-12T23:00:00+0200', dimension: { time: { category: { index: timeIndex } } }, value };
}

describe('Eurostat JSON-stat → εξάμηνα', () => {
  it('η θέση στο `value` είναι η θέση του εξαμήνου· παλαιότερο πρώτο, 4 δεκαδικά', () => {
    const json = jsonStat({ '2025-S2': 0, '2026-S1': 1 }, { 0: 0.23814, 1: 0.2401 });
    expect(semesterPricesFromJsonStat(json)).toEqual([
      { period: '2025-S2', eurPerKwh: 0.2381 },
      { period: '2026-S1', eurPerKwh: 0.2401 },
    ]);
  });

  it('🔴 εξάμηνο χωρίς τιμή ΠΑΡΑΛΕΙΠΕΤΑΙ — δεν γίνεται 0 €/kWh', () => {
    const json = jsonStat({ '2025-S1': 0, '2025-S2': 1, '2026-S1': 2 }, { 0: 0.09, 2: 0.08 });
    expect(semesterPricesFromJsonStat(json).map((entry) => entry.period)).toEqual(['2025-S1', '2026-S1']);
  });

  it('🔴 απάντηση χωρίς τιμές ή χωρίς χρόνο ΡΙΧΝΕΙ — ο γεννήτορας δεν γράφει μισό πίνακα', () => {
    expect(() => semesterPricesFromJsonStat(jsonStat({ '2026-S1': 0 }, {}))).toThrow();
    expect(() => semesterPricesFromJsonStat({ value: { 0: 1 } })).toThrow();
  });
});

describe('Weekly Oil Bulletin → εξάμηνα', () => {
  const week = (iso, eurPer1000L) => ({ date: new Date(`${iso}T00:00:00Z`), eurPer1000L });
  const weeksOf = (isos, price) => isos.map((iso) => week(iso, price));
  const TODAY = new Date('2026-10-13T00:00:00Z');

  it('το εξάμηνο βγαίνει από τον μήνα', () => {
    expect(semesterOf(new Date('2026-06-30T00:00:00Z'))).toBe('2026-S1');
    expect(semesterOf(new Date('2026-07-01T00:00:00Z'))).toBe('2026-S2');
  });

  it('μέσος όρος εβδομάδων → €/λίτρο → €/kWh με τη θερμογόνο ικανότητα', () => {
    const weeks = weeksOf(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'], 1200);
    const [semester] = oilSemesterPrices(weeks, TODAY);
    expect(semester.period).toBe('2026-S1');
    expect(semester.weeks).toBe(4);
    expect(semester.eurPerKwh).toBeCloseTo(1.2 / OIL_KWH_PER_LITRE, 4);
  });

  it('🔴 το ΤΡΕΧΟΝ εξάμηνο δεν γράφεται ποτέ — είναι ατελές', () => {
    const weeks = [
      ...weeksOf(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'], 1200),
      ...weeksOf(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'], 1500),
    ];
    expect(oilSemesterPrices(weeks, new Date('2026-11-15T00:00:00Z')).map((entry) => entry.period)).toEqual(['2026-S1']);
  });

  it(`🔴 εξάμηνο με λιγότερες από ${MIN_OIL_WEEKS} εβδομάδες ΔΕΝ γίνεται τιμή`, () => {
    const weeks = weeksOf(['2026-01-05', '2026-01-12', '2026-01-19'], 1200);
    expect(oilSemesterPrices(weeks, TODAY)).toEqual([]);
  });

  it('εβδομάδες χωρίς τιμή (εκτός περιόδου διάθεσης) αγνοούνται· κρατούνται τα 4 νεότερα εξάμηνα', () => {
    const years = [2023, 2024, 2025];
    const weeks = years.flatMap((year) => [
      ...weeksOf([`${year}-01-05`, `${year}-01-12`, `${year}-01-19`, `${year}-01-26`], 1000 + year),
      ...weeksOf([`${year}-11-02`, `${year}-11-09`, `${year}-11-16`, `${year}-11-23`], 1100 + year),
      week(`${year}-08-10`, Number.NaN),
    ]);
    const periods = oilSemesterPrices(weeks, TODAY).map((entry) => entry.period);
    expect(periods).toEqual(['2024-S1', '2024-S2', '2025-S1', '2025-S2']);
  });
});
