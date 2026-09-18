/**
 * @fileoverview **Ο ΦΑΚΕΛΟΣ ΤΟΥ ΑΚΙΝΗΤΟΥ** — ό,τι αφορά το σπίτι, σε ένα μέρος, πέρα από κάθε αγγελία.
 * @related ADR-866 Ε-1 · §2.8 (Φ1.1) · §5.1 · types/owner-property.ts
 * @module types/property-dossier
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΟΝΤΟΤΗΤΕΣ, ΔΥΟ ΕΡΩΤΗΣΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **αγγελία** (`OwnerProperty`) απαντά *«τι προσφέρω στην αγορά;»* — ζει όσο η **πώληση**.
 * Ο **φάκελος** απαντά *«τι ξέρω για το σπίτι μου;»* — ζει όσο το **σπίτι**: υπάρχει πριν την
 * αγγελία, κατά τη διάρκειά της, και μετά από αυτήν **περνά στον επόμενο κάτοχο** (Φ4 — UK
 * digital property logbook: το βιβλίο συνεχίζει μετά την πώληση). Πολλές αγγελίες στον χρόνο
 * δείχνουν στον **ίδιο** φάκελο (Φ1.3).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΚΡΑΤΑ — ΕΠΙΤΗΔΕΣ (ADR-866 §2.8.5)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * · **Κανένα στοιχείο αγγελίας** (τιμή, διαθέσεις, κοινό) — αυτά αλλάζουν ανά αγγελία.
 * · **Κανένα πεδίο της Φ2** (ΠΕΑ, παροχές) — ζουν στον **κοινό** `PropertySpecificationFields` (§5.4).
 * · **Καμία διεύθυνση ακόμη** — μπαίνει με το Φ1.3, μέσω του υπάρχοντος `OwnerPropertyPlace`,
 *   όχι με δεύτερο σχήμα τόπου.
 *
 * **Layering**: leaf — τύποι και καθαρές συναρτήσεις, καμία εξάρτηση από Firestore ή React.
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';

// =============================================================================
// 1. ΚΥΚΛΟΣ ΖΩΗΣ
// =============================================================================

/**
 * Οι καταστάσεις του φακέλου (ADR-866 §2.8.7 Δ2).
 *
 * 🔑 **`archived` = «εκτός καθημερινής λίστας, τίποτα δεν χάνεται, επαναφέρεται»** — όπως το
 * archive/restore project του ACC/BIM 360. **Όχι** διαγραφή: φάκελο δεν σβήνει κανένας πελάτης.
 *
 * ⚠️ **Δεν υπάρχει `transferred`, επίτηδες.** Η μεταβίβαση (Φ4) είναι **γεγονός ιστορικού**
 * (ποιος → ποιον, πότε), όχι κατάσταση: ο φάκελος μένει `active` στα χέρια του νέου κατόχου. Και
 * μια τιμή που κανένας κώδικας δεν παράγει θα ήταν νεκρή ως τη Φ4.
 */
export const PROPERTY_DOSSIER_LIFECYCLES = ['active', 'archived'] as const;

export type PropertyDossierLifecycle = (typeof PROPERTY_DOSSIER_LIFECYCLES)[number];

// =============================================================================
// 2. Η ΟΝΤΟΤΗΤΑ
// =============================================================================

/** Ο φάκελος, όπως αποθηκεύεται στο `property_dossiers/{id}`. */
export interface PropertyDossier {
  /** Enterprise id (`pdos_*`) — N.6, **ποτέ** `addDoc`. Το προ-γεννά ο πελάτης (§2.8.7 Δ4). */
  readonly id: string;
  /**
   * Ο **κάτοχος** — το μέλος `{ userId }` της `CustodyScope` (ADR-866 §2.8.7 Δ1).
   *
   * 🔴 **ΟΧΙ `authorUserId`**: εκείνο σημαίνει «ποιος **έγραψε**» και είναι αμετάβλητο (ADR-777
   * §8.33). Ο φάκελος **αλλάζει χέρια** (Φ4) — όπως ο ρόλος `owner` στο Google Drive αλλάζει πάνω
   * στο **ίδιο** αρχείο. Και με αυτό το όνομα, το `custodyScopeFromData(φάκελος)` απαντά χωρίς
   * μετάφραση, όπως για τα προσωπικά αρχεία του.
   */
  readonly userId: string;
  /** Ό,τι λέει ο άνθρωπος το σπίτι του («Διαμέρισμα Καλαμαριάς»). Πάντα μη κενό μετά το `trim`. */
  readonly label: string;
  /**
   * Το είδος — **ίδιο όνομα και λεξιλόγιο** με το `OwnerProperty.type`, ώστε η γέννηση από αγγελία
   * (Φ1.3) να είναι **αντιγραφή**, όχι μετάφραση. `null` όπως και εκεί: δεν είναι γνωστό.
   */
  readonly type: PropertyTypeCanonical | null;
  readonly lifecycle: PropertyDossierLifecycle;
  /** ISO — `nowISO()`, όπως η αγγελία. */
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * **Ό,τι συντάσσει ο άνθρωπος** — και **μόνο** αυτό.
 *
 * ⚠️ Ο κάτοχος, η ταυτότητα, ο κύκλος ζωής και οι χρόνοι **δεν είναι στον τύπο**, άρα δεν μπορούν
 * να σταλούν από το δίκτυο — η ίδια άμυνα με τον κανόνα Firestore (`write: false`), αλλά στη
 * μεταγλώττιση. Ίδιο ιδίωμα με το `OwnerPropertyDraft`.
 */
export interface PropertyDossierDraft {
  readonly label: string;
  readonly type: PropertyTypeCanonical | null;
}

/** Ποιος και με ποια ταυτότητα — **από τον διακομιστή**, ποτέ από το σώμα του αιτήματος. */
export interface PropertyDossierBirth {
  readonly id: string;
  readonly userId: string;
}

/**
 * **Ο νέος φάκελος.** Γεννιέται `active`, με `createdAt === updatedAt`.
 *
 * ⚠️ Ο χρόνος **δίνεται**, δεν διαβάζεται εδώ: όταν ο φάκελος γεννιέται μέσα στη δέσμη της
 * αγγελίας (Φ1.3), οι δύο εγγραφές πρέπει να λένε την **ίδια** στιγμή.
 */
export function newPropertyDossier(
  birth: PropertyDossierBirth,
  draft: PropertyDossierDraft,
  now: string,
): PropertyDossier {
  return {
    id: birth.id,
    userId: birth.userId,
    label: draft.label.trim(),
    type: draft.type,
    lifecycle: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * **Μια μεταβολή φακέλου** (ADR-866 Φ1.2 · Ε-Φ1.2-1) — κλειστό σύνολο, **δύο** πράξεις:
 * · `details` — μετονομασία / διόρθωση είδους (ό,τι συντάσσει ο άνθρωπος — `PropertyDossierDraft`)·
 * · `lifecycle` — αρχειοθέτηση / επαναφορά (Ε-Φ1.1-2· **καμία** διαγραφή).
 *
 * ⚠️ **Χωριστές, όχι ένα ελεύθερο `Partial<PropertyDossier>`**: η αρχειοθέτηση **δεν** ξανακρίνει τα
 * invariants του ονόματος (ο άνθρωπος πρέπει να μπορεί να αρχειοθετήσει φάκελο **ακόμη κι αν** το όνομά
 * του έγινε άκυρο στο μεταξύ με αλλαγή κανόνα), ενώ η μετονομασία τα κρίνει **πάντα**.
 */
export type PropertyDossierChange =
  | { readonly kind: 'details'; readonly draft: PropertyDossierDraft }
  | { readonly kind: 'lifecycle'; readonly lifecycle: PropertyDossierLifecycle };

/**
 * **Η επόμενη κατάσταση** μετά από μια μεταβολή — καθαρή, η **ίδια** για τον γραφέα και για κάθε οθόνη.
 *
 * 🔑 Επιστρέφει **τον ίδιο** φάκελο (ίδια αναφορά) όταν η μεταβολή **δεν αλλάζει τίποτα** — έτσι ο γραφέας
 * κρίνει «ιδεμπότητο ⇒ καμία εγγραφή, κανένα ίχνος» με μια σύγκριση αναφοράς, χωρίς δεύτερο κριτή
 * ισότητας που θα μπορούσε να αποκλίνει. Το `updatedAt` αλλάζει **μόνο** όταν αλλάζει κάτι.
 */
export function applyPropertyDossierChange(
  current: PropertyDossier,
  change: PropertyDossierChange,
  now: string,
): PropertyDossier {
  if (change.kind === 'lifecycle') {
    return change.lifecycle === current.lifecycle
      ? current
      : { ...current, lifecycle: change.lifecycle, updatedAt: now };
  }
  const label = change.draft.label.trim();
  if (label === current.label && change.draft.type === current.type) return current;
  return { ...current, label, type: change.draft.type, updatedAt: now };
}

// =============================================================================
// 3. ΤΙ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΥΠΑΡΞΕΙ
// =============================================================================

/** Το μέγιστο μήκος ονόματος — αρκετό για «Μεζονέτα Πανοράματος, 2ος–3ος», όχι για κείμενο. */
export const PROPERTY_DOSSIER_LABEL_MAX = 120;

/**
 * Οι παραβιάσεις, ως **κλειστό σύνολο κωδικών** — κωδικοί, όχι μηνύματα: το μήνυμα ζει στα locale
 * (N.11), ίδιο ιδίωμα με τα `OWNER_PROPERTY_INVARIANTS`.
 *
 * ⚠️ Ζουν **εδώ** και όχι σε χωριστό αρχείο (όπως `owner-property-invariants.ts`): δύο κωδικοί που
 * κρίνουν ένα πεδίο δεν είναι δεύτερη ευθύνη· θα χωρίσουν όταν ο φάκελος αποκτήσει κανόνες μεταξύ πεδίων.
 */
export const PROPERTY_DOSSIER_INVARIANTS = ['label-required', 'label-too-long'] as const;

export type PropertyDossierInvariant = (typeof PROPERTY_DOSSIER_INVARIANTS)[number];

/** Φρουρός για τιμές **από το δίκτυο** (σώμα 422) — ποτέ `as`: ένας άγνωστος κωδικός δεν γίνεται ωμό κλειδί i18n. */
export function isPropertyDossierInvariant(value: unknown): value is PropertyDossierInvariant {
  return (PROPERTY_DOSSIER_INVARIANTS as readonly unknown[]).includes(value);
}

/**
 * **Όλες** οι παραβιάσεις ενός προσχεδίου — η **ίδια** συνάρτηση τρέχει η φόρμα (για να δείξει) και
 * η πύλη γραφής (γιατί δεν εμπιστεύεται καμία φόρμα).
 */
export function propertyDossierInvariantViolations(
  draft: PropertyDossierDraft,
): PropertyDossierInvariant[] {
  const label = draft.label.trim();
  if (label === '') return ['label-required'];
  return label.length > PROPERTY_DOSSIER_LABEL_MAX ? ['label-too-long'] : [];
}
