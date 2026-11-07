/**
 * =============================================================================
 * ΠΟΣΟ ΖΕΙ ΤΟ PDF ΜΙΑΣ ΕΚΔΟΣΗΣ — ο ΕΝΑΣ κριτής (ADR-923 §5.6.1)
 * =============================================================================
 *
 * | Έκδοση | Το PDF σβήνεται |
 * |---|---|
 * | Δεν κατέβηκε ποτέ | Με το χέρι ανά πάσα στιγμή · αυτόματα 90 ημέρες αφού αντικατασταθεί |
 * | Κατέβηκε, χωρίς τιμές | 24 μήνες αφού αντικατασταθεί |
 * | Κατέβηκε, με τιμές | Τέλος του έτους που έπαψε να ισχύει η έκδοση τιμών + 5 έτη (ο κανόνας του ADR-864 §20) |
 * | Δικαστική δέσμευση | Ποτέ, ώσπου να αρθεί («holds always win») |
 * | Δημοσιευμένη σε κοινό (§5.15 Η2) | Ποτέ, ώσπου να αποσυρθεί η τελευταία δημοσίευση· μετά ισχύει ξανά ο κανόνας της γραμμής του |
 *
 * 🔑 **Το ρολόι ξεκινά από το γεγονός, όχι από τη γέννηση** (Purview «event-based retention»): όσο η έκδοση είναι η τελευταία της
 *    συνταγής δεν τρέχει ρολόι. Η λήψη είναι η μόνη πόρτα του αρχείου, άρα «δεν κατέβηκε» σημαίνει «δεν το είδε κανείς».
 * 🔑 **Σβήνονται μόνο τα bytes** (Purview «proof of disposition»): εγγραφή, sha256 και ιστορικό μένουν. Ίδιες είσοδοι ξαναδίνουν
 *    τα ίδια bytes, άρα το αποτύπωμα αποδεικνύει ποιο έγγραφο υπήρξε.
 * ⚠️ **Το `dispositionDueAt` είναι η νωρίτερη δυνατή ημερομηνία, όχι η απόφαση**: η λήξη της έκδοσης τιμών ξανακρίνεται στη σάρωση.
 * ⚠️ Καθαρό: το `now` περνιέται, κανένα ρολόι μέσα.
 *
 * @module subapps/catalog/publishing/publication-retention
 */

import { addMonthsClampedUtc } from '@/lib/date/calendar-arithmetic';
import { EVIDENCE_RETENTION_RULE, retainUntilOf } from '@/lib/mandate/evidence-retention';
import { EMPTY_PUBLICATION_RETENTION, type PublicationRetention, type PublicationRunDefinition } from '../types/publication';

/** Ο κανόνας: ένα σημείο για τους αριθμούς. Το `id` γράφεται στην απόδειξη διάθεσης, ώστε να ξέρουμε με ποιον κανόνα σβήστηκε. */
export const PUBLICATION_RETENTION_RULE = {
  id: 'catalog-publication-v1',
  undownloadedDays: 90,
  unpricedMonths: 24,
  pricedRule: EVIDENCE_RETENTION_RULE.id,
  /** Η έκδοση τιμών ισχύει ακόμη: πότε ξανακοιτάμε. */
  recheckMonths: 12,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

type RetentionFacts = Pick<PublicationRunDefinition, 'status' | 'priced' | 'retention'>;

const plusMonths = (iso: string, months: number): string => addMonthsClampedUtc(new Date(iso), months).toISOString();
const plusDays = (iso: string, days: number): string => new Date(Date.parse(iso) + days * DAY_MS).toISOString();
const laterOf = (a: string, b: string): string => (Date.parse(a) >= Date.parse(b) ? a : b);

/** Το διαβάζει κοινό μέσω δημοσιευμένης έκδοσης καταλόγου (§5.15 Η2). */
export const isPublished = (run: RetentionFacts): boolean => run.retention.publishedEditions > 0;

/**
 * Κρατά η **πλατφόρμα** (GCS `temporaryHold`) τα αρχεία της έκδοσης; Ο ΕΝΑΣ κριτής για κάθε πόρτα που βάζει ή σηκώνει κράτηση:
 * λήψη, δικαστική δέσμευση, δημοσίευση σε κοινό. Πριν από αυτόν κάθε πόρτα ρωτούσε δικό της υποσύνολο, και η άρση της δέσμευσης
 * έλυνε την κράτηση δημοσιευμένης έκδοσης (§5.15 Θ.1β).
 */
export function publicationHeldByPlatform(run: Pick<PublicationRunDefinition, 'retention'>): boolean {
  const { downloadCount, legalHold, publishedEditions } = run.retention;
  return downloadCount > 0 || legalHold !== null || publishedEditions > 0;
}

const isPricedEvidence =(run: RetentionFacts): boolean => run.priced && run.retention.downloadCount > 0;

/** Η νωρίτερη στιγμή που μπορεί να σβηστεί το PDF· `null` = δεν τρέχει ρολόι. */
export function publicationDispositionDueAt(run: RetentionFacts): string | null {
  const { disposal, legalHold, supersededAt, downloadCount } = run.retention;
  if (run.status !== 'ready' || disposal !== null || legalHold !== null || supersededAt === null || isPublished(run)) return null;
  if (downloadCount === 0) return plusDays(supersededAt, PUBLICATION_RETENTION_RULE.undownloadedDays);
  return run.priced ? retainUntilOf(supersededAt) : plusMonths(supersededAt, PUBLICATION_RETENTION_RULE.unpricedMonths);
}

/** Το κομμάτι της έκδοσης που αλλάζει μαζί: η διατήρηση και η προθεσμία της δεν γράφονται ποτέ χωριστά. */
export function retentionPatch<T extends RetentionFacts>(run: T, patch: Partial<PublicationRetention>): Pick<PublicationRunDefinition, 'retention' | 'dispositionDueAt'> {
  const retention = { ...run.retention, ...patch };
  return { retention, dispositionDueAt: publicationDispositionDueAt({ ...run, retention }) };
}

export type PublicationRetentionStep =
  | { readonly kind: 'keep' }
  | { readonly kind: 'dispose' }
  /** Νωρίς ακόμη: η σάρωση ξαναγυρίζει τότε. */
  | { readonly kind: 'defer'; readonly dueAt: string };

/**
 * Το επόμενο βήμα. `versionEndedAt` = πότε έπαψε να ισχύει η έκδοση τιμών, `null` αν ισχύει ακόμη. Αφορά μόνο όσες κατέβηκαν με
 * τιμές: όσο η τιμή ισχύει, το έγγραφο που την τύπωσε μπορεί ακόμη να κυκλοφορεί.
 */
export function publicationRetentionStepOf(run: RetentionFacts, versionEndedAt: string | null, nowISO: string): PublicationRetentionStep {
  const due = publicationDispositionDueAt(run);
  if (due === null) return { kind: 'keep' };
  if (isPricedEvidence(run) && versionEndedAt === null) return { kind: 'defer', dueAt: plusMonths(nowISO, PUBLICATION_RETENTION_RULE.recheckMonths) };
  const decided = isPricedEvidence(run) && versionEndedAt !== null ? laterOf(due, retainUntilOf(versionEndedAt)) : due;
  return Date.parse(decided) <= Date.parse(nowISO) ? { kind: 'dispose' } : { kind: 'defer', dueAt: decided };
}

/**
 * Μία έκδοση όπως διαβάζεται από τη βάση. Έγγραφα γραμμένα πριν από τη διατήρηση δεν έχουν τα νέα πεδία: συμπληρώνονται εδώ,
 * ώστε κανένας αναγνώστης να μη χρειάζεται δικό του έλεγχο και η οθόνη να μην πέφτει σε παλιά εγγραφή.
 */
export function publicationRunOf<T extends object>(data: T): T & Pick<PublicationRunDefinition, 'retention' | 'dispositionDueAt' | 'priceVersion'> {
  const stored: Partial<PublicationRunDefinition> = data;
  return {
    ...data,
    retention: { ...EMPTY_PUBLICATION_RETENTION, ...stored.retention },
    dispositionDueAt: stored.dispositionDueAt ?? null,
    priceVersion: stored.priceVersion ?? null,
  };
}

/** Ξαναδίνεται η ίδια έκδοση σε νέα αίτηση; Όχι αν απέτυχε ή αν σβήστηκε το PDF της: δεν λέμε ποτέ «έτοιμη» χωρίς αρχείο. */
export function isPublicationRunReusable(run: Pick<PublicationRunDefinition, 'status' | 'retention'>): boolean {
  return run.status !== 'failed' && run.retention.disposal === null;
}

/** Με το χέρι σβήνεται μόνο ό,τι δεν έφτασε σε κανέναν: χωρίς λήψη το PDF δεν είναι τεκμήριο και ξαναβγαίνει ίδιο. */
export function canDeletePublicationByHand(run: RetentionFacts): boolean {
  const { disposal, legalHold, downloadCount } = run.retention;
  return run.status === 'ready' && disposal === null && legalHold === null && downloadCount === 0 && !isPublished(run);
}

/** Μπαίνει δικαστική δέσμευση: μόνο σε έτοιμη έκδοση που έχει ακόμη αρχείο. */
export function canHoldPublication(run: RetentionFacts): boolean {
  return run.status === 'ready' && run.retention.disposal === null;
}

interface VersionFacts {
  readonly id: string;
  readonly status: string;
  readonly validFrom: string | null;
}

const EVER_IN_FORCE: readonly string[] = ['published', 'superseded'];

/** Πότε έπαψε να ισχύει μια έκδοση τιμών: όταν ξεκίνησε η επόμενη. Το «έως» είναι παράγωγο, όπως στη χρονογραμμή. */
export function priceVersionEndedAt(versions: readonly VersionFacts[], versionId: string): string | null {
  const start = versions.find((version) => version.id === versionId)?.validFrom;
  if (!start) return null;
  const later = versions
    .filter((version) => EVER_IN_FORCE.includes(version.status) && version.validFrom !== null && version.validFrom > start)
    .flatMap((version) => (version.validFrom === null ? [] : [version.validFrom]))
    .sort();
  return later[0] ?? null;
}
