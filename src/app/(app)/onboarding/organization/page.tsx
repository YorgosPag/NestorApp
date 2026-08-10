'use client';

import { useState, useEffect, type ElementType } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Calculator, Briefcase, Scale, Check } from 'lucide-react';
import { useAuth } from '@/auth';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { PageLoadingState } from '@/core/states';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeptKey = 'accounting' | 'sales' | 'engineering' | 'legal';

interface DeptConfig {
  key: DeptKey;
  icon: ElementType;
  preselected: boolean;
}

const DEPT_CONFIGS: DeptConfig[] = [
  { key: 'accounting', icon: Calculator, preselected: true },
  { key: 'sales',      icon: Briefcase,  preselected: true },
  { key: 'engineering', icon: Building2, preselected: false },
  { key: 'legal',      icon: Scale,      preselected: false },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface DeptToggleProps {
  config: Omit<DeptConfig, 'preselected'>;
  selected: boolean;
  label: string;
  note: string;
  badge: string;
  onToggle: () => void;
}

function DeptToggle({ config, selected, label, note, badge, onToggle }: DeptToggleProps) {
  const Icon = config.icon;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'w-full flex items-start gap-4 rounded-lg border p-4 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:bg-muted/30',
      ].join(' ')}
    >
      <div className={[
        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
        selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
      ].join(' ')}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            {badge}
          </span>
          {selected && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingOrganizationPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const { t } = useTranslation('onboarding');

  const [selected, setSelected] = useState<Set<DeptKey>>(
    new Set(DEPT_CONFIGS.filter((d) => d.preselected).map((d) => d.key)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return <PageLoadingState icon={Building2} message={t('onboarding.org.actions.saving')} layout="fullscreen" />;
  }

  if (!isAuthenticated) return null;

  const toggleDept = (key: DeptKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const submit = async (action: 'complete' | 'skip') => {
    setSaving(true);
    setError(null);

    try {
      const body = action === 'complete'
        ? { action, selectedDepts: Array.from(selected) }
        : { action };

      const res = await fetch('/api/onboarding/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Σφάλμα');
        return;
      }

      router.replace('/');
    } catch {
      setError('Σφάλμα σύνδεσης');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-lg space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('onboarding.org.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('onboarding.org.subtitle')}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('onboarding.org.description')}
          </p>
        </header>

        <div className="space-y-3">
          {DEPT_CONFIGS.map((cfg) => (
            <DeptToggle
              key={cfg.key}
              config={cfg}
              selected={selected.has(cfg.key)}
              label={t(`onboarding.org.depts.${cfg.key}`)}
              note={t(`onboarding.org.deptNote.${cfg.key}`)}
              badge={cfg.preselected
                ? t('onboarding.org.preselected')
                : t('onboarding.org.optional')}
              onToggle={() => toggleDept(cfg.key)}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => submit('complete')}
            disabled={saving || selected.size === 0}
            className="w-full"
          >
            {saving ? t('onboarding.org.actions.saving') : t('onboarding.org.actions.confirm')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => submit('skip')}
            disabled={saving}
            className="w-full text-muted-foreground text-sm"
          >
            {t('onboarding.org.actions.skip')}
          </Button>
          {!saving && (
            <p className="text-center text-xs text-muted-foreground">
              {t('onboarding.org.skipNote')}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
