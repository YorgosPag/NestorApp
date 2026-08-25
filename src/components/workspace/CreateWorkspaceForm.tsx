'use client';

/**
 * **«Δημιουργώ τον χώρο μου»** — η οθόνη του Κ-1 (ADR-787)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΗΤΑΝ ΠΡΙΝ
 * ─────────────────────────────────────────────────────────────────────────────
 * **Τίποτα.** Ένας αυτο-εγγεγραμμένος άνθρωπος έπαιρνε τον ιδιωτικό του χώρο και
 * σταματούσε εκεί: εταιρικός χώρος δινόταν **μόνο** από `super_admin`. Αυτή είναι
 * η πρώτη οθόνη που τον αφήνει να φτιάξει το γραφείο του μόνος του.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΠΕΔΙΑ, ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ ΓΡΑΦΕΤΑΙ ΜΟΝΟ ΤΟΥ ΜΕΧΡΙ ΝΑ ΤΟ ΑΓΓΙΞΕΙΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η **επωνυμία** είναι ετικέτα οθόνης· η **διεύθυνση** είναι μόνιμο αναγνωριστικό
 * σε δημόσιο χώρο ονομάτων. Είναι **δύο αποφάσεις**, και το να ζητηθούν ως δύο
 * πεδία είναι το μοντέλο που ακολουθούν Slack, Linear και GitHub.
 *
 * ⚠️ Ο συγχρονισμός σταματά **οριστικά** μόλις ο άνθρωπος γράψει στη διεύθυνση
 * (`aliasTouched`). Χωρίς αυτό, μια διόρθωση στην επωνυμία θα **έσβηνε σιωπηλά**
 * τη διεύθυνση που μόλις διάλεξε — η κλασική βλάβη των «έξυπνων» πεδίων.
 *
 * ⛔ **ΚΑΜΙΑ ΚΡΙΣΗ ΜΟΡΦΗΣ ΕΔΩ.** Ο κριτής ζει στον διακομιστή και ο λόγος είναι
 *    γραμμένος στο {@link useCreateWorkspace}. Η όψη **μεταφράζει κωδικό σε
 *    πρόταση**, ποτέ δεν αποφασίζει.
 *
 * @module components/workspace/CreateWorkspaceForm
 * @see docs/centralized-systems/reference/adrs/ADR-787-multi-organization-platform.md Κ-1
 */

import { useState, type FormEvent } from 'react';
import { Building2, ArrowRight, ShieldCheck, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/i18n';
import { ALIAS_MAX_LENGTH, ALIAS_MIN_LENGTH } from '@/types/workspace-alias';
import { WORKSPACE_PATH_PREFIX } from '@/lib/workspace/workspace-path';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ `/workspace/new`.
//
// Το `onboarding` **ΔΕΝ είναι στο κέλυφος** (μετρημένο 2026-08-25: 18 namespaces, απών)
// ⇒ χωρίς αυτή τη γραμμή η οθόνη βάφει **ωμά κλειδιά στο πρώτο καρέ SSR** — η κλάση
// που κυνηγά η CHECK 3.51. Κόστος: **2.504 bytes**, 1,5% του κελύφους.
//
// 🔴 **ΕΔΩ, ΚΑΙ ΟΧΙ ΣΤΟ `page.tsx`**: εκείνο είναι Server Component, και τα Server/Client
// δέντρα έχουν **ΞΕΧΩΡΙΣΤΟΥΣ γράφους module** — εγγραφή από εκεί θα έγραφε σε **άλλο**
// στιγμιότυπο i18next: πράσινη κλήση που δεν κάνει τίποτα.
//
// ⚠️ **Στατική εισαγωγή, εμβέλεια MODULE** — με `import()` το ωμό κλειδί απλώς
// μετακομίζει σε «ένα καρέ» και κρύβεται από το CHECK 3.51.
import routeSlice from '@/i18n/generated/routes/workspace__new.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

import type { ProvisioningRejection } from '@/types/workspace';
import { useCreateWorkspace } from './use-create-workspace';
import { suggestAlias } from './alias-suggestion';

registerRouteSlice(routeSlice);

/**
 * Ο κωδικός απόρριψης, ως **πρόταση προς τον άνθρωπο**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ `switch` ΜΕ ΚΥΡΙΟΛΕΚΤΙΚΑ ΚΛΕΙΔΙΑ ΚΑΙ ΟΧΙ `t(buildKey(code))`
 * ─────────────────────────────────────────────────────────────────────────────
 * Η πρώτη γραφή έχτιζε το κλειδί με συνάρτηση. Ο γεννήτορας του **ADR-744**
 * **αρνήθηκε να παράγει** το route slice: *«ανεπίλυτη δυναμική `t()` — το slice
 * δεν μπορεί να ξέρει ποια κλειδιά χρειάζεται, και δεν θα μαντέψει»*. Η άρνηση
 * ήταν **σωστή**: κλειδί που ο γεννήτορας δεν βλέπει δεν ταξιδεύει, και βάφεται
 * **ωμό** στην οθόνη (η κλάση που κυνηγά η CHECK 3.51).
 *
 * Υπάρχει έξοδος διαφυγής (`dynamicKeyPolicy` με `prefixes`), και **δεν
 * χρησιμοποιήθηκε**: το σύνολο των λόγων είναι **κλειστή ένωση** που εξάγει ο
 * ίδιος ο διακομιστής ({@link ProvisioningRejection}). Με `switch`, ο
 * γεννήτορας βλέπει **κάθε** κλειδί κυριολεκτικά, και ο **μεταγλωττιστής**
 * εγγυάται ότι καμία ετυμηγορία δεν έμεινε χωρίς πρόταση — μια δήλωση προθέσεων
 * αντικαταστάθηκε από **δομή**.
 *
 * ⚠️ **Το `default` δεν είναι διακοσμητικό**: ο κωδικός φτάνει από το σύρμα ως
 * `string`, οπότε ένας διακομιστής νεότερης έκδοσης μπορεί να στείλει ετυμηγορία
 * που αυτός ο κώδικας δεν ξέρει. Ο άνθρωπος οφείλει να δει **πρόταση**, ποτέ το
 * ωμό `look-alike-taken`.
 */
function RejectionMessage({ code }: { readonly code: string }) {
  const { t } = useTranslation('onboarding');
  const bounds = { min: ALIAS_MIN_LENGTH, max: ALIAS_MAX_LENGTH };

  switch (code as ProvisioningRejection | 'name-required') {
    case 'reserved':            return <>{t('onboarding.workspace.errors.reserved')}</>;
    case 'too-short':           return <>{t('onboarding.workspace.errors.too-short', bounds)}</>;
    case 'too-long':            return <>{t('onboarding.workspace.errors.too-long', bounds)}</>;
    case 'invalid-characters':  return <>{t('onboarding.workspace.errors.invalid-characters')}</>;
    case 'mixed-script':        return <>{t('onboarding.workspace.errors.mixed-script')}</>;
    case 'already-taken':       return <>{t('onboarding.workspace.errors.already-taken')}</>;
    case 'look-alike-taken':    return <>{t('onboarding.workspace.errors.look-alike-taken')}</>;
    case 'already-has-workspace': return <>{t('onboarding.workspace.errors.already-has-workspace')}</>;
    case 'name-required':       return <>{t('onboarding.workspace.errors.name-required')}</>;
    case 'registry-unavailable': return <>{t('onboarding.workspace.errors.registry-unavailable')}</>;
    case 'failed':              return <>{t('onboarding.workspace.errors.failed')}</>;
    default:                    return <>{t('onboarding.workspace.errors.failed')}</>;
  }
}

export function CreateWorkspaceForm() {
  const { t } = useTranslation('onboarding');
  const { errorCode, busy, submit } = useCreateWorkspace();

  const [displayName, setDisplayName] = useState('');
  const [alias, setAlias] = useState('');
  const [aliasTouched, setAliasTouched] = useState(false);

  const onNameChange = (value: string) => {
    setDisplayName(value);
    if (!aliasTouched) setAlias(suggestAlias(value, ALIAS_MAX_LENGTH));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    void submit(displayName, alias);
  };

  // ⚠️ ΚΑΜΙΑ `max-w-*` στη ρίζα: το **μέτρο** το δηλώνει η γειτονιά, μία φορά
  //    (`ShellSurface measure="wide"` = 80ch — ΟΧΙ 80 χαρακτήρες, δες §Β.11 — στο
  //    `PrivateSpaceShell`). Χειρόγραφο ταβάνι εδώ θα ήταν πέμπτη τιμή δίπλα σε
  //    τέσσερις που μόλις ενοποιήθηκαν — και το φυλά το CHECK 3.63.
  return (
    <form onSubmit={onSubmit} className="w-full space-y-8">
      <header className="space-y-2">
        {/*
          ⚠️ ΟΧΙ `text-primary` (CHECK 3.38 / ADR-770): στο **προεπιλεγμένο σκοτεινό**
          θέμα το `--primary` λύνεται ΤΑΥΤΟΣΗΜΑ με το `--card` (1,00:1) — το εικονίδιο
          δεν θα ήταν δυσανάγνωστο, θα ήταν **ανύπαρκτο**. Το `--text-info` είναι token
          ΣΚΟΠΟΥ και ορίζεται ξεχωριστά στα δύο θέματα (blue-600 / blue-400).
        */}
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-[hsl(var(--text-info))]">
          <Building2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('onboarding.workspace.title')}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('onboarding.workspace.subtitle')}
        </p>
      </header>

      <section className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">{t('onboarding.workspace.nameLabel')}</Label>
          <Input
            id="workspace-name"
            value={displayName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('onboarding.workspace.namePlaceholder')}
            autoComplete="organization"
            autoFocus
            required
            disabled={busy}
            aria-describedby="workspace-name-hint"
          />
          <p id="workspace-name-hint" className="text-xs text-muted-foreground">
            {t('onboarding.workspace.nameHint')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspace-alias">{t('onboarding.workspace.aliasLabel')}</Label>
          {/*
            Το πρόθεμα ζωγραφίζεται **δίπλα** στο πεδίο και όχι μέσα του: ο
            άνθρωπος βλέπει τη διεύθυνση που θα προκύψει, χωρίς να μπορεί να
            πληκτρολογήσει μέσα σε τμήμα που δεν του ανήκει. Η τιμή έρχεται από
            το SSoT (`workspace-path.ts`) — ωμό «/o/» εδώ θα ήταν δεύτερη γραφή.
          */}
          <div className="flex items-stretch overflow-hidden rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
            <span
              className="flex select-none items-center border-r border-input bg-muted px-3 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              /{WORKSPACE_PATH_PREFIX}/
            </span>
            <Input
              id="workspace-alias"
              value={alias}
              onChange={(e) => { setAliasTouched(true); setAlias(e.target.value); }}
              minLength={ALIAS_MIN_LENGTH}
              maxLength={ALIAS_MAX_LENGTH}
              required
              disabled={busy}
              spellCheck={false}
              autoComplete="off"
              aria-describedby="workspace-alias-hint"
              className="rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <p id="workspace-alias-hint" className="text-xs text-muted-foreground">
            {t('onboarding.workspace.aliasHint', {
              min: ALIAS_MIN_LENGTH,
              max: ALIAS_MAX_LENGTH,
            })}
            {!aliasTouched && alias.length > 0 && (
              <> {t('onboarding.workspace.aliasAuto')}</>
            )}
          </p>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-card p-4">
        <p className="flex items-start gap-2.5 text-sm text-card-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--text-success))]" aria-hidden="true" />
          {t('onboarding.workspace.youBecomeAdmin')}
        </p>
        <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('onboarding.workspace.privateStays')}
        </p>
      </section>

      {errorCode && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <RejectionMessage code={errorCode} />
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={busy || displayName.trim().length === 0 || alias.length === 0}
      >
        {busy
          ? t('onboarding.workspace.submitting')
          : t('onboarding.workspace.submit')}
        {!busy && <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />}
      </Button>
    </form>
  );
}
