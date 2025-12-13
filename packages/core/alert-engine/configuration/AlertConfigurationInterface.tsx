/**
 * ALERT CONFIGURATION INTERFACE
 * Geo-Alert System - Phase 5: Enterprise Configuration Management
 *
 * Comprehensive interface για configuration των alert rules, notification settings,
 * και system parameters. Implements enterprise configuration patterns.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Rule,
  RuleCondition,
  RuleAction,
  RuleCategory,
  RulePriority,
  LogicalOperator,
  ComparisonOperator,
  RulesEngine
} from '../rules/RulesEngine';
import {
  AlertDetectionSystem,
  AlertTemplate
} from '../detection/AlertDetectionSystem';
import {
  NotificationDispatchEngine,
  NotificationTemplate
} from '../notifications/NotificationDispatchEngine';

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

interface DetectionConfig {
  pollingInterval: number;
  batchSize: number;
  enableRealTime: boolean;
  accuracyThresholds: {
    warning: number;
    critical: number;
  };
}

interface NotificationConfig {
  channels: {
    email: { enabled: boolean; priority: number };
    sms: { enabled: boolean; priority: number };
    webhook: { enabled: boolean; priority: number };
    push: { enabled: boolean; priority: number };
    in_app: { enabled: boolean; priority: number };
  };
  retryAttempts: number;
  retryDelay: number;
  batchSize: number;
  rateLimit: number;
}

interface AlertConfigurationData {
  rules: Rule[];
  alertTemplates: AlertTemplate[];
  notificationTemplates: NotificationTemplate[];
  detectionConfig: DetectionConfig;
  notificationConfig: NotificationConfig;
  globalSettings: {
    enableAutoDetection: boolean;
    enableNotifications: boolean;
    defaultSeverity: 'low' | 'medium' | 'high' | 'critical';
    maxConcurrentAlerts: number;
    alertRetentionDays: number;
    notificationRetryAttempts: number;
    emergencyEscalationEnabled: boolean;
  };
}

interface ConfigurationSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: 'active' | 'inactive' | 'error';
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

const ConfigurationCard: React.FC<{
  section: ConfigurationSection;
  isSelected: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}> = ({ section, isSelected, onClick, children }) => {
  const getStatusColor = () => {
    switch (section.status) {
      case 'active': return '#10B981';
      case 'inactive': return '#6B7280';
      case 'error': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? '#F0F9FF' : 'white',
        border: `2px solid ${isSelected ? '#0EA5E9' : '#E5E7EB'}`,
        borderRadius: '8px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span style={{ fontSize: '24px' }}>{section.icon}</span>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
            {section.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: getStatusColor()
              }}
            />
            <span style={{ fontSize: '12px', color: '#6B7280', textTransform: 'capitalize' }}>
              {section.status}
            </span>
          </div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
        {section.description}
      </p>
      {children}
    </div>
  );
};

const RuleEditor: React.FC<{
  rule: Rule | null;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}> = ({ rule, onSave, onCancel }) => {
  const [editingRule, setEditingRule] = useState<Partial<Rule>>(
    rule || {
      id: `rule_${Date.now()}`,
      name: '',
      description: '',
      category: 'geospatial' as RuleCategory,
      priority: 'low' as RulePriority,
      isEnabled: true,
      conditions: { type: 'logical', operator: 'AND', children: [] } as RuleCondition,
      actions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user',
      triggerCount: 0,
      averageExecutionTime: 0,
      successRate: 100
    }
  );

  const handleSave = () => {
    if (editingRule.name && editingRule.conditions && editingRule.actions) {
      onSave(editingRule as Rule);
    }
  };

  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '600' }}>
        {rule ? 'Επεξεργασία Κανόνα' : 'Νέος Κανόνας'}
      </h3>

      {/* Basic Information */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
          Όνομα Κανόνα
        </label>
        <input
          type="text"
          value={editingRule.name || ''}
          onChange={(e) => setEditingRule(prev => ({ ...prev, name: e.target.value }))}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px'
          }}
          placeholder="π.χ. Accuracy Degradation Alert"
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
          Περιγραφή
        </label>
        <textarea
          value={editingRule.description || ''}
          onChange={(e) => setEditingRule(prev => ({ ...prev, description: e.target.value }))}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px',
            minHeight: '80px',
            resize: 'vertical'
          }}
          placeholder="Περιγραφή του κανόνα και πότε θα ενεργοποιείται..."
        />
      </div>

      {/* Priority and Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
            Προτεραιότητα
          </label>
          <select
            value={editingRule.priority || 'low'}
            onChange={(e) => setEditingRule(prev => ({ ...prev, priority: e.target.value as RulePriority }))}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value={1}>1 - Υψηλότατη</option>
            <option value={3}>3 - Υψηλή</option>
            <option value={5}>5 - Μεσαία</option>
            <option value={7}>7 - Χαμηλή</option>
            <option value={9}>9 - Χαμηλότατη</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
            Κατάσταση
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={editingRule.isEnabled || false}
              onChange={(e) => setEditingRule(prev => ({ ...prev, isEnabled: e.target.checked }))}
            />
            <span style={{ fontSize: '14px' }}>Ενεργός κανόνας</span>
          </label>
        </div>
      </div>

      {/* Conditions Section */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
          Συνθήκες (Conditions)
        </h4>
        <div style={{ background: '#F9FAFB', padding: '16px', borderRadius: '6px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
            Εδώ θα μπορείτε να ορίσετε τις συνθήκες που θα ενεργοποιούν τον κανόνα.
            Για τη Phase 5, χρησιμοποιούμε mock editor.
          </p>
          <div style={{ marginTop: '12px' }}>
            <button
              style={{
                padding: '6px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '4px',
                background: 'white',
                color: '#374151',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              + Προσθήκη Συνθήκης
            </button>
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
          Ενέργειες (Actions)
        </h4>
        <div style={{ background: '#F9FAFB', padding: '16px', borderRadius: '6px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
            Ορίστε τι θα συμβαίνει όταν ενεργοποιηθεί ο κανόνας
            (δημιουργία alert, αποστολή email, κ.λπ.).
          </p>
          <div style={{ marginTop: '12px' }}>
            <button
              style={{
                padding: '6px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '4px',
                background: 'white',
                color: '#374151',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              + Προσθήκη Ενέργειας
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 20px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            background: 'white',
            color: '#374151',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Ακύρωση
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            background: '#0EA5E9',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Αποθήκευση
        </button>
      </div>
    </div>
  );
};

const NotificationSettings: React.FC<{
  config: NotificationConfig | null;
  onUpdate: (config: NotificationConfig) => void;
}> = ({ config, onUpdate }) => {
  const [editingConfig, setEditingConfig] = useState<NotificationConfig>(
    config || {
      channels: {
        email: { enabled: true, priority: 1 },
        sms: { enabled: false, priority: 2 },
        webhook: { enabled: true, priority: 3 },
        push: { enabled: false, priority: 4 },
        in_app: { enabled: true, priority: 5 }
      },
      retryAttempts: 3,
      retryDelay: 5000,
      batchSize: 10,
      rateLimit: 100
    }
  );

  const handleChannelToggle = (channel: string) => {
    setEditingConfig(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: {
          ...prev.channels[channel as keyof typeof prev.channels],
          enabled: !prev.channels[channel as keyof typeof prev.channels].enabled
        }
      }
    }));
  };

  const handleSave = () => {
    onUpdate(editingConfig);
  };

  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '600' }}>
        Ρυθμίσεις Ειδοποιήσεων
      </h3>

      {/* Notification Channels */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
          Κανάλια Ειδοποιήσεων
        </h4>
        <div style={{ display: 'grid', gap: '12px' }}>
          {Object.entries(editingConfig.channels).map(([channel, settings]) => (
            <div
              key={channel}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                border: '1px solid #E5E7EB',
                borderRadius: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={() => handleChannelToggle(channel)}
                  />
                  <span style={{ fontSize: '14px', fontWeight: '500', textTransform: 'capitalize' }}>
                    {channel === 'in_app' ? 'In-App' : channel}
                  </span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>Προτεραιότητα:</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.priority}
                  onChange={(e) => {
                    const priority = parseInt(e.target.value);
                    setEditingConfig(prev => ({
                      ...prev,
                      channels: {
                        ...prev.channels,
                        [channel]: { ...prev.channels[channel as keyof typeof prev.channels], priority }
                      }
                    }));
                  }}
                  style={{
                    width: '60px',
                    padding: '4px 8px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Settings */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
          Προχωρημένες Ρυθμίσεις
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Προσπάθειες Επανάληψης
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={editingConfig.retryAttempts}
              onChange={(e) => setEditingConfig(prev => ({ ...prev, retryAttempts: parseInt(e.target.value) }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Καθυστέρηση Επανάληψης (ms)
            </label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={editingConfig.retryDelay}
              onChange={(e) => setEditingConfig(prev => ({ ...prev, retryDelay: parseInt(e.target.value) }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Μέγεθος Batch
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={editingConfig.batchSize}
              onChange={(e) => setEditingConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Όριο Αποστολής (ανά λεπτό)
            </label>
            <input
              type="number"
              min="10"
              max="1000"
              value={editingConfig.rateLimit}
              onChange={(e) => setEditingConfig(prev => ({ ...prev, rateLimit: parseInt(e.target.value) }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            background: '#0EA5E9',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Αποθήκευση Ρυθμίσεων
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN CONFIGURATION INTERFACE
// ============================================================================

export const AlertConfigurationInterface: React.FC = () => {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const [configData, setConfigData] = useState<AlertConfigurationData | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('rules');
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Service instances
  const rulesEngine = new RulesEngine();
  const alertDetection = new AlertDetectionSystem();
  const notificationEngine = new NotificationDispatchEngine();

  // ========================================================================
  // CONFIGURATION SECTIONS
  // ========================================================================

  const configurationSections: ConfigurationSection[] = [
    {
      id: 'rules',
      title: 'Κανόνες Alerts',
      description: 'Διαχείριση των κανόνων που ενεργοποιούν τα alerts',
      icon: '📜',
      status: 'active'
    },
    {
      id: 'notifications',
      title: 'Ειδοποιήσεις',
      description: 'Ρυθμίσεις για τα κανάλια και τους τρόπους ειδοποίησης',
      icon: '📧',
      status: 'active'
    },
    {
      id: 'detection',
      title: 'Ανίχνευση',
      description: 'Παράμετροι του συστήματος ανίχνευσης alerts',
      icon: '🔍',
      status: 'active'
    },
    {
      id: 'templates',
      title: 'Templates',
      description: 'Πρότυπα για alerts και notifications',
      icon: '📋',
      status: 'inactive'
    },
    {
      id: 'global',
      title: 'Γενικές Ρυθμίσεις',
      description: 'Καθολικές ρυθμίσεις συστήματος',
      icon: '⚙️',
      status: 'active'
    }
  ];

  // ========================================================================
  // DATA LOADING
  // ========================================================================

  useEffect(() => {
    loadConfigurationData();
  }, []);

  const loadConfigurationData = async () => {
    try {
      setIsLoading(true);

      // Mock configuration data (στην πραγματικότητα θα έρχεται από services)
      const mockConfig: AlertConfigurationData = {
        rules: [
          {
            id: 'rule_accuracy_degradation',
            name: 'Accuracy Degradation Alert',
            description: 'Triggers when coordinate accuracy drops below threshold',
            category: 'geospatial' as RuleCategory,
            isEnabled: true,
            priority: 'medium' as RulePriority,
            conditions: { type: 'logical', operator: 'AND', children: [] } as RuleCondition,
            actions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'system',
            triggerCount: 0,
            averageExecutionTime: 0,
            successRate: 100
          },
          {
            id: 'rule_spatial_conflict',
            name: 'Spatial Conflict Detection',
            description: 'Detects overlapping control points',
            category: 'geospatial' as RuleCategory,
            isEnabled: true,
            priority: 'low' as RulePriority,
            conditions: { type: 'logical', operator: 'AND', children: [] } as RuleCondition,
            actions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'system',
            triggerCount: 0,
            averageExecutionTime: 0,
            successRate: 100
          }
        ],
        alertTemplates: [],
        notificationTemplates: [],
        detectionConfig: {
          pollingInterval: 5000,
          batchSize: 50,
          enableRealTime: true,
          accuracyThresholds: {
            warning: 0.1,
            critical: 0.5
          }
        },
        notificationConfig: {
          channels: {
            email: { enabled: true, priority: 1 },
            sms: { enabled: false, priority: 2 },
            webhook: { enabled: true, priority: 3 },
            push: { enabled: false, priority: 4 },
            in_app: { enabled: true, priority: 5 }
          },
          retryAttempts: 3,
          retryDelay: 5000,
          batchSize: 10,
          rateLimit: 100
        },
        globalSettings: {
          enableAutoDetection: true,
          enableNotifications: true,
          defaultSeverity: 'medium',
          maxConcurrentAlerts: 100,
          alertRetentionDays: 30,
          notificationRetryAttempts: 3,
          emergencyEscalationEnabled: true
        }
      };

      setConfigData(mockConfig);

    } catch (error) {
      console.error('Configuration load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleSectionSelect = (sectionId: string) => {
    setSelectedSection(sectionId);
    setEditingRule(null);
  };

  const handleRuleEdit = (rule: Rule) => {
    setEditingRule(rule);
  };

  const handleRuleCreate = () => {
    setEditingRule(null);
    setSelectedSection('rule-editor');
  };

  const handleRuleSave = (rule: Rule) => {
    if (!configData) return;

    const updatedRules = editingRule
      ? configData.rules.map(r => r.id === rule.id ? rule : r)
      : [...configData.rules, rule];

    setConfigData({
      ...configData,
      rules: updatedRules
    });

    setEditingRule(null);
    setSelectedSection('rules');
  };

  const handleRuleCancel = () => {
    setEditingRule(null);
    setSelectedSection('rules');
  };

  const handleNotificationConfigUpdate = (config: NotificationConfig) => {
    if (!configData) return;

    setConfigData({
      ...configData,
      notificationConfig: config
    });
  };

  // ========================================================================
  // RENDER CONTENT SECTIONS
  // ========================================================================

  const renderRulesSection = () => {
    if (!configData) return null;

    return (
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            Κανόνες Alerts ({configData.rules.length})
          </h3>
          <button
            onClick={handleRuleCreate}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: '#0EA5E9',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            + Νέος Κανόνας
          </button>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          {configData.rules.map(rule => (
            <div
              key={rule.id}
              style={{
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '16px'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>
                    {rule.name}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '500',
                      background: rule.isEnabled ? '#DCFCE7' : '#F3F4F6',
                      color: rule.isEnabled ? '#166534' : '#6B7280'
                    }}>
                      {rule.isEnabled ? 'ΕΝΕΡΓΟΣ' : 'ΑΝΕΝΕΡΓΟΣ'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>
                      Προτεραιότητα: {rule.priority}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRuleEdit(rule)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '4px',
                    background: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Επεξεργασία
                </button>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
                {rule.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMainContent = () => {
    if (selectedSection === 'rule-editor' || editingRule) {
      return (
        <RuleEditor
          rule={editingRule}
          onSave={handleRuleSave}
          onCancel={handleRuleCancel}
        />
      );
    }

    switch (selectedSection) {
      case 'rules':
        return renderRulesSection();

      case 'notifications':
        return (
          <NotificationSettings
            config={configData?.notificationConfig || null}
            onUpdate={handleNotificationConfigUpdate}
          />
        );

      case 'detection':
      case 'templates':
      case 'global':
        return (
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
              {configurationSections.find(s => s.id === selectedSection)?.title}
            </h3>
            <p style={{ margin: 0, color: '#6B7280' }}>
              Αυτή η ενότητα θα υλοποιηθεί στο επόμενο iteration της Phase 5.
              Προς το παρόν διαθέσιμες είναι οι ενότητες "Κανόνες" και "Ειδοποιήσεις".
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        background: '#F9FAFB'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚙️</div>
          <div style={{ color: '#6B7280' }}>Φόρτωση ρυθμίσεων...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#F9FAFB',
      minHeight: '100vh',
      padding: '24px'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 'bold' }}>
          ⚙️ Alert Configuration
        </h1>
        <p style={{ margin: 0, color: '#6B7280' }}>
          Διαχείριση κανόνων, ειδοποιήσεων και ρυθμίσεων του Alert Engine
        </p>
      </div>

      {/* Content Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        gap: '24px'
      }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {configurationSections.map(section => (
            <ConfigurationCard
              key={section.id}
              section={section}
              isSelected={selectedSection === section.id}
              onClick={() => handleSectionSelect(section.id)}
            />
          ))}
        </div>

        {/* Main Content */}
        <div>
          {renderMainContent()}
        </div>
      </div>
    </div>
  );
};

export default AlertConfigurationInterface;