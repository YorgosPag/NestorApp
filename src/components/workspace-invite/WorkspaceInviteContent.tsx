'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΥ ΠΡΟΣΚΕΚΛΗΜΕΝΟΥ** — ποιος τον καλεί, και τι απαντά.
 * @related app/(auth)/invite/[token]/page.tsx · types/workspace-invitation-view.ts · ADR-853 Φ6
 * @module components/workspace-invite/WorkspaceInviteContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ NAMESPACE ΔΗΛΩΝΕΤΑΙ ΕΔΩ, ΔΕΝ ΔΑΝΕΙΖΕΤΑΙ (ADR-744 §18)
 * ────────────────────────────────────────────────────────────────────────────
 * Κάθε υπο-κομμάτι που χρησιμοποιεί κλειδιά καλεί **μόνο του** `useTranslation(NS)` και
 * **κανένα δεν δέχεται `t` ως prop**. Ένα component που παίρνει το `t` δηλώνει **μηδέν**
 * namespace, και τότε ο γεννήτορας του shell slice αποδίδει τα κλειδιά του σε
 * `targets = []` — **τα χάνει σιωπηλά**, και η οθόνη βάφει ωμά κλειδιά σε άνθρωπο που
 * μόλις ήρθε από email.
 *
 * ⚠️ **ΚΑΜΙΑ ΜΠΑΡΑ, ΚΑΝΕΝΑ ΣΗΜΑ, ΚΑΝΕΝΑ `min-h-screen`**: το `(auth)/layout.tsx` δίνει ήδη
 * `<AuthToolbar />` (γλώσσα+θέμα, ADR-809) και `ShellSurface as="main"` με
 * `shellAuthStandalone`, που **είναι ήδη** `min-h-screen … items-center justify-center`.
 * Επανάληψη μετρήθηκε ζωντανά ως **48px φάντασμα κύλισης** (= 2×24 του διαδρόμου ADR-797).
 *
 * ⛔ **Σύνδεσμοι μόνο από το `@/lib/workspace/navigation`** (CHECK 3.61) — ποτέ `next/link`.
 */

import { useCallback, useRef, useState, useTransition } from 'react';

import { useAuthOptional } from '@/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateTime, formatDeadlineRelative } from '@/lib/intl-formatting';
import { Link, useRouter } from '@/lib/workspace/navigation';
import { cn } from '@/lib/utils';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import {
  redeemWorkspaceInvitationFromScreen,
  type RedeemInvitationResult,
} from '@/services/workspace/workspace-invitation.client';
import type {
  WorkspaceInvitationLinkView,
  WorkspaceInviteExitName,
  WorkspaceInviteSetback,
} from '@/types/workspace-invitation-view';
import type {
  WorkspaceInvitationPreview,
  WorkspaceInvitationRefusal,
} from '@/types/workspace-invitation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import {
  EXIT_BY_REFUSAL,
  EXIT_HREF,
  EXIT_KEY,
  INVITE_PAGE_KEYS,
  INVITED_ROLE_KEY,
  REFUSAL_KEY,
} from './workspace-invite-labels';
import { WORKSPACE_INVITE_NS } from './workspace-invite-namespace';
import { OtherAccountNotice, SwitchAccountButton } from './SwitchAccount';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
//
// Χωρίς αυτές τις δύο γραμμές το artifact **υπάρχει**, το manifest το υπογράφει, οι πύλες
// είναι **πράσινες** — και **κανείς δεν το φορτώνει ποτέ**: η θεραπεία μένει ΑΔΡΑΝΗΣ και η
// σελίδα βάφει ωμά κλειδιά σε άνθρωπο που μόλις ήρθε από email.
//
// ⚠️ **ΠΟΤΕ `import()`** — μετακινεί το ωμό κλειδί σε «ένα καρέ» και το **κρύβει** από το
//    CHECK 3.51.
// ⚠️ **ΠΟΤΕ σε Server Component** — Server και Client έχουν **ξεχωριστούς γράφους module**,
//    οπότε η εγγραφή από το `page.tsx` θα έγραφε σε **άλλο** στιγμιότυπο i18next: πράσινη
//    κλήση που δεν κάνει τίποτα. Γι' αυτό ζει **εδώ**, στο client component.
//
// 🔑 Μετρημένο: **3273 bytes · 1 ns [auth]** — τα 31 κλειδιά `auth:workspaceInvite.*`.
import routeSlice from '@/i18n/generated/routes/invite__token.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export function WorkspaceInviteContent({ view }: { view: WorkspaceInvitationLinkView }) {
  const response = useInvitationResponse(view.kind === 'preview' ? view.token : null);

  if (view.kind !== 'preview') return <SetbackScreen setback={view} />;
  if (response.outcome !== null) {
    return (
      <OutcomeScreen
        outcome={response.outcome}
        busy={response.busy}
        onRetry={response.retry}
        switchAccountHref={view.switchAccountHref}
      />
    );
  }

  return <PreviewScreen view={view} pendingAction={response.pendingAction} onRespond={response.respond} />;
}

type InviteAction = 'accept' | 'decline';

interface InvitationResponse {
  readonly outcome: RedeemInvitationResult | null;
  /**
   * 🔑 **ΠΟΙΑ πράξη εκκρεμεί, όχι «κάτι εκκρεμεί»** (ADR-853 §13 ε.β): η ένδειξη ζωγραφίζεται
   * στο κουμπί που **πατήθηκε**. Ένα σκέτο `busy` δεν μπορεί να το πει — γι' αυτό η αναμονή
   * της άρνησης εμφανιζόταν πάνω στην αποδοχή.
   */
  readonly pendingAction: InviteAction | null;
  /** Παράγωγο του `pendingAction` — για την επανάληψη, που δεν διαλέγει πράξη. */
  readonly busy: boolean;
  readonly respond: (action: InviteAction) => Promise<void>;
  /** Ξανατρέχει **την ΙΔΙΑ** πράξη που πάτησε ο άνθρωπος — ποτέ άλλη. */
  readonly retry: () => void;
}

/**
 * **Η απάντηση στην πρόσκληση — και η επανάληψή της.**
 *
 * 🔑 **Το «δοκιμάστε ξανά» επαναλαμβάνει την ΙΔΙΑ πράξη**, δεν γυρίζει τον άνθρωπο στην όψη
 * να ξαναδιαλέξει (πρότυπο Gmail/Slack για παροδικές αποτυχίες). Είναι **ασφαλές**: η
 * εξαργύρωση τρέχει σε συναλλαγή που ελέγχει `state === 'pending'` — δεύτερη κλήση μετά από
 * επιτυχία που «χάθηκε» στο δίκτυο απαντά `already-used`, **ποτέ** διπλή ένταξη.
 *
 * ⚠️ Η πράξη κρατιέται σε **ref**, όχι σε state: δεν ζωγραφίζεται, και ένα state θα
 *    ξανάφτιαχνε το `retry` σε κάθε αλλαγή του.
 */
function useInvitationResponse(token: string | null): InvitationResponse {
  // ⚠️ **`useAuthOptional`**: η σελίδα είναι **δημόσια** — ο ανώνυμος τη βλέπει κανονικά
  //    (§5 #4), και ένα `useAuth()` εκεί θα έριχνε ολόκληρη την οθόνη.
  const auth = useAuthOptional();
  const [outcome, setOutcome] = useState<RedeemInvitationResult | null>(null);
  const [pendingAction, setPendingAction] = useState<InviteAction | null>(null);
  const lastAction = useRef<InviteAction | null>(null);

  const respond = useCallback(
    async (action: InviteAction) => {
      if (token === null) return;
      lastAction.current = action;
      setPendingAction(action);
      try {
        const result = await redeemWorkspaceInvitationFromScreen({ token, action });
        // 🔑 **ΠΡΟΛΑΒΑΙΝΟΥΜΕ ΤΗΝ ΚΟΥΡΣΑ, ΔΕΝ ΤΗ ΜΕΤΡΙΑΖΟΥΜΕ** (N.7.2 #1, ADR-853 §18): ο
        //    διακομιστής μόλις έδωσε claim χώρου, αλλά το **cookie** του φυλλομετρητή κρατά
        //    ακόμη το παλιό. Ο ακροατής του ADR-360 θα το διόρθωνε σε δευτερόλεπτα — ο
        //    άνθρωπος όμως πατά το κουμπί **τώρα**, και θα κατέληγε στον προσωπικό του χώρο.
        //    Εδώ ξέρουμε **ότι** άλλαξε, άρα ζητάμε την ανανέωση αντί να την περιμένουμε.
        // ⚠️ **Μη μπλοκάρον**: η ένταξη **έγινε**· αποτυχία ανανέωσης δεν την ακυρώνει, και
        //    το `/home` παραμένει τίμιο (θα στείλει εκεί που ξέρει ο διακομιστής).
        if (result.kind === 'accepted' && result.activeWorkspaceChanged) {
          try {
            await auth?.refreshToken();
          } catch {
            // Ο ακροατής του `claimsUpdatedAt` παραμένει το δίχτυ ασφαλείας.
          }
        }
        setOutcome(result);
      } finally {
        setPendingAction(null);
      }
    },
    [auth, token],
  );

  const retry = useCallback(() => {
    if (lastAction.current !== null) void respond(lastAction.current);
  }, [respond]);

  return { outcome, pendingAction, busy: pendingAction !== null, respond, retry };
}

// =============================================================================
// ΤΟ ΠΛΑΙΣΙΟ — μία κάρτα, το ίδιο με τις υπόλοιπες οθόνες `(auth)`
// =============================================================================

function InviteCard({ title, children }: { title: string; children: React.ReactNode }) {
  const layout = useLayoutClasses();

  return (
    <section className={layout.flexColGap4}>
      <Card className={layout.cardAuthWidth}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className={layout.flexColGap4}>{children}</CardContent>
      </Card>
    </section>
  );
}

/**
 * **Η ΔΙΕΞΟΔΟΣ** — κάθε οθόνη που δεν προσφέρει πράξη, προσφέρει δρόμο.
 *
 * 🔴 Το μάθημα του ADR-844: *«η οθόνη **περιγράφει** την επόμενη κίνηση αντί να την
 * **προσφέρει**»*. Ο τύπος συνόρου κάνει το πεδίο **υποχρεωτικό**· εδώ γίνεται κουμπί.
 */
function ExitLink({ exit }: { exit: WorkspaceInviteExitName }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);

  return (
    <Link href={EXIT_HREF[exit]} className="w-full">
      <Button variant="outline" className="w-full">
        {t(EXIT_KEY[exit])}
      </Button>
    </Link>
  );
}

/**
 * **ΤΟ «ΔΟΚΙΜΑΣΤΕ ΞΑΝΑ»** — μόνο για το **παροδικό** (`unavailable` / `failed`).
 *
 * ⛔ **Ποτέ σε ονομασμένη άρνηση**: «λάθος παραλήπτης» ή «έληξε» δεν αλλάζουν με επανάληψη —
 *    κουμπί εκεί θα ήταν υπόσχεση που δεν τηρείται (ADR-844 Α3).
 */
function RetryButton({ busy, onRetry }: { busy: boolean; onRetry: () => void }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);

  return (
    <Button className="w-full" disabled={busy} onClick={onRetry}>
      {busy ? t(INVITE_PAGE_KEYS.retrying) : t(INVITE_PAGE_KEYS.retry)}
    </Button>
  );
}

// =============================================================================
// ΟΙ ΤΡΕΙΣ ΟΘΟΝΕΣ
// =============================================================================

function SetbackScreen({ setback }: { setback: WorkspaceInviteSetback }) {
  if (setback.kind === 'unavailable') return <UnavailableViewScreen />;

  return <RefusalScreen reason={setback.reason} exit={setback.exit} />;
}

/**
 * **Η ΟΝΟΜΑΣΜΕΝΗ ΑΡΝΗΣΗ — μία οθόνη, είτε ήρθε από την όψη είτε από την πράξη.**
 *
 * 🔴 **Τίτλος της πρόσκλησης, ΟΧΙ του παροδικού**: η άρνηση είναι **οριστική** και έχει
 *    **συγκεκριμένη** λύση. Ο τίτλος «δεν μπορούμε αυτή τη στιγμή» θα έλεγε *«περιμένετε»*
 *    πάνω από σώμα που λέει *«κάντε κάτι»* (ADR-853 §13, 2026-09-21).
 */
function RefusalScreen({
  reason,
  exit,
  switchAccountHref = null,
}: {
  reason: WorkspaceInvitationRefusal;
  exit: WorkspaceInviteExitName;
  /**
   * 🔑 §13 ε.δ — «λάθος παραλήπτης» την ώρα της πράξης: ο δρόμος είναι **αλλαγή λογαριασμού
   * με επιστροφή εδώ**, όχι σκέτο `/login` που χάνει την πρόσκληση. `null` όταν δεν
   * υπάρχει πρόσκληση να επιστρέψει κανείς (άρνηση της όψης).
   */
  switchAccountHref?: string | null;
}) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);
  const switchHref = reason === 'wrong-recipient' ? switchAccountHref : null;

  return (
    <InviteCard title={t(INVITE_PAGE_KEYS.title)}>
      <p className="text-sm">{t(REFUSAL_KEY[reason])}</p>
      {switchHref ? <SwitchAccountButton href={switchHref} /> : <ExitLink exit={exit} />}
    </InviteCard>
  );
}

/**
 * **ΤΟ ΠΑΡΟΔΙΚΟ — μία οθόνη**· αλλάζει **μόνο** τι ξανατρέχει το «Δοκιμάστε ξανά».
 *
 * ⚠️ Εδώ, και **μόνο** εδώ, ζει ο τίτλος `unavailableTitle`: είναι η **μόνη** κατάσταση όπου
 *    το «αυτή τη στιγμή» λέει αλήθεια.
 */
function TransientScreen({ busy, onRetry }: { busy: boolean; onRetry: () => void }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);

  return (
    <InviteCard title={t(INVITE_PAGE_KEYS.unavailableTitle)}>
      <p className="text-sm">{t(INVITE_PAGE_KEYS.unavailableBody)}</p>
      <RetryButton busy={busy} onRetry={onRetry} />
      <ExitLink exit="home" />
    </InviteCard>
  );
}

/**
 * **Η ΟΨΗ δεν δόθηκε** — ο διακομιστής δεν μπόρεσε να ρωτήσει.
 *
 * 🔑 `router.refresh()` και όχι `location.reload()`: ξανατρέχει **μόνο** το Server Component
 * της σελίδας (νέα `previewWorkspaceInvitation`), χωρίς να πετά την κατάσταση του πελάτη ή
 * να ξαναφορτώνει ολόκληρη την εφαρμογή. Το `useTransition` δίνει το «εκκρεμεί» **μέχρι να
 * φτάσει η νέα απόδοση** — όχι μέχρι να επιστρέψει η κλήση, που επιστρέφει αμέσως.
 */
function UnavailableViewScreen() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return <TransientScreen busy={pending} onRetry={() => startTransition(() => router.refresh())} />;
}

function OutcomeScreen({
  outcome,
  busy,
  onRetry,
  switchAccountHref,
}: {
  outcome: RedeemInvitationResult;
  busy: boolean;
  onRetry: () => void;
  switchAccountHref: string;
}) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);

  if (outcome.kind === 'accepted') {
    return (
      <InviteCard title={t(INVITE_PAGE_KEYS.acceptedTitle)}>
        {/* 🔴 §6 #1 — το «δεν άλλαξε ο ενεργός χώρος» λέγεται ΜΕ ΟΝΟΜΑ. */}
        <p className="text-sm">
          {outcome.activeWorkspaceChanged
            ? t(INVITE_PAGE_KEYS.acceptedActiveNow)
            : t(INVITE_PAGE_KEYS.acceptedNotActive)}
        </p>
        {/* 🔴 Ε-Γ (§18): ο άνθρωπος **είναι** συνδεδεμένος — η εξαργύρωση το απαιτεί. Η έξοδος
            είναι ο **χώρος**, και το `/home` τον λύνει στον διακομιστή τη στιγμή του κλικ. */}
        <ExitLink exit="workspace" />
      </InviteCard>
    );
  }

  if (outcome.kind === 'declined') {
    return (
      <InviteCard title={t(INVITE_PAGE_KEYS.declinedTitle)}>
        <p className="text-sm">{t(INVITE_PAGE_KEYS.declinedBody)}</p>
        <ExitLink exit="home" />
      </InviteCard>
    );
  }

  // 🔑 Η έξοδος από τον **ΕΝΑ** πίνακα που διαβάζει και η όψη — όχι σταθερό «αρχική».
  if (outcome.kind === 'refused') {
    return (
      <RefusalScreen
        reason={outcome.reason}
        exit={EXIT_BY_REFUSAL[outcome.reason]}
        switchAccountHref={switchAccountHref}
      />
    );
  }

  return <TransientScreen busy={busy} onRetry={onRetry} />;
}

type PreviewBranch = Extract<WorkspaceInvitationLinkView, { kind: 'preview' }>;

function PreviewScreen({
  view,
  pendingAction,
  onRespond,
}: {
  view: PreviewBranch;
  pendingAction: InviteAction | null;
  onRespond: (action: InviteAction) => Promise<void>;
}) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);

  return (
    <InviteCard title={t(INVITE_PAGE_KEYS.title)}>
      <InvitationFacts preview={view.preview} />
      {view.respond.kind === 'ready' && (
        <nav className="flex flex-col gap-2" aria-label={t(INVITE_PAGE_KEYS.title)}>
          <InviteActionButton action="accept" pendingAction={pendingAction} onRespond={onRespond} />
          <InviteActionButton action="decline" pendingAction={pendingAction} onRespond={onRespond} />
        </nav>
      )}
      {view.respond.kind === 'sign-in' && <SignInInvitation href={view.respond.href} />}
      {/* 🔑 §13 ε.δ — άλλος λογαριασμός: το λέμε ΠΡΙΝ το κλικ, με τον δρόμο έτοιμο. */}
      {view.respond.kind === 'other-account' && (
        <OtherAccountNotice signedInAs={view.respond.signedInAs} href={view.switchAccountHref} />
      )}
    </InviteCard>
  );
}

/**
 * **Η λέξη του κουμπιού** — κάθε κλειδί γραμμένο **ρητά** σε κλήση `t()`.
 *
 * ⚠️ **ΟΧΙ πίνακας `{ idle, pending }` με `t(spec[...])`**: ο γεννήτορας του route slice
 * (ADR-744 §18) δεν επιλύει δυναμικό κλειδί και **αρνείται να εκπέμψει** — μετρημένο
 * 2026-09-21. Χωρίς slice, η σελίδα βάφει ωμά κλειδιά σε άνθρωπο που ήρθε από email.
 */
function useActionLabel(action: InviteAction, pending: boolean): string {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);
  if (action === 'accept') return pending ? t(INVITE_PAGE_KEYS.accepting) : t(INVITE_PAGE_KEYS.accept);
  return pending ? t(INVITE_PAGE_KEYS.declining) : t(INVITE_PAGE_KEYS.decline);
}

/**
 * **Ένα κουμπί πράξης — η αναμονή ζει ΜΟΝΟ στο πατημένο** (ADR-853 §13 ε.β).
 *
 * ⚠️ **Και τα δύο απενεργοποιούνται** όσο εκκρεμεί οποιαδήποτε πράξη: δεύτερη απάντηση πριν
 * έρθει η πρώτη δεν έχει νόημα (η συναλλαγή θα την απέρριπτε ως `already-used`). Το
 * `aria-busy` λέει στον αναγνώστη οθόνης **ποιο** δουλεύει.
 */
function InviteActionButton({
  action,
  pendingAction,
  onRespond,
}: {
  action: InviteAction;
  pendingAction: InviteAction | null;
  onRespond: (action: InviteAction) => Promise<void>;
}) {
  const pending = pendingAction === action;
  const label = useActionLabel(action, pending);

  return (
    <Button
      variant={action === 'accept' ? 'default' : 'outline'}
      disabled={pendingAction !== null}
      aria-busy={pending}
      onClick={() => void onRespond(action)}
    >
      {/* ⚠️ Διακοσμητικό: η λέξη του κουμπιού λέει ήδη τι γίνεται, και το προεπιλεγμένο
          `aria-label` του Spinner είναι αγγλικό — θα διαβαζόταν δίπλα στην ελληνική λέξη. */}
      {pending && (
        <span aria-hidden="true" className="mr-2 inline-flex">
          <Spinner size="small" color="inherit" />
        </span>
      )}
      {label}
    </Button>
  );
}

// =============================================================================
// ΤΑ ΣΤΟΙΧΕΙΑ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ
// =============================================================================

function InvitationFacts({ preview }: { preview: WorkspaceInvitationPreview }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);
  const colors = useSemanticColors();

  return (
    <article className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {t(INVITE_PAGE_KEYS.intro, { workspace: preview.workspaceName })}
      </p>
      <p className="text-sm">
        {t(INVITE_PAGE_KEYS.roleLine, { role: t(INVITED_ROLE_KEY[preview.role]) })}
      </p>
      <p className={cn('text-sm', colors.text.muted)}>
        {/* 🔑 ADR-853 §13 ε.γ — σχετικό ΚΑΙ απόλυτο (πρότυπο Slack/Google): «σε 7 ημέρες»
            με τον ΙΔΙΟ κανόνα του email, και η ακριβής στιγμή στη ζώνη του θεατή. */}
        {t(INVITE_PAGE_KEYS.expiresLine, {
          when: formatDeadlineRelative(preview.expiresAt),
          date: formatDateTime(preview.expiresAt, { dateStyle: 'long', timeStyle: 'short' }),
        })}
      </p>
      {/*
        🔑 §5 #4 · ADR-798 — «ΔΗΛΩΜΕΝΗ, ΟΧΙ ΕΠΑΛΗΘΕΥΜΕΝΗ», γραμμένο στην οθόνη.
        Το `identityAssurance` έχει σήμερα **μία** τιμή· τη διαβάζουμε ώστε η οθόνη να μην
        μπορεί να **ξεχάσει** την ετικέτα τη μέρα που ο τύπος αποκτήσει δεύτερη.
      */}
      {preview.identityAssurance === 'declared' && (
        <CardDescription>{t(INVITE_PAGE_KEYS.identityDeclared)}</CardDescription>
      )}
    </article>
  );
}

/**
 * **Ο ανώνυμος βλέπει ΠΡΩΤΑ ποιος τον καλεί, και μετά συνδέεται** (§5 #4, αντι-phishing).
 *
 * ⚠️ Ο σύνδεσμος έρχεται **έτοιμος από τον διακομιστή** (`loginHref`, που περνά από τον
 * φρουρό `safeReturnPath`) — η οθόνη **δεν** συναρμολογεί `?next=` μόνη της.
 */
function SignInInvitation({ href }: { href: string }) {
  const { t } = useTranslation([WORKSPACE_INVITE_NS]);
  const colors = useSemanticColors();

  return (
    <section className="flex flex-col gap-2">
      <p className={cn('text-sm', colors.text.muted)}>{t(INVITE_PAGE_KEYS.signInHint)}</p>
      {/*
        ⚠️ Ωμό `href` από τον διακομιστή: δεν είναι κυριολεκτική διαδρομή του καταλόγου
        (κουβαλά `?next=`), γι' αυτό δεν περνά από τον γενικό `Link` του συνόρου αλλά
        δηλώνεται ρητά ως πλοήγηση ανώτατου επιπέδου προς τη **δική μας** σελίδα σύνδεσης.
      */}
      <Button asChild>
        <a href={href}>{t(INVITE_PAGE_KEYS.signInToAccept)}</a>
      </Button>
    </section>
  );
}
