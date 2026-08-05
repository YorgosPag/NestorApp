/**
 * @fileoverview Ο **ρητός** χάρτης `ProjectRole` → κλειδί i18n (ADR-745 Φ3β, Τομέας Δ2).
 *
 * 🔑 **Δεν γεννιέται εδώ λεξιλόγιο.** Οι ετικέτες υπάρχουν ήδη, πλήρεις και στις δύο γλώσσες,
 * στο `locales/{el,en}/building-address.json` κάτω από `associations.roles.*` — και τους
 * **επτά** ρόλους έργου. Αυτό το αρχείο προσθέτει το μόνο που έλειπε: έναν **τυποποιημένο**
 * χάρτη προς αυτά. Δεύτερο σύνολο κλειδιών θα ήταν δεύτερη πηγή αλήθειας για την ίδια λέξη
 * (N.0/N.12) — και η απόκλιση θα ξεκινούσε από την πρώτη μέρα.
 *
 * 🔴 **Γιατί ρητός και όχι `` t(`associations.roles.${role}`) ``**, που είναι το σημερινό ιδίωμα
 * σε `EntityAssociationsManager.tsx:143` και `ProjectParticipationSection.tsx:95`: μια συντεθειμένη
 * συμβολοσειρά είναι **αόρατη** στη CHECK 3.8 και στον generator του shell slice (CHECK 3.34).
 * Είναι το ακριβές σχήμα που παρήγαγε ωμά κλειδιά στην οθόνη **ενώ η μετάφραση υπήρχε**
 * (ADR-744/752). Ο τύπος `Record<ProjectRole, …>` κάνει επιπλέον το κενό **σφάλμα
 * μεταγλώττισης**: νέος ρόλος χωρίς ετικέτα δεν χτίζει.
 *
 * ⚠️ **`ProjectRole` είναι του `@/types/entity-associations`, ΟΧΙ του `@/lib/auth/types`.**
 * Υπάρχουν δύο ομώνυμοι τύποι στο repo και επικαλύπτονται στο `'architect'` — ο ένας είναι
 * ρόλοι RBAC, ο άλλος συμμετοχή σε έργο. Λάθος import θα μεταγλωττιζόταν και θα έδινε λάθος
 * λεξιλόγιο.
 *
 * @module config/project-role-labels
 */

import { ENTITY_ASSOCIATION_ROLES } from '@/types/entity-associations';
import type { ProjectRole } from '@/types/entity-associations';

/**
 * Το namespace στο οποίο ζουν οι ετικέτες.
 *
 * Κάθε καταναλωτής πρέπει να το δηλώσει στο `useTranslation([...])` του — τα κλειδιά φέρουν
 * ήδη το πρόθεμα, αλλά χωρίς φορτωμένο namespace το i18next επιστρέφει το ίδιο το κλειδί.
 */
export const PROJECT_ROLE_LABEL_NAMESPACE = 'building-address' as const;

export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  architect: 'building-address:associations.roles.architect',
  structural_engineer: 'building-address:associations.roles.structural_engineer',
  electrical_engineer: 'building-address:associations.roles.electrical_engineer',
  mechanical_engineer: 'building-address:associations.roles.mechanical_engineer',
  surveyor: 'building-address:associations.roles.surveyor',
  energy_inspector: 'building-address:associations.roles.energy_inspector',
  supervising_engineer: 'building-address:associations.roles.supervising_engineer',
};

/**
 * Είναι αυτή η συμβολοσειρά ρόλος **έργου**;
 *
 * Χρειάζεται επειδή οι σύνδεσμοι επαφών φέρουν `role: string` — ο ίδιος τύπος εξυπηρετεί έργα,
 * κτήρια και ακίνητα. Ένα `as ProjectRole` θα μεταγλωττιζόταν και θα έδινε `undefined` κλειδί
 * στην πρώτη επαφή με ρόλο κτηρίου.
 */
export const isProjectRole = (role: string): role is ProjectRole =>
  (ENTITY_ASSOCIATION_ROLES.project as readonly string[]).includes(role);
