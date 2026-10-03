/**
 * @fileoverview **ΤΟ ΣΩΜΑ ΤΗΣ ΕΞΑΡΓΥΡΩΣΗΣ ΠΡΟΣΚΛΗΣΗΣ** — οι τιμές του, ΜΙΑ φορά, για κάθε είδος πρόσκλησης.
 * @related ADR-853 §15 · ADR-904 Ε6 · `server/invitations/invitation-http.ts` (`INVITATION_REDEEM_BODY`)
 * @module contracts/invitation-redeem-body
 *
 * 🔑 **Γιατί ζει στο `src/contracts/`**: τις διαβάζουν **και** οι διαδρομές εξαργύρωσης (σχήμα zod v3 στο
 * `invitation-http.ts`) **και** το παραγόμενο συμβόλαιο της εφαρμογής κινητού (σχήμα zod v4 εδώ — η εφαρμογή ανοίγει
 * τον σύνδεσμο `/tour-invite/[token]` και εξαργυρώνει μόνη της). Ο γεννήτορας εκτελείται έξω από το Next.js, άρα οι
 * τιμές **δεν** μπορούν να ζουν σε αρχείο `server-only`.
 *
 * ⚠️ **Γιατί δύο σχήματα πάνω στις ΙΔΙΕΣ τιμές, και όχι ένα**: το v3 σχήμα επεκτείνεται με `.extend()` από τη
 * διαδρομή εξαργύρωσης εμπλοκής (`credential`) — μετάβασή του σε v4 είναι αλλαγή **εκείνης** της διαδρομής, όχι του
 * συμβολαίου. Μέχρι τότε η ισοδυναμία **αποδεικνύεται** από test (`capture-api-parity.test.ts`), δεν υποθέτεται.
 *
 * **Layering**: leaf — μόνο zod.
 */

import { z } from 'zod/v4';

/** Η πράξη είναι **ρητή**, χωρίς προεπιλογή — «δέχομαι» ή «αρνούμαι» δεν μαντεύεται ποτέ. */
export const INVITATION_REDEEM_ACTIONS = ['accept', 'decline'] as const;
export type InvitationRedeemAction = (typeof INVITATION_REDEEM_ACTIONS)[number];

/**
 * **Κάθε άρνηση εξαργύρωσης απαντά 422**, ποτέ 404/403: το αίτημα ήταν κατανοητό· ο **κόσμος** δεν το επιτρέπει — και ο
 * λόγος ταξιδεύει στο σώμα. Η **όψη** (GET) μιλά για τον πόρο και έχει δικό της πίνακα (`INVITATION_PREVIEW_STATUS`).
 */
export const INVITATION_REDEEM_REFUSED_STATUS = 422;

/** Τα όρια του token του συνδέσμου (το token σε **σώμα**, ποτέ σε URL — RFC 6819 §5.1.5). */
export const INVITATION_TOKEN_MIN_LENGTH = 8;
export const INVITATION_TOKEN_MAX_LENGTH = 4096;

export const InvitationRedeemBodySchema = z.object({
  /** Κρίνεται **μαζί** με το email του λογαριασμού από το Auth — δύο παράγοντες (§15). */
  token: z.string().min(INVITATION_TOKEN_MIN_LENGTH).max(INVITATION_TOKEN_MAX_LENGTH),
  action: z.enum(INVITATION_REDEEM_ACTIONS),
});
