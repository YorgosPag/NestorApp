/**
 * **Η αλυσίδα έκπτωσης ως κείμενο** — «50 + 10» ↔ `[5000, 1000]` μονάδες βάσης (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related lib/pricing/discount-rule.ts (η ΜΙΑ μηχανή: `basisPointsFromPercent` · `effectivePercent`) ·
 *   subapps/catalog/values/decimal-amount.ts (`parseEnteredAmount`: ο ΕΝΑΣ αναγνώστης αριθμού που πληκτρολόγησε άνθρωπος)
 * @module components/catalog/pricing/discount-chain-input
 *
 * 🔑 **Πληκτρολόγηση όπως τη λέει ο έμπορος**: «50+10», «50 + 10», «50% + 10,5%». Κάθε βήμα είναι ποσοστό με **έως δύο**
 *    δεκαδικά — τρίτο δεκαδικό ⇒ **άκυρο βήμα** (`NaN`), ποτέ σιωπηλή στρογγύλευση της βούλησης του ανθρώπου.
 * 🔑 **Το άκυρο το λέει η ΙΔΙΑ επικύρωση με τον γραφέα**: το βήμα που δεν διαβάζεται γίνεται `NaN`, και το
 *    `validateDiscountRule` το ονομάζει `discountStepInvalid` στο σωστό πεδίο — κανένας δεύτερος κανόνας εδώ.
 * 🔑 Κενό κείμενο ⇒ `[]` = **καμία έκπτωση** — έγκυρο: ειδικότερη συνθήκη «0%» εξαιρεί συνεργάτη από γενική έκπτωση (SAP).
 * ⚠️ Τα βήματα **πολλαπλασιάζονται** (50 + 10 = −55%, όχι −60%) — το λέει η μηχανή (`effectivePercent`), όχι αυτό το αρχείο.
 */

import { basisPointsFromPercent, BP_PER_WHOLE, type BasisPoints } from '@/lib/pricing/discount-rule';
import { parseEnteredAmount } from '@/subapps/catalog/values/decimal-amount';

/** Τα δεκαδικά που δέχεται ένα βήμα σε ποσοστό (μονάδες βάσης: 0,01%). */
const PERCENT_DECIMALS = 2;

const STEP_SEPARATOR = '+';
const PERCENT_SIGN = /\s*%$/;

/** Ένα βήμα «10,5» / «10,5%» → μονάδες βάσης· ό,τι δεν διαβάζεται ακριβώς ⇒ `NaN`. */
function stepOf(token: string): BasisPoints {
  const parsed = parseEnteredAmount(token.trim().replace(PERCENT_SIGN, ''));
  if (parsed === null || parsed.value < 0 || parsed.decimals > PERCENT_DECIMALS) return Number.NaN;
  return basisPointsFromPercent(parsed.value) ?? Number.NaN;
}

/** «50 + 10» → `[5000, 1000]`. Κενό ⇒ `[]`· κάθε άκυρο βήμα (και το κενό ανάμεσα σε δύο «+») ⇒ `NaN` στη θέση του. */
export function stepsFromChainText(text: string): BasisPoints[] {
  if (text.trim() === '') return [];
  return text.split(STEP_SEPARATOR).map(stepOf);
}

/** Ένα βήμα σε ποσοστό, για προβολή (`5025` ⇒ 50,25) — ακριβής διαίρεση με τη σταθερά της μηχανής. */
export const percentOfStep = (step: BasisPoints): number => (step * 100) / BP_PER_WHOLE;

/** `[5000, 1000]` → «50 + 10» με τον μορφοποιητή αριθμού της γλώσσας του UI (υποδιαστολή «,» στα ελληνικά). */
export function chainTextOf(steps: readonly BasisPoints[], formatNumber: (value: number) => string): string {
  return steps.map((step) => formatNumber(percentOfStep(step))).join(` ${STEP_SEPARATOR} `);
}

/** Είναι κάθε βήμα διαβάσιμο; — η οθόνη δείχνει «συνολικά» μόνο τότε (το άκυρο το λέει η επικύρωση). */
export const isReadableChain = (steps: readonly BasisPoints[]): boolean => steps.every(Number.isInteger);
