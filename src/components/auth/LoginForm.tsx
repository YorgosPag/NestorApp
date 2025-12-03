'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const notifications = useNotifications();
  const { t } = useTranslation('auth');

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      notifications.success(`✅ ${t('login.success.title')}: ${t('login.success.message')}`);
      // Here you would typically redirect the user, e.g., router.push('/dashboard')
    } catch (error) {
      console.error("Login error:", error);
      notifications.error(`❌ ${t('login.error.title')}: ${t('login.error.message')}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
            <CardDescription>{t('login.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                <Label htmlFor="email">{t('login.email')}</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder={t('login.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                />
                </div>
                <div className="space-y-2">
                <Label htmlFor="password">{t('login.password')}</Label>
                <Input
                    id="password"
                    type="password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                    <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('login.submitting')}
                    </>
                ) : (
                    t('login.submit')
                )}
                </Button>
            </form>
            </CardContent>
        </Card>
    </div>
  );
}
