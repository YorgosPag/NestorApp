"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Sparkles, Target, MessageSquare } from "lucide-react";

export function AIAssistantCard() {
  return (
    <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border-purple-200 dark:border-purple-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <CardTitle className="text-base">AI Assistant</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Χρησιμοποιήστε τον AI βοηθό για έξυπνες προτάσεις και αυτοματισμούς
        </p>
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Έξυπνη αναζήτηση
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <Target className="mr-2 h-4 w-4" />
            Προτάσεις επαφών
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Δημιουργία μηνύματος
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
