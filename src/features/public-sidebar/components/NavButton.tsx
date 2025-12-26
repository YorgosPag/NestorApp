'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

export function NavButton({
  item,
  active,
}: {
  item: { title: string; href: string; icon: LucideIcon; description: string };
  active: boolean;
}) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const Icon = item.icon;
  return (
    <Link href={item.href}>
      <Button
        variant={active ? 'secondary' : 'ghost'}
        className={cn('w-full justify-start h-12 text-left px-3', active && `bg-blue-50 text-blue-700 ${getStatusBorder('info')}`)}
      >
        <Icon className={`mr-3 ${iconSizes.sm}`} />
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">{item.title}</span>
          <span className="text-xs text-muted-foreground">{item.description}</span>
        </div>
      </Button>
    </Link>
  );
}
