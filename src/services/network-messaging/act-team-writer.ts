/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΟΜΑΔΑΣ ΠΡΑΞΗΣ** — ποιος απαντά, από τη στιγμή που γεννιέται η πράξη.
 * @related ADR-867 §4.3 · §6 Β3 · ADR-834 §5 Β (ε) ①-③ · ADR-862 §5.3.6 (μέλη έργου — ίδιο νόημα)
 * @module services/network-messaging/act-team-writer
 *
 * 🔑 **Η ομάδα γεννιέται ΜΕ ΤΗΝ ΠΡΑΞΗ, όχι με το πρώτο μήνυμα** (N.7.2 #1 — προδραστικά).
 * Ένα «τη φτιάχνω όταν χρειαστεί» θα σήμαινε ότι το **πρώτο** μήνυμα του ιδιοκτήτη αποφασίζει
 * ποιος το διαβάζει — δηλαδή ο πελάτης θα όριζε το ακροατήριο του γραφείου.
 *
 * 🔑 **Ιδεμποτής, με ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ κλειδί** (N.7.2 #3): δεύτερη γέννηση της ίδιας πράξης
 * (ανανέωση όρων στο **ίδιο** γραφείο) βρίσκει την **ίδια** ομάδα και **ΔΕΝ** την ξαναγράφει —
 * αλλιώς μια ανανέωση θα **ακύρωνε** μεταβίβαση ευθύνης που έγινε στο ενδιάμεσο.
 *
 * ⚠️ **ΔΥΟ πόρτες, ΕΝΑΣ πυρήνας**: ο δρόμος της αποδοχής έχει **ήδη** συναλλαγή (και όλες τις
 * αναγνώσεις πριν τις γραφές — απαίτηση Firestore), ο δρόμος του μεσίτη **δεν έχει**. Γι' αυτό:
 * {@link readActTeam} + {@link writeActTeamBirth} για την πρώτη, {@link ensureActTeam} για τη
 * δεύτερη. Το **έγγραφο** το χτίζει **μία** συνάρτηση ({@link actTeamDocument}).
 *
 * ⛔ **Κανένας άλλος γραφέας του `network_act_teams`** (ADR-867 §4.3) — και του ακροατηρίου
 * που προβάλλεται από αυτό (Β4).
 */

import 'server-only';

import type {
  DocumentReference,
  DocumentSnapshot,
  Firestore as AdminFirestore,
  Transaction,
} from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicNetworkActTeamId } from '@/services/enterprise-id.service';
import type { NetworkActKind, NetworkActTeam } from '@/types/network-thread';

import { readActThreadSlot, writeActThread } from './thread-writer';

/** Ό,τι ξέρει η **πράξη** τη στιγμή που γεννιέται — τίποτα για μηνύματα, τίποτα για νήματα. */
export interface ActTeamBirth {
  readonly actKind: NetworkActKind;
  /** Ο σπόρος του μητρώου πηγών (`lib/network-edge/edge-sources.ts`) — **η ίδια** τιμή με το νήμα. */
  readonly actSeed: string;
  readonly hostCompanyId: string;
  /**
   * 🔴 **Ο άνθρωπος που ανέλαβε** — και είναι το πεδίο που **δεν υπήρχε πουθενά** ως τώρα
   * (ADR-867 §2.3): η εντολή κρατά `agencyCompanyId`, όχι άνθρωπο. Ο δρόμος της αποδοχής
   * δίνει τον `deciderUid`, ο δρόμος του μεσίτη τον `attestedByUserId`/`authorUserId`.
   */
  readonly responsibleUid: string;
}

/** Το έγγραφο, με τα δύο πεδία χρόνου που ο τύπος του πυρήνα δεν κουβαλά. */
export interface ActTeamDocument extends NetworkActTeam {
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * **Η γέννηση σε μορφή εγγράφου** — καθαρή, ώστε να ελέγχεται χωρίς Firestore.
 *
 * ⚠️ `memberUids` **περιλαμβάνει** τον υπεύθυνο: **μία** λίστα, όχι δύο που πρέπει να
 * συμφωνούν (ADR-867 §4.3). `version: 1` — η μεταβίβαση το αυξάνει.
 */
export function actTeamDocument(birth: ActTeamBirth, nowISO: string): ActTeamDocument {
  return {
    id: generateDeterministicNetworkActTeamId(birth.actSeed),
    actKind: birth.actKind,
    actSeed: birth.actSeed,
    hostCompanyId: birth.hostCompanyId,
    responsibleUid: birth.responsibleUid,
    memberUids: [birth.responsibleUid],
    version: 1,
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}

/** Το μισό της ιδεμποτησίας που ανήκει στη **φάση ανάγνωσης** μιας ξένης συναλλαγής. */
export interface ActTeamSlot {
  readonly ref: DocumentReference;
  readonly exists: boolean;
  /**
   * 🔴 **Η ΟΜΑΔΑ ΟΠΩΣ ΕΙΝΑΙ ΤΩΡΑ — ΠΡΟΣΤΕΘΗΚΕ ΣΤΟ Β4, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΕΥΚΟΛΙΑ.**
   *
   * Η ανάγνωση γινόταν **ήδη** (`transaction.get`) και το περιεχόμενο **πεταγόταν**. Από
   * τη στιγμή που το ακροατήριο του νήματος είναι **προβολή** της ομάδας (§4.3), ο
   * καλών πρέπει να προβάλει την **πραγματική** ομάδα: σε **ανανέωση όρων** η ομάδα
   * μπορεί να έχει άλλον υπεύθυνο (μεταβίβαση) και περισσότερα μέλη. Χωρίς αυτό, η
   * προβολή θα έγραφε την ομάδα **της γέννησης** — δηλαδή θα **επανέφερε** σιωπηλά τον
   * αρχικό υπεύθυνο στο ακροατήριο και θα **σφράγιζε** τους υπόλοιπους.
   */
  readonly team: NetworkActTeam | null;
}

/**
 * **Η ομάδα που ΙΣΧΥΕΙ** μετά από μια γέννηση: η αποθηκευμένη αν υπάρχει, αλλιώς αυτή
 * που μόλις γεννήθηκε. Ο **ένας** τόπος που απαντά *«ποιους να προβάλω;»*.
 */
export function effectiveActTeam(
  slot: ActTeamSlot,
  birth: ActTeamBirth,
): Pick<NetworkActTeam, 'responsibleUid' | 'memberUids'> {
  return slot.team ?? { responsibleUid: birth.responsibleUid, memberUids: [birth.responsibleUid] };
}

function actTeamRef(adminDb: AdminFirestore, actSeed: string): DocumentReference {
  return adminDb
    .collection(COLLECTIONS.NETWORK_ACT_TEAMS)
    .doc(generateDeterministicNetworkActTeamId(actSeed));
}

/**
 * **Φάση ανάγνωσης** — καλείται μαζί με τα υπόλοιπα `get` της συναλλαγής του καλούντος.
 *
 * ⚠️ **ΠΡΕΠΕΙ** να τρέξει πριν από **κάθε** γραφή της συναλλαγής (απαίτηση Firestore, όχι στυλ).
 */
export async function readActTeam(
  transaction: Transaction,
  adminDb: AdminFirestore,
  actSeed: string,
): Promise<ActTeamSlot> {
  const ref = actTeamRef(adminDb, actSeed);
  const snapshot: DocumentSnapshot = await transaction.get(ref);
  return {
    ref,
    exists: snapshot.exists,
    team: (snapshot.data() as NetworkActTeam | undefined) ?? null,
  };
}

/**
 * **Φάση γραφής** — γράφει **μόνο** όταν δεν υπάρχει· επιστρέφει το id είτε έγραψε είτε όχι.
 *
 * 🔑 Η σιωπή σε υπαρκτή ομάδα **δεν** είναι παράλειψη: είναι ο κανόνας. Ένα `set` με `merge`
 * εδώ θα επανέφερε τον **αρχικό** υπεύθυνο πάνω από μεταβίβαση που έγινε νόμιμα (ε) ②.
 */
export function writeActTeamBirth(
  transaction: Transaction,
  slot: ActTeamSlot,
  birth: ActTeamBirth,
  nowISO: string,
): string {
  const document = actTeamDocument(birth, nowISO);
  if (!slot.exists) transaction.set(slot.ref, document);
  return document.id;
}

/**
 * **Η πόρτα για όποιον ΔΕΝ έχει συναλλαγή** (δρόμος του μεσίτη — `brokered-listing.service.ts`).
 *
 * ⚠️ Δική της συναλλαγή, ώστε η ιδεμποτησία να μην είναι «διάβασε, μετά γράψε» με κενό ανάμεσα:
 * δύο ταυτόχρονες καταχωρίσεις της ίδιας πράξης θα γεννούσαν **δύο** ομάδες με το ίδιο κλειδί —
 * δηλαδή η δεύτερη θα έσβηνε την πρώτη.
 */
export async function ensureActTeam(
  adminDb: AdminFirestore,
  birth: ActTeamBirth,
  nowISO: string,
): Promise<{ readonly id: string; readonly created: boolean }> {
  return adminDb.runTransaction(async (transaction) => {
    const slot = await readActTeam(transaction, adminDb, birth.actSeed);
    const id = writeActTeamBirth(transaction, slot, birth, nowISO);
    return { id, created: !slot.exists };
  });
}

// =============================================================================
// Η ΜΕΤΑΒΙΒΑΣΗ — «κανένα ορφανό νήμα, ΠΟΤΕ» (ADR-834 §5 Β (ε) 🏆)
// =============================================================================

/** Ποιος φεύγει, ποιος κάνει την πράξη, πότε. */
export interface DepartureTransfer {
  readonly companyId: string;
  readonly departingUid: string;
  /**
   * 🔑 **Ο τελευταίος καταφύγιος, και ΥΠΑΡΧΕΙ ΠΑΝΤΑ**: ο διαχειριστής που εκτελεί την
   * αναστολή. Δεν χρειάζεται δεύτερη ανάγνωση «βρες έναν διαχειριστή» — η αυτοπροστασία
   * (`rejectSelfTarget`) εγγυάται ότι **δεν** είναι ο ίδιος ο αποχωρών.
   */
  readonly fallbackUid: string;
  readonly nowISO: string;
}

/**
 * **Ο κανόνας, καθαρός**: επόμενο μέλος της ομάδας· αν δεν υπάρχει, ο διαχειριστής.
 *
 * ⚠️ **Ποτέ `null`, ποτέ «ο ίδιος»**: μια ομάδα χωρίς υπεύθυνο είναι το **ορφανό νήμα**
 * που Salesforce/HubSpot/Zendesk/Follow Up Boss αφήνουν πίσω τους (ADR-834 §5 Β (ε)).
 */
export function nextResponsible(
  team: { readonly memberUids: readonly string[] },
  departingUid: string,
  fallbackUid: string,
): string {
  return team.memberUids.find((uid) => uid !== departingUid) ?? fallbackUid;
}

/** Η **επόμενη έκδοση** της ομάδας μετά την αποχώρηση — καθαρή, ώστε να ελέγχεται μόνη της. */
export function teamAfterDeparture(
  team: NetworkActTeam,
  transfer: DepartureTransfer,
): Pick<NetworkActTeam, 'responsibleUid' | 'memberUids' | 'version'> & { readonly updatedAt: string } {
  const heir = nextResponsible(team, transfer.departingUid, transfer.fallbackUid);
  const remaining = team.memberUids.filter((uid) => uid !== transfer.departingUid);
  return {
    responsibleUid: heir,
    // ⚠️ Ο κληρονόμος μπαίνει στα μέλη **μία** φορά: ο διαχειριστής που μπαίνει είναι
    //    **ορατός** στο ακροατήριο (ADR-834 (ε) ②) — καμία σιωπηλή ανάγνωση.
    memberUids: remaining.includes(heir) ? remaining : [...remaining, heir],
    version: team.version + 1,
    updatedAt: transfer.nowISO,
  };
}

/**
 * **Η αποχώρηση παράγει ξανά την ευθύνη** — για **κάθε** πράξη που κρατούσε ο αποχωρών.
 *
 * ⚠️ **Η αποχώρηση ΔΕΝ είναι διαγραφή μέλους** (μετρημένο 2026-09-17, ADR-867 §8 #5):
 * **κανείς** δεν σβήνει `workspace_members`. Η αποχώρηση εκφράζεται ως **κατάσταση**
 * (`status: suspended` + Firebase Auth `disabled`), και **αυτοί** είναι οι γραφείς που
 * καλούν αυτή τη συνάρτηση.
 *
 * ⚠️ **Μία συναλλαγή ανά ομάδα**, όχι μία για όλες: το πλήθος είναι **αφράγκτο** και μια
 * συναλλαγή Firestore έχει όριο. Κάθε ομάδα μεταβιβάζεται **ατομικά** — μερική επιτυχία
 * αφήνει **λιγότερα** ορφανά, ποτέ ασυνεπή ομάδα.
 */
export async function transferActTeamsOnDeparture(
  adminDb: AdminFirestore,
  transfer: DepartureTransfer,
): Promise<{ readonly transferred: number }> {
  // tenant-scope-exempt: το φίλτρο **ΕΙΝΑΙ** ο άξονας μισθωτή αυτής της συλλογής
  //   (`hostCompanyId`, tenant-config) — δηλωμένο ρητά επειδή το όνομα δεν είναι `companyId`.
  const snapshot = await adminDb
    .collection(COLLECTIONS.NETWORK_ACT_TEAMS)
    .where('hostCompanyId', '==', transfer.companyId)
    .where('responsibleUid', '==', transfer.departingUid)
    .get();

  let transferred = 0;
  for (const doc of snapshot.docs) {
    const ref = adminDb.collection(COLLECTIONS.NETWORK_ACT_TEAMS).doc(doc.id);
    const changed = await adminDb.runTransaction(async (transaction) => {
      const fresh = await transaction.get(ref);
      const team = fresh.data() as NetworkActTeam | undefined;
      // 🔑 **Ξαναδιαβάζουμε μέσα στη συναλλαγή**: αν κάποιος μεταβίβασε ήδη στο ενδιάμεσο,
      //    η ομάδα **δεν** αγγίζεται — αλλιώς θα κλέβαμε ευθύνη από τον νέο υπεύθυνο.
      if (team === undefined || team.responsibleUid !== transfer.departingUid) return false;

      // 🔴 **ADR-867 Β4 — Η ΜΕΤΑΒΙΒΑΣΗ ΧΩΡΙΣ ΤΟ ΑΚΡΟΑΤΗΡΙΟ ΘΑ ΗΤΑΝ ΜΙΣΗ**, και η μισή
      //    είναι **χειρότερη** από καμία: η ομάδα θα έλεγε «υπεύθυνη η Ελένη» ενώ ο
      //    κανόνας Firestore θα συνέχιζε να δίνει ανάγνωση στον **αποχωρούντα** και να
      //    την **αρνείται** στην Ελένη. Δηλαδή νήμα που κανείς αρμόδιος δεν διαβάζει.
      //    ⚠️ Η ανάγνωση **πριν** από κάθε γραφή (απαίτηση Firestore) — γι' αυτό εδώ.
      const threadSlot = await readActThreadSlot(transaction, adminDb, team.actSeed);

      const next = teamAfterDeparture(team, transfer);
      transaction.update(ref, next);

      // ⚠️ `birth: null` ⇒ **αν δεν υπάρχει νήμα, δεν γεννιέται τώρα**: η αποχώρηση
      //    ενός υπαλλήλου δεν είναι ακμή, και μια πράξη «σε αναμονή» δεν έχει ακόμη
      //    πρόσωπο στην άλλη πλευρά (§8 #1).
      writeActThread(transaction, threadSlot, {
        birth: null,
        team: next,
        newcomerReason: 'failover',
        addedBy: transfer.fallbackUid,
        nowISO: transfer.nowISO,
      });
      return true;
    });
    if (changed) transferred += 1;
  }
  return { transferred };
}
