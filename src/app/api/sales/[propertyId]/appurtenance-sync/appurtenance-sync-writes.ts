/**
 * =============================================================================
 * ΤΟ ΜΟΝΤΕΛΟ ΓΡΑΦΗΣ ΤΩΝ ΠΑΡΑΚΟΛΟΥΘΗΜΑΤΩΝ — τυπωμένο, ώστε το λάθος να μη ΓΡΑΦΕΤΑΙ
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ.** Μέχρι τις 2026-08-11 ο κλάδος `revert` της
 * διαδρομής έγραφε `commercialStatus: null` — τιμή που **δεν υπάρχει** στο κλειστό
 * σύνολο των επτά (`COMMERCIAL_STATUSES`). Ο τύπος `CommercialStatus` παράγεται
 * **αυτόματα** από εκείνο το array, άρα ο μεταγλωττιστής θα το έπιανε **αν** το
 * πεδίο ήταν τυπωμένο· σε `batch.update()` με ωμό αντικείμενο **δεν είναι** — το
 * Admin SDK δέχεται οποιοδήποτε σχήμα.
 *
 * Η θεραπεία **δεν** είναι να διορθωθεί η γραμμή: αυτό αφήνει τον μηχανισμό που
 * την επέτρεψε ανέπαφο και ο επόμενος τη γράφει ξανά. Η θεραπεία είναι να γίνει
 * **δομικά αδύνατη** — ίδια κίνηση με το `applyOfferProjectionsForWrite`, όπου το
 * λάθος «**δεν μεταγλωττίζεται**».
 *
 * ⚠️ **ΜΗΝ βάλεις index signature** (`[k: string]: unknown`) στο
 * {@link AppurtenanceUpdate}: θα ξανάνοιγε ακριβώς την τρύπα που κλείνει αυτό το
 * αρχείο — κάθε ορθογραφικό λάθος σε δοτικό μονοπάτι θα περνούσε σιωπηλά και θα
 * έγραφε **νέο** πεδίο στο έγγραφο αντί να ενημερώσει το υπάρχον.
 *
 * @module api/sales/[propertyId]/appurtenance-sync/appurtenance-sync-writes
 * @see ADR-199 Sales Appurtenances · ADR-777 §8.5α (δ) — το ονομασμένο ανοιχτό
 * @see ADR-749 — μία αλήθεια· εδώ: ο γράφων, όχι ο αναγνώστης
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import {
  APPURTENANCE_REVERTED_STATUS,
  type CommercialStatus,
} from '@/constants/commercial-statuses';
import { nowISO } from '@/lib/date-local';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { PropertyOwnerEntry } from '@/types/ownership-table';

// =============================================================================
// 1. ΤΟ ΣΧΗΜΑ ΤΟΥ ΑΙΤΗΜΑΤΟΣ
// =============================================================================

export type SyncAction = 'reserve' | 'sell' | 'revert';

export const VALID_ACTIONS: readonly SyncAction[] = ['reserve', 'sell', 'revert'];

export type SpaceType = 'parking' | 'storage';

export interface SyncSpacePayload {
  spaceId: string;
  spaceType: SpaceType;
  salePrice?: number | null;
}

/**
 * ADR-244: owners[] SSoT — προωθείται στους συνδεδεμένους χώρους.
 *
 * ⚠️ **ΔΕΝ ξαναδηλώνεται εδώ.** Μέχρι τις 2026-08-11 ο διακομιστής είχε δικό του
 * ανώνυμο σχήμα με `role: string`, ενώ ο πελάτης στέλνει `PropertyOwnerEntry` με
 * `role: PropertyOwnerRole` — **δύο δηλώσεις ενός συμβολαίου**, με τη μία πιο
 * χαλαρή. Ο τύπος του συμβολαίου είναι **ένας** και ζει στον αποστολέα.
 */
export type SyncOwnerEntry = PropertyOwnerEntry;

export interface SyncRequestBody {
  action: SyncAction;
  spaces: SyncSpacePayload[];
  owners?: SyncOwnerEntry[] | null;
  /** ADR-244: επίπεδος πίνακας contactId για ερωτήματα `array-contains`. */
  ownerContactIds?: string[] | null;
}

// =============================================================================
// 2. ΤΟ ΣΧΗΜΑ ΤΗΣ ΓΡΑΦΗΣ — η πύλη του μεταγλωττιστή
// =============================================================================

/**
 * Το πλήρες σχήμα μιας γραφής παρακολουθήματος — τα **μόνα** πεδία που
 * επιτρέπεται να αγγίξει αυτή η διαδρομή.
 *
 * 🔑 Το `commercialStatus` είναι **υποχρεωτικό και τυπωμένο**: κάθε ενέργεια
 * οφείλει να δηλώσει πού προσγειώνεται ο χώρος, και μόνο μία από τις **επτά**
 * κανονικές τιμές είναι δεκτή. `null` · `undefined` · ορθογραφικό λάθος ⇒ **δεν
 * μεταγλωττίζεται**. Τα δοτικά μονοπάτια είναι **προαιρετικά**: κάθε ενέργεια
 * γράφει το δικό της υποσύνολο, και ό,τι δεν ονομάζεται εδώ δεν γράφεται πουθενά.
 *
 * ⚠️ **ΕΙΝΑΙ `type`, ΟΧΙ `interface`, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΑΠΑΙΤΗΣΗ ΤΟΥ ΜΕΤΑΓΛΩΤΤΙΣΤΗ.**
 * Το `WriteBatch.update` ζητά `UpdateData<DocumentData>`, που αναλύεται σε τύπο
 * **με index signature**. Η TypeScript συνάγει σιωπηρή index signature για τύπους
 * αντικειμένου δηλωμένους ως `type`, **ποτέ για `interface`** — ένα `interface`
 * εδώ θα έσκαγε με «*Index signature for type 'string' is missing*». Μετατροπή σε
 * `interface` «για συνέπεια» **σπάει το αρχείο**.
 */
export type AppurtenanceUpdate = {
  commercialStatus: CommercialStatus;
  'commercial.owners'?: SyncOwnerEntry[] | null;
  'commercial.ownerContactIds'?: string[] | null;
  'commercial.askingPrice'?: number | null;
  'commercial.finalPrice'?: number | null;
  'commercial.reservationDeposit'?: number | null;
  'commercial.reservationDate'?: string | null;
  'commercial.saleDate'?: string | null;
  'commercial.linkedPropertyId'?: string | null;
};

export interface AppurtenanceUpdateInput {
  action: SyncAction;
  space: SyncSpacePayload;
  propertyId: string;
  owners: SyncOwnerEntry[] | null;
  ownerContactIds: string[] | null;
  /** Η στιγμή του γεγονότος — **μία** για ολόκληρη τη δέσμη, όχι μία ανά χώρο. */
  now: string;
}

/**
 * Παράγει τη γραφή για **έναν** χώρο.
 *
 * Η εξαντλητικότητα φυλάγεται από τον μεταγλωττιστή (`never` στο `default`):
 * μια τέταρτη ενέργεια χωρίς κλάδο εδώ **δεν μεταγλωττίζεται**.
 */
export function buildAppurtenanceUpdate(
  input: AppurtenanceUpdateInput,
): AppurtenanceUpdate {
  const { action, space, propertyId, owners, ownerContactIds, now } = input;

  switch (action) {
    case 'reserve':
      return {
        commercialStatus: 'reserved',
        'commercial.owners': owners,
        'commercial.ownerContactIds': ownerContactIds,
        'commercial.askingPrice': space.salePrice ?? null,
        'commercial.reservationDate': now,
        'commercial.linkedPropertyId': propertyId,
      };

    case 'sell':
      return {
        commercialStatus: 'sold',
        'commercial.owners': owners,
        'commercial.ownerContactIds': ownerContactIds,
        'commercial.finalPrice': space.salePrice ?? null,
        'commercial.saleDate': now,
        'commercial.linkedPropertyId': propertyId,
      };

    case 'revert':
      // Βγαίνει από την αγορά — ΔΕΝ ακολουθεί το ακίνητο στο `for-sale`.
      // Το σκεπτικό ζει πάνω από τη σταθερά, όχι εδώ.
      return {
        commercialStatus: APPURTENANCE_REVERTED_STATUS,
        'commercial.owners': null,
        'commercial.ownerContactIds': null,
        'commercial.askingPrice': null,
        'commercial.finalPrice': null,
        'commercial.reservationDeposit': null,
        'commercial.reservationDate': null,
        'commercial.saleDate': null,
        'commercial.linkedPropertyId': null,
      };

    default: {
      const exhaustive: never = action;
      throw new Error(`Unhandled appurtenance sync action: ${String(exhaustive)}`);
    }
  }
}

// =============================================================================
// 3. ΕΠΙΚΥΡΩΣΗ ΕΙΣΟΔΟΥ
// =============================================================================

export function validateSyncBody(body: Partial<SyncRequestBody>): string | null {
  if (!body.action || !VALID_ACTIONS.includes(body.action)) {
    return `action must be one of: ${VALID_ACTIONS.join(', ')}`;
  }
  if (!Array.isArray(body.spaces) || body.spaces.length === 0) {
    return 'spaces must be a non-empty array';
  }
  for (const space of body.spaces) {
    if (!space.spaceId?.trim()) return 'Each space must have a spaceId';
    if (space.spaceType !== 'parking' && space.spaceType !== 'storage') {
      return 'spaceType must be "parking" or "storage"';
    }
  }
  return null;
}

export function getCollectionName(spaceType: SpaceType): string {
  return spaceType === 'parking' ? COLLECTIONS.PARKING_SPACES : COLLECTIONS.STORAGE;
}

// =============================================================================
// 4. Η ΕΦΑΡΜΟΓΗ ΣΤΗ ΒΑΣΗ
// =============================================================================

/**
 * Οι ενέργειες που **δεσμεύουν** χώρο απαιτούν εμβαδόν > 0 — μια θέση χωρίς
 * εμβαδόν δεν μπορεί να τιμολογηθεί. Η `revert` **απελευθερώνει**, οπότε δεν
 * ζητά τίποτα: αλλιώς ένας χώρος με λάθος δεδομένα θα κλείδωνε για πάντα.
 */
async function assertSpacesHaveArea(
  db: Firestore,
  spaces: readonly SyncSpacePayload[],
): Promise<void> {
  for (const space of spaces) {
    const doc = await db.collection(getCollectionName(space.spaceType)).doc(space.spaceId).get();
    const area = (doc.data()?.area as number) ?? 0;
    if (area <= 0) {
      throw new Error(
        `Space ${space.spaceId} has no area (0 sqm) — cannot include in transaction`,
      );
    }
  }
}

/**
 * Εφαρμόζει όλες τις γραφές ατομικά (batch), με **μία** χρονοσήμανση, **και**
 * καταγράφει το ίχνος ελέγχου.
 *
 * 🔴 **ΓΙΑΤΙ Η ΚΑΤΑΓΡΑΦΗ ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗ ΔΙΑΔΡΟΜΗ.** Το **CHECK 3.17**
 * (ADR-195) απαιτεί κάθε γραφή σε παρακολουθούμενη συλλογή να συνοδεύεται από
 * `recordChange()` στο **ίδιο αρχείο** — και μπλόκαρε αυτό ακριβώς το σπλιτ, με
 * δίκιο: βγάζοντας τη γραφή από τη διαδρομή, η καταγραφή έμεινε πίσω και το
 * ζευγάρι έπαψε να είναι ζευγάρι.
 *
 * Η θεραπεία **δεν** είναι να ξαναγυρίσει η γραφή στη διαδρομή (το `handlePost`
 * ήταν 125 γραμμές, N.7.1 απαιτεί 40). Είναι να πάψει η καταγραφή να είναι κάτι
 * που ο **καλών** οφείλει να θυμηθεί: ένας δεύτερος καλών αύριο θα έγραφε στους
 * ίδιους χώρους **χωρίς** ίχνος, και τίποτα δεν θα το έλεγε. *Ίδιο μάθημα με το
 * `evaluateTranslucent` του CHECK 3.39 — ξεχωριστή κλήση που ο τρίτος καταναλωτής
 * δεν θυμήθηκε.*
 */
export async function applyAppurtenanceSync(
  db: Firestore,
  body: SyncRequestBody,
  propertyId: string,
  actor: SyncActor,
): Promise<void> {
  if (body.action !== 'revert') {
    await assertSpacesHaveArea(db, body.spaces);
  }

  const batch = db.batch();
  const now = nowISO();

  for (const space of body.spaces) {
    const docRef = db.collection(getCollectionName(space.spaceType)).doc(space.spaceId);
    const update = buildAppurtenanceUpdate({
      action: body.action,
      space,
      propertyId,
      owners: body.owners ?? null,
      ownerContactIds: body.ownerContactIds ?? null,
      now,
    });
    // Το spread παράγει κυριολεκτικό αντικείμενο — δεύτερη ζώνη ασφαλείας για τη
    // σιωπηρή index signature που ζητά το `UpdateData`. Δεν χαλαρώνει τίποτα: ο
    // τύπος έχει ήδη κριθεί στην ανάθεση παραπάνω.
    batch.update(docRef, { ...update });
  }

  await batch.commit();

  recordSyncAudit(propertyId, body, actor);
}

// =============================================================================
// 5. ΤΟ ΙΧΝΟΣ ΕΛΕΓΧΟΥ — αχώριστο από τη γραφή (ADR-195 · CHECK 3.17)
// =============================================================================

const ACTION_LABELS: Record<SyncAction, string> = {
  reserve: 'Κράτηση',
  sell: 'Πώληση',
  revert: 'Επαναφορά',
};

const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  parking: 'Παρκινγκ',
  storage: 'Αποθήκη',
};

/**
 * Ποιος έκανε τη μεταβολή.
 *
 * ⚠️ **Δεν είναι `AuthContext`, επίτηδες.** Αυτό το module περιγράφει **γραφές**·
 * μια εξάρτηση από το στρώμα αυθεντικοποίησης θα το έδενε σε ένα και μόνο σημείο
 * κλήσης. Χρειάζεται **τρία πεδία**, και τα ζητά ονομαστικά.
 */
export interface SyncActor {
  uid: string;
  email: string | null;
  companyId: string;
}

/**
 * Fire-and-forget **σκόπιμα**: το ίχνος ελέγχου δεν είναι μέρος της ατομικότητας
 * της συναλλαγής — μια αποτυχία καταγραφής δεν επιτρέπεται να ακυρώσει γραφή που
 * **έχει ήδη γίνει** (N.7.2 #6: `await` για ορθότητα, fire-and-forget για μη
 * μπλοκάρουσες παρενέργειες).
 */
function recordSyncAudit(
  propertyId: string,
  body: SyncRequestBody,
  actor: SyncActor,
): void {
  safeFireAndForget(
    EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.PROPERTY,
      entityId: propertyId,
      entityName: null,
      action: 'updated',
      changes: body.spaces.map((s) => ({
        field: s.spaceType,
        oldValue: null,
        newValue: `${s.spaceId.slice(0, 8)}… — ${ACTION_LABELS[body.action]}`,
        label: SPACE_TYPE_LABELS[s.spaceType],
      })),
      performedBy: actor.uid,
      performedByName: actor.email,
      companyId: actor.companyId,
    }),
    'AppurtenanceSync.auditTrail',
  );
}
