/**
 * Flexural-capacity ceiling — η ΦΥΣΙΚΗ ΠΥΛΗ επάρκειας RC διατομής (ADR-499 Slice A).
 *
 * SSoT για το «πόση καμπτική ροπή ΑΝΤΕΧΕΙ μια μονοπαρειακή διατομή πριν συνθλιβεί η
 * θλιβόμενη ζώνη σκυροδέματος» — ΑΝΕΞΑΡΤΗΤΑ από το πόσο χάλυβα βάλεις. EC2 Annex A:
 *
 *   `M_Rd,lim = μ_lim · f_cd · b · d²`   (μ_lim ≈ 0.295 για ξ_lim = x/d ≈ 0.45)
 *
 * Πάνω από αυτό το όριο, ο εφελκυόμενος οπλισμός **δεν λύνει** το πρόβλημα: η αστοχία
 * μετατοπίζεται στο σκυρόδεμα. Ο suggester (`suggest-reinforcement` δοκάρι +
 * `suggest-slab-reinforcement` πλάκα) κόβει εκεί τον χάλυβα αντί να παράγει ψεύτικη
 * λύση (π.χ. Ø25/75 σε πλάκα 200 mm)· η ανεπάρκεια διορθώνεται με **μεγαλύτερη διατομή**
 * (auto-size, ADR-499 Slice B), όχι με περισσότερο σίδερο.
 *
 * Το `μ_lim` είναι code-specific (provider `flexuralLimitMuLim()` — EC2 vs ΕΚΩΣ)· ο
 * τύπος `μ·f_cd·b·d²` είναι κοινός. Pure — zero React/DOM/Firestore. Όλα σε mm / MPa /
 * N·mm (b·d²·MPa = N·mm).
 *
 * @see ./suggest-reinforcement.ts — beam cap (consumer)
 * @see ./suggest-slab-reinforcement.ts — slab cap (consumer)
 * @see ./structural-code-types.ts — `flexuralLimitMuLim()` (μ_lim ανά κώδικα)
 * @see docs/centralized-systems/reference/adrs/ADR-499-auto-correcting-organism.md
 */

/**
 * Οριακή καμπτική αντοχή μονοπαρειακής RC διατομής `M_Rd,lim = μ_lim·f_cd·b·d²` (N·mm),
 * EC2 Annex A. Επιστρέφει 0 σε εκφυλισμένη είσοδο (⇒ ο caller το αντιμετωπίζει ως
 * «μη-περιοριστικό» / αφόρτιστο). Κοινό για δοκάρι (b=width) & πλάκα (b=1000mm λωρίδα).
 */
export function limitMomentNmm(
  widthMm: number,
  effectiveDepthMm: number,
  fcdMpa: number,
  muLim: number,
): number {
  if (widthMm <= 0 || effectiveDepthMm <= 0 || fcdMpa <= 0 || muLim <= 0) return 0;
  return muLim * fcdMpa * widthMm * effectiveDepthMm * effectiveDepthMm;
}

/**
 * Συντελεστής κορεσμού εφελκυόμενου οπλισμού στο όριο της διατομής: `min(1, M_Rd,lim/M_Ed)`.
 * Πολλαπλασιάζει το As,strength ώστε να μη ξεπερνά το A_s,lim (= As,strength·M_Rd,lim/M_Ed,
 * αφού ο μοχλοβραχίονας z απλοποιείται). `1` όταν η διατομή επαρκεί (μηδέν regression).
 */
export function flexuralCapacityCapFactor(designMomentNmm: number, limitMomentNmmValue: number): number {
  if (limitMomentNmmValue <= 0 || designMomentNmm <= limitMomentNmmValue) return 1;
  return limitMomentNmmValue / designMomentNmm;
}

/**
 * ADR-499 (Slice B) — το **ελάχιστο ενεργό βάθος** d ώστε `M_Ed ≤ M_Rd,lim`: αντιστροφή
 * του `limitMomentNmm` ⇒ `d = √(M_Ed/(μ_lim·f_cd·b))`. Η διατομή που το ικανοποιεί έχει
 * τη ροπή ακριβώς στο όριο (ξ=ξ_lim)· ο auto-sizer μεγαλώνει το πάχος/ύψος μέχρι εκεί.
 * ΕΝΑ SSoT με το `limitMomentNmm` (ίδιο `μ·f_cd·b`). 0 σε αφόρτιστη/εκφυλισμένη είσοδο.
 */
export function capacityDepthMm(
  designMomentNmm: number,
  fcdMpa: number,
  muLim: number,
  widthMm: number,
): number {
  if (designMomentNmm <= 0 || fcdMpa <= 0 || muLim <= 0 || widthMm <= 0) return 0;
  return Math.sqrt(designMomentNmm / (muLim * fcdMpa * widthMm));
}
