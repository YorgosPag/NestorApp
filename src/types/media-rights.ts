/**
 * @fileoverview **ΤΑ ΔΗΛΩΜΕΝΑ ΔΙΚΑΙΩΜΑΤΑ ΕΝΟΣ ΜΕΣΟΥ** (φωτογραφία · πανόραμα · βίντεο) — ΕΝΑΣ τύπος.
 * @related ADR-884 Φ0.14 (Ε10) · ADR-866 §5.6.1 · IPTC Photo Metadata Standard
 * @module types/media-rights
 *
 * Τον εισάγουν **και** οι λήψεις της χωρικής περιήγησης (ADR-884) **και** τα μέσα του μεσίτη στον φάκελο
 * του ακινήτου (ADR-866 §5.6.1 Φ3) — **ένας** τύπος, όχι δύο. Τα ονόματα ακολουθούν το **IPTC** ώστε τα
 * πεδία να γράφονται και **μέσα** στο αρχείο κατά την εξαγωγή, χωρίς μετάφραση.
 */

import type { MediaLicensePurpose } from '@/constants/media-rights-vocabulary';

/** Ένα πρόσωπο των δικαιωμάτων — με λογαριασμό στην πλατφόρμα ή χωρίς (εξωτερικός φωτογράφος). */
export interface MediaParty {
  /** Όπως το δήλωσε άνθρωπος — IPTC `Creator` / `Licensor Name`. */
  readonly name: string;
  /** Ο λογαριασμός του, όταν υπάρχει — `null` για πρόσωπο εκτός πλατφόρμας. */
  readonly userId: string | null;
  /** IPTC `Licensor URL` — πού ζητά κανείς άδεια. */
  readonly url: string | null;
}

/** Πόσο κρατά η άδεια — ο διακριτής είναι το `kind` (βλ. `MEDIA_LICENSE_TERM_KINDS`). */
export type MediaLicenseTerm =
  | { readonly kind: 'mandate'; readonly mandateId: string }
  | { readonly kind: 'date'; readonly until: string }
  | { readonly kind: 'perpetual' };

export interface MediaLicense {
  readonly purpose: MediaLicensePurpose;
  readonly term: MediaLicenseTerm;
}

export interface MediaRights {
  /** IPTC `Creator` — ο δημιουργός, κάτοχος των πνευματικών δικαιωμάτων εξ ορισμού. */
  readonly creator: MediaParty;
  /** IPTC `Licensor` (0–3) — κενό ⇒ άδεια δίνει ο ίδιος ο δημιουργός. */
  readonly licensors: readonly MediaParty[];
  /** IPTC `Copyright Notice` — π.χ. «© 2026 Νίκος Παπαδόπουλος». */
  readonly copyrightNotice: string;
  /** IPTC `Web Statement of Rights` — URL των όρων, όταν υπάρχει. */
  readonly webStatementOfRights: string | null;
  readonly license: MediaLicense;
}
