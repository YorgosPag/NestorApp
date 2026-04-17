'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ShowcaseMedia } from './types';

interface ShowcaseFloorplansProps {
  floorplans: ShowcaseMedia[];
}

export function ShowcaseFloorplans({ floorplans }: ShowcaseFloorplansProps) {
  const { t } = useTranslation('showcase');
  if (floorplans.length === 0) return null;
  return (
    <section className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('floorplans.title')}</h2>
      <ul className="space-y-3">
        {floorplans.map((plan) => (
          <li key={plan.id} className="border border-gray-100 rounded-lg p-3">
            <a
              href={plan.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-700 hover:underline font-medium"
            >
              {plan.displayName || t('floorplans.defaultName')}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
