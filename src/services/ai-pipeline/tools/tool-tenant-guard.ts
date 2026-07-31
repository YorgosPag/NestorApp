/**
 * «Ανήκει αυτό το έγγραφο;» — για το στρώμα του πράκτορα ΤΝ
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΟ ΣΥΝΟΡΟ ΕΔΩ (ADR-742 Φάση Δ, ADR-734 §7)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο πράκτορας ΤΝ είναι **ακριβώς** ο καλών που δοκιμάζει ids ένα-ένα: παίρνει
 * ονόματα και αναγνωριστικά από ελεύθερο κείμενο χρήστη και τα περνά ωμά σε
 * `read_document` / `discard_pending_file` / `firestore_get_document`. Δεν
 * υπάρχει φόρμα, δεν υπάρχει λίστα από την οποία διάλεξε — η είσοδος είναι
 * **αναξιόπιστη εξ ορισμού**.
 *
 * Πριν από αυτό το module, πέντε handlers απαντούσαν σε ξένο id με πέντε
 * διαφορετικούς τρόπους, εκ των οποίων **δύο έλεγαν αυτολεξεί την αλήθεια**:
 *
 * | Handler | Τι έφτανε στο μοντέλο |
 * |---|---|
 * | `document-reader` | `Access denied: file belongs to a different company.` |
 * | `file-lifecycle`  | `Access denied: file belongs to another company.` |
 * | `banking`         | `Access denied` (διακριτό από το «Contact not found») |
 * | `relationship`    | `Access denied — source contact.` |
 * | `firestore`       | `{success:false}` ενώ το γνήσιο κενό είναι `{success:true,data:null}` |
 *
 * Και οι πέντε μαρτυρούσαν ύπαρξη — οι δύο πρώτοι με λέξεις, ο τελευταίος
 * **χωρίς καν λέξεις**: αρκούσε το `success` flag για να ξεχωρίσει «δεν
 * υπάρχει» από «υπάρχει αλλού». Ένα μοντέλο που διαβάζει το αποτέλεσμα μπορεί
 * να το επαναλάβει στον χρήστη ή να το χρησιμοποιήσει για να συμπεράνει· έτσι
 * χαρτογραφείται τι έχει άλλος πελάτης **χωρίς ποτέ να διαβαστεί περιεχόμενο**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΔΩ Η ΑΠΑΝΤΗΣΗ ΕΙΝΑΙ ΠΑΝΤΑ ΣΙΩΠΗ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΕΠΙΛΟΓΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο κανόνας αποκάλυψης του ADR-742 §3.3 ρωτά **«θα μπορούσε ο καλών να το
 * μάθει νόμιμα με άλλον τρόπο;»**. Στο σύνορο HTTP η απάντηση εξαρτάται από τον
 * ρόλο, γι' αυτό εκεί υπάρχει η `concealCrossTenant`.
 *
 * Εδώ **δεν υπάρχει ρόλος να ρωτηθεί**: το `AgenticContext` φέρει `companyId`
 * και `isAdmin` — και το `isAdmin` είναι ρόλος **εντός** εταιρείας, όχι ο
 * καθολικός bypass ρόλος (`ctx.globalRole`) που εξετάζει η `concealCrossTenant`.
 * Άρα ο κλάδος `reveal` δεν έχει νόημα σε αυτό το στρώμα: **κανένας καλών του
 * πράκτορα δεν έχει νόμιμη cross-tenant ορατότητα**, οπότε η ειλικρινής άρνηση
 * δεν σώζει καμία διάγνωση — μόνο μαρτυρά. Η σιωπή είναι το σωστό, όχι το
 * συντηρητικό.
 *
 * ⚠️ Αν ποτέ το `AgenticContext` αποκτήσει `globalRole`, **αυτό** είναι το ένα
 * σημείο που θα το ρωτήσει — όχι πέντε handlers.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΣΧΗΜΑ: ΕΝΑ CALLBACK ΓΙΑ ΤΟΥΣ ΔΥΟ ΚΛΑΔΟΥΣ (ADR-742 §7.1)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η ταυτότητα γνήσιου και μεταμφιεσμένου «δεν βρέθηκε» **δεν είναι θέμα
 * προσοχής· είναι δομική**. Ο καλών δίνει **ένα** `notFound` callback και το
 * ίδιο εξυπηρετεί «δεν υπάρχει» **και** «ανήκει αλλού». Δεν υπάρχει τρόπος να
 * αποκλίνουν χωρίς να αλλάξουν **και τα δύο** — που είναι ακριβώς το ζητούμενο,
 * γιατί κάθε handler έχει **δικό του** γνήσιο μήνυμα (`FileRecord x not found.`
 * vs `FileRecord "x" not found.` vs `{success:true,data:null,count:0}`) και μια
 * κοινή σταθερά θα πρόδιδε τη διαφορά με το ίδιο το σχήμα της.
 *
 * @module services/ai-pipeline/tools/tool-tenant-guard
 * @see ADR-742 §3.3 (κανόνας αποκάλυψης), §7.1 (το σχήμα), ADR-734 §7 (μαντείο ύπαρξης)
 * @see lib/auth/tenant-ownership (ο SSoT της ερώτησης)
 */

import { isPayloadOwnedByCompany, type OwnershipSubject } from '@/lib/auth/tenant-ownership';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { AgenticContext, ToolResult } from './executor-shared-types';

const logger = createModuleLogger('AgentToolTenantGuard');

/**
 * Το ελάχιστο σχήμα στιγμιότυπου Firestore που χρειάζεται η ερώτηση.
 *
 * Δηλώνεται τοπικά αντί να εισαχθεί ο τύπος του `firebase-admin` ώστε το module
 * να μένει δοκιμάσιμο με σκέτα αντικείμενα — ο φύλακας δεν διαβάζει τη βάση,
 * κρίνει ό,τι του δώσεις.
 */
export interface TenantDocSnapshot {
  readonly exists: boolean;
  data(): Record<string, unknown> | undefined;
}

/**
 * Το αποτέλεσμα: **ή** το έγγραφο, **ή** το έτοιμο `ToolResult` που πρέπει να
 * επιστραφεί αυτούσιο.
 *
 * Διακριτή ένωση αντί για `T | null` επίτηδες: ο καλών **δεν μπορεί** να ξεχάσει
 * να χειριστεί την άρνηση, γιατί το `data` δεν υπάρχει καν στον αρνητικό κλάδο.
 */
export type OwnedToolDoc =
  | { readonly ok: true; readonly data: Record<string, unknown> }
  | { readonly ok: false; readonly result: ToolResult };

/**
 * Η ερώτηση + η πολιτική, μία φορά για όλους τους handlers.
 *
 * Καλύπτει **και τους δύο** λόγους αποτυχίας ώστε να μη μπορούν να αποκλίνουν:
 * ανύπαρκτο έγγραφο και ξένο έγγραφο δίνουν το **ίδιο** `notFound()`.
 *
 * @param snap Το στιγμιότυπο όπως ήρθε από τη βάση (μη διαβασμένο, μη ελεγμένο)
 * @param ctx Ο πράκτορας που ρωτά — από εδώ βγαίνει ο tenant
 * @param subject Τι ζητήθηκε· μπαίνει στο log ώστε η απόπειρα να εντοπίζεται
 * @param notFound Το **γνήσιο** «δεν βρέθηκε» του handler. Χρησιμοποιείται
 *   αυτούσιο και για τη μεταμφίεση — μην περάσεις δεύτερη γραφή του ίδιου σώματος.
 */
export function resolveOwnedToolDoc(spec: {
  readonly snap: TenantDocSnapshot;
  readonly ctx: AgenticContext;
  readonly subject: OwnershipSubject;
  readonly notFound: () => ToolResult;
}): OwnedToolDoc {
  const { snap, ctx, subject, notFound } = spec;

  if (!snap.exists) return { ok: false, result: notFound() };

  const data = snap.data();
  if (data === undefined) return { ok: false, result: notFound() };

  if (!isPayloadOwnedByCompany(data, ctx.companyId)) {
    // Σήμα ασφαλείας, όχι θόρυβος: ο εσωτερικός κώδικας κρατά την πλήρη
    // αλήθεια ενώ ο καλών δεν μαθαίνει τίποτα (ADR-742 §3.4).
    logger.warn('Cross-tenant access blocked (agent tool)', {
      resource: subject.resource,
      resourceId: subject.resourceId,
      callerCompanyId: ctx.companyId,
      channel: ctx.channel,
      requestId: ctx.requestId,
      ...(subject.path === undefined ? {} : { path: subject.path }),
    });
    return { ok: false, result: notFound() };
  }

  return { ok: true, data };
}
