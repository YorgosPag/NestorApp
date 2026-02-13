"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Sparkles, Upload, Mic } from "lucide-react"
import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects'
import { CommonBadge } from "@/core/badges"
import { quickActions } from "@/constants/header"
import { useIconSizes } from '@/hooks/useIconSizes'
import { useAuth } from '@/auth/hooks/useAuth'
import { createCommunicationClient } from '@/services/communications-client.service'
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useEffect, useMemo, useRef, useState } from 'react'

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: {
    transcript: string;
  };
}

interface SpeechRecognitionEventLike extends Event {
  results: SpeechRecognitionResultLike[];
}

interface SpeechRecognitionErrorLike extends Event {
  error?: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function QuickAddMenu() {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n support
  const { t, currentLanguage } = useTranslation('common');
  const { user } = useAuth();
  const [dictationOpen, setDictationOpen] = useState(false);
  const [dictationText, setDictationText] = useState('');
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const recognitionAvailable = useMemo(
    () => Boolean(getSpeechRecognitionConstructor()),
    []
  );

  useEffect(() => {
    if (!dictationOpen) {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      setIsListening(false);
      setDictationError(null);
      return;
    }

    const RecognitionConstructor = getSpeechRecognitionConstructor();
    if (!RecognitionConstructor) {
      setDictationError(t('voiceDictation.notSupported'));
      return;
    }

    const recognition = new RecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = currentLanguage || 'el';

    recognition.onresult = (event) => {
      const transcripts = event.results.map((result) => result[0]?.transcript || '');
      const text = transcripts.join(' ').trim();
      setDictationText(text);
    };

    recognition.onerror = (event) => {
      setDictationError(event.error || t('voiceDictation.error'));
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [dictationOpen, currentLanguage, t]);

  const handleStartDictation = () => {
    if (!recognitionRef.current) return;
    setDictationError(null);
    recognitionRef.current.start();
    setIsListening(true);
  };

  const handleStopDictation = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  };

  const handleSaveDictation = async () => {
    const content = dictationText.trim();
    if (!content) {
      setDictationError(t('voiceDictation.empty'));
      return;
    }

    if (!user?.uid) {
      setDictationError(t('voiceDictation.authRequired'));
      return;
    }

    const result = await createCommunicationClient({
      type: 'note',
      content,
      direction: 'inbound',
      userId: user.uid,
    });

    if (!result.success) {
      setDictationError(result.error || t('voiceDictation.error'));
      return;
    }

    setDictationText('');
    setDictationError(null);
    setDictationOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className={`relative text-white shadow-lg ${GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON}`}
              >
                <Plus className={iconSizes.sm} />
                <Sparkles className={`absolute -top-1 -right-1 ${iconSizes.xs} text-yellow-300 animate-pulse`} />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('quickAdd.tooltip')}</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t('quickAdd.menuTitle')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {quickActions.map((action) => (
            <DropdownMenuItem key={action.label} className="cursor-pointer">
              <action.icon className={`mr-2 ${iconSizes.sm}`} />
              <span>{action.label}</span>
              <DropdownMenuShortcut>⌘{action.shortcut}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer">
            <Upload className={`mr-2 ${iconSizes.sm}`} />
            <span>{t('quickAdd.importFromFile')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(event) => {
              event.preventDefault();
              setDictationOpen(true);
            }}
          >
            <Mic className={`mr-2 ${iconSizes.sm}`} />
            <span>{t('quickAdd.voiceInput')}</span>
            <CommonBadge
              status="company"
              customLabel="AI"
              variant="secondary"
              className="ml-auto text-xs"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={dictationOpen} onOpenChange={setDictationOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('voiceDictation.title')}</DialogTitle>
            <DialogDescription>{t('voiceDictation.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={dictationText}
              onChange={(event) => setDictationText(event.target.value)}
              placeholder={t('voiceDictation.placeholder')}
              className="min-h-[160px]"
            />
            {dictationError && (
              <p className="text-sm text-destructive">{dictationError}</p>
            )}
            {!recognitionAvailable && (
              <p className="text-sm text-muted-foreground">
                {t('voiceDictation.notSupported')}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDictationOpen(false)}>
              {t('voiceDictation.cancel')}
            </Button>
            {isListening ? (
              <Button variant="outline" onClick={handleStopDictation}>
                {t('voiceDictation.stop')}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleStartDictation}
                disabled={!recognitionAvailable}
              >
                {t('voiceDictation.start')}
              </Button>
            )}
            <Button onClick={handleSaveDictation}>
              {t('voiceDictation.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
