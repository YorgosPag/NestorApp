'use client';
/**
 * @fileoverview **Ο ΟΙΚΙΣΜΟΣ ΣΥΜΠΛΗΡΩΝΕΤΑΙ ΜΟΝΟΣ ΤΟΥ** — δύο δρόμοι, μία ευθύνη.
 * @module components/shared/addresses/use-settlement-autofill
 * @related ADR-332 (ο επεξεργαστής διεύθυνσης) · ADR-332 D27 Ζ5 (η μνήμη της μηχανής)
 *
 * 🔑 **ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (N.7.1)**: το `AddressWithHierarchy.tsx` απαντά *«πώς
 * δείχνει και πώς επεξεργάζεται μια διεύθυνση;»*. Αυτό εδώ απαντά *«πώς βρίσκεται ο
 * οικισμός όταν ο άνθρωπος δεν τον έγραψε;»* — δεύτερη ευθύνη, καθαρά ασύγχρονη, με
 * **δικές της** παγίδες χρόνου. Η εξαγωγή έγινε όταν το component πέρασε τις 500
 * γραμμές· δεν άλλαξε **καμία** συμπεριφορά.
 *
 * ── ΔΥΟ ΔΡΟΜΟΙ, ΟΧΙ ΕΝΑΣ ──
 * 1. **Γεωκωδικοποίηση** (οδός + Τ.Κ. → πόλη): ο άνθρωπος πληκτρολογεί, εμείς ρωτάμε.
 * 2. **Ανάλυση ιεραρχίας** (όνομα → id + πλήρης διαδρομή): το όνομα ήρθε **από αλλού**
 *    (σύρσιμο πινέζας στον χάρτη) χωρίς id, και πρέπει να δέσει στα δικά μας δεδομένα.
 *
 * ⚠️ **ΚΑΙ ΟΙ ΔΥΟ ΜΟΝΟ ΓΙΑ ΕΛΛΗΝΙΚΗ ΔΙΕΥΘΥΝΣΗ**: η ελληνική διοικητική ιεραρχία είναι
 * κρυμμένη στις υπόλοιπες, οπότε το ερώτημα δεν έχει υποκείμενο.
 */

import { useCallback, useEffect, useRef } from 'react';

import { useAdministrativeHierarchy } from '@/hooks/useAdministrativeHierarchy';
import { geocodeAddress } from '@/lib/geocoding/geocoding-service';
import { toCanonicalGreekPostalCode } from '@/utils/address/postal-code';

import {
  PATH_TO_VALUE,
  type AddressWithHierarchyValue,
} from './address-with-hierarchy-config';
import { stripGreekAdminPrefix } from './address-hierarchy-field-ops';

/** Πόσο περιμένουμε μετά το τελευταίο πλήκτρο πριν ρωτήσουμε τη μηχανή. */
const AUTOFILL_DEBOUNCE_MS = 1500;

/** Ελάχιστο μήκος οδού πριν το ερώτημα έχει νόημα. */
const MIN_STREET_LENGTH = 2;

/** Το επίπεδο του οικισμού στην ελληνική διοικητική ιεραρχία. */
const SETTLEMENT_LEVEL = 8;

export interface SettlementAutoFillInput {
  readonly current: AddressWithHierarchyValue;
  readonly onChange: (next: AddressWithHierarchyValue) => void;
  readonly disabled: boolean;
  readonly isGreekAddress: boolean;
}

/**
 * Ονόματα που ταιριάζουν «αρκετά»: ακριβώς, ή με κοινό πρόθεμα ανά λέξη.
 *
 * 🔑 **ΓΙΑΤΙ ΟΧΙ ΣΚΕΤΟ `includes`** (που κάνει το `searchOptions`): η γενική πτώση.
 * Το Nominatim επιστρέφει «Ελευθερίου» ενώ η βάση έχει «Ελευθέριο» — υποσυμβολοσειρά
 * **αποτυγχάνει**, κοινό πρόθεμα 5 χαρακτήρων πετυχαίνει.
 */
function makeNameMatcher(target: string): (entityName: string) => boolean {
  const normalize = (s: string): string =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-]/g, ' ').toLowerCase().trim();

  const normalizedTarget = normalize(target);

  return (entityName: string): boolean => {
    const normalizedEntity = normalize(entityName);
    if (normalizedEntity === normalizedTarget) return true;
    if (normalizedTarget.length < 4) return false;

    const targetWords = normalizedTarget.split(/\s+/);
    const entityWords = normalizedEntity.split(/\s+/);
    if (entityWords.length !== targetWords.length) return false;

    return targetWords.every((word, i) => {
      const prefixLen = Math.min(5, Math.min(word.length, entityWords[i].length));
      return word.substring(0, prefixLen) === entityWords[i].substring(0, prefixLen);
    });
  };
}

/**
 * **Αποσαφήνιση με τον Τ.Κ. ΠΡΩΤΑ** — τρία σκαλιά, από το ακριβές στο ευρύ.
 *
 * Ο λόγος είναι ότι τα ονόματα οικισμών **επαναλαμβάνονται** σε όλη τη χώρα, ενώ ο
 * ταχυδρομικός κώδικας τα ξεχωρίζει: ακριβής Τ.Κ. ▸ ίδια ζώνη (3 ψηφία) ▸ ευρεία
 * ζώνη (2 ψηφία). Χωρίς αυτό, «Νέα Χώρα» θα έδενε στην πρώτη που θα τύχαινε.
 */
function findByPostalCode(
  settlements: readonly { id: string; name: string; postalCode?: string }[],
  postalCode: string,
  nameMatches: (name: string) => boolean,
): { id: string; name: string } | null {
  const zones = [postalCode, postalCode.substring(0, 3), postalCode.substring(0, 2)];

  for (const zone of zones) {
    const hit = settlements.find(
      (e) =>
        toCanonicalGreekPostalCode(e.postalCode ?? '').startsWith(zone) && nameMatches(e.name),
    );
    if (hit) return { id: hit.id, name: hit.name };
  }
  return null;
}

/**
 * Και οι δύο δρόμοι της αυτόματης συμπλήρωσης, σε ένα σημείο.
 *
 * ⚠️ **Η ΤΙΜΗ ΔΕΝ ΕΠΙΣΤΡΕΦΕΤΑΙ — εφαρμόζεται μέσω `onChange`**, ακριβώς όπως όταν ο
 * κώδικας ζούσε μέσα στο component. Ένα hook που επέστρεφε «προτεινόμενη τιμή» θα
 * ζητούσε από κάθε καλούντα να θυμηθεί να την εφαρμόσει — ευθύνη πίσω έξω.
 *
 * 🔴 **ΕΠΙΣΤΡΕΦΕΙ ΟΜΩΣ ΤΗΝ ΑΚΥΡΩΣΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΗ.** Όταν ο άνθρωπος επιλέγει
 * οικισμό ή επίπεδο ιεραρχίας, κάθε auto-fill σε πτήση πρέπει να **πεθάνει**: η ρητή
 * πρόθεση νικά πάντα μια εξωτερική πηγή (πειθαρχία `buildSelected`, ADR-601). Χωρίς
 * αυτό, μια απάντηση που έφτασε **μετά** την επιλογή θα την έσβηνε — και αυτό είναι
 * ακριβώς το περιστατικό που περιγράφει το σχόλιο των refs παρακάτω.
 *
 * ⛔ **ΜΗΝ την κάνεις `useEffect` σε dependency**: η ακύρωση είναι **γεγονός**
 * (ο άνθρωπος πάτησε), όχι κατάσταση — ένα effect θα την έτρεχε και σε επαναποδόσεις
 * που κανείς δεν ζήτησε.
 */
export function useSettlementAutoFill({
  current,
  onChange,
  disabled,
  isGreekAddress,
}: SettlementAutoFillInput): { readonly cancelPendingAutoFill: () => void } {
  const { isLoading, resolvePath, getByLevel } = useAdministrativeHierarchy();

  // ---------------------------------------------------------------------------
  // 🔴 ΑΜΥΝΑ ΕΝΑΝΤΙ STALE CLOSURES ΣΕ ΚΑΘΥΣΤΕΡΗΜΕΝΑ ΑΠΟΤΕΛΕΣΜΑΤΑ GEOCODING.
  //    *(Μετακόμισε εδώ μαζί με τον κώδικά του — 2026-09-12, N.7.1.)*
  //
  // Το `clearTimeout` ακυρώνει τον χρονιστή, ΟΧΙ ένα fetch που έχει ήδη φύγει.
  // Όταν το promise λυνόταν αργότερα, διάβαζε το closure της στιγμής που ξεκίνησε
  // — δηλαδή κατάσταση ΠΡΙΝ την επιλογή του χρήστη — και (α) περνούσε τον έλεγχο
  // «δεν υπάρχει οικισμός», (β) με το stale spread πετούσε το μόλις τεθέν
  // `settlementId` και όλη την ιεραρχία. Αποτέλεσμα: γραφόταν το διοικητικό όνομα
  // του geocoder αντί για την ετικέτα που είχε επιλέξει ο χρήστης.
  //
  // `currentRef`       → ζωντανή κατάσταση τη στιγμή της άφιξης του αποτελέσματος.
  // `autoFillEpochRef` → κάθε νέα ενέργεια ακυρώνει ό,τι είναι σε πτήση.
  // ---------------------------------------------------------------------------
  const currentRef = useRef(current);
  currentRef.current = current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const autoFillEpochRef = useRef(0);
  const autoFillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── ΔΡΟΜΟΣ 1: οδός + Τ.Κ. → πόλη, μέσω γεωκωδικοποίησης ──
  useEffect(() => {
    // Κάθε επαναξιολόγηση ακυρώνει προηγούμενο αίτημα σε πτήση.
    const epoch = ++autoFillEpochRef.current;

    const hasStreet = current.street.trim().length > MIN_STREET_LENGTH;
    const hasPostalCode = toCanonicalGreekPostalCode(current.postalCode).length === 5;
    const hasSettlement = current.settlementName.trim().length > 0;

    if (!hasStreet || !hasPostalCode || hasSettlement || disabled || !isGreekAddress) {
      return;
    }

    if (autoFillTimerRef.current) {
      clearTimeout(autoFillTimerRef.current);
    }

    autoFillTimerRef.current = setTimeout(async () => {
      try {
        const atRequest = currentRef.current;
        const streetWithNumber = [atRequest.street, atRequest.number].filter(Boolean).join(' ');
        const result = await geocodeAddress({
          street: streetWithNumber,
          postalCode: atRequest.postalCode,
          country: 'gr',
        });

        // ⚠️ Από εδώ και κάτω μπορεί να έχουν περάσει δευτερόλεπτα και ο χρήστης να
        // έχει ήδη επιλέξει οικισμό. ΠΟΤΕ μην διαβάσεις το closure — μόνο ζωντανή
        // κατάσταση, και μόνο αν το αίτημα είναι ακόμη το τρέχον.
        if (epoch !== autoFillEpochRef.current) return;

        const live = currentRef.current;
        if (!result?.resolvedCity || live.settlementName.trim()) return;

        onChangeRef.current({
          ...live,
          settlementName: stripGreekAdminPrefix(result.resolvedCity),
        });
      } catch {
        // Σιωπηλή αστοχία — η αυτόματη συμπλήρωση είναι best-effort, ποτέ φραγμός.
      }
    }, AUTOFILL_DEBOUNCE_MS);

    return () => {
      if (autoFillTimerRef.current) {
        clearTimeout(autoFillTimerRef.current);
      }
    };
  }, [
    current.street,
    current.number,
    current.postalCode,
    current.settlementName,
    disabled,
    current,
    isGreekAddress,
  ]);

  // ── ΔΡΟΜΟΣ 2: όνομα χωρίς id (ήρθε από σύρσιμο πινέζας) → πλήρης ιεραρχία ──
  useEffect(() => {
    if (isLoading || !current.settlementName.trim() || current.settlementId || !isGreekAddress) {
      return;
    }

    const cleanedName = stripGreekAdminPrefix(current.settlementName.trim()).replace(/-/g, ' ');
    const nameMatches = makeNameMatcher(cleanedName);
    const postalCode = toCanonicalGreekPostalCode(current.postalCode);
    const settlements = getByLevel(SETTLEMENT_LEVEL);

    // Τ.Κ. πρώτα (τρία σκαλιά)· αν δεν υπάρχει ή δεν έδεσε, σκέτο όνομα.
    const byPostal =
      postalCode.length === 5 ? findByPostalCode(settlements, postalCode, nameMatches) : null;
    const bestMatch =
      byPostal ??
      (() => {
        const candidate = settlements.find((e) => nameMatches(e.name));
        return candidate ? { id: candidate.id, name: candidate.name } : null;
      })();

    if (!bestMatch) return;

    const path = resolvePath(bestMatch.id);
    const updated = { ...current };
    updated.settlementName = bestMatch.name;
    for (const mapping of PATH_TO_VALUE) {
      const entity = path[mapping.pathKey];
      if (entity) {
        (updated[mapping.idField] as string | null) = entity.id;
        (updated[mapping.nameField] as string) = entity.name;
      }
    }
    onChange(updated);
  }, [
    current.settlementName,
    current.settlementId,
    current.postalCode,
    isLoading,
    isGreekAddress,
  ]);

  // Η ακύρωση είναι **αύξηση του epoch**, όχι `clearTimeout`: ο χρονιστής μπορεί να έχει
  // ήδη λήξει και το αίτημα να ταξιδεύει. Ό,τι επιστρέψει, θα βρει το epoch αλλαγμένο
  // και θα το πετάξει μόνο του — ίδιο ιδίωμα και στους δύο δρόμους.
  const cancelPendingAutoFill = useCallback(() => {
    autoFillEpochRef.current += 1;
  }, []);

  return { cancelPendingAutoFill };
}
