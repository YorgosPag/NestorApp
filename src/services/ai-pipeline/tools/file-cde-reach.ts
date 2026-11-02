/**
 * Ποια αρχεία φτάνουν στον θεατή του πράκτορα — η εμβέλεια CDE στα εργαλεία (ADR-901 Φ2 · ADR-862 §5.4.1)
 *
 * Το ακροατήριο **παράγεται** από την ταυτότητα, ποτέ από το μοντέλο: μόνο το `isAdmin` είναι επαληθευμένη
 * εσωτερική ταυτότητα (`adminCommandMeta`). Όλοι οι άλλοι είναι εξωτερικοί ⇒ `client`, ακόμη κι αν το
 * `contact_links` τους λέει «μηχανικός»: ο ρόλος επαφής δεν είναι συμμετοχή CDE και δεν ανεβάζει εμβέλεια.
 *
 * Η κρίση είναι του **ΕΝΟΣ** κριτή ({@link fileReachesAudience}). Τα `pre-cde` φτάνουν: το `cdeState` το γράφουν
 * μόνο οι πράξεις του `container-transitions`, άρα ένα ανέβασμα του ίδιου του πελάτη δεν γεννιέται WIP.
 *
 * @module services/ai-pipeline/tools/file-cde-reach
 * @see services/conveyance/conveyance-evidence.server — ο ίδιος κριτής στα τεκμήρια της υπόθεσης
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { fileReachesAudience, type EvidenceAudience } from '@/services/conveyance/conveyance-evidence.server';
import type { AgenticContext } from './executor-shared-types';

type Viewer = Pick<AgenticContext, 'isAdmin'>;

/**
 * Κανάλια όπου ο αποστολέας είναι επαληθευμένος από την πλατφόρμα. **Όχι** το email: το `From:` πλαστογραφείται,
 * και τα συνημμένα του τρέχοντος μηνύματος καλύπτονται ούτως ή άλλως από το `ctx.attachments`.
 */
const VERIFIED_SENDER_SOURCES: readonly string[] = ['telegram', 'whatsapp'];

/** Για ποιον διαβάζει το εργαλείο. */
export function evidenceAudienceOf(viewer: Viewer): EvidenceAudience {
  return viewer.isAdmin ? 'host' : 'client';
}

/** Φτάνει αυτό το αρχείο στον θεατή; */
function fileReachesViewer(data: Record<string, unknown>, viewer: Viewer): boolean {
  return fileReachesAudience(data, evidenceAudienceOf(viewer));
}

/**
 * Το ανέβασε ο ίδιος ο αποστολέας; Στο τρέχον μήνυμα το εγγυάται ο διακομιστής (`ctx.attachments`)· σε επόμενο μήνυμα,
 * η πηγή του εισερχόμενου. Τα εισερχόμενα ανήκουν στην εταιρεία (`entityType: company`), άρα χωρίς αυτό ο πελάτης
 * θα έχανε τα δικά του έγγραφα.
 */
function isOwnUpload(fileId: string, data: Record<string, unknown>, ctx: AgenticContext): boolean {
  if (ctx.attachments?.some((attachment) => attachment.fileRecordId === fileId)) return true;
  const source = data.source as { type?: unknown; fromUserId?: unknown } | undefined;
  if (typeof source?.type !== 'string' || typeof source.fromUserId !== 'string' || source.fromUserId === '') return false;
  return VERIFIED_SENDER_SOURCES.includes(source.type) && `${source.type}_${source.fromUserId}` === ctx.channelSenderId;
}

/** Ανήκει στα ακίνητα/έργα της επαφής; */
function isLinkedFile(data: Record<string, unknown>, contact: AgenticContext['contactMeta']): boolean {
  if (!contact) return false;
  const entityType = String(data.entityType ?? '');
  if (entityType === ENTITY_TYPES.PROPERTY) return (contact.linkedPropertyIds ?? []).includes(String(data.entityId ?? ''));
  const projectId = String(data.projectId ?? '');
  return projectId !== '' && (contact.projectRoles ?? []).some((role) => role.projectId === projectId);
}

/**
 * Η **ΜΙΑ** κρίση «βλέπει ο θεατής αυτό το αρχείο;»: δικό του **και** μέσα στην εμβέλειά του. Ανήκει στο ακίνητό του
 * ≠ φτάνει σε αυτόν: ένα WIP μηχανικού δεν φτάνει, ακόμη κι αν αφορά το σπίτι του.
 */
export function fileVisibleToViewer(fileId: string, data: Record<string, unknown>, ctx: AgenticContext): boolean {
  if (ctx.isAdmin) return true;
  return (isOwnUpload(fileId, data, ctx) || isLinkedFile(data, ctx.contactMeta)) && fileReachesViewer(data, ctx);
}

/**
 * Πρέπει να κριθεί **κάθε εγγραφή** χωριστά; Τότε ένα `count()` δεν αρκεί: μετρά και ό,τι δεν φτάνει στον θεατή,
 * δηλαδή επιβεβαιώνει την ύπαρξή του.
 */
export function reachIsPerRecord(collection: string, viewer: Viewer): boolean {
  return collection === COLLECTIONS.FILES && !viewer.isAdmin;
}

/** Ο φρουρός των γενικών αναγνωστών: οποιαδήποτε συλλογή, κρίνει μόνο τα αρχεία. */
export function recordVisibleToViewer(collection: string, id: string, data: Record<string, unknown>, ctx: AgenticContext): boolean {
  return !reachIsPerRecord(collection, ctx) || fileVisibleToViewer(id, data, ctx);
}
