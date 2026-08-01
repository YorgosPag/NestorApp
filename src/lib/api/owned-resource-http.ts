/**
 * 🔒 Ο ΠΟΡΟΣ ΩΣ **ΔΗΛΩΣΗ** — ταυτότητα, φύλακας και «δεν βρέθηκε» σε ένα σημείο
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-742 §7undecies · N.18 · CHECK 3.28)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η Ομάδα 6 βρήκε **έξι** πόρους που έπρεπε να μεταναστεύσουν ταυτόχρονα
 * (`dxf-dimension-style`, `dxf-level`, `floor`, `file`, `purchase-order`,
 * `quote`). Το πρότυπο των Ομάδων 3–5 ήταν ένα λεπτό module **ανά πόρο**
 * (`project-ownership` → `contact-ownership` → `message-ownership` …), δηλαδή
 * έξι νέα αρχεία που θα διέφεραν σε **τέσσερα literals**.
 *
 * 🔴 Αυτό είναι **ακριβώς** η αστοχία που προβλέπει ο N.18 — *κεντρικοποιείς το
 * Α και γράφεις Β+Γ ως δίδυμα* — και το `jscpd` **δεν** θα την έβλεπε: τα
 * `floorData` / `styleData` / `quoteData` είναι διαφορετικά tokens (μάθημα #4,
 * το ίδιο τυφλό σημείο που έκρυψε τρεις φύλακες στην §7octies).
 *
 * ⇒ Ένας πόρος δηλώνεται πλέον όπως δηλώνεται μια οντότητα στο
 * `requireDocInTenant`: **μία υλοποίηση, N δηλώσεις**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΕΝΟΠΟΙΕΙΤΑΙ ΚΑΙ ΤΙ **ΟΧΙ**
 * ─────────────────────────────────────────────────────────────────────────────
 * Ενοποιείται η **απόφαση** (ζει στο `createOwnershipDecision`), η **αλυσίδα**
 * (`loadOwnedDocOrRefusal`) και ο **κοινός φάκελος σύρματος**
 * `{ success:false, error }` + `404`, που τον μοιράζονται αυτούσιο τρεις πόροι.
 *
 * ⛔ **Δεν** ενοποιείται το «όχι» των διαδρομών που έχουν **δικό τους σχήμα**:
 * το `floorplans/process` προσθέτει `errorCode`, το `quotes/notify-vendor`
 * απαντά σκέτο `{ error }`. Γι' αυτό η {@link OwnedResource.load} δέχεται
 * `refusal` από τον καλούντα: η μεταμφίεση οφείλει να μοιάζει με το **γνήσιο
 * «δεν βρέθηκε» ΤΗΣ ΔΙΑΔΡΟΜΗΣ**, όχι με ένα καθολικό σχήμα (ADR-742 §7.1).
 * Ένα κοινό εργοστάσιο εκεί θα πρόδιδε τη διαφορά **με το ίδιο το σχήμα**.
 *
 * Κοινό μένει το **κείμενο** ({@link OwnedResource.notFoundMessage}) — το μόνο
 * που ο πελάτης μπορεί να συγκρίνει μεταξύ αδελφικών διαδρομών.
 *
 * @module lib/api/owned-resource-http
 * @see @/lib/auth/resource-ownership-guard — η απόφαση (μην την ξαναγράψεις)
 * @see @/lib/auth/owned-doc-loader — η αλυσίδα φόρτωσε→υπάρχει;→δικό μου;
 * @see @/lib/auth/tenant-isolation — το ίδιο σχήμα «μία υλοποίηση, N δηλώσεις»
 * @see ADR-742 §7.1, §7ter.4 (PDP/PEP), §7undecies
 */

import 'server-only';

import { NextResponse } from 'next/server';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import {
  createOwnershipDecision,
  type ResourceAccessCaller,
  type ResourceAccessVerdict,
} from '@/lib/auth/resource-ownership-guard';
import type { MaybeTenantOwned } from '@/lib/auth/tenant-ownership';
import { loadOwnedDocOrRefusal, type OwnedDocOutcome } from '@/lib/auth/owned-doc-loader';

/** Ο κοινός φάκελος σύρματος του «δεν βρέθηκε» — τρεις πόροι τον γράφουν αυτούσιο. */
export interface OwnedResourceNotFoundBody {
  success: false;
  error: string;
}

export interface OwnedResourceSpec {
  /** Η συλλογή του πόρου — πάντα από το `COLLECTIONS` SSoT. */
  readonly collection: string;
  /** Ανθρώπινο όνομα για τα **logs** (`'Floor'`, `'Quote'`). Ποτέ για το σύρμα. */
  readonly resourceLabel: string;
  /** Πώς λέγεται το id στα logs (`'floorId'`) — τα ερωτήματα παρατηρησιμότητας βασίζονται σε αυτό. */
  readonly idLogField: string;
  /**
   * Το κείμενο του «δεν βρέθηκε» — **SSoT του πόρου**.
   *
   * ⚠️ Πρέπει να είναι **ακριβώς** η τιμή που έγραφε ο γνήσιος κλάδος πριν τη
   * μετανάστευση. Αν το μεταμφιεσμένο κείμενο διαφέρει από το γνήσιο, **το ίδιο
   * το κείμενο γίνεται μαντείο** και η μεταμφίεση δεν κρύβει τίποτα.
   */
  readonly notFoundMessage: string;
}

/** Τι ρωτήθηκε — μπαίνει στο log ώστε η απόπειρα να εντοπίζεται. */
export interface OwnedResourceQuery {
  /** Το φορτίο **όπως βγήκε από τη βάση**. Ποτέ στενεμένο — βλ. ADR-742 §7.5. */
  readonly data: MaybeTenantOwned | null | undefined;
  readonly caller: ResourceAccessCaller;
  readonly resourceId: string;
  /** Ποιο μονοπάτι ρώτησε, π.χ. `'update'`, `'delete'`, `'notify-vendor'`. */
  readonly action: string;
}

export interface LoadOwnedResourceSpec<R> {
  readonly docId: string;
  readonly caller: ResourceAccessCaller;
  readonly action: string;
  /**
   * Το **ένα** «όχι» της διαδρομής, καλούμενο από **δύο** κλάδους: το έγγραφο
   * όντως λείπει, ή ανήκει αλλού και ο καλών δεν δικαιούται να το μάθει.
   */
  readonly refusal: () => R;
  /** Η ήδη ανοιγμένη σύνδεση, όταν ο καλών τη χρειάζεται **και** μετά. */
  readonly db?: Firestore;
}

export interface OwnedResource {
  /** Το κείμενο — για διαδρομές που χτίζουν **δικό τους** σχήμα γύρω του. */
  readonly notFoundMessage: string;
  /** Το κοινό `{ success:false, error }` + `404`. */
  notFoundResponse(): NextResponse<OwnedResourceNotFoundBody>;
  /**
   * **Η απόφαση (PDP)** — ολική, χωρίς ρίψη.
   *
   * Για τις διαδρομές που **δεν** φορτώνουν μέσω αυτού του module: το φορτίο
   * τους έρχεται από υπηρεσία (`getPO`) ή είναι ήδη διαβασμένο για άλλον λόγο
   * (`fetchFileRecord`). Χωρίς αυτή τη μορφή θα ξανάγραφαν τη σύγκριση.
   */
  check(query: OwnedResourceQuery): ResourceAccessVerdict;
  /**
   * **Η επιβολή (PEP)**: φόρτωσε→υπάρχει;→δικό μου; ως **μία** πράξη, με το
   * «όχι» της διαδρομής.
   */
  load<R>(spec: LoadOwnedResourceSpec<R>): Promise<OwnedDocOutcome<R>>;
}

/**
 * Δηλώνει έναν πόρο.
 *
 * 🔴 Η **σειρά** μέσα στο {@link OwnedResource.load} δεν είναι δική του: ζει
 * στο `loadOwnedDocOrRefusal`, ώστε ένας νέος πόρος να μην μπορεί να τη γράψει
 * ανάποδα. Αυτό είναι όλο το νόημα — αντίγραφο που φορτώνει, δουλεύει, και
 * ρωτά «δικό μου;» στο τέλος **απαντά σωστά**· απλώς έχει ήδη διαβάσει ξένο
 * έγγραφο (ADR-742 §7.1).
 */
export function defineOwnedResource(spec: OwnedResourceSpec): OwnedResource {
  const decide = createOwnershipDecision(spec.resourceLabel, spec.idLogField);

  const check = (query: OwnedResourceQuery): ResourceAccessVerdict =>
    decide({
      data: query.data,
      caller: query.caller,
      resourceId: query.resourceId,
      action: query.action,
    });

  return {
    notFoundMessage: spec.notFoundMessage,

    notFoundResponse: () =>
      NextResponse.json(
        { success: false as const, error: spec.notFoundMessage },
        { status: 404 },
      ),

    check,

    load: <R>(load: LoadOwnedResourceSpec<R>) =>
      loadOwnedDocOrRefusal<R>({
        collection: spec.collection,
        docId: load.docId,
        action: load.action,
        resourceLabel: spec.resourceLabel,
        refusal: load.refusal,
        decide: (data: DocumentData | undefined) =>
          check({
            data,
            caller: load.caller,
            resourceId: load.docId,
            action: load.action,
          }),
        ...(load.db === undefined ? {} : { db: load.db }),
      }),
  };
}
