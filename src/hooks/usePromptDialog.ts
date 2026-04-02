import { useCallback, useState } from 'react';
import type { PromptDialogProps } from '@/components/ui/PromptDialog';

interface PromptOptions {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  initialValue?: string;
}

interface UsePromptDialogReturn {
  prompt: (options: PromptOptions) => Promise<string | null>;
  dialogProps: PromptDialogProps;
}

export function usePromptDialog(): UsePromptDialogReturn {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [options, setOptions] = useState<PromptOptions>({ title: '' });
  const [resolver, setResolver] = useState<{ resolve: (value: string | null) => void } | null>(null);

  const prompt = useCallback((nextOptions: PromptOptions): Promise<string | null> => {
    setOptions(nextOptions);
    setValue(nextOptions.initialValue ?? '');
    setOpen(true);

    return new Promise<string | null>((resolve) => {
      setResolver({ resolve });
    });
  }, []);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resolver?.resolve(null);
      setResolver(null);
      setValue('');
    }
  }, [resolver]);

  const handleConfirm = useCallback(() => {
    const trimmedValue = value.trim();
    resolver?.resolve(trimmedValue.length > 0 ? trimmedValue : null);
    setResolver(null);
    setOpen(false);
    setValue('');
  }, [resolver, value]);

  return {
    prompt,
    dialogProps: {
      open,
      onOpenChange: handleOpenChange,
      title: options.title,
      description: options.description,
      label: options.label,
      placeholder: options.placeholder,
      value,
      onValueChange: setValue,
      onConfirm: handleConfirm,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      loading: false,
      disabled: false,
    },
  };
}
