/**
 * @fileoverview **ΝΗΜΑΤΑ ΑΝΑΜΕΣΑ ΣΕ ΣΥΝΕΡΓΑΤΕΣ** — τα κλειστά σύνολα και τα σχήματα (ADR-867 §4).
 * @related ADR-834 §5 Β (α)-(ε) — οι αποφάσεις · ADR-862 §5.2
 * @module types/network-thread
 *
 * 🔑 **Ο πυρήνας δεν ξέρει τι είναι «εντολή»** (ADR-867 §3): η πράξη εμφανίζεται εδώ ως
 * `actKind` από κλειστό σύνολο και ως **σπόρος** — τίποτα από τα πεδία της. Νέα πηγή ακμής
 * (ADR-862 Φ1 — συμμετοχή) = **μία** τιμή στο `NETWORK_ACT_KINDS`, όχι νέο σχήμα νήματος.
 *
 * ⚠️ **Ξεχωριστό από το `types/conversations.ts` (ADR-029)**: εκείνο είναι γραφείο ↔ εξωτερικό
 * κανάλι, ορατό σε όλο τον χώρο. Κοινός τύπος θα έκανε τους κανόνες ορατότητας **αδιάκριτους**.
 */

// ============================================================================
// ΚΛΕΙΣΤΑ ΣΥΝΟΛΑ
// ============================================================================

/** Οι **πράξεις** που γεννούν ακμή. Σήμερα μία (ADR-834 §5 Β (δ)). */
export const NETWORK_ACT_KINDS = ['mandate'] as const;
export type NetworkActKind = (typeof NETWORK_ACT_KINDS)[number];

/** Τα δύο θέματα νήματος (ADR-834 §5 Β (γ)): της **πράξης** (του χώρου) · της **σχέσης** (του προσώπου). */
export const NETWORK_THREAD_KINDS = ['act', 'relationship'] as const;
export type NetworkThreadKind = (typeof NETWORK_THREAD_KINDS)[number];

/** `closed` ⇐ **μόνο** αποσύνδεση ΓΚΠΔ (β) — **ποτέ** διαγραφή, **ποτέ** λήξη πράξης (α). */
export const NETWORK_THREAD_STATES = ['open', 'closed'] as const;
export type NetworkThreadState = (typeof NETWORK_THREAD_STATES)[number];

/** Η **πλευρά** ενός μέλους του ακροατηρίου. `person` = νήμα σχέσης (κανένας χώρος). */
export const NETWORK_AUDIENCE_SIDES = ['host', 'counterpart', 'person'] as const;
export type NetworkAudienceSide = (typeof NETWORK_AUDIENCE_SIDES)[number];

/** Ο **ρόλος** στο ακροατήριο (ADR-834 §5 Β (ε) ①). */
export const NETWORK_AUDIENCE_ROLES = ['responsible', 'collaborator', 'counterpart', 'person'] as const;
export type NetworkAudienceRole = (typeof NETWORK_AUDIENCE_ROLES)[number];

/**
 * **Γιατί** κάποιος είναι στο ακροατήριο — η προέλευση, όπως το `enrollment` των μελών έργου.
 * `admin-self` = ο διαχειριστής χώρου μπήκε **ορατά** (ADR-834 §5 Β (ε) ②).
 */
export const NETWORK_AUDIENCE_REASONS = [
  'creator',
  'assigned',
  'added',
  'failover',
  'admin-self',
  'counterpart',
  'relationship',
] as const;
export type NetworkAudienceReason = (typeof NETWORK_AUDIENCE_REASONS)[number];

/**
 * **Κάθε λόγος άρνησης των πορτών του δικτύου** — κλειστό σύνολο, **κοινό** σε διακομιστή και οθόνη.
 *
 * 🔑 Ο διακομιστής τον αντιστοιχίζει σε HTTP (`NETWORK_REFUSAL_STATUS`, `satisfies Record<…>` ⇒ νέος λόγος
 * χωρίς γραμμή εκεί **δεν μεταγλωττίζεται**)· η οθόνη τον μεταφράζει σε ανθρώπινο κείμενο (N.11) — ποτέ
 * κείμενο από τον διακομιστή. Ζει εδώ ώστε ο πελάτης να **μη** χρειάζεται αρχείο `server-only`.
 */
export const NETWORK_REFUSAL_CODES = [
  'thread-absent',
  'not-audience',
  'team-absent',
  'message-absent',
  'thread-closed',
  'already-retracted',
  'stale-version',
  'window-expired',
  'not-sender',
  'not-permitted',
  'empty-text',
  'too-long',
  'target-not-in-workspace',
  'target-is-counterpart',
  'responsible-not-removable',
] as const;
export type NetworkRefusalCode = (typeof NETWORK_REFUSAL_CODES)[number];

/**
 * **Ανώτατο μήκος μηνύματος** — ένας αριθμός για τον γραφέα (`too-long`) **και** το πλαίσιο γραφής (μετρητής).
 *
 * ⚠️ Δεν είναι «ασφάλεια», είναι **σχήμα**: ένα έγγραφο Firestore έχει όριο 1 MiB, και ένα
 * μήνυμα που το πλησιάζει κάνει **κάθε** ανάγνωση του νήματος ακριβή για όλους. Το όριο
 * είναι το ίδιο μέγεθος που δίνει το Slack στο μήνυμα (~4.000 χαρακτήρες) — πάνω από αυτό
 * ο άνθρωπος στέλνει **αρχείο**, και τα συνημμένα έχουν δικό τους βήμα (§8 #2, Β8β).
 */
export const MAX_NETWORK_MESSAGE_CHARS = 4000;

// ============================================================================
// ΣΧΗΜΑΤΑ
// ============================================================================

/** Το θέμα του νήματος — διακριτή ένωση, **ποτέ** προαιρετικά πεδία που «συνήθως» υπάρχουν. */
export type NetworkThreadTopic =
  | {
      readonly kind: 'act';
      readonly actKind: NetworkActKind;
      /** Ο σπόρος της πράξης, από το μητρώο πηγών ακμής. */
      readonly actSeed: string;
      /** Ο χώρος στον οποίο **ανήκει** το νήμα πράξης (ADR-834 (γ) ①). */
      readonly hostCompanyId: string;
      /** Το πρόσωπο της **άλλης** πλευράς. */
      readonly counterpartUid: string;
    }
  | {
      readonly kind: 'relationship';
      /** Ταξινομημένα — το ζεύγος είναι **συμμετρικό**. */
      readonly personUids: readonly [string, string];
    };

/** `network_threads/{nthr_*}` */
export interface NetworkThread {
  readonly id: string;
  readonly topic: NetworkThreadTopic;
  readonly state: NetworkThreadState;
  readonly createdAt: string;
  readonly lastMessageAt: string | null;
}

/**
 * `network_threads/{id}/network_messages/{nmsg_*}` — **ό,τι διαβάζει ο πελάτης**.
 *
 * 🔑 **Η ΑΝΑΚΛΗΣΗ ΕΙΝΑΙ ΤΑΦΟΠΛΑΚΑ, ΟΧΙ ΔΙΑΓΡΑΦΗ** (XMPP **XEP-0424**, το πρότυπο της
 * βιομηχανίας): το έγγραφο **μένει στη θέση του** — ίδιο id, ίδιο `createdAt`, ίδιος
 * αποστολέας — και **μόνο το σώμα** αδειάζει. Έτσι η σειρά του νήματος, οι δείκτες
 * ανάγνωσης και η σελιδοποίηση **δεν μετακινούνται**, και ο παραλήπτης βλέπει **ότι
 * κάτι ανακλήθηκε** αντί να του εξαφανιστεί η συνομιλία κάτω από τα μάτια του.
 *
 * ⚠️ **ΤΟ ΚΕΙΜΕΝΟ ΔΕΝ ΧΑΝΕΤΑΙ — ΑΛΛΑΖΕΙ ΤΟΠΟ**: μετακινείται στο
 * `network_message_retractions/{nmsg_*}`, που είναι **κλειστό σε κάθε πελάτη**. Ίδιο
 * δόγμα με τα **δύο αντίγραφα** του Microsoft Teams *(«one for compliance purposes, one
 * for end-user access»)* και με το `save edits and deletions` του Slack.
 */
export interface NetworkMessage {
  readonly id: string;
  readonly senderUid: string;
  /** **Κενό** μετά την ανάκληση. Το αρχικό ζει στο βιβλίο ανακλήσεων. */
  readonly text: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly retractedAt: string | null;
  /**
   * 🏆 **Η ΕΙΛΙΚΡΙΝΗΣ ΤΑΦΟΠΛΑΚΑ — ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΟΥΜΕ.**
   *
   * `true` = **κάποιος το είχε ήδη διαβάσει** όταν ανακλήθηκε. Το μετρημένο παράπονο
   * του WhatsApp είναι ότι ο αποστολέας **δεν μαθαίνει ποτέ** αν πρόλαβε· εδώ το
   * ξέρουμε, γιατί το ακροατήριο κρατά `lastReadAt` ανά πρόσωπο.
   *
   * 🔑 Σε επαγγελματικό εργαλείο αυτό **δεν είναι λεπτομέρεια**: ο μεσίτης που έγραψε
   * λάθος τιμή πρέπει να ξέρει αν έφτασε στον πελάτη — αλλιώς θα υποθέσει ότι δεν
   * έφτασε, και θα χτίσει πάνω σε ψέμα. `null` = δεν είχε ανακληθεί ποτέ.
   */
  readonly readBeforeRetraction: boolean | null;
  /**
   * 🏆 **ΕΠΕΞΕΡΓΑΣΤΗΚΕ ΑΦΟΥ ΤΟ ΕΙΧΑΝ ΔΙΑΒΑΣΕΙ;** (ADR-867 Β7) — το ίδιο γεγονός με το
   * `readBeforeRetraction`, για την **τελευταία** επεξεργασία. Teams/Slack/Google Chat γράφουν μόνο
   * «Edited»· εδώ ο αναγνώστης μαθαίνει ότι **αυτό που διάβασε άλλαξε** — σε επαγγελματικό νήμα, η
   * διαφορά ανάμεσα σε «διόρθωσα τυπογραφικό» και «άλλαξα την τιμή που ήδη είδες».
   * `null` = δεν επεξεργάστηκε ποτέ.
   */
  readonly readBeforeEdit: boolean | null;
}

/**
 * `network_message_revisions/{nmrv_*}` — **ΤΟ ΚΕΙΜΕΝΟ ΠΡΙΝ ΑΠΟ ΜΙΑ ΕΠΕΞΕΡΓΑΣΙΑ** (ADR-867 Β7).
 *
 * ⛔ **Κλειστό σε κάθε πελάτη**, όπως το αντίγραφο ανάκλησης. Μία γραμμή **ανά επεξεργασία**: η
 * σειρά `replacedAt` ξαναχτίζει όλο το ιστορικό του μηνύματος για ΓΚΠΔ άρθρο 17 §3(ε).
 */
export interface NetworkMessageRevision {
  readonly id: string;
  readonly messageId: string;
  readonly threadId: string;
  readonly threadKind: NetworkThreadKind;
  readonly senderUid: string;
  /** 🔒 Το κείμενο **όπως ήταν** πριν αντικατασταθεί. */
  readonly previousText: string;
  /** Πότε είχε γραφτεί αυτή η μορφή (`createdAt` ή η προηγούμενη επεξεργασία). */
  readonly previousAt: string;
  readonly replacedAt: string;
  readonly readBeforeEdit: boolean;
}

/**
 * `network_message_retractions/{nmsg_*}` — **ΤΟ ΑΝΤΙΓΡΑΦΟ ΣΥΜΜΟΡΦΩΣΗΣ.**
 *
 * ⛔ **ΚΛΕΙΣΤΟ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ, ΓΙΑ ΚΑΘΕ ΠΕΛΑΤΗ** — ούτε ο αποστολέας, ούτε ο
 * παραλήπτης, ούτε ο διαχειριστής χώρου, ούτε ο `super_admin`. Το διαβάζει **μόνο** ο
 * διακομιστής, και μόνο για τον λόγο που υπάρχει: **θεμελίωση/άσκηση/υποστήριξη
 * νομικών αξιώσεων** (ΓΚΠΔ άρθρο 17 §3(ε) · ADR-834 §5 Β (β) ③).
 *
 * 🔑 **ΤΟ ΚΛΕΙΔΙ ΕΙΝΑΙ ΤΟ ID ΤΟΥ ΜΗΝΥΜΑΤΟΣ** — ένα προς ένα, ντετερμινιστικά. Καμία
 * νέα ταυτότητα: μια ανάκληση **δεν είναι** δικό της αντικείμενο, είναι το **γεγονός**
 * που συνέβη σε ένα συγκεκριμένο μήνυμα (XEP-0424: η ανάκληση **αναφέρεται** στο
 * μήνυμα, δεν το μεταλλάσσει).
 */
export interface NetworkMessageRetraction {
  /** = το id του μηνύματος. */
  readonly id: string;
  readonly threadId: string;
  /** Το θέμα του νήματος — **γιατί** κρατάμε: τεκμήριο πράξης ή προσωπική σχέση. */
  readonly threadKind: NetworkThreadKind;
  readonly senderUid: string;
  /** Ο άνθρωπος που ανακάλεσε. **Πάντα** ο αποστολέας (XEP-0424 business rule). */
  readonly retractedBy: string;
  /** 🔒 Το κείμενο **όπως στάλθηκε**. Ο μόνος τόπος όπου επιβιώνει. */
  readonly originalText: string;
  readonly originalCreatedAt: string;
  readonly retractedAt: string;
  /** Είχε διαβαστεί; Το ίδιο γεγονός με το `readBeforeRetraction`, **γραμμένο δύο φορές επίτηδες**. */
  readonly readBeforeRetraction: boolean;
}

/** `network_threads/{id}/audience/{uid}` — **η** απάντηση στο «ποιος διαβάζει;», με ιστορικό. */
export interface NetworkAudienceEntry {
  readonly uid: string;
  readonly side: NetworkAudienceSide;
  readonly role: NetworkAudienceRole;
  readonly reason: NetworkAudienceReason;
  readonly addedBy: string;
  readonly since: string;
  /** `null` = διαβάζει **τώρα**. Η έξοδος **σφραγίζεται**, δεν σβήνεται. */
  readonly until: string | null;
  readonly lastReadAt: string | null;
  readonly muted: boolean;
  /**
   * 🔔 **«ΑΚΟΛΟΥΘΩ»** (ADR-867 Β7 · §8 #10) — opt-in ειδοποιήσεων για **συνεργάτη**: ειδοποιείται για
   * κάθε νέο εισερχόμενο **σαν** κύριο πρόσωπο, όχι μόνο ως αναπληρωτής (HubSpot «Follow a record»).
   *
   * ⚠️ **Δεν αφορά τα κύρια πρόσωπα** (`PRIMARY_NOTIFY_ROLES`): εκείνα ειδοποιούνται **πάντα** (Β6)·
   * όποιος θέλει ησυχία έχει τη **σίγαση**, που νικά το follow. Επιβιώνει αλλαγής ρόλου και επιστροφής,
   * όπως το `muted` — είναι επιλογή **του ανθρώπου**, όχι της ομάδας.
   */
  readonly following: boolean;
  /**
   * 🔑 **ΠΟΤΕ ΚΙΝΗΘΗΚΕ ΤΟ ΝΗΜΑ — ΑΝΤΙΓΡΑΜΜΕΝΟ ΕΔΩ ΕΠΙΤΗΔΕΣ** (fan-out on write, ADR-867 Β5).
   *
   * Ο κατάλογος νημάτων ενός ανθρώπου είναι **ένα** collection group query πάνω στις δικές
   * του ζωντανές γραμμές, **ταξινομημένο εδώ**, με όριο και δρομέα σελίδας. Χωρίς αυτό το
   * πεδίο η ταξινόμηση θα ζούσε στο **νήμα** — δηλαδή «διάβασε ΟΛΕΣ τις γραμμές μου, μετά
   * ΟΛΑ τα νήματα, και ταξινόμησε στη μνήμη»: αφράγκτο κόστος και καμία σελιδοποίηση.
   *
   * = `lastMessageAt ?? createdAt` του νήματος. **Ποτέ `null`**: ένα νήμα που μόλις γεννήθηκε
   * είναι **νέα** συνομιλία και πρέπει να ανεβαίνει ψηλά, όχι να βουλιάζει κάτω από τα `null`.
   * ⚠️ Γράφεται **μόνο** από τον `thread-writer.ts` (CHECK 3.89 Κ3): στη γέννηση/είσοδο από την
   * προβολή, σε κάθε μήνυμα από το `writeThreadActivity`, στην **ίδια** συναλλαγή.
   */
  readonly threadActivityAt: string;
}

/** `network_act_teams/{nteam_*}` — **το SSoT** της ομάδας· το ακροατήριο είναι προβολή του (§4.3). */
export interface NetworkActTeam {
  readonly id: string;
  readonly actKind: NetworkActKind;
  readonly actSeed: string;
  readonly hostCompanyId: string;
  readonly responsibleUid: string;
  /** **Περιλαμβάνει** τον υπεύθυνο — μία λίστα, όχι δύο που πρέπει να συμφωνούν. */
  readonly memberUids: readonly string[];
  readonly version: number;
}
