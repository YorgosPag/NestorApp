/**
 * @fileoverview **Προεπιλεγμένα πρότυπα ειδικότητας** (ADR-928 §5.3) — ΔΕΔΟΜΕΝΑ, από τα έγγραφα της εταιρείας.
 * @module config/subcontracts/default-trade-templates
 *
 * - `reinforcement.placement` — «Πρότυπο Προσφοράς. Σιδηροί Οπλισμοί Μπετόν» (2009-2010): Τρόπος Α (η προσφορά γίνεται
 *   συμφωνητικό με την εγκατάσταση), ημερομίσθια ως προκαταβολή με όριο το παραχθέν, πληρωμή κάθε 2η Παρασκευή,
 *   εξόφληση μετά τον φέροντα οργανισμό 50% τράπεζα / 50% επιταγή 4 μηνών (2009: «50% μετρητοίς» → τράπεζα, §4).
 * - `plastering.three_coat` — «Προσφορά – Ιδιωτικό Συμφωνητικό & Τιμολόγιο Εφαρμογής Επιχρισμάτων» (2008): Τρόπος Β,
 *   πιστοποίηση επιμετρημένων ποσοτήτων, κράτηση 5%, ποινή 100 €/ημέρα έως 5%, κατανομή σταδίων, κανόνες επιμέτρησης,
 *   1 ένσημο ανά 30 m², ελάχιστη απόδοση 110 m²/ημέρα.
 *
 * Τιμές του τότε, ως **σημείο εκκίνησης** που η εταιρεία αλλάζει — όχι τιμοκατάλογος. Τα πρότυπα αναφέρονται σε ρήτρες
 * με `clauseKey`· η έγκριση της έκδοσης κρίνεται όταν χρησιμοποιηθεί το πρότυπο (Φ2). Άγκυρα: `default-clause-library.test.ts`.
 */

import { list, paragraph } from '@/subapps/procurement/subcontracts/clauses/clause-body-builders';
import type { AgreementLine, AgreementLineStage, MeasurementRule } from '@/subapps/procurement/subcontracts/types/agreement-line';
import type { CommercialTerms, RequiredDocument } from '@/subapps/procurement/subcontracts/types/commercial-terms';
import type { SubcontractTradeTemplateDefinition, TemplateClauseRef } from '@/subapps/procurement/subcontracts/types/trade-template';

const refs = (...clauseKeys: readonly string[]): TemplateClauseRef[] =>
  clauseKeys.map((clauseKey) => ({ clauseKey, parameterOverrides: {} }));

const CORE_CLAUSES = [
  'subject.scope', 'mobilization.start', 'execution.obligations', 'safety.health', 'personnel.obligations',
  'labor.joint_liability', 'liability.insurance', 'acceptance.handover', 'payment.certification',
  'tax.withholding_technical_works', 'payment.instruments', 'vat.treatment', 'assignment.prohibited', 'documents.required',
] as const;

const REQUIRED_DOCUMENTS: readonly RequiredDocument[] = [
  { kind: 'personnel_list', when: { kind: 'days_before_start', days: 5 } },
  { kind: 'liability_insurance', when: { kind: 'days_before_start', days: 0 } },
  { kind: 'tax_clearance', when: { kind: 'before_each_payment' } },
  { kind: 'insurance_clearance', when: { kind: 'before_each_payment' } },
];

/** Κοινή βάση όρων: ΦΠΑ εκτός (24%), παρακράτηση 3%, όριο μετρητών 500 €, πληρωμή κάθε 2η Παρασκευή. */
const baseTerms = (overrides: Partial<CommercialTerms>): CommercialTerms => ({
  vat: { treatment: 'excluded', rate: 24 },
  withholding: { applies: true, rate: 300 },
  paymentPlan: {
    basis: 'measured_progress',
    schedule: { kind: 'recurring', every: 2, unit: 'week', anchor: { kind: 'weekday', weekday: 5 }, holidayShift: 'previous_business_day' },
    finalSettlement: { kind: 'final_acceptance' },
    settlement: { regular: [{ instrument: 'bank_transfer', share: 10_000 }], final: null },
    capAtEarnedValue: true,
    milestones: [],
    advance: null,
    retention: null,
  },
  penalty: null,
  minimumOutputs: [],
  crew: null,
  costSharing: [],
  requiredDocuments: REQUIRED_DOCUMENTS,
  cashLimitPerPayment: 50_000,
  ...overrides,
});

const line = (fields: Pick<AgreementLine, 'id' | 'pricing' | 'description' | 'unit' | 'unitPrice'> & Partial<AgreementLine>): AgreementLine => ({
  kind: 'labor', atoeCode: null, skuRef: null, estimatedMilliQuantity: null, clientUnitPrice: null, printClientPrice: false,
  comment: null, measurementRule: null, stages: [], insuredDaysCap: null, paymentOverride: null, ...fields,
});

// ── Σιδηροί οπλισμοί (2009) ─────────────────────────────────────────────────

/** «≤ 1,2 ένσημα/τόνο» ⇒ ≥ 0,834 τόνοι ανά ημέρα ασφάλισης (ακέραια χιλιοστά· στρογγυλεύεται προς το αυστηρότερο). */
const REBAR_INSURED_DAYS_CAP = { unit: 'ton', milliUnitsPerInsuredDay: 834 } as const;

const REINFORCEMENT_PLACEMENT: SubcontractTradeTemplateDefinition = {
  code: 'reinforcement.placement',
  trade: 'reinforcement',
  title: { el: 'Σιδηροί οπλισμοί — τοποθέτηση', en: 'Reinforcement — placing' },
  defaultDocumentMode: 'offer_becomes_agreement',
  lines: [
    line({
      id: 'placement', pricing: 'unit_rate', unit: 'ton', unitPrice: 9000, insuredDaysCap: REBAR_INSURED_DAYS_CAP,
      description: { el: 'Τοποθέτηση έτοιμου σιδηροπλισμού (πλην θώρακα)' },
      comment: { el: 'Ο υπεργολάβος παραλαμβάνει έτοιμο κομμένο σιδηροπλισμό στο εργοτάξιο και τον τοποθετεί.' },
    }),
    line({
      id: 'column_cages', pricing: 'unit_rate', unit: 'ton', unitPrice: 7000, insuredDaysCap: REBAR_INSURED_DAYS_CAP,
      description: { el: 'Τοποθέτηση θώρακα' },
      comment: { el: 'Οπλισμός υποστυλώματος του οποίου οι συνδετήρες δεν είναι οριζόντιοι μετά την τοποθέτηση δεν παραλαμβάνεται.' },
    }),
    line({
      id: 'crew_day', pricing: 'day_rate', unit: 'day', unitPrice: 6000,
      description: { el: 'Χρήση συνεργείου σιδηροπλισμών με ημερομίσθιο (ανά άτομο και ημέρα)' },
      comment: { el: 'Απολογιστικές εργασίες, μόνο με εντολή του Εργοδότη.' },
    }),
  ],
  clauses: refs(...CORE_CLAUSES, 'offer.becomes_agreement', 'crew.composition', 'crew.wage_advance', 'crew.onsite_days_only', 'insurance.days_cap', 'cost_sharing.equipment'),
  defaultTerms: baseTerms({
    paymentPlan: {
      ...baseTerms({}).paymentPlan,
      basis: 'labor_advance_capped',
      finalSettlement: { kind: 'milestone', milestone: 'structure.frame_complete' },
      settlement: {
        regular: [{ instrument: 'bank_transfer', share: 10_000 }],
        final: [{ instrument: 'bank_transfer', share: 5000 }, { instrument: 'cheque', share: 5000, chequeMaturityDays: 120 }],
      },
    },
    crew: {
      minimumHeadcount: 6,
      members: [
        { role: { el: 'Τεχνίτες' }, trade: 'reinforcement', ratioParts: 1, dailyWage: 5500 },
        { role: { el: 'Βοηθοί' }, trade: 'reinforcement', ratioParts: 1, dailyWage: 5500 },
        { role: { el: 'Εργάτες' }, trade: null, ratioParts: 1, dailyWage: 5500 },
      ],
    },
    costSharing: [{
      description: { el: 'Ανυψωτικό μηχάνημα (γερανός)' },
      shares: [{ party: 'employer', share: 5000 }, { party: 'subcontractor', share: 5000 }],
    }],
  }),
};

// ── Επιχρίσματα (2008) ──────────────────────────────────────────────────────

const PLASTER_MEASUREMENT: MeasurementRule = {
  blocks: [
    paragraph('Η επιμέτρηση γίνεται επί ολοκληρωμένης εργασίας, ανά μονάδα μέτρησης του άρθρου:'),
    list(
      false,
      'αφαιρείται από τις επιμετρούμενες επιφάνειες το 50% των ανοιγμάτων·',
      'αφαιρούνται όλα τα ανοίγματα της πυλωτής ανάμεσα σε φέροντα στοιχεία· εξαιρούνται τα ανοίγματα ανάμεσα σε τοιχοποιίες με μήκος μικρότερο από 1,30 m.',
    ),
  ],
};

const stage = (key: string, el: string, share: number): AgreementLineStage => ({ key, label: { el }, share });

const THREE_COAT_STAGES = [
  stage('scratch_coat', 'Πεταχτό (αστάρωμα)', 1000),
  stage('beads_guides', 'Οδηγοί, γωνιόκρανα, σκοτίες', 2000),
  stage('brown_coat', 'Γέμισμα', 4500),
  stage('finish_coat', 'Ψιλό και τελική επεξεργασία', 2500),
];

const TWO_COAT_STAGES = [
  stage('scratch_coat', 'Πεταχτό (αστάρωμα)', 1500),
  stage('beads_guides', 'Οδηγοί, γωνιόκρανα, σκοτίες', 2000),
  stage('brown_coat', 'Γέμισμα', 6500),
];

/** «1 ένσημο ανά 30 τ.μ. παραδιδόμενης επιφάνειας». */
const PLASTER_INSURED_DAYS_CAP = { unit: 'm2', milliUnitsPerInsuredDay: 30_000 } as const;

const wallLine = (id: string, el: string, unitPrice: number, stages: readonly AgreementLineStage[]): AgreementLine =>
  line({ id, pricing: 'unit_rate', unit: 'm2', unitPrice, description: { el }, stages, measurementRule: PLASTER_MEASUREMENT, insuredDaysCap: PLASTER_INSURED_DAYS_CAP });

const PLASTERING_THREE_COAT: SubcontractTradeTemplateDefinition = {
  code: 'plastering.three_coat',
  trade: 'plastering',
  title: { el: 'Επιχρίσματα τριών στρώσεων', en: 'Three-coat plastering' },
  defaultDocumentMode: 'offer_then_agreement',
  lines: [
    wallLine('interior_walls', 'Εσωτερικά επιχρίσματα κατακόρυφων επιφανειών, τριών στρώσεων', 320, THREE_COAT_STAGES),
    line({ id: 'ceilings', pricing: 'unit_rate', unit: 'm2', unitPrice: 320, description: { el: 'Εσωτερικά επιχρίσματα οροφών' }, insuredDaysCap: PLASTER_INSURED_DAYS_CAP }),
    wallLine('exterior', 'Εξωτερικά επιχρίσματα οριζόντιων ή κατακόρυφων επιφανειών, τριών στρώσεων', 320, THREE_COAT_STAGES),
    wallLine('tile_backing', 'Εσωτερικά επιχρίσματα σε επιφάνειες που θα επενδυθούν με πλακίδια (χωρίς τρίτη στρώση)', 220, TWO_COAT_STAGES),
    line({ id: 'reveals', pricing: 'unit_rate', unit: 'm', unitPrice: 100, description: { el: 'Οριζόντιες και κατακόρυφες σκοτίες εξωτερικού επιχρίσματος με προφίλ αλουμινίου' } }),
    line({ id: 'opening_beads', pricing: 'lump_sum', unit: 'lump', unitPrice: 70_000, description: { el: 'Γωνιόκρανα και οδηγοί σε εσωτερικά και εξωτερικά ανοίγματα' } }),
  ],
  clauses: refs(
    ...CORE_CLAUSES, 'pricing.inclusions', 'price.fixed', 'retention.performance', 'schedule.deadlines', 'penalty.delay',
    'coordination.trades', 'employer.obligations', 'site.housekeeping', 'insurance.days_cap',
  ),
  defaultTerms: baseTerms({
    paymentPlan: {
      ...baseTerms({}).paymentPlan,
      retention: { rate: 500, release: [{ share: 10_000, trigger: { kind: 'final_acceptance' } }] },
    },
    penalty: { perDay: 10_000, capOfContractValue: 500 },
    minimumOutputs: [{ lineId: 'interior_walls', milliUnitsPerDay: 110_000 }],
    crew: { minimumHeadcount: 5, members: [] },
  }),
};

export const DEFAULT_TRADE_TEMPLATES: readonly SubcontractTradeTemplateDefinition[] = [REINFORCEMENT_PLACEMENT, PLASTERING_THREE_COAT];
