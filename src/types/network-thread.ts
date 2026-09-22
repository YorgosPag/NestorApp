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
 * 🔑 **Η ΔΕΥΤΕΡΗ ΙΔΙΟΤΗΤΑ ΤΟΥ ΑΝΤΙΣΥΜΒΑΛΛΟΜΕΝΟΥ** (ADR-867 Β9) — ο ιδιοκτήτης που είναι **και** μέλος
 * της ομάδας του γραφείου (μεσίτης που καταχωρεί το δικό του ακίνητο μέσω του γραφείου του).
 * Μόνο οι ρόλοι της πλευράς `host`: ένας αντισυμβαλλόμενος δεν μπορεί να είναι «και αντισυμβαλλόμενος».
 */
export const NETWORK_HOST_ROLES = ['responsible', 'collaborator'] as const;
export type NetworkHostRole = (typeof NETWORK_HOST_ROLES)[number];

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
  'target-cannot-serve',
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
  /** Πότε **κινήθηκε** το νήμα — ταξινόμηση. Η ανάκληση **δεν** το αλλάζει: η ταφόπλακα είναι κίνηση. */
  readonly lastMessageAt: string | null;
  /**
   * Πότε γράφτηκε το τελευταίο μήνυμα που **ζει** (όχι ανακλημένο) — η βάση του «αδιάβαστο» (ADR-867 Ε10 ·
   * `lib/network-messaging/thread-liveness.ts`). `undefined` ⇒ νήμα **προ-Ε10**: ισχύει το `lastMessageAt`.
   * Γράφεται **μόνο** στην αποστολή (= τώρα) και στην ανάκληση (επανυπολογισμός, στην ίδια συναλλαγή).
   */
  readonly lastLiveMessageAt?: string | null;
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

/** Μια θητεία που **έληξε** — με τον ρόλο και τον λόγο που ίσχυαν **τότε**, όχι τους σημερινούς. */
export interface NetworkAudienceTenure {
  readonly role: NetworkAudienceRole;
  readonly reason: NetworkAudienceReason;
  readonly since: string;
  readonly until: string;
}

/**
 * **Οι προηγούμενες θητείες μιας θέσης** (ADR-867 Β9(β) εύρημα Ε8) — χρονολογικά, η παλαιότερη πρώτη.
 *
 * 🔑 Η επανένταξη ξανανοίγει την **ίδια** γραμμή (κλειδί = `uid`) με νέο `since`· χωρίς αυτό το πεδίο η
 * παλιά θητεία **χανόταν** από το «Διάβαζαν παλαιότερα» — και ο άλλος δικαιούται να ξέρει ότι κάποιος
 * **είχε** δει ό,τι γράφτηκε ως τότε. Φραγμένο ({@link NETWORK_AUDIENCE_TENURE_CAP}): ό,τι πέφτει έξω
 * **μετριέται** (`omitted`), ποτέ δεν σβήνεται σιωπηλά. Γράφεται **μόνο** από την προβολή (`thread-audience.ts`).
 */
export interface NetworkAudienceTenureHistory {
  readonly earlier: readonly NetworkAudienceTenure[];
  /** Πόσες ακόμη παλαιότερες θητείες υπήρξαν και δεν κρατιούνται πια ονομαστικά. */
  readonly omitted: number;
}

/** Όριο θητειών ανά γραμμή — το έγγραφο μένει μικρό (1 MiB Firestore) και η οθόνη διαβάσιμη. */
export const NETWORK_AUDIENCE_TENURE_CAP = 20;

/** **Καμία** προηγούμενη θητεία — η μία τιμή για γέννηση, παλιές γραμμές και fixtures. */
export const NO_EARLIER_TENURES: NetworkAudienceTenureHistory = Object.freeze({ earlier: Object.freeze([]), omitted: 0 });

/**
 * `network_threads/{id}/network_audience/{uid}` — **η** απάντηση στο «ποιος διαβάζει;», με ιστορικό.
 *
 * 🔒 **ΜΟΝΟ ΔΗΜΟΣΙΑ ΠΕΔΙΑ** (ADR-867 Β9(β) Ε9): αυτό το έγγραφο το διαβάζει **όλο το ακροατήριο**, και
 * των δύο πλευρών, και η Firestore **δεν κρύβει πεδία** («You either retrieve the full document, or you
 * retrieve nothing»). Ό,τι είναι επιλογή ή ίχνος **του ανθρώπου** ζει στο {@link NetworkAudiencePrivate}.
 * Κάθε πεδίο δηλώνεται σε **μία** από τις δύο λίστες ορατότητας — δες {@link NETWORK_AUDIENCE_FIELD_VISIBILITY}.
 */
export interface NetworkAudienceEntry {
  readonly uid: string;
  readonly side: NetworkAudienceSide;
  readonly role: NetworkAudienceRole;
  readonly reason: NetworkAudienceReason;
  readonly addedBy: string;
  readonly since: string;
  /** `null` = διαβάζει **τώρα**. Η έξοδος **σφραγίζεται**, δεν σβήνεται. */
  readonly until: string | null;
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
  /**
   * 🔑 **ΜΙΑ ΘΕΣΗ, ΔΥΟ ΙΔΙΟΤΗΤΕΣ** (ADR-867 Β9 · Figma «η υψηλότερη πρόσβαση από κάθε δρόμο» ·
   * NAR Άρθρο 4 «το ιδιοκτησιακό συμφέρον του μεσίτη δηλώνεται σε ΟΛΑ τα μέρη»).
   *
   * Ένας άνθρωπος έχει **μία** γραμμή (κλειδί = `uid`). Όταν ο αντισυμβαλλόμενος είναι **και** μέλος της
   * ομάδας, η γραμμή μένει `side: 'counterpart'` (ο εντολέας δεν υποβιβάζεται ποτέ) και **εδώ** γράφεται
   * ο ρόλος του στο γραφείο — ώστε η οθόνη να τον **δηλώνει** και στις δύο πλευρές, αντί η πλευρά του
   * γραφείου να φαίνεται άδεια. `null` ⇒ μία ιδιότητα. ⚠️ **Παράγεται** από την προβολή, ποτέ χειρόγραφα.
   */
  readonly alsoHostRole: NetworkHostRole | null;
  /** Οι θητείες **πριν** την τρέχουσα — δες {@link NetworkAudienceTenureHistory}. */
  readonly tenureHistory: NetworkAudienceTenureHistory;
}

/**
 * `network_threads/{id}/network_audience_private/{uid}` — **Η ΙΔΙΩΤΙΚΗ ΠΛΕΥΡΑ ΤΗΣ ΘΕΣΗΣ** (ADR-867 Β9(β) Ε9).
 *
 * 🌐 **Η πρακτική των μεγάλων**: η σίγαση στο Slack είναι προτίμηση του χρήστη που κανείς δεν βλέπει· στο
 * Gmail είναι ετικέτα **του δικού του** γραμματοκιβωτίου· το `last_read` του Slack επιστρέφεται **μόνο** για
 * όποιον ρωτά· και το Teams **δεν** δείχνει ποτέ ένδειξη ανάγνωσης προς άλλον οργανισμό. Ο αντισυμβαλλόμενος
 * ενός νήματος είναι **πάντα** άλλος οργανισμός ⇒ τίποτα από αυτά δεν περνά στην άλλη πλευρά.
 *
 * 🔑 **Χωριστό έγγραφο, όχι κρυφά πεδία** — το πρότυπο της ίδιας της Firebase (*Control access to specific
 * fields*: `employees/{id}` + `employees/{id}/private/finances`). Ο κανόνας δίνει ανάγνωση **μόνο** στον ίδιο.
 *
 * ⚠️ **Η απουσία εγγράφου είναι έγκυρη κατάσταση** = {@link NETWORK_AUDIENCE_PRIVATE_DEFAULTS} («δεν διάβασε
 * ποτέ, δεν σίγασε, δεν ακολουθεί»). Γράφεται **πρώτη φορά** όταν ο άνθρωπος κάνει κάτι — και επιβιώνει
 * έξοδο και επιστροφή, γιατί είναι δικό **του**, όχι της ομάδας.
 * ⛔ Γράφει **μόνο** ο `thread-writer.ts` (CHECK 3.89 Κ3).
 */
export interface NetworkAudiencePrivate {
  /** Ως πού έχει διαβάσει. 🔒 Ιδιωτικό: εκτεθειμένο, θα ήταν ένδειξη ανάγνωσης (§8 #4 την αρνείται). */
  readonly lastReadAt: string | null;
  /** Σίγαση — τα μηνύματα φτάνουν, το καμπανάκι όχι. «Η άλλη πλευρά δεν το μαθαίνει» (`muteHint`). */
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
}

/** Η θέση όπως τη βλέπει **ο διακομιστής**: δημόσια + ιδιωτική πλευρά. ⛔ Ποτέ σε απάντηση προς άλλον. */
export interface NetworkAudienceSeat extends NetworkAudienceEntry, NetworkAudiencePrivate {}

/** Ό,τι σημαίνει «δεν υπάρχει ακόμη ιδιωτικό έγγραφο». */
export const NETWORK_AUDIENCE_PRIVATE_DEFAULTS: NetworkAudiencePrivate = {
  lastReadAt: null,
  muted: false,
  following: false,
};

/**
 * 🏆 **ΤΟ ΜΗΤΡΩΟ ΟΡΑΤΟΤΗΤΑΣ ΤΗΣ ΘΕΣΗΣ** — «ποιος βλέπει αυτό το πεδίο;», απαντημένο για **κάθε** πεδίο.
 *
 * Το Ε9 δεν ήταν λάθος ενός πεδίου· ήταν ότι **κανείς δεν ρωτούσε**: τρία πεδία ιδιωτικής φύσης μπήκαν σε
 * έγγραφο που διαβάζει η άλλη πλευρά, σε τρεις διαφορετικές φάσεις (Β5, Β5, Β7). Εδώ η ερώτηση γίνεται
 * **υποχρεωτική**: νέο πεδίο σε οποιονδήποτε από τους δύο τύπους χωρίς γραμμή ⇒ ο μεταγλωττιστής αρνείται
 * (δες τους ελέγχους αμέσως κάτω). Οι λίστες **χρησιμοποιούνται** — από τον αναλυτή του ιδιωτικού εγγράφου,
 * τη μετανάστευση και τη σουίτα κανόνων — δεν είναι σχόλιο.
 */
export const NETWORK_AUDIENCE_FIELD_VISIBILITY = declareAudienceVisibility({
  /** Όλο το ακροατήριο, και των δύο πλευρών (ADR-834 (ε) 🏆 «ποιοι διαβάζουν και από πότε»). */
  audience: ['uid', 'side', 'role', 'reason', 'addedBy', 'since', 'until', 'threadActivityAt', 'alsoHostRole', 'tenureHistory'],
  /** Μόνο ο ίδιος (και ο διακομιστής). */
  self: ['lastReadAt', 'muted', 'following'],
});

/** Τα ιδιωτικά πεδία ως λίστα — ό,τι μετακινεί η μετανάστευση και ό,τι απαγορεύεται στο δημόσιο έγγραφο. */
export const NETWORK_AUDIENCE_PRIVATE_FIELDS = NETWORK_AUDIENCE_FIELD_VISIBILITY.self;

/** Τα δημόσια πεδία ως λίστα — ό,τι **μόνο** επιτρέπεται να γραφτεί στη γραμμή ακροατηρίου (`publicAudienceRow`). */
export const NETWORK_AUDIENCE_PUBLIC_FIELDS = NETWORK_AUDIENCE_FIELD_VISIBILITY.audience;

/** `{}` αν δεν λείπει τίποτα· αλλιώς ένα πεδίο που **ονομάζει** ό,τι λείπει στο μήνυμα του μεταγλωττιστή. */
type Undeclared<T, Declared extends PropertyKey, Label extends string> =
  [Exclude<keyof T, Declared>] extends [never] ? unknown : { readonly [K in Label]: Exclude<keyof T, Declared> };

/**
 * ⛔ Η δήλωση **αρνείται να μεταγλωττιστεί** αν πεδίο της θέσης δεν έχει πει **ποιος το βλέπει**, ή αν ένα
 * όνομα ζει **και στις δύο** πλευρές (αυτό ακριβώς ήταν το Ε9). Το σφάλμα ονομάζει το πεδίο.
 */
function declareAudienceVisibility<
  const A extends readonly (keyof NetworkAudienceEntry)[],
  const S extends readonly (keyof NetworkAudiencePrivate)[],
>(
  lists: { readonly audience: A; readonly self: S }
    & Undeclared<NetworkAudienceEntry, A[number], 'undeclaredAudienceField'>
    & Undeclared<NetworkAudiencePrivate, S[number], 'undeclaredSelfField'>
    & ([Extract<keyof NetworkAudienceEntry, keyof NetworkAudiencePrivate>] extends [never]
      ? unknown
      : { readonly fieldOnBothSides: Extract<keyof NetworkAudienceEntry, keyof NetworkAudiencePrivate> }),
): { readonly audience: A; readonly self: S } {
  return { audience: lists.audience, self: lists.self };
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
