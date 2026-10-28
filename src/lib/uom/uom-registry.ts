/**
 * @fileoverview **ΤΟ ΜΗΤΡΩΟ ΜΟΝΑΔΩΝ ΜΕΤΡΗΣΗΣ** (unit of measure — UoM) — ΕΝΑ λεξιλόγιο για BOQ, υλικά, παραγγελίες,
 *   αιτήματα προσφορών και έγγραφα (ADR-923 §5.11 «3γ» Α10).
 * @related ./uom-label.ts (ετικέτα) · ./uom-label-bundle.ts (server/PDF) · hooks/useUomLabel.ts (UI) · types/boq/units.ts
 * @module lib/uom/uom-registry
 *
 * 🔴 **Γιατί υπάρχει**: τρία λεξιλόγια για την ίδια έννοια — BOQ (`'pcs'`, `'m2'`), παραγγελία (`'τεμ'`, `'m²'`), αίτημα
 * προσφοράς (`'τμχ'`, `'l'`). Το υλικό έγραφε `'pcs'`, η γραμμή παραγγελίας περίμενε `'τεμ'` ⇒ η επιλογή υλικού άφηνε
 * τη Μονάδα **ασύμβατη** με τη λίστα της φόρμας. Και οι ετικέτες ζούσαν σε **πέντε** namespaces.
 *
 * 🔑 **Το πρότυπο του SAP (T006)**: **εσωτερικός** κωδικός για αποθήκευση και λογική + ο **ISO** κωδικός ως ιδιότητα για
 * επικοινωνία με τρίτους + κείμενα **ανά γλώσσα** χωριστά (εδώ: namespace i18n `uom`).
 * - εσωτερικός = οι κωδικοί BOQ (ADR-175), που ήδη γράφουν υλικά · BIM · BOQ — άρα κανένας από τους 13 καταναλωτές
 *   του `BOQMeasurementUnit` δεν αλλάζει·
 * - ISO = **UN/ECE Rec 20** (EN 16931 BT-130 · Peppol), και **Rec 21 με πρόθεμα `X`** για συσκευασίες (`XBG` σακί…)·
 * - `null` μόνο όπου δεν υπάρχει ειλικρινής αντιστοίχιση (`kWp`: η Rec 20 έχει `KWT` = kW, **όχι** μέγιστη ισχύ ΦΒ).
 *
 * 🧠 **Εξυπνότερο από μετάπτωση — ανεκτική ανάγνωση (Postel)**: κάθε αποθηκευμένη γραφή (`'τεμ'`, `'τμχ'`, `'m²'`,
 * `'τ.μ.'`, `'H87'`) λύνεται στον **ίδιο** κωδικό από το `resolveUom`· οι νέες εγγραφές γράφουν τον κανονικό. Κανένα
 * έγγραφο δεν ξαναγράφεται, κανένα παλιό δεν «σπάει».
 *
 * ⚠️ Χωρίς κείμενο για άνθρωπο εδώ (N.11): οι ετικέτες ζουν στα `locales/<γλώσσα>/uom.json`. Τα `aliases` είναι
 * **δεδομένα ανάγνωσης** (τι έχει ήδη γραφτεί), όχι κείμενο που εμφανίζεται.
 */

/** Οι κανονικοί κωδικοί — η σειρά είναι η σειρά εμφάνισης στις λίστες. */
export const UOM_CODES = [
  'pcs', 'm', 'm2', 'm3', 'kg', 'ton', 'g', 'lt', 'ml',
  'hr', 'day', 'month', 'set', 'pair', 'bag', 'box', 'pallet', 'roll', 'container', 'pack',
  'lump', 'kWp',
] as const;

export type UomCode = (typeof UOM_CODES)[number];

interface UomDefinition {
  /** UN/ECE Rec 20 (ή Rec 21 με `X`) — ο κωδικός που φεύγει προς τρίτους· `null` όταν δεν υπάρχει ειλικρινής. */
  readonly unece: string | null;
  /** Γραφές που υπάρχουν ήδη αποθηκευμένες ή που πληκτρολογεί άνθρωπος· κανονικοποιούνται από το `normalizeUomText`. */
  readonly aliases: readonly string[];
}

export const UOM_REGISTRY: Readonly<Record<UomCode, UomDefinition>> = {
  pcs: { unece: 'H87', aliases: ['τεμ', 'τμχ', 'τεμάχιο', 'τεμάχια', 'pc', 'piece', 'pieces', 'ea', 'each', 'C62'] },
  m: { unece: 'MTR', aliases: ['μ', 'μέτρο', 'μέτρα', 'meter', 'metre'] },
  m2: { unece: 'MTK', aliases: ['μ2', 'τ.μ.', 'sqm', 'τετραγωνικό μέτρο'] },
  m3: { unece: 'MTQ', aliases: ['μ3', 'κ.μ.', 'cbm', 'κυβικό μέτρο'] },
  kg: { unece: 'KGM', aliases: ['κιλό', 'κιλά', 'χγρ', 'kilogram'] },
  ton: { unece: 'TNE', aliases: ['τόνος', 'τόνοι', 't', 'tn', 'tonne'] },
  g: { unece: 'GRM', aliases: ['γρ', 'gr', 'γραμμάριο', 'gram'] },
  lt: { unece: 'LTR', aliases: ['l', 'λίτρο', 'λίτρα', 'litre', 'liter'] },
  ml: { unece: 'MLT', aliases: ['millilitre', 'milliliter'] },
  hr: { unece: 'HUR', aliases: ['ώρα', 'ώρες', 'h', 'hour', 'hours'] },
  day: { unece: 'DAY', aliases: ['ημέρα', 'ημέρες', 'μέρα', 'μέρες', 'd', 'days'] },
  month: { unece: 'MON', aliases: ['μήνας', 'μήνες', 'months'] },
  set: { unece: 'SET', aliases: ['σετ', 'sets'] },
  pair: { unece: 'PR', aliases: ['ζεύγ', 'ζεύγος', 'ζεύγη', 'pairs'] },
  bag: { unece: 'XBG', aliases: ['σακ', 'σακί', 'σακιά', 'bags'] },
  box: { unece: 'XBX', aliases: ['κουτ', 'κουτί', 'κουτιά', 'boxes'] },
  pallet: { unece: 'XPX', aliases: ['παλ', 'παλέτα', 'παλέτες', 'pallets'] },
  roll: { unece: 'XRO', aliases: ['ρολ', 'ρολό', 'ρολά', 'rolls'] },
  container: { unece: 'XCN', aliases: ['δοχ', 'δοχείο', 'δοχεία', 'containers'] },
  pack: { unece: 'XPK', aliases: ['πακέτο', 'πακέτα', 'package', 'packs'] },
  lump: { unece: 'LS', aliases: ["κατ' αποκοπή", 'κατ αποκοπή', 'lump sum'] },
  kWp: { unece: null, aliases: [] },
};

/** Η μονάδα μιας νέας γραμμής όταν κανείς δεν διάλεξε άλλη. */
export const DEFAULT_UOM: UomCode = 'pcs';

const COMBINING_MARKS = /\p{M}/gu;
const IGNORED = /[\s.'’]/g;

/**
 * Η **σύγκριση** δύο γραφών μονάδας: NFD χωρίς τόνους · πεζά · `²/³` → `2/3` · χωρίς κενά/τελείες/αποστρόφους.
 * («Τ.Μ.» ≡ «τμ» ≡ «τ. μ.» — «τεμάχιο» ≡ «τεμαχιο» — «m²» ≡ «M2».) Γι' αυτό το μητρώο **δεν** γράφει `m²`/`μ²`
 * ως aliases: τα λύνει ο κανόνας, όχι αντίγραφο.
 */
export function normalizeUomText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .toLocaleLowerCase('el')
    .replace(IGNORED, '');
}

function buildLookup(): ReadonlyMap<string, UomCode> {
  const lookup = new Map<string, UomCode>();
  for (const code of UOM_CODES) {
    const { unece, aliases } = UOM_REGISTRY[code];
    const spellings = unece === null ? [code, ...aliases] : [code, unece, ...aliases];
    for (const spelling of spellings) lookup.set(normalizeUomText(spelling), code);
  }
  return lookup;
}

const LOOKUP = buildLookup();

export function isUomCode(value: string): value is UomCode {
  return (UOM_CODES as readonly string[]).includes(value);
}

/** **Ποια μονάδα είναι αυτή η γραφή;** — `null` όταν καμία (ο καλών κρατά την ωμή τιμή ορατή). */
export function resolveUom(raw: string | null | undefined): UomCode | null {
  if (!raw) return null;
  const key = normalizeUomText(raw);
  return key === '' ? null : LOOKUP.get(key) ?? null;
}

/**
 * **Υιοθετεί η γραμμή τη μονάδα της πηγής;** (υλικό · γραμμή BOQ) — μόνο όσο η γραμμή έχει ακόμη την **προεπιλογή**·
 * μονάδα που διάλεξε άνθρωπος δεν αντικαθίσταται σιωπηλά. Επιστρέφει τη νέα τιμή (κανονικός κωδικός, ή η άγνωστη γραφή
 * της πηγής αυτούσια) ή `null` = «άφησέ τη».
 */
export function adoptedUom(lineUnit: string, sourceUnit: string | null | undefined): string | null {
  if (!sourceUnit?.trim() || resolveUom(lineUnit) !== DEFAULT_UOM) return null;
  return resolveUom(sourceUnit) ?? sourceUnit.trim();
}

/** Ο κωδικός UN/ECE για εξαγωγή (EN 16931 BT-130)· `null` για άγνωστη μονάδα ή χωρίς ειλικρινή αντιστοίχιση. */
export function uneceCodeOf(raw: string | null | undefined): string | null {
  const code = resolveUom(raw);
  return code === null ? null : UOM_REGISTRY[code].unece;
}
