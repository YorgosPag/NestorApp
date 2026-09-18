/**
 * @fileoverview **ΟΙ ΑΠΟΦΑΣΕΙΣ ΤΩΝ ΚΑΝΟΝΩΝ** — βάση, ρύθμιση ημερών, και ο έλεγχος της χειροκίνητης κράτησης.
 * @related ADR-835 §21 (Στάδιο Β) · services/stay-calendar/stay-calendar-write.service.ts ·
 *   lib/stay/stay-rule-warnings.ts · lib/stay/stay-rules-shape.ts
 * @module services/stay-calendar/stay-calendar-rules-write
 *
 * 🔑 **Γράφονται στην ΙΔΙΑ συναλλαγή με την κεφαλή** (`version + 1`), όπως κάθε άλλη πράξη:
 * μια αλλαγή κανόνα που τρέχει παράλληλα με μια κράτηση ξαναπαίζεται πάνω στα φρέσκα, άρα
 * οι προειδοποιήσεις της κράτησης κρίνονται πάντα με τους κανόνες που **ισχύουν**.
 */

import 'server-only';
import { COLLECTIONS } from '@/config/firestore-collections';
import { deriveStayTerms } from '@/lib/offers/derive-stay-terms';
import { declaredStayCalendarOf, stayDayRulesOf } from '@/lib/stay/stay-calendar-of';
import { restrictDays } from '@/lib/stay/stay-day-restriction';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import { stayRuleWarningsFor } from '@/lib/stay/stay-rule-warnings';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import {
  STAY_RULES_NONE,
  type StayCalendarMonth,
  type StayDayRule,
  type StayDayRules,
} from '@/types/stay-rules';

import { refuse, type Decision, type WriteContext } from './stay-calendar-write-decision';

type RestrictCommand = Extract<StayCalendarCommand, { action: 'restrict' }>;
type BookCommand = Extract<StayCalendarCommand, { action: 'book' }>;

/** Αντικατάσταση των κανόνων βάσης — δεν γράφει τίποτα άλλο από την κεφαλή. */
export function decideRules(rules: Extract<StayCalendarCommand, { action: 'rules' }>['rules']): Decision {
  return { kind: 'write', entryId: null, apply: () => undefined, rules };
}

/** Οι μέρες ανά μήνα `YYYY-MM` — μόνο για τους μήνες που αγγίζει η ρύθμιση. */
function monthsTouched(days: StayDayRules, touched: readonly string[]): Map<string, Record<string, StayDayRule>> {
  const byMonth = new Map<string, Record<string, StayDayRule>>();
  for (const date of touched) byMonth.set(date.slice(0, 7), {});
  for (const [date, rule] of Object.entries(days)) {
    const month = byMonth.get(date.slice(0, 7));
    if (month !== undefined) month[date] = rule;
  }
  return byMonth;
}

/**
 * **Ρύθμιση ημερών** — γράφει/σβήνει τα μηνιαία έγγραφα που αγγίζει η επιλογή.
 * Μήνας χωρίς καμία υπέρβαση **σβήνεται** (δεν μένει κενό έγγραφο που μοιάζει με κανόνα).
 */
export function decideRestrict(ctx: WriteContext, command: RestrictCommand): Decision {
  const outcome = restrictDays(stayDayRulesOf(ctx.months), command);
  if (outcome.kind === 'contradictory') return refuse({ kind: 'contradictory-rules', date: outcome.date });
  const months = monthsTouched(outcome.days, outcome.touched);
  const { property } = ctx;
  return {
    kind: 'write',
    entryId: null,
    apply: (transaction) => {
      for (const [monthKey, days] of months) {
        const id = enterpriseIdService.generateDeterministicStayCalendarMonthId(property.id, monthKey);
        const ref = ctx.adminDb.collection(COLLECTIONS.STAY_CALENDAR_MONTHS).doc(id);
        if (Object.keys(days).length === 0) {
          if (ctx.months.some((month) => month.month === monthKey)) transaction.delete(ref);
          continue;
        }
        const doc: StayCalendarMonth = {
          propertyId: property.id, authorUserId: property.authorUserId, month: monthKey, days, updatedAt: ctx.now,
        };
        transaction.set(ref, doc);
      }
    },
  };
}

/**
 * **Προειδοποιήσεις της χειροκίνητης κράτησης** που ο οικοδεσπότης δεν αποδέχτηκε — ή `null`.
 *
 * Κρίνεται πάνω στο ημερολόγιο **ως δηλωμένο** (`declaredStayCalendarOf`): οι κανόνες του
 * οικοδεσπότη ισχύουν για τις κρατήσεις του ανεξάρτητα από το αν το δημοσίευσε.
 */
export function unacknowledgedWarnings(ctx: WriteContext, command: BookCommand): Decision | null {
  const rules = ctx.head?.rules ?? STAY_RULES_NONE;
  // 🔴 Ως το Στάδιο Δ έλειπε το 5ο όρισμα (`channels`, υποχρεωτικό από το Στάδιο Γ) — σφάλμα τύπου
  //    στο HEAD. `'synced'` ΡΗΤΑ: εδώ κρίνονται οι **κανόνες** του οικοδεσπότη για τη δική του
  //    κράτηση· ένα σιωπηλό κανάλι θα μετέτρεπε κάθε απάντηση σε `unsynced` ⇒ ψευδής «προειδοποίηση».
  const calendar = declaredStayCalendarOf(ctx.entries, rules, ctx.months, ctx.clock, 'synced');
  const base = deriveStayTerms(ctx.property.offers)?.minNights ?? null;
  const warnings = stayRuleWarningsFor(ctx.property.id, calendar, base, command.checkIn, command.checkOut);
  const missing = warnings.filter((warning) => !command.acknowledgedWarnings.includes(warning));
  return missing.length === 0 ? null : refuse({ kind: 'rules-unacknowledged', warnings: missing });
}
