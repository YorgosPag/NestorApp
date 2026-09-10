/**
 * @fileoverview **«Ποια είναι η δημόσια διεύθυνσή μας;»** — χωρίς αίτημα, χωρίς εξαρτήσεις.
 * @module lib/http/public-origin
 * @see lib/http/request-origin — η εκδοχή **με** αίτημα, που πέφτει και σε κεφαλίδα
 * @see ADR-848 — ο σύνδεσμος του email ειδοποίησης
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΟ `request-origin`**: εκείνο εισάγει το `next/server`
 * (για το `redirectTo`). Ο αποστολέας email, τα πρότυπα email και οι άγκυρές τους **δεν
 * έχουν** αίτημα και **δεν πρέπει** να τραβούν τον runtime του Next για να διαβάσουν μία
 * μεταβλητή περιβάλλοντος. Εδώ ζει ο **πυρήνας** — και το `request-origin` τον εισάγει,
 * ώστε ο κανόνας «env πρώτα, κόψε τις καθέτους» να είναι γραμμένος **μία** φορά.
 *
 * ⚠️ **ΜΗΝ το ενώσεις με το `getPublicBaseUrl()`** (`lib/oauth/oauth-config.ts`): εκείνο
 * **πετά** σε production, γιατί ένα token χωρίς issuer δεν έχει νόημα. Ένα email χωρίς
 * σύνδεσμο **έχει**: λέει ακόμη τι συνέβη.
 */

/**
 * **Η δημόσια διεύθυνση αυτής της εγκατάστασης, από το env** — ή `null`.
 *
 * ⚠️ **Το `null` ΕΙΝΑΙ Η ΥΠΗΡΕΣΙΑ.** Ο καλών οφείλει να φτιάξει email **χωρίς**
 * σύνδεσμο — ποτέ σχετικό (`/n/…` μέσα σε email δεν ανοίγει πουθενά) και ποτέ
 * μαντεμένο (`http://localhost:3000` μοιάζει έγκυρο και δεν ανοίγει ποτέ).
 */
export function publicOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;

  const withoutSlash = configured.replace(/\/+$/, '');
  return withoutSlash.length > 0 ? withoutSlash : null;
}

/** Origin + διαδρομή με **ακριβώς μία** κάθετο ανάμεσα — ένας κανόνας, όλοι οι καταναλωτές. */
export function joinOrigin(origin: string, path: string): string {
  return path.startsWith('/') ? `${origin}${path}` : `${origin}/${path}`;
}

/** Απόλυτο URL πάνω στο {@link publicOrigin} — `null` αν δεν ξέρουμε ποιοι είμαστε. */
export function publicUrl(path: string): string | null {
  const origin = publicOrigin();
  return origin === null ? null : joinOrigin(origin, path);
}
