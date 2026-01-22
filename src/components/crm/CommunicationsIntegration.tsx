// src/components/crm/CommunicationsIntegration.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { CommonBadge } from '@/core/badges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  MessageSquare,
  Mail,
  Phone,
  Send,
  Settings,
  Activity,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Plus,
  BarChart3,
  Users,
  Clock
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import UnifiedInbox from './UnifiedInbox';
import SendMessageModal from './SendMessageModal';
import communicationsService, { 
  initializeCommunications, 
  getChannelsStatus,
  testAllChannels,
  getCommunicationsStats 
} from '../../lib/communications';
import { MESSAGE_TYPES } from '../../lib/config/communications.config';
import { toast } from 'sonner';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * 🏢 ENTERPRISE: Communications Stats Interface
 */
interface CommunicationsStats {
  totalMessages: number;
  byChannel: Record<string, number>;
  byDirection: { inbound: number; outbound: number };
  responseTime: { average: string; median: string };
  period: string;
}

/**
 * Communications Integration Component
 * Κεντρικό component που ενσωματώνει όλη την communications infrastructure στο CRM
 */

interface CommunicationsIntegrationProps {
  leadData?: { id?: string } | null;
  defaultTab?: string;
}

const CommunicationsIntegration: React.FC<CommunicationsIntegrationProps> = ({ leadData = null, defaultTab = "inbox" }) => {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('communications');
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [channelsStatus, setChannelsStatus] = useState<Record<string, unknown>>({});
  const [stats, setStats] = useState<CommunicationsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);

  useEffect(() => {
    initializeSystem();
  }, []);

  useEffect(() => {
    if (initialized) {
      loadData();
    }
  }, [initialized]);

  /**
   * Αρχικοποίηση του communications system
   */
  const initializeSystem = async () => {
    try {
      setLoading(true);
      
      // Αρχικοποίηση communications service
      const initResult = await initializeCommunications();

      if (initResult.success) {
        setInitialized(true);
        toast.success(t('center.initSuccess'));
      } else {
        toast.error(t('center.initError'));
      }

    } catch (error) {
      console.error('Error initializing communications:', error);
      toast.error(t('center.initErrorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Φόρτωση δεδομένων
   */
  const loadData = async () => {
    try {
      // Φόρτωση status channels
      const channels = await getChannelsStatus();
      setChannelsStatus(channels);

      // Φόρτωση στατιστικών
      const statistics = await getCommunicationsStats();
      setStats(statistics);

    } catch (error) {
      console.error('Error loading communications data:', error);
    }
  };

  /**
   * Test όλων των channels
   */
  const handleTestChannels = async () => {
    try {
      setTesting(true);
      const results = await testAllChannels();
      
      // Εμφάνιση αποτελεσμάτων
      const successfulChannels = Object.entries(results)
        .filter(([, result]) => result.success)
        .map(([channel]) => channel);
      
      const failedChannels = Object.entries(results)
        .filter(([, result]) => !result.success)
        .map(([channel]) => channel);

      if (successfulChannels.length > 0) {
        toast.success(t('center.channelsSuccess', { channels: successfulChannels.join(', ') }));
      }

      if (failedChannels.length > 0) {
        toast.error(t('center.channelsFailed', { channels: failedChannels.join(', ') }));
      }

      // Refresh channels status
      await loadData();

    } catch (error) {
      console.error('Error testing channels:', error);
      toast.error(t('center.channelsTestError'));
    } finally {
      setTesting(false);
    }
  };

  /**
   * Refresh δεδομένων
   */
  const handleRefresh = async () => {
    await loadData();
    toast.success(t('center.dataRefreshed'));
  };

  /**
   * Callback όταν στέλνεται μήνυμα
   */
  const handleMessageSent = async (result: { success: boolean }) => {
    // Refresh inbox για να φανεί το νέο μήνυμα
    await loadData();
  };

  /**
   * Render channel status badge
   */
  const renderChannelStatus = (channelName: string, status: { enabled: boolean; configured: boolean }) => {
    const isEnabled = status.enabled && status.configured;

    return (
      <div key={channelName} className="flex items-center justify-between p-3 border rounded-lg">
        <div className="flex items-center gap-2">
          {getChannelIcon(channelName)}
          <span className="font-medium capitalize">{channelName}</span>
        </div>
        <div className="flex items-center gap-2">
          <CommonBadge
            status="company"
            customLabel={isEnabled ? t('center.channelStatus.active') : t('center.channelStatus.inactive')}
            variant={isEnabled ? "default" : "secondary"}
          />
          {isEnabled ? (
            <CheckCircle className={`${iconSizes.sm} text-green-600`} />
          ) : (
            <AlertCircle className={`${iconSizes.sm} text-orange-600`} />
          )}
        </div>
      </div>
    );
  };

  /**
   * Λήψη icon για κάθε channel
   */
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case MESSAGE_TYPES.EMAIL:
      case 'email':
        return <Mail className={iconSizes.sm} />;
      case MESSAGE_TYPES.TELEGRAM:
      case 'telegram':
        return <MessageSquare className={`${iconSizes.sm} text-cyan-600`} />;
      case MESSAGE_TYPES.WHATSAPP:
      case 'whatsapp':
        return <MessageSquare className={`${iconSizes.sm} text-green-600`} />;
      case MESSAGE_TYPES.MESSENGER:
      case 'messenger':
        return <MessageSquare className={`${iconSizes.sm} text-purple-600`} />;
      case MESSAGE_TYPES.SMS:
      case 'sms':
        return <MessageSquare className={`${iconSizes.sm} text-orange-600`} />;
      case MESSAGE_TYPES.CALL:
      case 'call':
        return <Phone className={iconSizes.sm} />;
      default:
        return <MessageSquare className={iconSizes.sm} />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className={`${iconSizes.lg} animate-spin mr-2`} />
            {t('center.initLoading')}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!initialized) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className={`${iconSizes.xl3} mx-auto mb-4 text-orange-500`} />
            <h3 className="text-lg font-semibold mb-2">{t('center.unavailable')}</h3>
            <p className="text-gray-600 mb-4">
              {t('center.unavailableDesc')}
            </p>
            <Button onClick={initializeSystem}>
              <RefreshCw className={`${iconSizes.sm} mr-2`} />
              {t('center.retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header με Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('center.title')}</h2>
          <p className="text-gray-600">
            {t('center.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
          >
            <RefreshCw className={`${iconSizes.sm} mr-2`} />
            {t('center.refresh')}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestChannels}
            disabled={testing}
          >
            {testing ? (
              <RefreshCw className={`${iconSizes.sm} mr-2 animate-spin`} />
            ) : (
              <Activity className={`${iconSizes.sm} mr-2`} />
            )}
            {t('center.testChannels')}
          </Button>
          <SendMessageModal
            trigger={
              <Button>
                <Plus className={`${iconSizes.sm} mr-2`} />
                {t('center.newMessage')}
              </Button>
            }
            leadData={leadData}
            onMessageSent={handleMessageSent}
            open={sendModalOpen}
            onOpenChange={setSendModalOpen}
          />
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className={`${iconSizes.md} text-blue-600`} />
                <div>
                  <p className="text-sm text-gray-600">{t('center.stats.totalMessages')}</p>
                  <p className="text-2xl font-bold">{stats.totalMessages}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className={`${iconSizes.md} text-green-600`} />
                <div>
                  <p className="text-sm text-gray-600">{t('center.stats.inbound')}</p>
                  <p className="text-2xl font-bold">{stats.byDirection.inbound}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Send className={`${iconSizes.md} text-purple-600`} />
                <div>
                  <p className="text-sm text-gray-600">{t('center.stats.outbound')}</p>
                  <p className="text-2xl font-bold">{stats.byDirection.outbound}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className={`${iconSizes.md} text-orange-600`} />
                <div>
                  <p className="text-sm text-gray-600">{t('center.stats.avgResponseTime')}</p>
                  <p className="text-2xl font-bold">{stats.responseTime.average}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inbox">
            <MessageSquare className={`${iconSizes.sm} mr-2`} />
            {t('center.tabs.inbox')}
          </TabsTrigger>
          <TabsTrigger value="channels">
            <Settings className={`${iconSizes.sm} mr-2`} />
            {t('center.tabs.channels')}
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className={`${iconSizes.sm} mr-2`} />
            {t('center.tabs.analytics')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <UnifiedInbox 
            leadId={leadData?.id} 
            height="500px"
          />
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('center.channelsTab.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(channelsStatus).map(([channelName, status]) =>
                renderChannelStatus(channelName, status as { enabled: boolean; configured: boolean }) // 🏢 ENTERPRISE: Type assertion
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Messages by Channel */}
            <Card>
              <CardHeader>
                <CardTitle>{t('center.analyticsTab.messagesByChannel')}</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.byChannel && Object.entries(stats.byChannel).map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      {getChannelIcon(channel)}
                      <span className="capitalize">{channel}</span>
                    </div>
                    <CommonBadge
                      status="company"
                      customLabel={count.toString()}
                      variant="secondary"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Response Time */}
            <Card>
              <CardHeader>
                <CardTitle>{t('center.analyticsTab.responseTime')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>{t('center.analyticsTab.average')}</span>
                    <span className="font-medium">{stats?.responseTime.average}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('center.analyticsTab.median')}</span>
                    <span className="font-medium">{stats?.responseTime.median}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunicationsIntegration;
