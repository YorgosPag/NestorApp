/**
 * ADR-890 Φ1 — η αληθοφάνεια ζητούμενης τιμής: η γη ΔΕΝ είναι κατοικία, και η κρίση με ρητό τρόπο προσφοράς
 * δίνει στο ενοίκιο μιας αγγελίας «πώληση & ενοίκιο» τη δική του ζώνη.
 */

import {
  assessModePricePlausibility,
  assessPricePlausibility,
  classifyPropertyTypeForPricing,
} from '@/constants/price-plausibility';

describe('classifyPropertyTypeForPricing', () => {
  it.each([
    ['plot', 'land'],
    ['parcel', 'land'],
    ['apartment', 'residential'],
    ['shop', 'commercial'],
    ['storage', 'auxiliary'],
    [null, 'residential'],
  ])('%s ⇒ %s', (type, expected) => {
    expect(classifyPropertyTypeForPricing(type)).toBe(expected);
  });
});

describe('η γη κρίνεται με ζώνη τάξης μεγέθους', () => {
  it('οικόπεδο 200 €/τ.μ. ΔΕΝ είναι «ύποπτα χαμηλό» (ήταν, όσο κρινόταν ως κατοικία)', () => {
    const verdict = assessPricePlausibility({ commercialStatus: 'for-sale', propertyType: 'plot', askingPrice: 100_000, grossArea: 500 });
    expect(verdict.verdict).toBe('ok');
    expect(verdict.priceClass).toBe('land');
  });

  it('αγροτεμάχιο 3 €/τ.μ. είναι αληθοφανές', () => {
    expect(assessPricePlausibility({ commercialStatus: 'for-sale', propertyType: 'parcel', askingPrice: 30_000, grossArea: 10_000 }).verdict).toBe('ok');
  });

  it('τα τυπογραφικά λάθη πιάνονται ακόμη (μηδενικά που έλειψαν)', () => {
    expect(assessPricePlausibility({ commercialStatus: 'for-sale', propertyType: 'plot', askingPrice: 100, grossArea: 500 }).verdict).toBe('hardFloor');
  });
});

describe('assessModePricePlausibility — ρητός τρόπος προσφοράς', () => {
  it('το ενοίκιο αγγελίας «πώληση & ενοίκιο» κρίνεται με τη ζώνη ΕΝΟΙΚΙΟΥ', () => {
    const rent = assessModePricePlausibility({ mode: 'rent', propertyType: 'apartment', askingPrice: 800, grossArea: 100 });
    expect(rent).toEqual(expect.objectContaining({ verdict: 'ok', mode: 'rent', pricePerSqm: 8 }));
  });

  it('η παλιά είσοδος αναθέτει στη νέα: ίδια απάντηση για ίδια ερώτηση', () => {
    const viaStatus = assessPricePlausibility({ commercialStatus: 'for-rent', propertyType: 'apartment', askingPrice: 5, grossArea: 100 });
    const viaMode = assessModePricePlausibility({ mode: 'rent', propertyType: 'apartment', askingPrice: 5, grossArea: 100 });
    expect(viaStatus).toEqual(viaMode);
  });

  it('εκτός αγοράς ⇒ «ok» χωρίς κρίση (αμετάβλητο)', () => {
    expect(assessPricePlausibility({ commercialStatus: 'sold', propertyType: 'apartment', askingPrice: 1, grossArea: 100 }).verdict).toBe('ok');
  });
});
