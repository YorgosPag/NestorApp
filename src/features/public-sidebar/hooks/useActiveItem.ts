'use client';
import { usePathname } from 'next/navigation';

export function useActiveItem() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;
  return { isActive };
}
