/**
 * ADR-651 Φάση Θ (must-have #1) — **Master πρότυπο & κληρονομιά**, ως καθαρές συναρτήσεις.
 *
 * ## Το μοντέλο: αναφορά ή απόσπαση — ΠΟΤΕ μερική κληρονομιά
 *
 * Έτσι το κάνουν οι ηγέτες (ArchiCAD *Master Layout*, Revit *title-block family*):
 *
 *  1. **Αναφορά (η κανονική περίπτωση)** — τα φύλλα **δείχνουν** στο master (ίδιο έγγραφο,
 *     μηδέν αντίγραφο). Αλλάζει το master ⇒ αλλάζουν **όλα** όσα το δείχνουν, **αυτόματα**.
 *     Αυτό ΔΕΝ χρειάζεται κώδικα κληρονομιάς: το πετυχαίνει η **βιβλιοθήκη** (ένα doc,
 *     πολλοί καταναλωτές) — γι' αυτό η βιβλιοθήκη γραφείου (#5) είναι το θεμέλιο του #1.
 *  2. **Απόσπαση (η εξαίρεση)** — ο χρήστης θέλει παραλλαγή σε ΕΝΑ έργο. Παίρνει πλήρες
 *     αντίγραφο που κρατά την **προέλευσή** του (`parentId`) και τη **στιγμή** του
 *     συγχρονισμού (`parentSyncedAt`). Από κει και πέρα είναι ανεξάρτητο: **καμία** σιωπηλή
 *     αλλαγή δεν το αγγίζει. Όταν ο γονιός αλλάξει, το UI **προτείνει** — ο χρήστης τραβά.
 *
 * ## Γιατί ΟΧΙ ζωντανή σύνθεση (Figma component overrides)
 *
 * Θα απαιτούσε **σταθερά ids ανά κόμβο** του AST. Το `DxfTextNode` δεν έχει: τα overrides θα
 * κλειδώνονταν σε **θέσεις** (π.χ. «η 2η παράγραφος»), και μόλις ο γονιός αναδιαταχθεί το
 * override θα προσγειωνόταν σε **λάθος γραμμή** — σιωπηλά, μέσα σε σχέδιο που κατατίθεται σε
 * πολεοδομία. Κανένα CAD δεν το κάνει έτσι, και εμείς ούτε.
 *
 * ## Γιατί δεν υπάρχει κίνδυνος κύκλου / άπειρου βρόχου
 *
 * Η κληρονομιά **δεν λύνεται αναδρομικά**: ένα αποσπασμένο πρότυπο κουβαλά ήδη ΟΛΟ του το
 * περιεχόμενο, οπότε καμία ανάγνωση δεν ανεβαίνει ποτέ την αλυσίδα γονέων. Ο μόνος
 * χειρισμός γονιού είναι **βάθους 1** ({@link findParentTemplate}) και ρητός (pull). Ένας
 * κύκλος `A→B→A` θα ήταν απλώς λανθασμένη *προέλευση*, ποτέ κρέμασμα — και τον απαγορεύουμε
 * κιόλας ({@link canDetachFrom}).
 *
 * @see ./text-template-library.service.ts — ο καταναλωτής (γράφει μέσω των API routes)
 */

import type {
  TextTemplate,
  TextTemplateLocale,
  TextTemplateTitleBlockMeta,
  WritableTextTemplateScope,
} from './template.types';

/** Πότε (ms) ενημερώθηκε τελευταία φορά ένα πρότυπο· `0` αν δεν το ξέρουμε (built-in). */
export function templateUpdatedAtMs(template: TextTemplate): number {
  return template.updatedAt?.getTime() ?? 0;
}

/** Ο **άμεσος** γονιός ενός προτύπου μέσα σε μια λίστα — βάθος 1, καμία αναδρομή. */
export function findParentTemplate(
  child: TextTemplate,
  candidates: readonly TextTemplate[],
): TextTemplate | null {
  if (!child.parentId) return null;
  return candidates.find((candidate) => candidate.id === child.parentId) ?? null;
}

/**
 * «Ο γονιός άλλαξε μετά τον τελευταίο μου συγχρονισμό;» — η **μόνη** σωστή ερώτηση.
 *
 * ⚠️ ΟΧΙ `parent.updatedAt > child.updatedAt`: αυτό θα έσβηνε την ειδοποίηση μόλις ο χρήστης
 * πείραζε οτιδήποτε στο παιδί, και η αλλαγή του γραφείου θα χανόταν **σιωπηλά**.
 */
export function isParentUpdateAvailable(child: TextTemplate, parent: TextTemplate): boolean {
  if (child.parentId !== parent.id) return false;
  const parentUpdatedAt = templateUpdatedAtMs(parent);
  if (parentUpdatedAt === 0) return false; // built-in γονιός: δεν αλλάζει ποτέ.
  return parentUpdatedAt > (child.parentSyncedAt ?? 0);
}

/**
 * Επιτρέπεται να αποσπαστεί παραλλαγή **από** αυτόν τον γονιό; Απαγορεύεται μόνο η
 * αυτο-γονεϊκότητα (`A → A`), που θα ήταν ανοησία στην προέλευση. Βαθύτεροι κύκλοι δεν
 * μπορούν να προκύψουν: κάθε απόσπαση γεννά **νέο** έγγραφο, οπότε ο γράφος γονέων είναι
 * εξ ορισμού δέντρο (ακμές μόνο προς ήδη υπάρχοντα έγγραφα).
 */
export function canDetachFrom(parent: TextTemplate, childId?: string): boolean {
  return !childId || parent.id !== childId;
}

// ─── Payload builders (τι ακριβώς γράφεται) ──────────────────────────────────

/**
 * ADR-651 Φάση Κ — ό,τι η παραλλαγή **δεν** κληρονομεί αυτούσιο από τον γονιό.
 *
 * Η γλωσσική παραλλαγή (§8 #7) είναι απόσπαση με **μεταφρασμένο** περιεχόμενο: ίδια δομή, ίδια
 * γεωμετρία, άλλες λέξεις. Το `template-inheritance` **δεν ξέρει από πινακίδες ή γλώσσες** — ο
 * καλών δίνει έτοιμο το περιεχόμενο, εδώ απλώς σφραγίζεται η προέλευση (μία μηχανή απόσπασης
 * για όλες τις παραλλαγές — N.18, καμία δεύτερη διαδρομή εγγραφής).
 */
export interface TemplateVariantOverrides {
  /** Το περιεχόμενο της παραλλαγής· απόν ⇒ αυτούσιο αντίγραφο του γονιού. */
  readonly content?: TextTemplate['content'];
  /** Η γλώσσα της παραλλαγής — χωρίς αυτήν το pull θα ξανα-περνούσε τον γονιό από πάνω της. */
  readonly locale?: TextTemplateLocale;
  /** Το κελί σφραγίδας της παραλλαγής (το κείμενό του είναι κι αυτό μεταφράσιμο). */
  readonly titleBlock?: TextTemplateTitleBlockMeta;
}

export interface DetachOptions extends TemplateVariantOverrides {
  /** Πού θα ζήσει η παραλλαγή (τυπικά `project`: αφορά ΜΟΝΟ αυτό το έργο). */
  readonly scope: WritableTextTemplateScope;
  readonly projectId?: string;
  /** Το όνομα της παραλλαγής — το δίνει το UI (i18n string, N.11: όχι σταθερό εδώ). */
  readonly name: string;
}

export interface DetachPayload {
  readonly name: string;
  readonly category: TextTemplate['category'];
  readonly content: TextTemplate['content'];
  readonly locale?: TextTemplateLocale;
  readonly scope: WritableTextTemplateScope;
  readonly projectId?: string;
  readonly parentId: string;
  readonly parentSyncedAt: number;
  readonly titleBlock?: TextTemplateTitleBlockMeta;
}

/**
 * Η **απόσπαση**: πλήρες αντίγραφο του γονιού (ή η παραλλαγή που έδωσε ο καλών) + η προέλευσή
 * του. Σφραγίζει το `parentSyncedAt` στην **τρέχουσα** έκδοση του γονιού ⇒ το παιδί γεννιέται
 * «ενήμερο» και δεν δείχνει ψεύτικη ειδοποίηση ενημέρωσης την ίδια στιγμή που φτιάχτηκε
 * (N.7.2 #3: idempotent, μηδέν θόρυβος).
 */
export function buildDetachPayload(parent: TextTemplate, options: DetachOptions): DetachPayload {
  const titleBlock = options.titleBlock ?? parent.titleBlock;
  return {
    name: options.name,
    category: parent.category,
    content: options.content ?? parent.content,
    ...(options.locale ? { locale: options.locale } : {}),
    scope: options.scope,
    ...(options.projectId ? { projectId: options.projectId } : {}),
    parentId: parent.id,
    parentSyncedAt: templateUpdatedAtMs(parent),
    ...(titleBlock ? { titleBlock } : {}),
  };
}

export interface PullPayload {
  readonly content: TextTemplate['content'];
  readonly parentSyncedAt: number;
  readonly titleBlock?: TextTemplateTitleBlockMeta;
}

/**
 * Το ρητό **«Ενημέρωση από τον γονιό»** (pull): το παιδί παίρνει το περιεχόμενο του γονιού και
 * ξανασφραγίζει τη στιγμή συγχρονισμού. Το **όνομα**, το **scope** και η **γλώσσα** του παιδιού
 * ΔΕΝ αγγίζονται — είναι δικά του (το έργο δεν χάνει την ταυτότητα της παραλλαγής του).
 *
 * ⚠️ ADR-651 Φάση Κ — **γλωσσική** παραλλαγή: αντιγραφή του γονιού αυτούσια θα έγραφε ελληνικά
 * πάνω στην αγγλική πινακίδα και θα **κατέστρεφε τη μετάφραση**. Γι' αυτό ο καλών περνά εδώ το
 * **ξανα-μεταφρασμένο** περιεχόμενο (`overrides.content`): το παιδί παίρνει τις αλλαγές του
 * γονιού **στη δική του γλώσσα**. Χωρίς override ⇒ η κλασική αυτούσια αντιγραφή.
 */
export function buildPullPayload(
  parent: TextTemplate,
  overrides: TemplateVariantOverrides = {},
): PullPayload {
  const titleBlock = overrides.titleBlock ?? parent.titleBlock;
  return {
    content: overrides.content ?? parent.content,
    parentSyncedAt: templateUpdatedAtMs(parent),
    ...(titleBlock ? { titleBlock } : {}),
  };
}
