/**
 * =============================================================================
 * ΤΑ BYTES ΕΝΟΣ ΑΡΧΕΙΟΥ — **ΜΙΑ** ΑΛΥΣΙΔΑ, ΤΡΕΙΣ ΔΙΑΔΡΟΜΕΣ (ADR-862 Φ0 Β8)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Δώσ' μου τα bytes αυτού του `fileId` — **αν** δικαιούμαι.»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΡΕΙΣ ΔΙΑΔΡΟΜΕΣ ΘΑ ΕΓΡΑΦΑΝ ΤΗΝ ΙΔΙΑ ΤΕΤΡΑΔΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μετά το Β8 οι διαδρομές που σερβίρουν bytes από `fileId` είναι **τρεις**:
 * `files/[fileId]/download` · `files/batch-download` · `download?fileId=`. Και οι
 * τρεις χρειάζονται **την ίδια αλυσίδα, με την ίδια σειρά**:
 *
 * ```
 * fileResource.load()            →  υπάρχει; δικό μου;     (ADR-742 §7undecies)
 * containerVisibilityRefusal()   →  το βλέπω καν;          (ADR-862 Φ0 Β5/Β7)
 * isDeleted / storagePath        →  υπάρχει αντικείμενο;
 * getAdminBucket().download()    →  τα bytes
 * ```
 *
 * 🔴 **Ο ΚΙΝΔΥΝΟΣ ΔΕΝ ΕΙΝΑΙ ΟΙ ΓΡΑΜΜΕΣ — ΕΙΝΑΙ Η ΣΕΙΡΑ** (μάθημα `owned-doc-loader`):
 * ένα αντίγραφο που κατεβάζει **πρώτα** και ρωτά «το βλέπω;» **μετά** δουλεύει
 * κανονικά και δίνει σωστή απάντηση — απλώς έχει ήδη διαβάσει bytes που δεν
 * δικαιούται. Η διαφορά **δεν φαίνεται πουθενά**: ο φρουρός *κλήθηκε*, απλώς αργά.
 * Ενώνοντας την αλυσίδα εδώ, η σειρά παύει να είναι θέμα προσοχής και γίνεται
 * **δομική**.
 *
 * ⚠️ Και το `jscpd` **δεν** θα έπιανε τα τρία αντίγραφα: τα `fileData`/`data`/`doc`
 * είναι διαφορετικά tokens — το ίδιο τυφλό σημείο που έκρυψε τρεις φύλακες στην
 * ADR-742 §7octies. Γι' αυτό η ένωση γίνεται **τώρα**, με το χέρι, όχι όταν το
 * μετρήσει εργαλείο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΔΙΑΜΕΡΙΣΜΑΤΑ, ΙΔΙΑ ΣΕΙΡΑ (ADR-866 §2.6.9)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το **πρώτο** βήμα διαφέρει ανά κάτοχο· η ουρά (αντικείμενο → bytes) είναι **μία**:
 *
 * | κάτοχος | «δικό μου;» | «το βλέπω;» |
 * |---|---|---|
 * | εταιρεία | `fileResource` (μισθωτής, με bypass super admin) | κριτής δοχείου CDE |
 * | άνθρωπος | `personalFileResource` (`userId == uid`, **κανένα** bypass) | η **ρίζα Storage** ανήκει στον ίδιο `uid` |
 *
 * ⚠️ Ο άνθρωπος **δεν** περνά από κριτή δοχείου: προσωπικό αρχείο δεν έχει φάσεις CDE (Ε-Φ0-1).
 * Στη θέση του μπαίνει **δεύτερο, ανεξάρτητο τεκμήριο**: έγγραφο με αλλοιωμένο `storagePath` που
 * δείχνει σε ξένα bytes **δεν** σερβίρεται, ακόμη κι αν το έγγραφο είναι δικό σου.
 *
 * @module app/api/files/_shared/owned-file-bytes
 * @see app/api/files/_shared/file-ownership — ο φρουρός μισθωτή / κατόχου
 * @see app/api/files/_shared/file-custody-route — η πόρτα που παράγει τον καλούντα
 * @see lib/auth/container-visibility-guard — ο φρουρός ορατότητας δοχείου
 */

import 'server-only';

import { containerVisibilityRefusal } from '@/lib/auth/container-visibility-guard';
import type { ProjectMemberRead } from '@/lib/auth/project-member-read';
import type { AuthContext, PermissionId } from '@/lib/auth';
import { getAdminBucket } from '@/lib/firebaseAdmin';
import { storagePathCustody } from '@/lib/storage/storage-path-custody';

import type { FileCustodyCaller } from './file-custody-route';
import { fileResource, personalFileResource } from './file-ownership';

// =============================================================================
// ΤΟ ΕΡΩΤΗΜΑ ΚΑΙ Η ΕΚΒΑΣΗ
// =============================================================================

/** Ό,τι χρειάζεται η παράδοση από το έγγραφο — **στενεύεται εδώ**, μία φορά. */
interface FileBytesRecord {
  storagePath?: string;
  contentType?: string;
  displayName?: string;
  originalFilename?: string;
  ext?: string;
  isDeleted?: boolean;
}

export interface OwnedFileBytesQuery {
  readonly fileId: string;
  /** Η **ήδη επαληθευμένη** ταυτότητα **και** το διαμέρισμα (`withFileCustodyAuth`). */
  readonly caller: FileCustodyCaller;
  /** Ποιο μονοπάτι ρώτησε — μπαίνει στα logs ασφαλείας (`'download'`, `'batch-download'`). */
  readonly action: string;
  /** Η ικανότητα που κρίνει ο φρουρός ορατότητας — **η ίδια** που δηλώνει το σύνορο (μόνο εταιρεία). */
  readonly capability: PermissionId;
  /** Ανά-**αίτημα** απομνημόνευση μέλους — το batch τη χρειάζεται ζωτικά. */
  readonly cache?: Map<string, ProjectMemberRead>;
}

/**
 * ⚠️ **Τρεις εκβάσεις, όχι δύο.**
 *
 * Το `unavailable` **δεν** ισοπεδώνεται στο `refused`: το πρώτο σημαίνει *«δεν
 * ξέρουμε»* (έπεσε η αυθεντία) και δικαιούται **503 — ξαναδοκίμασε**· το δεύτερο
 * σημαίνει *«δεν βρέθηκε»* και είναι **404**. Ένα κοινό «όχι» θα έστελνε τον
 * μηχανικό να ζητήσει δικαιώματα που **έχει**, επειδή έπεσε το δίκτυο (N.12).
 *
 * 🔑 Ο **καλών** αποφασίζει τι κάνει με το καθένα: η μονή λήψη απαντά 404/503, το
 * batch τα **παραλείπει και τα δύο** — γιατί εκεί μια άρνηση ανά αρχείο θα ήταν
 * μαντείο ύπαρξης. Η **απόφαση** ανήκει στη διαδρομή· η **διάκριση** ανήκει εδώ.
 */
export type OwnedFileBytes =
  | {
      readonly outcome: 'bytes';
      readonly buffer: Buffer;
      readonly contentType: string;
      /** Το όνομα **από το έγγραφο** — ποτέ από το αίτημα. */
      readonly filename: string;
    }
  | { readonly outcome: 'refused' }
  | { readonly outcome: 'unavailable' };

const REFUSED = { outcome: 'refused' } as const satisfies OwnedFileBytes;
const UNAVAILABLE = { outcome: 'unavailable' } as const satisfies OwnedFileBytes;

/**
 * Το όνομα παράδοσης, **από το έγγραφο**.
 *
 * 🔴 Μέχρι το Β8 το έδινε ο πελάτης (`?filename=`, ή ανά εγγραφή στο batch). Όνομα
 * που ταξιδεύει με το αίτημα είναι όνομα που ο αιτών **διαλέγει** για bytes που
 * **δεν διάλεξε** — και μπαίνει αυτούσιο σε κεφαλίδα `Content-Disposition`.
 */
function ownedFileName(data: FileBytesRecord, fileId: string): string {
  const base = data.displayName ?? data.originalFilename ?? fileId;
  const ext = data.ext;
  if (ext === undefined || ext.length === 0) return base;
  return base.toLowerCase().endsWith(`.${ext.toLowerCase()}`) ? base : `${base}.${ext}`;
}

// =============================================================================
// Η ΑΛΥΣΙΔΑ
// =============================================================================

/**
 * **Φόρτωσε → δικό μου; → το βλέπω; → κατέβασε.** Με **αυτή** τη σειρά.
 *
 * ⚠️ **Καμία δεύτερη ανάγνωση**: το `load()` επιστρέφει ήδη το ωμό `doc.data`
 * (`lib/auth/owned-doc-loader.ts:154`), οπότε ο φρουρός ορατότητας κρίνει ό,τι
 * **έχουμε στο χέρι**. Ένα δεύτερο `get()` θα πρόσθετε κόστος **και** ένα παράθυρο
 * όπου τα δύο διαβάσματα διαφωνούν.
 */
export async function loadOwnedFileBytes(query: OwnedFileBytesQuery): Promise<OwnedFileBytes> {
  // (1)+(2) υπάρχει; δικό μου; το βλέπω; — ανά διαμέρισμα, με το «όχι» ως τιμή.
  const owned =
    query.caller.custody === 'company'
      ? await ownedCompanyRecord(query, query.caller.ctx)
      : await ownedPersonalRecord(query, query.caller.uid);
  if (owned.outcome !== 'record') return owned;

  return deliverRecordBytes(owned.data, query.fileId);
}

/** Το έγγραφο **αφού** κρίθηκε — ή ήδη η άρνηση/βλάβη που θα επιστραφεί αυτούσια. */
type OwnedRecord =
  | { readonly outcome: 'record'; readonly data: FileBytesRecord }
  | Exclude<OwnedFileBytes, { readonly outcome: 'bytes' }>;

/** Εταιρεία: μισθωτής (`fileResource`) **και** ορατότητα δοχείου (Β5) — αμετάβλητα από το Β8. */
async function ownedCompanyRecord(
  query: OwnedFileBytesQuery,
  ctx: AuthContext,
): Promise<OwnedRecord> {
  const { fileId, action, capability, cache } = query;

  const owned = await fileResource.load<OwnedRecord>({
    docId: fileId,
    caller: ctx,
    action,
    refusal: () => REFUSED,
  });
  if (owned.refusal !== undefined) return owned.refusal;

  const refusal = await containerVisibilityRefusal<OwnedRecord>({
    fileId,
    caller: ctx,
    action: capability,
    raw: owned.doc.data,
    notFound: () => REFUSED,
    unavailable: () => UNAVAILABLE,
    ...(cache === undefined ? {} : { cache }),
  });
  if (refusal !== null) return refusal;

  return { outcome: 'record', data: owned.doc.data as FileBytesRecord };
}

/**
 * Άνθρωπος: κάτοχος εγγράφου **και** κάτοχος ρίζας Storage — δύο ανεξάρτητα τεκμήρια, ίδιος `uid`.
 *
 * 🔴 Η ρίζα κρίνεται από τον **έναν** απαντητή (`storagePathCustody`), ποτέ με `startsWith`: η
 * λίστα ριζών και η αντιστοίχισή τους με τους κανόνες ζουν **εκεί** (άγκυρα Κ1).
 */
async function ownedPersonalRecord(query: OwnedFileBytesQuery, uid: string): Promise<OwnedRecord> {
  const owned = await personalFileResource.load<OwnedRecord>({
    docId: query.fileId,
    uid,
    action: query.action,
    refusal: () => REFUSED,
  });
  if (owned.refusal !== undefined) return owned.refusal;

  const data = owned.doc.data as FileBytesRecord;
  const bytesOwner = storagePathCustody(data.storagePath ?? '');
  if (bytesOwner.kind !== 'user' || bytesOwner.uid !== uid) return REFUSED;

  return { outcome: 'record', data };
}

/** (3)+(4) Η **κοινή** ουρά: υπάρχει αντικείμενο να δοθεί; — και τα bytes. */
async function deliverRecordBytes(data: FileBytesRecord, fileId: string): Promise<OwnedFileBytes> {
  if (data.isDeleted === true) return REFUSED;
  if (data.storagePath === undefined || data.storagePath.length === 0) return REFUSED;

  // (4) τα bytes — `getAdminBucket()` είναι ο SSoT (`lib/firebaseAdmin.ts:151`):
  //     ο implicit default του Admin SDK λύνεται σε `{projectId}.appspot.com` σε
  //     κάποιες διαδρομές αρχικοποίησης και γεννά ασυνέπειες `exists()`.
  const [buffer] = await getAdminBucket().file(data.storagePath).download();

  return {
    outcome: 'bytes',
    buffer,
    contentType: data.contentType ?? 'application/octet-stream',
    filename: ownedFileName(data, fileId),
  };
}
