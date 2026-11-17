'use client';

/**
 * @fileoverview **«Δώσε πρόσβαση σε επαγγελματία»** — ο διάλογος πρόσκλησης του κατόχου (ADR-916 Φ-Ε1 Σ4).
 * @module components/property-dossier/access/DossierInviteDialog
 * @related `lib/property-dossier/dossier-access-request-schema.ts` (το σώμα που στέλνεται — ο server το ξανακρίνει)
 *
 * 🏆 Το Share του Google Drive (πρόσωπο · ρόλος · λήξη), συν ό,τι εκείνο δεν έχει: **προεπισκόπηση** του τι θα δει
 *    (`DossierReachFields`) και **δήλωση σκοπού ΠΡΙΝ την αποστολή** (ADR-942 · ΓΚΠΔ — το ίδιο νόημα με το email·
 *    ⚖️ προς νομικό έλεγχο πριν την παραγωγή).
 * 🔑 Προεπιλογές πολιτικής, όχι του συστατικού: εύρος `DOSSIER_SHARE_DEFAULT_TABS` (ελάχιστη πρόσβαση) · διάρκεια
 *    `DOSSIER_SHARE_DEFAULT_DAYS`. Ο ρόλος έρχεται από τη θέση που πατήθηκε· το email από την προηγούμενη πρόσκληση
 *    στην επαναποστολή.
 */

import React, { useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DOSSIER_SHARE_DEFAULT_DAYS, DOSSIER_SHARE_DEFAULT_TABS, type DossierShareDays } from '@/config/engagement-policy';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DossierInvitationRequest } from '@/lib/property-dossier/dossier-access-request-schema';
import type { FloorplanTabKind } from '@/lib/property-dossier/property-dossier-view';
import { cn } from '@/lib/utils';
import { isValidEmail } from '@/lib/validation/email-validation';
import { DOSSIER_ENGAGEMENT_ROLES, type DossierEngagementRole, type DossierShareReach } from '@/types/engagement';
import type { EngagedDossierFile } from '@/types/my-engagements';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { DossierReachFields, DossierShareDaysField } from './DossierAccessFields';

const K = 'property-market:dossier.access';

/** Με τι ανοίγει ο διάλογος — `null` ⇒ κλειστός. */
export interface DossierInviteSeed {
  readonly role: DossierEngagementRole;
  readonly email: string;
}

interface DossierInviteDialogProps {
  readonly seed: DossierInviteSeed | null;
  readonly floorplanKind: FloorplanTabKind;
  readonly files: readonly EngagedDossierFile[];
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onSend: (request: DossierInvitationRequest) => void;
}

function isDossierRole(value: string): value is DossierEngagementRole {
  return (DOSSIER_ENGAGEMENT_ROLES as readonly string[]).includes(value);
}

function RoleField({ role, onChange }: { readonly role: DossierEngagementRole; readonly onChange: (role: DossierEngagementRole) => void }) {
  const { t } = useTranslation(['property-market']);
  return (
    <section className="space-y-2">
      <Label htmlFor="dossier-invite-role">{t(`${K}.invite.roleLabel`)}</Label>
      <Select value={role} onValueChange={(value) => { if (isDossierRole(value)) onChange(value); }}>
        <SelectTrigger id="dossier-invite-role"><SelectValue /></SelectTrigger>
        <SelectContent>
          {DOSSIER_ENGAGEMENT_ROLES.map((value) => (
            <SelectItem key={value} value={value}>{t(`${K}.roles.${value}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
}

/** Το σώμα του διαλόγου — ζει μόνο όσο ο διάλογος είναι ανοιχτός, άρα κάθε άνοιγμα ξεκινά από τις προεπιλογές. */
function InviteForm({ seed, floorplanKind, files, busy, onCancel, onSend }: DossierInviteDialogProps & { readonly seed: DossierInviteSeed }) {
  const { t } = useTranslation(['property-market']);
  const colors = useSemanticColors();
  const [email, setEmail] = useState(seed.email);
  const [role, setRole] = useState(seed.role);
  const [reach, setReach] = useState<DossierShareReach>({ tabs: DOSSIER_SHARE_DEFAULT_TABS, excludedFileIds: [] });
  const [shareDays, setShareDays] = useState<DossierShareDays>(DOSSIER_SHARE_DEFAULT_DAYS);
  const emailOk = isValidEmail(email.trim());
  const send = () => onSend({ email: email.trim(), role, reach, shareDays });
  return (
    <>
      <section className="space-y-2">
        <Label htmlFor="dossier-invite-email">{t(`${K}.invite.emailLabel`)}</Label>
        <Input id="dossier-invite-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
        {email.trim() !== '' && !emailOk && <p className={cn('m-0 text-xs', colors.text.error)}>{t(`${K}.invite.emailInvalid`)}</p>}
      </section>
      <RoleField role={role} onChange={setRole} />
      <DossierReachFields idPrefix="dossier-invite" floorplanKind={floorplanKind} files={files} reach={reach} onChange={setReach} />
      <DossierShareDaysField id="dossier-invite-days" value={shareDays} onChange={setShareDays} />
      <aside className="rounded-md border border-border bg-muted/30 p-3">
        <h3 className="m-0 text-sm font-medium">{t(`${K}.invite.purposeTitle`)}</h3>
        <p className="m-0 mt-1 text-sm text-muted-foreground">{t(`${K}.invite.purpose`)}</p>
      </aside>
      <DialogActionFooter
        cancelLabel={t(`${K}.invite.cancel`)}
        confirmLabel={t(`${K}.invite.send`)}
        busyLabel={t(`${K}.invite.sending`)}
        onCancel={onCancel}
        onConfirm={send}
        isSubmitting={busy}
        canSubmit={!busy && emailOk && reach.tabs.length > 0}
      />
    </>
  );
}

export function DossierInviteDialog(props: DossierInviteDialogProps): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  const { seed, onCancel } = props;
  if (seed === null) return null;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(`${K}.invite.title`)}</DialogTitle>
          <DialogDescription>{t(`${K}.invite.description`)}</DialogDescription>
        </DialogHeader>
        <InviteForm {...props} seed={seed} />
      </DialogContent>
    </Dialog>
  );
}
