/**
 * @fileoverview **ΤΟ ΣΧΗΜΑ ΚΑΛΩΔΙΟΥ ΤΟΥ ΚΤΙΡΙΟΥ** — γραμμένο μία φορά, για τις δύο άκρες.
 * @related ADR-777 §14.5 · ADR-167 · ADR-233 §3.4 · app/api/buildings/building-update.handler.ts
 * @module types/building/mutation-payloads
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ — ΤΟ ΒΡΗΚΕ Η ΠΥΛΗ, ΟΧΙ Η ΠΡΟΘΕΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το σχήμα του αιτήματος `PATCH /api/buildings` ήταν γραμμένο **δύο φορές** — μία στον
 * πελάτη (`components/building-management/building-services.ts`) και μία στον
 * διακομιστή (`app/api/buildings/building-update.handler.ts`) — και οι δύο **είχαν ήδη
 * αποκλίνει**: ο διακομιστής δήλωνε `addresses?: Record<string, unknown>[]` και
 * `category?: string`, ο πελάτης `ProjectAddress[]` και κλειστή ένωση.
 *
 * Δεν το είδε άνθρωπος· το είδε το **CHECK 3.28** τη στιγμή που ένα νέο πεδίο
 * (`placeRef`, ADR-777 Β3) γράφτηκε και στα δύο. Δηλαδή ο κλώνος **δούλευε ως κλώνος**:
 * κάθε προσθήκη έπρεπε να θυμηθεί δύο τόπους, και η απόκλιση ήταν σιωπηλή.
 *
 * 🔑 **Καμία οδηγία `'use client'` / `server-only` εδώ, επίτηδες**: το αρχείο είναι
 * **μόνο τύποι**, άρα σβήνεται στη μεταγλώττιση και μπορεί να το εισάγουν και οι δύο
 * πλευρές χωρίς να μεταφέρουν κώδικα η μία στην άλλη.
 */

import type { ProjectAddress } from '@/types/project/addresses';
import type { PlaceRef } from '@/types/geo/public-place';

/**
 * **Τι επιτρέπεται να αλλάξει σε ένα κτίριο.**
 *
 * ⚠️ Το `companyId` **δεν είναι εδώ και δεν πρόκειται**: είναι το πεδίο μισθωτή και
 * είναι **αμετάβλητο** (ο διακομιστής το φιλτράρει ρητά ως `IMMUTABLE_FIELDS`). Η
 * συσχέτιση με εταιρεία-επαφή εκφράζεται με `linkedCompanyId`.
 */
export interface BuildingUpdatePayload {
  /** ADR-233 §3.4: locked building identifier (e.g. "Κτήριο Α") */
  code?: string;
  name?: string;
  description?: string;
  totalArea?: number;
  builtArea?: number;
  floors?: number;
  units?: number;
  totalValue?: number;
  startDate?: string;
  completionDate?: string;
  /** 🏢 LEGACY: μονή διεύθυνση — διατηρείται για μετανάστευση (ADR-167). */
  address?: string;
  city?: string;
  status?: string;
  /** 🏢 ENTERPRISE: Link building to project */
  projectId?: string | null;
  /** 🏢 ENTERPRISE: Company association (contact ID) — ΟΧΙ το πεδίο μισθωτή */
  linkedCompanyId?: string | null;
  linkedCompanyName?: string | null;
  /** 🏢 ENTERPRISE: Legacy company display name */
  company?: string | null;
  /** 🏢 ENTERPRISE: Multi-address support (ADR-167) */
  addresses?: ProjectAddress[];
  category?: 'mixed' | 'residential' | 'commercial' | 'industrial';
  /**
   * **ADR-777 §14.5** — ο δεσμός προς το **κοινό** κτίριο (επίπεδο Α).
   *
   * `null` **λύνει** τον δεσμό· `undefined` τον αφήνει άθικτο. Ο διακομιστής επαληθεύει
   * ότι ο τόπος **υπάρχει** πριν τον γράψει (**422** αν δεν υπάρχει · **503** αν δεν
   * μάθαμε), ποτέ σιωπηλή αποδοχή — δες `assertPlaceRefResolvable`.
   */
  placeRef?: PlaceRef | null;
  /** ADR-396 P8: κλιματική ζώνη ΚΕΝΑΚ (ΤΟΤΕΕ 20701-3) — έλεγχος U_max θερμοπρόσοψης. */
  climateZone?: 'A' | 'B' | 'C' | 'D';
  /** ADR-451 — building has a foundation datum below the lowest storey (default true). */
  hasFoundation?: boolean;
  /** ADR-451 — METRES — foundation depth below the lowest storey FFL. */
  foundationDepth?: number;
  /** ADR-489 §6.2 — `foundationDepth` παράγεται δυναμικά (Auto, default true) ή χειροκίνητη υπέρβαση. */
  foundationDepthAuto?: boolean;
  /**
   * ADR-713 — METRES — πόσο κάτω από το FFL του χαμηλότερου ορόφου είναι η στάθμη
   * **τελειωμένου εδάφους** (≥0, default 0). Όριο ΟΨΗΣ: πάνω της επένδυση/σοβάς, κάτω της
   * στεγάνωση. **Διαφορετικό** από το `foundationDepth`, που είναι ογκομετρικό (ADR-712).
   */
  gradeDropBelowBase?: number;
  /** ADR-461 — building has a stair-penthouse special level above the top storey (default true when ≥1 storey). */
  hasStairPenthouse?: boolean;
  /** ADR-461 — METRES — stair-penthouse (απόληξη κλιμακοστασίου) storey height (default 2.40). */
  stairPenthouseHeight?: number;
  /**
   * ADR-456 — δομοστατικές ρυθμίσεις κτιρίου (κανονισμός + προεπιλ. κατηγορία
   * σκυροδέματος). Inline shape (όχι import από dxf-viewer subapp — dependency
   * direction)· ταυτίζεται με `StructuralSettings` στο subapp.
   */
  structuralSettings?: {
    codeId: 'eurocode' | 'greek-legacy';
    defaultConcreteGrade: string;
  };
}

/**
 * **Τι χρειάζεται ένα κτίριο για να γεννηθεί** — ό,τι μπορεί να αλλάξει, **συν** τα τρία
 * που δεν επιτρέπεται να λείπουν στη γέννηση.
 *
 * 🔑 **Εκφράζεται ΩΣ ΠΡΟΣ την ενημέρωση, όχι ξανά από την αρχή**: η προηγούμενη γραφή
 * αντέγραφε τα ίδια ~18 πεδία, οπότε κάθε νέο πεδίο έπρεπε να θυμηθεί **τρεις** τόπους.
 * Έτσι το «τι είναι κτίριο» λέγεται **μία** φορά, και η γέννηση προσθέτει μόνο **τη
 * διαφορά της**: ταυτότητα κώδικα, όνομα, και ο μισθωτής στον οποίο ανήκει.
 *
 * ⚠️ Το `companyId` είναι **υποχρεωτικό εδώ και μόνο εδώ**: τίθεται **μία φορά**, στη
 * γέννηση, και μετά είναι αμετάβλητο.
 */
export type BuildingCreatePayload = BuildingUpdatePayload & {
  code: string;
  name: string;
  companyId: string;
};
