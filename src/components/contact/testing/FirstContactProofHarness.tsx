'use client';

/**
 * @fileoverview **Η ΓΚΑΛΕΡΙ ΤΗΣ ΑΠΟΔΕΙΞΗΣ** — κάθε έκβαση της οθόνης, ταυτόχρονα.
 * @related components/contact/FirstContactAwaitingProof.tsx (η οθόνη) · ADR-844 §11
 * @module components/contact/testing/FirstContactProofHarness
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΟ ΕΠΙΧΕΙΡΗΜΑ ΕΙΝΑΙ ΑΡΙΘΜΗΤΙΚΟ, ΟΧΙ ΑΙΣΘΗΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ζωντανή ροή **δεν μπορεί** να φτάσει τις περισσότερες εκβάσεις αυτής της οθόνης:
 *
 * | Έκβαση | Πώς φτάνεται ζωντανά |
 * |---|---|
 * | `expired` | **περιμένεις επτά ημέρες** |
 * | `identity-refused` · `unavailable` | απαιτούν **σπασμένο** διακομιστή |
 * | `link-invalid` · `invitation-unknown` | **δεν φτάνουν ποτέ** εδώ — η πόρτα κωδικού γυρίζει `code-wrong` |
 * | `code-exhausted` | πέντε λάθος δοκιμές, ανά πρόσκληση |
 *
 * 🔴 **ΚΑΙ ΜΕΤΡΗΘΗΚΕ ΧΕΙΡΟΤΕΡΟ ΑΠΟ ΑΥΤΟ** *(06/09, ζωντανά)*: χωρίς
 * `FIRST_CONTACT_INVITE_SECRET` ο διακομιστής γράφει *«Λείπει το μυστικό των
 * προσκλήσεων — κάθε σύνδεσμος φαίνεται άκυρος»*, δηλαδή η ζωντανή ροή φτάνει
 * **μία** από τις έντεκα εκβάσεις. Μια οθόνη που δεν μπορεί να ιδωθεί δεν μπορεί να
 * κριθεί — και ο **N.11** λέει ρητά ότι ο στατικός σαρωτής **δεν βλέπει** ωμά ελληνικά
 * μέσα σε JSX, άρα το μόνο όργανο είναι **μάτι πάνω στην οθόνη**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΡΑΦΗ ΤΟΥ ΔΙΚΤΥΟΥ: ΑΡΧΙΤΕΚΤΟΝΙΚΗ MSW, ΧΩΡΙΣ ΝΕΑ ΕΞΑΡΤΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το πρότυπο των μεγάλων για «γκαλερί χωρίς backend» είναι το **MSW**: **ΕΝΑΣ**
 * handler που **δρομολογεί πάνω στο αίτημα**. Το σχήμα το κρατάμε ακέραιο· την
 * υλοποίηση **δεν** την εισάγουμε, γιατί η ραφή **υπάρχει ήδη σε αυτό το δέντρο** —
 * το `ContactMutationHarness` μπαλώνει `apiClient.post` μέσα σε `useEffect` με
 * επαναφορά. Ίδιο ιδίωμα, μηδέν νέο πακέτο, μηδέν service worker στο `public/`.
 *
 * ⛔ **ΜΗΝ βάλεις δεύτερο μπάλωμα ανά πάνελ.** Το `apiClient` είναι **singleton**:
 * έντεκα πάνελ που μπαλώνουν το ίδιο `post` πατούν το ένα το άλλο και το τελευταίο
 * κερδίζει. Γι' αυτό ο μεταφορέας είναι **ΕΝΑΣ** και δρομολογεί στο `invitationId` —
 * ακριβώς όπως ο handler του MSW δρομολογεί στο URL.
 *
 * ⛔ **ΜΗΝ προσθέσεις εδώ διακόπτη θέματος ή γλώσσας.** Η σελίδα φοράει **κέλυφος**,
 * και το κέλυφος τα κατέχει ήδη *(CHECK 3.72 — γλώσσα, θέμα, λογαριασμός)*. Δεύτερος
 * διακόπτης θα ήταν δεύτερη αυθεντία για την ίδια ρύθμιση. 🧪 Το **pseudo** ανάβει από
 * τον ίδιο διακόπτη γλώσσας, και τότε ό,τι μένει ελληνικό σε αυτή τη σελίδα είναι
 * **hardcoded** (ADR-666).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΟΙ ΕΤΙΚΕΤΕΣ ΤΟΥ ΕΡΓΑΛΕΙΟΥ ΔΕΝ ΠΕΡΝΟΥΝ ΑΠΟ `t()` — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΑΒΛΕΨΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **N.11** απαιτεί κάθε κείμενο οθόνης να ζει στα locale JSON. Αυτή η διαδρομή όμως
 * **δεν υπάρχει σε παραγωγή**: ο `isTestHarnessRouteEnabled()` τη γυρίζει σε `notFound()`.
 * ⚠️ **Και η διαδρομή γράφεται `locales/<γλώσσα>/…`, ΠΟΤΕ με αστερίσκο-κάθετο**: η
 * ακολουθία **τερματίζει το σχόλιο μπλοκ** και το αρχείο παύει να μεταγλωττίζεται.
 * *(Μετρημένο εδώ, 06/09: το `locales/⟨αστερίσκος⟩/property-market.json` έριξε ολόκληρη
 * τη σουίτα με «Expected ';', '}' or &lt;eof&gt;».)*
 *
 * Βάζοντας *«Proof Screen Gallery»* στα locale JSON και των δύο γλωσσών θα φορτώναμε
 * **σε κάθε πραγματικό χρήστη** κείμενα εργαλείου που δεν θα δει ποτέ — δηλαδή θα
 * παραβιάζαμε τον σκοπό του κανόνα για να τηρήσουμε το γράμμα του.
 *
 * ⇒ Ίδια απόφαση με το **υπάρχον** `ContactMutationHarness` *(«Contact Mutation Harness»,
 * αγγλικά, εκτός locales)* — **ένα** ιδίωμα για τα harness αυτού του δέντρου.
 *
 * 🔑 **Και τα κείμενα που ΚΡΙΝΟΝΤΑΙ εδώ δεν είναι αυτά**: είναι τα κείμενα της **οθόνης
 * παραγωγής**, που τα αποδίδει η ίδια με τα δικά της κλειδιά. Το εργαλείο δεν γράφει
 * ούτε μία λέξη από αυτά — γι' αυτό και οι λεζάντες είναι **μηχανικά ονόματα**
 * *(`link-expired`)*, όχι πεζός λόγος.
 *
 * **Layering**: dev-only παρουσίαση. Καμία γνώση Firestore· καμία γνώση των κειμένων —
 * τα αποδίδει η **ίδια** η οθόνη παραγωγής.
 */

import React from 'react';

import { Card } from '@/components/ui/card';

import { clickWhenEnabled, PANEL_WIDTH_CLASS, PanelWidthSelect, type PanelWidth } from '@/components/testing/harness/harness-panel';
import { scriptedBodyField, useScriptedPost, type ScriptedRoute } from '@/components/testing/harness/scripted-transport';

import { FirstContactAwaitingProof } from '../FirstContactAwaitingProof';
import {
  HARNESS_CODE,
  PROOF_SCENARIOS,
  type ProofScenario,
} from './first-contact-proof-scenarios';

const CONFIRM_PATH = '/confirm';

const PROOF_BY_ID = new Map(PROOF_SCENARIOS.map((scenario) => [scenario.id, scenario]));

/**
 * **Ο δρομολογητής του ΕΝΟΣ μεταφορέα** (`useScriptedPost`) — δρομολογεί στο `invitationId`, όπως ο handler του MSW
 * στο URL. Σε εμβέλεια module: σταθερός, άρα το μπάλωμα στήνεται **μία** φορά.
 */
const proofRoute: ScriptedRoute = (url, body) => {
  if (!url.endsWith(CONFIRM_PATH)) return undefined;
  const scenario = PROOF_BY_ID.get(scriptedBodyField(body, 'invitationId'));
  return scenario?.reply ? { status: scenario.status, body: scenario.reply } : undefined;
};

export function FirstContactProofHarness(): React.JSX.Element {
  const [resending, setResending] = React.useState(false);
  const [width, setWidth] = React.useState<PanelWidth>('auto');

  // 🔴 **ΤΟ `armed` ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΣΗ — ΕΙΝΑΙ Η ΣΕΙΡΑ.** Στον React τα effects των
  //    **παιδιών** τρέχουν **ΠΡΙΝ** του γονιού: χωρίς αυτό, κάθε πάνελ θα υπέβαλλε
  //    ενώ ο ψεύτικος μεταφορέας **δεν έχει ακόμη εγκατασταθεί** — δηλαδή έντεκα
  //    αληθινές κλήσεις στη δημόσια διαδρομή, και έντεκα πάνελ να δείχνουν `failed`.
  //    ⛔ **ΜΗΝ το «λύσεις» με `requestAnimationFrame` ή `setTimeout`**: θα δούλευε
  //    σχεδόν πάντα, δηλαδή θα ήταν **στοίχημα στον χρόνο** — το ακριβές λάθος που
  //    κοκκίνισε στο πλήρες τρέξιμο του ADR-844 §11. Η σειρά εδώ είναι **εγγυημένη**:
  //    το πάνελ δεν οδηγείται μέχρι ο γονιός να δηλώσει ότι ο μεταφορέας στέκει.
  const armed = useScriptedPost(proofRoute);

  return (
    // 🔴 **ΟΥΤΕ ΚΕΝΟ ΟΥΤΕ ΤΑΒΑΝΙ ΟΥΤΕ `<main>` — ΚΑΙ ΤΑ ΤΡΙΑ ΑΝΗΚΟΥΝ ΣΤΟ ΚΕΛΥΦΟΣ**
    //    *(ADR-797 / CHECK 3.63)*. Η πρώτη γραφή εδώ ήταν
    //    `<main className="mx-auto … max-w-[1600px] … p-6">` και η πύλη τη σταμάτησε με
    //    **δύο** ονομαστικά ευρήματα: `[content-padding]` *(το κενό το δίνει ο
    //    διάδρομος)* και `[page-measure]` *(η κλίμακα ζει στο `spacing.layout.measure`,
    //    όχι σε χειρόγραφο αριθμό)*.
    //    ⛔ **ΚΑΙ ΟΧΙ `<main>`**: το WCAG επιτρέπει **ένα** landmark ανά σελίδα, και το
    //    κέλυφος του `(app)` το έχει ήδη ξοδέψει. Το `ShellSurface` το λέει ρητά.
    //    ⚠️ **Κανένα `measure`**: η γκαλερί είναι **εργαλείο πυκνών δεδομένων** — έντεκα
    //    πάνελ δίπλα-δίπλα — δηλαδή ακριβώς η περίπτωση που η σύμβαση εξαιρεί.
    <section className="flex flex-col gap-6" aria-label="First Contact Proof Harness">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-2xl font-semibold text-foreground">First Contact — Proof Screen Gallery</h1>
        <p className="m-0 max-w-3xl text-sm text-muted-foreground">
          Every outcome of <code>FirstContactAwaitingProof</code>, rendered at once against a scripted
          transport. Panels are derived from <code>FIRST_CONTACT_INVITATION_REFUSALS</code>, never listed
          by hand — a new refusal code shows up here on its own. Flip theme, language and 🧪 pseudo
          from the shell toolbar; this page owns none of them.
        </p>
      </header>

      <HarnessControls
        resending={resending}
        width={width}
        onResendingChange={setResending}
        onWidthChange={setWidth}
      />

      <section className="flex flex-wrap items-start gap-6" aria-label="Proof scenarios">
        {PROOF_SCENARIOS.map((scenario) => (
          <ProofPanel
            key={scenario.id}
            scenario={scenario}
            resending={resending}
            width={width}
            armed={armed}
          />
        ))}
      </section>
    </section>
  );
}

/**
 * **Οι δύο άξονες που το κέλυφος ΔΕΝ κατέχει** — και μόνο αυτοί.
 *
 * 🔑 Το `resending` είναι **καθολικό**, όχι ανά πάνελ: είναι *τρόπος θέασης* (η ιδέα
 * των «modes» του Chromatic), όχι κατάσταση σεναρίου. Ανά πάνελ θα διπλασίαζε τα
 * πάνελ σε είκοσι δύο για να δείξει **μία** επιπλέον ετικέτα κουμπιού.
 */
function HarnessControls({
  resending,
  width,
  onResendingChange,
  onWidthChange,
}: {
  readonly resending: boolean;
  readonly width: PanelWidth;
  readonly onResendingChange: (next: boolean) => void;
  readonly onWidthChange: (next: PanelWidth) => void;
}): React.JSX.Element {
  return (
    <Card asChild className="flex flex-wrap items-center gap-6 p-4 text-sm">
      <section aria-label="Harness controls">
        <label className="flex items-center gap-2 text-foreground">
          <input
            type="checkbox"
            checked={resending}
            onChange={(event) => onResendingChange(event.target.checked)}
          />
          resending
        </label>

        <PanelWidthSelect width={width} onChange={onWidthChange} />

        <span className="text-muted-foreground">{PROOF_SCENARIOS.length} panels</span>
      </section>
    </Card>
  );
}

/**
 * **Ένα πάνελ = μία έκβαση.**
 *
 * ⚠️ **Η λεζάντα λέει ΜΟΝΟ την ταυτότητα του σεναρίου, ποτέ «τι μπορεί να κάνει».**
 * Το δεύτερο το **δείχνει η ίδια η οθόνη** (υπάρχει κουμπί; είναι κύριο ή δευτερεύον;
 * υπάρχει πεδίο κωδικού;). Λεζάντα που το επαναλάμβανε θα ήταν **δεύτερη διατύπωση**
 * του `REFUSAL_ACTION` — ελεύθερη να αποκλίνει, και μάλιστα **μέσα στο εργαλείο που
 * υπάρχει για να πιάνει αποκλίσεις**.
 */
function ProofPanel({
  scenario,
  resending,
  width,
  armed,
}: {
  readonly scenario: ProofScenario;
  readonly resending: boolean;
  readonly width: PanelWidth;
  /** Ο μεταφορέας στέκει. Δες το σχόλιο στο {@link FirstContactProofHarness}. */
  readonly armed: boolean;
}): React.JSX.Element {
  const host = React.useRef<HTMLDivElement>(null);
  // 🔴 **ΤΟ ΕΥΡΗΜΑ ΤΗΣ ΠΡΩΤΗΣ ΕΚΤΕΛΕΣΗΣ, ΚΑΙ ΤΟ ΚΡΑΤΑΜΕ ΟΡΑΤΟ.** Δεν καταλήγουν όλες
  //    οι εκβάσεις του μεταφορέα σε **αυτή** την οθόνη: το `failed` *(και τα `refused`
  //    / `invalid`)* **ανεβαίνουν στον γονιό** — το `settle()` επιστρέφει πράξη, όχι
  //    `null`, και ο διάλογος τα ζωγραφίζει με το `FirstContactOutcomeNotice`.
  //    ⇒ Χωρίς αυτή τη γραμμή το πάνελ `failed` ήταν **οπτικά ταυτόσημο με το
  //    `pristine`**: γκαλερί που δείχνει δύο διαφορετικά ονόματα για την ίδια εικόνα
  //    **λέει ψέματα** — ακριβώς το ελάττωμα που το ADR-844 θεραπεύει αλλού.
  const [handoff, setHandoff] = React.useState<string | null>(null);
  useAutoProve(host, armed && scenario.reply !== null);

  return (
    // ⚠️ **Κλάσεις, ΠΟΤΕ `style={{ width }}`** (N.3): τα δύο πλάτη είναι **κλειστό
    //    σύνολο δύο τιμών**, άρα είναι κλάσεις — όχι υπολογισμός. Ένα inline `style`
    //    εδώ θα ήταν και παράβαση κανόνα και μονόδρομος για «άλλο ένα πλάτος» ως
    //    αριθμός σκορπισμένος στο JSX.
    // `overflow-visible`: η γκαλερί υπάρχει για να ΦΑΙΝΕΤΑΙ ό,τι ξεχειλίζει στα 375px — το κόψιμο του `Card` θα το έκρυβε.
    <Card asChild className={`flex flex-col gap-3 overflow-visible p-4 ${PANEL_WIDTH_CLASS[width]}`}>
      <article data-testid={`proof-panel-${scenario.id}`}>
        <h2 className="m-0 font-mono text-xs text-muted-foreground">{scenario.id}</h2>
        {handoff !== null && (
          <p
            data-testid={`proof-handoff-${scenario.id}`}
            className="m-0 rounded-md border border-border p-2 font-mono text-xs text-muted-foreground"
          >
            ⬆ leaves this screen — parent renders `{handoff}`
          </p>
        )}
        <div ref={host}>
          <FirstContactAwaitingProof
            invitationId={scenario.id}
            resending={resending}
            onProven={(result) => setHandoff(result.kind)}
            onResend={noop}
            onCancel={noop}
          />
        </div>
      </article>
    </Card>
  );
}

/**
 * **Οδηγεί το πάνελ στην έκβασή του** — γεμίζει τον κωδικό και υποβάλλει, μία φορά.
 *
 * 🏆 Είναι η `play` συνάρτηση του Storybook: η γκαλερί **δεν** στήνει εσωτερική
 * κατάσταση από έξω· **χειρίζεται την οθόνη όπως ο άνθρωπος**, μέσα από το δημόσιο
 * DOM της. Έτσι ό,τι φαίνεται είναι αποτέλεσμα του **πραγματικού** `useCodeProof` και
 * του **πραγματικού** `guestFailureOf`.
 *
 * 🔴 **ΠΕΡΙΜΕΝΕΙ ΔΗΛΩΜΕΝΟ ΣΗΜΑ ΤΗΣ ΟΘΟΝΗΣ, ΟΧΙ ΧΡΟΝΟ** — και το μάθημα είναι πρόσφατο
 * *(ADR-844 §11: `for (i<4) await act(…)` πέρασε μόνο του και κοκκίνισε στο πλήρες
 * τρέξιμο)*. Το κουμπί υποβολής φοράει `disabled={busy || code.trim() === ''}`: όσο
 * είναι ανενεργό, η οθόνη **δηλώνει** ότι δεν είναι έτοιμη. Περιμένουμε **αυτό**, με
 * φραγμένο αριθμό καρέ ώστε να μην κολλήσει ποτέ βρόχος.
 */
function useAutoProve(host: React.RefObject<HTMLDivElement | null>, enabled: boolean): void {
  React.useEffect(() => {
    const root = host.current;
    if (!enabled || root === null) return;

    typeCode(root, HARNESS_CODE);
    return clickWhenEnabled(root, 'button[type="submit"]');
  }, [host, enabled]);
}

/**
 * ⚠️ **ΚΑΤΩ ΑΠΟ ΤΟΝ ΕΛΕΓΚΤΗ ΤΟΥ React ΔΕΝ ΑΡΚΕΙ `input.value = …`.** Ο React κρατά τη
 * δική του τιμή και **αναιρεί** την απευθείας ανάθεση. Ο εγγραφέας του πρωτοτύπου
 * είναι ο τεκμηριωμένος τρόπος να γραφτεί ώστε το γεγονός `input` να ταξιδέψει
 * κανονικά — το ίδιο κάνει και το `@testing-library/user-event`.
 */
function typeCode(root: HTMLElement, code: string): void {
  const input = root.querySelector('input');
  if (input === null) return;

  const writer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  writer?.call(input, code);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Η γκαλερί δεν έχει πού να πάει: κάθε έξοδος του συστατικού είναι **θέαμα**, όχι πράξη. */
function noop(): void {
  // σκόπιμα κενό
}
