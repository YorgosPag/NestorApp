import React, { useEffect } from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { mapContactToFormData } from '@/utils/contactForm/contactMapper';
import { createModuleLogger } from '@/lib/telemetry';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

const logger = createModuleLogger('useContactDataLoader');

/** Photo slot structure for multiple photos */
interface PhotoSlotData {
  uploadUrl?: string;
  url?: string;
  fileName?: string;
  [key: string]: unknown;
}

interface UseContactDataLoaderProps {
  editContact?: Contact | null;
  isModalOpen?: boolean;
  setFormData: React.Dispatch<React.SetStateAction<ContactFormData>>;
  handleMultiplePhotosChange: (photos: PhotoSlotData[]) => void;
  resetForm: () => void;
  /**
   * Πεδία που προσυμπληρώνονται σε **νέα** επαφή από εξωτερική ανάγνωση (ADR-759 Φ1).
   *
   * 🔴 **Ζει ΕΔΩ και όχι στον διάλογο, και αυτό είναι ολόκληρη η διαφορά.** Αυτό το hook είναι ο
   * **μοναδικός ιδιοκτήτης** της αρχικής κατάστασης της φόρμας: σε edit φορτώνει την επαφή, σε
   * νέα κάνει `resetForm()`. Ένα `useEffect` προσυμπλήρωσης οπουδήποτε αλλού θα **κούρδιζε
   * κόντρα σε αυτό το reset** και θα επιβίωνε μόνο χάρη στη σειρά δήλωσης των hooks — δηλαδή
   * ένα ανακάτεμα γραμμών θα έσβηνε σιωπηλά την προσυμπλήρωση. Στο ίδιο effect, η σειρά είναι
   * **γραμμένη**, όχι τυχερή (N.7.2 #7: ένας ρητός ιδιοκτήτης κύκλου ζωής, όχι αναδυόμενη
   * συμπεριφορά).
   *
   * ⚠️ Αγνοείται σε edit mode: η υπάρχουσα εγγραφή είναι η αλήθεια και καμία ανάγνωση αρχείου
   * δεν τη γράφει από πάνω (ADR-745 §8 κανόνας 2).
   */
  prefill?: Partial<ContactFormData>;
}

// ============================================================================
// 🔥 EXTRACTED: CONTACT DATA LOADING FUNCTIONALITY
// ============================================================================

/**
 * Contact Data Loader Hook - Specialized για contact data management
 *
 * Extracted από useContactForm για Single Responsibility Principle.
 * Χειρίζεται μόνο το loading/editing/resetting των contact data.
 *
 * Features:
 * - Contact-to-FormData mapping
 * - Edit mode initialization
 * - Form reset για νέες επαφές
 * - Empty photos array handling
 * - Error handling με fallback
 */
export function useContactDataLoader({
  editContact,
  isModalOpen,
  setFormData,
  handleMultiplePhotosChange,
  resetForm,
  prefill
}: UseContactDataLoaderProps) {

  // ========================================================================
  // 🔴 ADR-759 Φ1 — Ο ΣΠΟΡΟΣ ΕΙΝΑΙ ΣΤΙΓΜΙΟΤΥΠΟ ΤΟΥ ΑΝΟΙΓΜΑΤΟΣ, ΟΧΙ ΖΩΝΤΑΝΟΣ ΔΕΣΜΟΣ
  // ========================================================================
  // Δύο φύλακες, και **κανένας από τους δύο δεν είναι σχολαστικισμός** — μετρήθηκαν και οι δύο
  // σε πραγματικό βρόχο (`useContactDataLoader.prefill.test.tsx`):
  //
  //  1. **Ref αντί για εξάρτηση.** Το `prefill` είναι αντικείμενο. Μπαίνοντας στον πίνακα
  //     εξαρτήσεων, ένας καλών που το γράφει ενσωματωμένο (`prefill={{ firstName: x }}`) το
  //     ξαναδημιουργεί σε κάθε απόδοση ⇒ το effect ξανατρέχει ⇒ `resetForm()` **σβήνει ό,τι
  //     πληκτρολογεί ο χρήστης** σε κάθε πλήκτρο.
  //  2. **Μία φορά ανά άνοιγμα.** Χωρίς αυτό, το effect γράφει **νέο** αντικείμενο κατάστασης
  //     σε κάθε εκτέλεση ⇒ νέα απόδοση ⇒ νέα εκτέλεση: **άπειρος βρόχος**. Το reset από μόνο
  //     του δεν τον είχε ποτέ, επειδή γράφει τη **σταθερή** `initialFormData` και ο React
  //     εγκαταλείπει· ο σπόρος αφαιρεί ακριβώς αυτή τη διαφυγή.
  //
  // ⇒ Ο καλών **δεν χρειάζεται να προσέχει**. Μια οδηγία σε σχόλιο δεν είναι πύλη· η
  // ταυτοτικότητα (N.7.2 #3) είναι.
  // ========================================================================
  const prefillRef = React.useRef(prefill);
  prefillRef.current = prefill;
  const seededRef = React.useRef(false);

  // ========================================================================
  // CONTACT DATA LOADING (Edit Mode)
  // ========================================================================

  /**
   * Load contact data when editing OR reset form when modal opens for new contact
   */
  useEffect(() => {
    // 🔧 FIX: Track modal state για proper form reset
    if (isModalOpen === false) {
      // Κλείνοντας, το επόμενο άνοιγμα δικαιούται νέο σπόρο — αλλιώς η δεύτερη επαφή που θα
      // καταχωρούσε ο μηχανικός θα άνοιγε **κενή** φόρμα, χωρίς καμία ένδειξη γιατί.
      seededRef.current = false;
      return;
    }

    if (editContact) {
      // ========================================================================
      // EDIT MODE: Load existing contact data
      // ========================================================================

      try {
        const mappingResult = mapContactToFormData(editContact);

        if (mappingResult.warnings.length > 0) {
          logger.warn('Contact mapping warnings', { warnings: mappingResult.warnings });
        }

        setFormData({
          ...mappingResult.formData,
          // 🔥 ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Force clear photos array όταν η βάση έχει κενό array
          multiplePhotos: Array.isArray(mappingResult.formData.multiplePhotos) &&
                          mappingResult.formData.multiplePhotos.length === 0
                          ? []
                          : mappingResult.formData.multiplePhotos || []
        });

        // Επιπλέον: Force update το UI state για φωτογραφίες
        setTimeout(() => {
          if (Array.isArray(mappingResult.formData.multiplePhotos) &&
              mappingResult.formData.multiplePhotos.length === 0) {
            logger.info('Database has empty photos array - forcing UI update');
            // Καλεί την συνάρτηση που ενημερώνει τα photos στο UI
            if (typeof handleMultiplePhotosChange === 'function') {
              handleMultiplePhotosChange([]);
            }
          }
        }, 50);

      } catch (error) {
        logger.error('Failed to load contact data', { error });
        resetForm();
      }

    } else if (isModalOpen === true) {
      // ========================================================================
      // NEW CONTACT MODE: Reset form
      // ========================================================================

      logger.info('New contact mode, resetting form (modal opened)');
      resetForm();

      // 🏢 ADR-759 Φ1 — ο σπόρος μπαίνει ΑΜΕΣΩΣ ΜΕΤΑ το reset, μέσα στο ΙΔΙΟ effect.
      // Λειτουργική ενημέρωση, ώστε να διαβάσει το `initialFormData` που μόλις έγραψε το
      // `resetForm` αντί για μια μπαγιάτικη κλειστότητα. Ούτε δεύτερο effect, ούτε εξάρτηση
      // από σειρά δήλωσης hooks — δες το σκεπτικό στους δύο φύλακες παραπάνω.
      const seed = prefillRef.current;
      if (seed && !seededRef.current) {
        seededRef.current = true;
        logger.info('New contact mode, applying prefill', { fields: Object.keys(seed).length });
        setFormData(prev => ({ ...prev, ...seed }));
      }
    }
  }, [
    editContact?.id,
    isModalOpen,
    editContact?.updatedAt, // 🔥 FINAL FIX: Force refresh on every edit - track ID + timestamp
    setFormData,
    handleMultiplePhotosChange,
    resetForm
    // ⚠️ Το `prefill` λείπει ΕΠΙΤΗΔΕΣ — δες τον φύλακα 1 παραπάνω. Διαβάζεται από ref.
  ]);

  // ========================================================================
  // RETURN API (Read-only information)
  // ========================================================================

  return {
    isEditMode: Boolean(editContact),
    contactId: editContact?.id,
    contactType: editContact?.type
  };
}