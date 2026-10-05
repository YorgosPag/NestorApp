/**
 * @fileoverview **Οι ετικέτες του «για λογαριασμό ποιου γραφείου»** — κλειστός πίνακας κλειδιών i18n (ADR-901 §15 Γ1).
 * @related `case-invite-labels.ts` (το πρότυπο) · ADR-744 (slice διαδρομής)
 * @module components/conveyance/acting/acting-workspace-labels
 *
 * ⚠️ **Μέλη αντικειμένου, ποτέ δυναμικό `${…}`**: το ίδιο πεδίο αποδίδεται σε **δύο** διαδρομές (`/cases` ·
 * `/case-invite/[token]`) και ο εξαγωγέας του slice (ADR-744) ακολουθεί μέλη πινάκων ετικετών.
 */

export const ACTING_NS = 'conveyance';

export const ACTING_KEYS = {
  office: 'conveyance:engagement.acting.office',
  personalProvisional: 'conveyance:engagement.acting.personalProvisional',
  chooseLabel: 'conveyance:engagement.acting.chooseLabel',
  choosePlaceholder: 'conveyance:engagement.acting.choosePlaceholder',
  chooseRequired: 'conveyance:engagement.acting.chooseRequired',
  unknown: 'conveyance:engagement.acting.unknown',
  unnamedOffice: 'conveyance:engagement.acting.unnamedOffice',
  cardOffice: 'conveyance:engagement.acting.cardOffice',
  cardPersonal: 'conveyance:engagement.acting.cardPersonal',
  cardDeparted: 'conveyance:engagement.acting.cardDeparted',
} as const;
