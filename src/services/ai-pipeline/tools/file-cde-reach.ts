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

import { COLLECTIONS } from '@/config/firestore-collections';
import { fileReachesAudience, type EvidenceAudience } from '@/services/conveyance/conveyance-evidence.server';
import type { AgenticContext } from './executor-shared-types';

type Viewer = Pick<AgenticContext, 'isAdmin'>;

/** Για ποιον διαβάζει το εργαλείο. */
export function evidenceAudienceOf(viewer: Viewer): EvidenceAudience {
  return viewer.isAdmin ? 'host' : 'client';
}

/** Φτάνει αυτό το αρχείο στον θεατή; */
export function fileReachesViewer(data: Record<string, unknown>, viewer: Viewer): boolean {
  return fileReachesAudience(data, evidenceAudienceOf(viewer));
}

/**
 * Πρέπει να κριθεί **κάθε εγγραφή** χωριστά; Τότε ένα `count()` δεν αρκεί: μετρά και ό,τι δεν φτάνει στον θεατή,
 * δηλαδή επιβεβαιώνει την ύπαρξή του.
 */
export function reachIsPerRecord(collection: string, viewer: Viewer): boolean {
  return collection === COLLECTIONS.FILES && !viewer.isAdmin;
}

/** Ο φρουρός των γενικών αναγνωστών: οποιαδήποτε συλλογή, κρίνει μόνο τα αρχεία. */
export function recordReachesViewer(collection: string, data: Record<string, unknown>, viewer: Viewer): boolean {
  return !reachIsPerRecord(collection, viewer) || fileReachesViewer(data, viewer);
}
