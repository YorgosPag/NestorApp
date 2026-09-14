'use client';

/**
 * @fileoverview 🏆 **Η ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΚΑΡΤΑ ΣΤΙΣ ΡΥΘΜΙΣΕΙΣ** — δική της πράξη, δικό της «Αποθήκευση»
 *   (ADR-841 §7 Α21.16).
 * @related hooks/mandate/useShowcaseCard.ts · components/mandate/ShowcaseLocationEditor.tsx
 * @module components/mandate/ShowcaseCardSection
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΚΟΥΜΠΙ ΑΠΟ ΤΗ «ΔΗΜΟΣΙΕΥΣΗ»**: τα κανάλια ζουν σε `deny_all` συλλογή και η
 * δήλωση της βιτρίνας δεν μπορεί να τα κουβαλήσει — το μάθημα του σήματος (Α21 Φάση 2). Ένα κοινό
 * κουμπί θα έκρυβε ότι είναι **δύο** πράξεις με **δύο** αποτυχίες.
 *
 * ⚠️ **Όσο η φόρτωση απέτυχε, η φόρμα ΔΕΝ εμφανίζεται** (N.12): κενή φόρμα πάνω σε βλάβη θα
 * καλούσε τον άνθρωπο να «αποθηκεύσει» — και να σβήσει την αληθινή του κάρτα.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MAX_PUBLIC_WEBSITE_LENGTH } from '@/lib/validation/email-validation';
import { useShowcaseCard, type ShowcaseCardFailure } from '@/hooks/mandate/useShowcaseCard';
import {
  draftOfLocation,
  emptyLocationDraft,
  wireOfDrafts,
  type ShowcaseLocationDraft,
} from '@/lib/agency/showcase-card-draft';
import {
  MAX_EMAILS_PER_LOCATION,
  MAX_PHONES_PER_LOCATION,
  MAX_SHOWCASE_LOCATIONS,
  type OwnedShowcaseLocation,
} from '@/types/showcase-card';
import type { SavedEmailChannels } from './ShowcaseEmailConfirmationControl';
import {
  SHOWCASE_CARD_KEYS,
  SHOWCASE_KEYS,
  SHOWCASE_NS,
  SHOWCASE_REJECTION_KEYS,
} from '@/components/mandate/agency-showcase-labels';
import { ShowcaseLocationEditor } from './ShowcaseLocationEditor';
import { ShowcaseCardImportControl } from './ShowcaseCardImportControl';
import { ShowcaseImportProvenance } from './ShowcaseImportProvenance';
import type { ImportOrigin } from '@/types/showcase-card-import';

const LIMITS = { maxLocations: MAX_SHOWCASE_LOCATIONS, maxPhones: MAX_PHONES_PER_LOCATION, maxEmails: MAX_EMAILS_PER_LOCATION };

/**
 * ⚠️ **Οι κλήσεις `t()` γράφονται ΕΔΩ, ρητά** — ποτέ `t(failureKey(f))`: ο τεμαχιστής του ADR-744
 * (CHECK 3.34) το μέτρησε ως *«unresolved dynamic t()»* (δες την κεφαλίδα του `agency-directory-labels`).
 */
function useFailureText(failure: ShowcaseCardFailure | null): string | null {
  const { t } = useTranslation([SHOWCASE_NS]);
  if (failure === null) return null;
  switch (failure.kind) {
    case 'rejected':
      return t(SHOWCASE_REJECTION_KEYS[failure.reason], LIMITS);
    case 'place-not-found':
      return t(SHOWCASE_KEYS.placeNotFound);
    case 'unavailable':
      return t(SHOWCASE_KEYS.temporarilyUnavailable);
    case 'failed':
      return t(SHOWCASE_KEYS.failed);
  }
}

function CardFooter({
  busy,
  saved,
  notice,
  onSave,
}: {
  readonly busy: boolean;
  readonly saved: boolean;
  readonly notice: string | null;
  readonly onSave: () => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <footer className="flex flex-col gap-2">
      {notice !== null ? <p role="alert" className="m-0 text-sm text-destructive">{notice}</p> : null}
      <span className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy} onClick={onSave}>
          {busy ? t(SHOWCASE_CARD_KEYS.saving) : t(SHOWCASE_CARD_KEYS.save)}
        </Button>
        {saved ? <span role="status" className="text-sm text-muted-foreground">{t(SHOWCASE_CARD_KEYS.saved)}</span> : null}
      </span>
    </footer>
  );
}

/** **Η ιστοσελίδα του οργανισμού** (Α21.17) — μία, πάνω από τα καταστήματα, γιατί ανήκει στον οργανισμό. */
function WebsiteField({
  value,
  origin,
  onChange,
}: {
  readonly value: string;
  /** Α21.19 — ήρθε από την εισαγωγή· `null` μόλις ο άνθρωπος τη γράψει. */
  readonly origin: ImportOrigin | null;
  readonly onChange: (next: string) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <span className="flex flex-col gap-1">
      <Label htmlFor="showcase-card-website">{t(SHOWCASE_CARD_KEYS.websiteLabel)}</Label>
      <ShowcaseImportProvenance origin={origin} />
      <Input
        id="showcase-card-website"
        type="url"
        inputMode="url"
        autoComplete="url"
        maxLength={MAX_PUBLIC_WEBSITE_LENGTH}
        aria-describedby="showcase-card-website-hint"
        placeholder={t(SHOWCASE_CARD_KEYS.websitePlaceholder)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span id="showcase-card-website-hint" className="text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.websiteHint)}</span>
    </span>
  );
}

/** Α21.18 — το **αποθηκευμένο** μισό ενός προχείρου: μόνο αυτό μπορεί να ζητήσει επιβεβαίωση. */
function savedOf(locations: readonly OwnedShowcaseLocation[], draft: ShowcaseLocationDraft): SavedEmailChannels | null {
  const location = draft.id === null ? undefined : locations.find(({ id }) => id === draft.id);
  return location === undefined ? null : { locationId: location.id, channels: location.channels };
}

function useCardDrafts(loaded: readonly ShowcaseLocationDraft[] | null) {
  const [drafts, setDrafts] = React.useState<readonly ShowcaseLocationDraft[]>([]);
  // 🔑 Κάθε νέα απάντηση του διακομιστή (φόρτωση ή αποθήκευση) γίνεται η αλήθεια της φόρμας —
  //    η αποθήκευση επιστρέφει τις **ταυτότητες** των νέων καταστημάτων.
  React.useEffect(() => {
    if (loaded !== null) setDrafts(loaded);
  }, [loaded]);
  const patch = (key: string, next: ShowcaseLocationDraft | null) =>
    setDrafts((current) =>
      next === null ? current.filter((draft) => draft.key !== key) : current.map((draft) => (draft.key === key ? next : draft)),
    );
  return { drafts, setDrafts, patch };
}

export function ShowcaseCardSection({ enabled }: { readonly enabled: boolean }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const { load, busy, failure, saved, save } = useShowcaseCard(enabled);
  const loaded = React.useMemo(
    () => (load.phase === 'loaded' ? load.locations.map(draftOfLocation) : null),
    [load],
  );
  const { drafts, setDrafts, patch } = useCardDrafts(loaded);
  const [website, setWebsite] = React.useState('');
  // 🔑 Ίδιος κανόνας με τα πρόχειρα: κάθε απάντηση του διακομιστή γίνεται η αλήθεια της φόρμας —
  //    η αποθήκευση επιστρέφει την **κανονικοποιημένη** διεύθυνση (`www.x.gr` → `https://www.x.gr/`).
  const [websiteOrigin, setWebsiteOrigin] = React.useState<ImportOrigin | null>(null);
  React.useEffect(() => {
    if (load.phase === 'loaded') setWebsite(load.website ?? '');
    setWebsiteOrigin(null);
  }, [load]);
  const [missingPlace, setMissingPlace] = React.useState(false);
  // Α21.19 — η εισαγωγή αντικαθιστά **το πρόχειρο**, ποτέ την αποθηκευμένη κάρτα.
  const onImport = (nextDrafts: readonly ShowcaseLocationDraft[], nextWebsite: string, origin: ImportOrigin | null) => {
    setDrafts(nextDrafts);
    setWebsite(nextWebsite);
    setWebsiteOrigin(origin);
  };
  const failureText = useFailureText(failure);

  const onSave = () => {
    const formed = wireOfDrafts(drafts, website);
    setMissingPlace('missingPlaceIndex' in formed);
    if ('wire' in formed) void save(formed.wire);
  };
  const notice = missingPlace ? t(SHOWCASE_CARD_KEYS.placeMissing) : failureText;
  const hasHeadquarters = drafts.some(({ role }) => role === 'headquarters');

  return (
    <section className="flex flex-col gap-4" aria-labelledby="showcase-card-title">
      <header className="flex flex-col gap-1">
        <h1 id="showcase-card-title" className="m-0 text-2xl font-semibold text-foreground">{t(SHOWCASE_CARD_KEYS.title)}</h1>
        <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_CARD_KEYS.lead)}</p>
      </header>
      {!enabled ? <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_CARD_KEYS.needsShowcase)}</p> : null}
      {load.phase === 'failed' ? <p role="alert" className="m-0 text-sm text-destructive">{t(SHOWCASE_CARD_KEYS.loadFailed)}</p> : null}
      {load.phase === 'loaded' ? (
        <>
          <ShowcaseCardImportControl enabled={enabled} drafts={drafts} website={website} onReplace={onImport} />
          <WebsiteField
            value={website}
            origin={websiteOrigin}
            onChange={(next) => {
              setWebsite(next);
              setWebsiteOrigin(null);
            }}
          />
          {drafts.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_CARD_KEYS.empty)}</p> : null}
          {drafts.map((draft) => (
            <ShowcaseLocationEditor key={draft.key} draft={draft} saved={savedOf(load.locations, draft)} onChange={(next) => patch(draft.key, next)} onRemove={() => patch(draft.key, null)} />
          ))}
          <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.emailConfirmHint)}</p>
          <span className="flex flex-wrap gap-2">
            {!hasHeadquarters ? (
              <Button type="button" variant="outline" onClick={() => setDrafts([emptyLocationDraft('headquarters'), ...drafts])}>{t(SHOWCASE_CARD_KEYS.addHeadquarters)}</Button>
            ) : null}
            {drafts.length < MAX_SHOWCASE_LOCATIONS ? (
              <Button type="button" variant="outline" onClick={() => setDrafts([...drafts, emptyLocationDraft('branch')])}>{t(SHOWCASE_CARD_KEYS.addBranch)}</Button>
            ) : null}
          </span>
          <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.channelsHint)}</p>
          <CardFooter busy={busy} saved={saved} notice={notice} onSave={onSave} />
        </>
      ) : null}
    </section>
  );
}
