'use client';

/**
 * ADR-336 — Signatory proposal card.
 *
 * Renders the AI-extracted signatory block from a quote with per-field
 * confidence color (Q2). User edits inline, picks a relationship type via
 * RelationshipTypePicker, and clicks one button to commit (creates or links
 * the IndividualContact + materializes the vendor↔signatory relationship).
 *
 * Weak-match responses surface SignatoryDisambiguationModal — the user
 * resolves "same person / different person / defer" before persistence.
 */

import { useMemo, useState } from 'react';
import { Loader2, UserCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EscoOccupationPicker } from '@/components/shared/EscoOccupationPicker';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  SIGNATORY_CONFIDENCE_HIGH,
  SIGNATORY_CONFIDENCE_MEDIUM,
  aggregateSignatoryBand,
  getSignatoryConfidenceBand,
  type SignatoryConfidenceBand,
} from '@/subapps/procurement/services/signatory-confidence';
import type { ExtractedSignatory } from '@/subapps/procurement/types/quote';
import { RelationshipTypePicker } from './RelationshipTypePicker';
import { SignatoryDisambiguationModal } from './SignatoryDisambiguationModal';
import type {
  CommitSignatoryRequest,
  CommitSignatoryResponse,
  RelationshipTypeChoice,
  SignatoryFields,
  SignatoryFieldKey,
  WeakMatchCandidate,
} from './types';

// ============================================================================
// PROPS
// ============================================================================

export interface SignatoryProposalCardProps {
  quoteId: string;
  signatory: ExtractedSignatory;
  /** Called after a successful commit (link or create). */
  onCommitted?: (result: {
    contactId: string;
    relationshipId: string;
    matchKind: string;
    relationshipTypeKey: string;
    reused: boolean;
  }) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

const BAND_BORDER: Record<SignatoryConfidenceBand, string> = {
  high: 'border-l-green-500 bg-green-50/40 dark:bg-green-950/20',
  medium: 'border-l-yellow-500 bg-yellow-50/40 dark:bg-yellow-950/20',
  low: 'border-l-red-500 bg-red-50/40 dark:bg-red-950/20',
};

const BAND_BUTTON: Record<SignatoryConfidenceBand, string> = {
  high: 'bg-green-600 hover:bg-green-700 text-white',
  medium: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  low: '',
};

function ConfidencePill({ confidence }: { confidence: number }) {
  if (confidence === 0) return null;
  const band = getSignatoryConfidenceBand(confidence);
  const cls =
    band === 'high'
      ? 'border-green-500 text-green-700 dark:text-green-400'
      : band === 'medium'
      ? 'border-yellow-500 text-yellow-700 dark:text-yellow-400'
      : 'border-red-500 text-red-700 dark:text-red-400';
  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {confidence}%
    </Badge>
  );
}

interface EditableFieldProps {
  label: string;
  fieldKey: SignatoryFieldKey;
  value: string;
  confidence: number;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: 'text' | 'email' | 'tel';
  placeholder?: string;
}

function EditableField({
  label,
  fieldKey,
  value,
  confidence,
  onChange,
  disabled,
  type = 'text',
  placeholder,
}: EditableFieldProps) {
  const band = value ? getSignatoryConfidenceBand(confidence) : 'low';
  return (
    <div className={`rounded-md border-l-4 px-3 py-2 ${BAND_BORDER[band]}`}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`signatory-${fieldKey}`} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <ConfidencePill confidence={confidence} />
      </div>
      <Input
        id={`signatory-${fieldKey}`}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 h-8 text-sm"
      />
    </div>
  );
}

interface ProfessionEscoFieldProps {
  label: string;
  value: string;
  escoUri?: string;
  iscoCode?: string;
  confidence: number;
  onChange: (
    profession: string,
    escoUri: string | undefined,
    escoLabel: string | undefined,
    iscoCode: string | undefined,
  ) => void;
  disabled?: boolean;
}

function ProfessionEscoField({
  label,
  value,
  escoUri,
  iscoCode,
  confidence,
  onChange,
  disabled,
}: ProfessionEscoFieldProps) {
  const band = value ? getSignatoryConfidenceBand(confidence) : 'low';
  return (
    <div className={`rounded-md border-l-4 px-3 py-2 ${BAND_BORDER[band]}`}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <ConfidencePill confidence={confidence} />
      </div>
      <div className="mt-1">
        <EscoOccupationPicker
          value={value}
          escoUri={escoUri}
          iscoCode={iscoCode}
          disabled={disabled}
          onChange={(v) => onChange(v.profession, v.escoUri, v.escoLabel, v.iscoCode)}
        />
      </div>
    </div>
  );
}

function buildInitialFields(extracted: ExtractedSignatory): SignatoryFields {
  return {
    firstName: extracted.firstName.value ?? '',
    lastName: extracted.lastName.value ?? '',
    role: extracted.role.value,
    profession: extracted.profession.value,
    escoUri: null,
    escoLabel: null,
    iscoCode: null,
    mobile: extracted.mobile.value,
    email: extracted.email.value,
    vatNumber: extracted.vatNumber.value,
  };
}

// ============================================================================
// MAIN
// ============================================================================

export function SignatoryProposalCard({
  quoteId,
  signatory,
  onCommitted,
}: SignatoryProposalCardProps) {
  const { t } = useTranslation('quotes');
  const [fields, setFields] = useState<SignatoryFields>(() => buildInitialFields(signatory));
  const [typeChoice, setTypeChoice] = useState<RelationshipTypeChoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [weakCandidates, setWeakCandidates] = useState<WeakMatchCandidate[] | null>(null);

  const aggregateBand = useMemo(
    () =>
      aggregateSignatoryBand([
        signatory.firstName.confidence,
        signatory.lastName.confidence,
        signatory.role.confidence,
        signatory.profession.confidence,
        signatory.mobile.confidence,
        signatory.email.confidence,
        signatory.vatNumber.confidence,
      ]),
    [signatory]
  );

  const hasName = fields.firstName.trim() && fields.lastName.trim();
  const hasType = typeChoice && (
    typeChoice.kind === 'static' ||
    (typeChoice.kind === 'custom' && typeChoice.labelEl.trim().length > 0)
  );
  const canCommit = Boolean(hasName && hasType) && !isSubmitting;

  const setField = (key: SignatoryFieldKey, value: string): void => {
    setFields((prev) => ({
      ...prev,
      [key]: value === '' && key !== 'firstName' && key !== 'lastName' ? null : value,
    }));
  };

  const setProfessionFromEsco = (
    profession: string,
    escoUri: string | undefined,
    escoLabel: string | undefined,
    iscoCode: string | undefined,
  ): void => {
    setFields((prev) => ({
      ...prev,
      profession: profession === '' ? null : profession,
      escoUri: escoUri ?? null,
      escoLabel: escoLabel ?? null,
      iscoCode: iscoCode ?? null,
    }));
  };

  const submit = async (
    overrides?: Partial<Pick<CommitSignatoryRequest, 'linkToContactId' | 'forceCreate'>>
  ): Promise<void> => {
    if (!typeChoice) return;
    setIsSubmitting(true);
    try {
      const body: CommitSignatoryRequest = {
        signatory: fields,
        relationshipType: typeChoice,
        ...overrides,
      };
      const res = await fetch(`/api/quotes/${quoteId}/commit-signatory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as CommitSignatoryResponse;

      if (res.status === 409 && 'requiresDisambiguation' in json && json.requiresDisambiguation) {
        setWeakCandidates(json.candidates);
        return;
      }
      if (!res.ok || !('success' in json) || !json.success) {
        const errMsg = 'error' in json ? json.error : t('quotes.signatory.commitError');
        toast.error(errMsg);
        return;
      }
      const ok = json;
      toast.success(t('quotes.signatory.commitSuccess'));
      setWeakCandidates(null);
      onCommitted?.({
        contactId: ok.data.contactId,
        relationshipId: ok.data.relationshipId,
        matchKind: ok.data.matchKind,
        relationshipTypeKey: ok.data.relationshipTypeKey,
        reused: ok.data.reused.contact || ok.data.reused.relationship,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('quotes.signatory.commitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className={`border-l-4 ${BAND_BORDER[aggregateBand].split(' ')[0]}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">{t('quotes.signatory.cardTitle')}</CardTitle>
          <Badge variant="outline" className="text-xs">
            {t(`quotes.signatory.confidenceBand.${aggregateBand}`, {
              high: SIGNATORY_CONFIDENCE_HIGH,
              medium: SIGNATORY_CONFIDENCE_MEDIUM,
            })}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <EditableField
              label={t('quotes.signatory.fields.firstName')}
              fieldKey="firstName"
              value={fields.firstName}
              confidence={signatory.firstName.confidence}
              onChange={(v) => setField('firstName', v)}
              disabled={isSubmitting}
            />
            <EditableField
              label={t('quotes.signatory.fields.lastName')}
              fieldKey="lastName"
              value={fields.lastName}
              confidence={signatory.lastName.confidence}
              onChange={(v) => setField('lastName', v)}
              disabled={isSubmitting}
            />
            <EditableField
              label={t('quotes.signatory.fields.role')}
              fieldKey="role"
              value={fields.role ?? ''}
              confidence={signatory.role.confidence}
              onChange={(v) => setField('role', v)}
              disabled={isSubmitting}
            />
            <ProfessionEscoField
              label={t('quotes.signatory.fields.profession')}
              value={fields.profession ?? ''}
              escoUri={fields.escoUri ?? undefined}
              iscoCode={fields.iscoCode ?? undefined}
              confidence={signatory.profession.confidence}
              onChange={setProfessionFromEsco}
              disabled={isSubmitting}
            />
            <EditableField
              label={t('quotes.signatory.fields.mobile')}
              fieldKey="mobile"
              value={fields.mobile ?? ''}
              confidence={signatory.mobile.confidence}
              onChange={(v) => setField('mobile', v)}
              disabled={isSubmitting}
              type="tel"
            />
            <EditableField
              label={t('quotes.signatory.fields.email')}
              fieldKey="email"
              value={fields.email ?? ''}
              confidence={signatory.email.confidence}
              onChange={(v) => setField('email', v)}
              disabled={isSubmitting}
              type="email"
            />
            <EditableField
              label={t('quotes.signatory.fields.vatNumber')}
              fieldKey="vatNumber"
              value={fields.vatNumber ?? ''}
              confidence={signatory.vatNumber.confidence}
              onChange={(v) => setField('vatNumber', v)}
              disabled={isSubmitting}
            />
          </div>

          <RelationshipTypePicker
            value={typeChoice}
            onChange={setTypeChoice}
            disabled={isSubmitting}
          />

          <div className="flex justify-end pt-1">
            <Button
              onClick={() => void submit()}
              disabled={!canCommit}
              className={canCommit ? BAND_BUTTON[aggregateBand] : ''}
            >
              {isSubmitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : aggregateBand === 'high' ? (
                <UserCheck className="mr-1 h-4 w-4" />
              ) : (
                <UserPlus className="mr-1 h-4 w-4" />
              )}
              {t(`quotes.signatory.commitButton.${aggregateBand}`)}
            </Button>
          </div>
        </CardContent>
      </Card>

      <SignatoryDisambiguationModal
        open={Boolean(weakCandidates)}
        candidates={weakCandidates ?? []}
        isSubmitting={isSubmitting}
        onLink={(contactId) => void submit({ linkToContactId: contactId })}
        onCreateAnyway={() => void submit({ forceCreate: true })}
        onCancel={() => setWeakCandidates(null)}
      />
    </>
  );
}
