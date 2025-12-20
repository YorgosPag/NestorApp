
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const UNSAVED_MESSAGE = 'Έχετε μη αποθηκευμένες αλλαγές. Είστε σίγουροι ότι θέλετε να φύγετε;';

export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  const router = useRouter();

  // Handle browser-level events (reload, close tab)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = UNSAVED_MESSAGE;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Handle Next.js router events
  // Note: This is more complex with App Router. A full solution
  // might involve a custom router provider or intercepting link clicks.
  // For now, this is a basic implementation.
  useEffect(() => {
    const originalPush = router.push;
    const originalReplace = router.replace;
    const originalBack = router.back;
    const originalForward = router.forward;
    
    const confirmAndProceed = (action: () => void) => {
        if (hasUnsavedChanges) {
            if (window.confirm(UNSAVED_MESSAGE)) {
                action();
            }
        } else {
            action();
        }
    }
    
    router.push = (...args: Parameters<typeof originalPush>) => {
        confirmAndProceed(() => originalPush(...args));
    }
    
    router.replace = (...args: Parameters<typeof originalReplace>) => {
        confirmAndProceed(() => originalReplace(...args));
    }
    
    router.back = () => {
        confirmAndProceed(() => originalBack());
    }

    router.forward = () => {
        confirmAndProceed(() => originalForward());
    }
    
    return () => {
      router.push = originalPush;
      router.replace = originalReplace;
      router.back = originalBack;
      router.forward = originalForward;
    };
  }, [hasUnsavedChanges, router]);
}
