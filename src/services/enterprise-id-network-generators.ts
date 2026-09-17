/**
 * ENTERPRISE ID GENERATION — ΟΙ ΤΑΥΤΟΤΗΤΕΣ ΤΟΥ ΔΙΚΤΥΟΥ ΣΥΝΕΡΓΑΤΩΝ (ADR-867)
 *
 * Composition model — abstract base chain, not a mixin:
 *
 *   AccessLifecycleIdGenerators  (ADR-853/660/844 — ένταξη σε χώρο)
 *     ↑ extends
 *   NetworkIdGenerators          (this file — νήματα ανάμεσα σε χώρους)
 *     ↑ extends
 *   CompositeKeyIdGenerators     (composite keys + pure readers)
 *
 * 🔑 **Ξεχωριστό αρχείο, όχι προσθήκη στο `access-generators`**: η κεφαλίδα εκείνου
 * δηλώνει ότι ενώνει **μία** διαδρομή (ένταξη σε χώρο). Ένα νήμα ανάμεσα σε χώρους δεν είναι
 * σταθμός εκείνης της διαδρομής — θα έκανε την κεφαλίδα να λέει ψέματα.
 *
 * 🔴 **ΟΛΕΣ ΔΙΑΚΟΜΙΣΤΗΣ ΜΟΝΟ**: οι συλλογές του δικτύου είναι `write: false` στον πελάτη
 * (ADR-867 §4.1) — ταυτότητα από τον πελάτη θα ήταν ταυτότητα χωρίς κριτή ακμής.
 *
 * ⚠️ **Διαχωριστής σπόρου `:`**: κανένα από τα μέρη (Firebase uid · `ownp_*` · id εταιρείας)
 * δεν περιέχει `:`, άρα ο σπόρος δεν είναι αμφίσημος — και ο κατακερματισμός κρύβει τα μέρη
 * από το κλειδί του εγγράφου.
 *
 * @module services/enterprise-id-network-generators
 * @version 1.0.0
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { AccessLifecycleIdGenerators } from './enterprise-id-access-generators';

const P = ENTERPRISE_ID_PREFIXES;

export abstract class NetworkIdGenerators extends AccessLifecycleIdGenerators {
  // `mintDeterministicV4Id` + `generateId` κληρονομούνται ως protected abstract — η μηχανή μένει μία.

  /**
   * ADR-867 §4.1 — **το νήμα μιας ΠΡΑΞΗΣ**, ένα ανά πράξη.
   * @param actSeed — η ταυτότητα της πράξης όπως τη γράφει το μητρώο πηγών ακμής.
   */
  generateDeterministicNetworkActThreadId(actSeed: string): string {
    return this.mintDeterministicV4Id(P.NETWORK_THREAD, `act:${actSeed}`);
  }

  /**
   * ADR-867 §4.1 — **το νήμα ΣΧΕΣΗΣ**, ένα ανά ζεύγος προσώπων.
   * 🔑 Η σειρά ταξινομείται **εδώ**: Α↔Β και Β↔Α είναι **το ίδιο** νήμα, όποιος κι αν καλέσει.
   */
  generateDeterministicNetworkRelationshipThreadId(uidA: string, uidB: string): string {
    const [first, second] = [uidA, uidB].sort();
    return this.mintDeterministicV4Id(P.NETWORK_THREAD, `rel:${first}:${second}`);
  }

  /** ADR-867 §4.3 — **η ομάδα της πράξης**, μία ανά πράξη (ίδιος σπόρος με το νήμα της). */
  generateDeterministicNetworkActTeamId(actSeed: string): string {
    return this.mintDeterministicV4Id(P.NETWORK_ACT_TEAM, actSeed);
  }

  /** ADR-867 §4.4 — **φραγή**, μία ανά (φράσσων, φραγμένος). Κατευθυνόμενη: **δεν** ταξινομείται. */
  generateDeterministicNetworkBlockId(blockerUid: string, blockedUid: string): string {
    return this.mintDeterministicV4Id(P.NETWORK_BLOCK, `${blockerUid}:${blockedUid}`);
  }

  /** ADR-867 §4.4 — **δήλωση απουσίας**, μία ανά πρόσωπο. */
  generateDeterministicNetworkAwayId(uid: string): string {
    return this.mintDeterministicV4Id(P.NETWORK_AWAY, uid);
  }

  /** ADR-867 §4.1 — **μήνυμα** νήματος. Τυχαίο: δύο ίδια κείμενα είναι δύο μηνύματα. */
  generateNetworkMessageId(): string { return this.generateId(P.NETWORK_MESSAGE).id; }
}
