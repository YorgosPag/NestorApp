"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Sparkles, Target, MessageSquare } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

export function AIAssistantCard() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <Card className={`bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 ${quick.info}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className={`${iconSizes.xl} rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center`}>
            <Zap className={`${iconSizes.sm} text-white`} />
          </div>
          <CardTitle className="text-base">AI Assistant</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className={cn("text-sm mb-4", colors.text.muted)}>
          Χρησιμοποιήστε τον AI βοηθό για έξυπνες προτάσεις και αυτοματισμούς
        </p>
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <Sparkles className={`mr-2 ${iconSizes.sm}`} />
            Έξυπνη αναζήτηση
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <Target className={`mr-2 ${iconSizes.sm}`} />
            Προτάσεις επαφών
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <MessageSquare className={`mr-2 ${iconSizes.sm}`} />
            Δημιουργία μηνύματος
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
