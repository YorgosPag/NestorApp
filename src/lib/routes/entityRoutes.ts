/**
 * =============================================================================
 * ENTITY ROUTES - CENTRALIZED ENTITY NAVIGATION DEFINITIONS
 * =============================================================================
 *
 * Single source of truth for entity-related routes.
 * Eliminates hardcoded template literals across the codebase.
 *
 * @module lib/routes/entityRoutes
 */

import { typedHref, withQuery } from '@/lib/workspace/route-worlds';

export const ENTITY_ROUTES = {
  crm: {
    leads: '/crm/leads',
    lead: (id: string) => typedHref(`/crm/leads/${id}`),
    tasks: '/crm/tasks',
    task: (id: string) => typedHref(`/crm/tasks/${id}`),
  },
  contacts: {
    list: '/contacts',
    withFilter: (term: string) => withQuery('/contacts', `filter=${encodeURIComponent(term)}`),
    withId: (id: string) => withQuery('/contacts', `contactId=${id}`),
  },
  /**
   * 🔴 **ΤΟ `withId` ΕΔΕΙΧΝΕ ΣΤΗ ΣΕΛΙΔΑ ΠΟΥ ΑΓΝΟΟΥΣΕ ΤΗΝ ΠΑΡΑΜΕΤΡΟ** (ADR-777 §8.30).
   *
   * Ήταν `/properties?propertyId=${id}` — και το `/properties` διάβαζε **μόνο**
   * `?view`. Επειδή αυτό είναι το **κεντρικό μητρώο**, το ελάττωμα δεν έμεινε σε
   * ένα σημείο: πολλαπλασιάστηκε σε κάθε καταναλωτή του, όλοι «σωστά» γραμμένοι.
   *
   * Πλέον δείχνει στην **καρτέλα**: `/properties/:id`, μια σελίδα με δική της
   * διεύθυνση — γιατί ένας σύνδεσμος οφείλει να οδηγεί **κάπου**.
   *
   * ⚠️ **ΤΟ `?propertyId=` ΤΟΥ `/spaces/properties` ΔΕΝ ΕΙΝΑΙ ΤΡΙΤΗ ΣΥΜΒΑΣΗ.**
   * Απαντά **άλλο ερώτημα**: *«ποια γραμμή της λίστας είναι επιλεγμένη;»* — όχι
   * *«ποιο ακίνητο κοιτάω;»*. Το πρώτο είναι κατάσταση μιας λίστας και ζει στο
   * ερώτημα· το δεύτερο είναι ταυτότητα και ζει στη **διαδρομή**.
   */
  properties: {
    list: '/properties',
    withId: (id: string) => typedHref(`/properties/${encodeURIComponent(id)}`),
    /**
     * Η καρτέλα, **ανοιγμένη σε συγκεκριμένη ενότητα** (έγγραφα, φωτογραφίες…).
     * Η τιμή ταξιδεύει στη διεύθυνση ώστε ο σύνδεσμος να μοιράζεται: «δες τα
     * έγγραφα του Δ3» δεν είναι το ίδιο με «δες το Δ3».
     */
    withTab: (id: string, tab: string) =>
      typedHref(`/properties/${encodeURIComponent(id)}?tab=${encodeURIComponent(tab)}`),
    /** Η λίστα με την κάτοψη, με **επιλεγμένο** ακίνητο. Κατάσταση λίστας, όχι ταυτότητα. */
    inSpaces: (id: string) => withQuery('/spaces/properties', `propertyId=${encodeURIComponent(id)}`),
  },
  spaces: {
    parking: (id: string) => withQuery('/spaces/parking', `parkingId=${id}`),
    storage: (id: string) => withQuery('/spaces/storage', `storageId=${id}`),
  },
  obligations: {
    list: '/obligations',
    edit: (id: string) => typedHref(`/obligations/${id}/edit`),
  },
} as const;
