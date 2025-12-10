'use client';

import React, { useCallback } from 'react';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SocialMediaInfo } from '@/types/contacts';

// ============================================================================
// TYPES
// ============================================================================

export interface SocialMediaManagerProps {
  socialMedia: SocialMediaInfo[];
  disabled?: boolean;
  onChange: (socialMedia: SocialMediaInfo[]) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SOCIAL_PLATFORMS = [
  {
    value: 'linkedin',
    label: 'LinkedIn',
    icon: '💼',
    urlTemplate: 'https://linkedin.com/in/{username}',
    placeholder: 'π.χ. john-doe-profile'
  },
  {
    value: 'facebook',
    label: 'Facebook',
    icon: '📘',
    urlTemplate: 'https://facebook.com/{username}',
    placeholder: 'π.χ. john.doe'
  },
  {
    value: 'instagram',
    label: 'Instagram',
    icon: '📷',
    urlTemplate: 'https://instagram.com/{username}',
    placeholder: 'π.χ. johndoe'
  },
  {
    value: 'twitter',
    label: 'Twitter/X',
    icon: '🐦',
    urlTemplate: 'https://x.com/{username}',
    placeholder: 'π.χ. johndoe'
  },
  {
    value: 'youtube',
    label: 'YouTube',
    icon: '📹',
    urlTemplate: 'https://youtube.com/@{username}',
    placeholder: 'π.χ. johndoe'
  },
  {
    value: 'github',
    label: 'GitHub',
    icon: '💻',
    urlTemplate: 'https://github.com/{username}',
    placeholder: 'π.χ. johndoe'
  },
  {
    value: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    urlTemplate: 'https://tiktok.com/@{username}',
    placeholder: 'π.χ. johndoe'
  },
  {
    value: 'other',
    label: 'Άλλο',
    icon: '🌐',
    urlTemplate: '',
    placeholder: 'Όνομα χρήστη'
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPlatformInfo(platform: string) {
  return SOCIAL_PLATFORMS.find(p => p.value === platform) || SOCIAL_PLATFORMS[SOCIAL_PLATFORMS.length - 1];
}

function generateUrl(platform: string, username: string): string {
  if (!username.trim()) return '';

  const platformInfo = getPlatformInfo(platform);
  if (!platformInfo.urlTemplate) return '';

  return platformInfo.urlTemplate.replace('{username}', username.trim());
}

// ============================================================================
// SOCIAL MEDIA MANAGER COMPONENT
// ============================================================================

export function SocialMediaManager({
  socialMedia = [],
  disabled = false,
  onChange
}: SocialMediaManagerProps) {

  const addSocialMedia = useCallback(() => {
    const newSocialMedia: SocialMediaInfo = {
      platform: 'linkedin',
      username: '',
      url: '',
      label: ''
    };
    onChange([...socialMedia, newSocialMedia]);
  }, [socialMedia, onChange]);

  const updateSocialMedia = useCallback((index: number, field: keyof SocialMediaInfo, value: any) => {
    const updated = socialMedia.map((item, i) => {
      if (i !== index) return item;

      const updatedItem = { ...item, [field]: value };

      // Auto-generate URL when username or platform changes
      if (field === 'username' || field === 'platform') {
        const username = field === 'username' ? value : item.username;
        const platform = field === 'platform' ? value : item.platform;
        updatedItem.url = generateUrl(platform, username);
      }

      return updatedItem;
    });
    onChange(updated);
  }, [socialMedia, onChange]);

  const removeSocialMedia = useCallback((index: number) => {
    const updated = socialMedia.filter((_, i) => i !== index);
    onChange(updated);
  }, [socialMedia, onChange]);

  const openUrl = useCallback((url: string) => {
    if (url && url.trim()) {
      window.open(url.trim(), '_blank', 'noopener,noreferrer');
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-lg">🌐</span>
          Social Media
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {socialMedia.map((item, index) => {
          const platformInfo = getPlatformInfo(item.platform);

          return (
            <div key={index} className="flex items-center gap-2 p-4 border rounded-lg bg-gray-50/50">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Πλατφόρμα</Label>
                  <Select
                    value={item.platform}
                    onValueChange={(value) => updateSocialMedia(index, 'platform', value)}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIAL_PLATFORMS.map(platform => (
                        <SelectItem key={platform.value} value={platform.value}>
                          <span className="flex items-center gap-2">
                            <span>{platform.icon}</span>
                            {platform.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Username</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-500">{platformInfo.icon}</span>
                    <Input
                      value={item.username}
                      onChange={(e) => updateSocialMedia(index, 'username', e.target.value)}
                      placeholder={platformInfo.placeholder}
                      disabled={disabled}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>URL (Auto-generated)</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      value={item.url || ''}
                      onChange={(e) => updateSocialMedia(index, 'url', e.target.value)}
                      placeholder="https://..."
                      disabled={disabled}
                      className="flex-1 text-sm"
                    />
                    {item.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openUrl(item.url!)}
                        disabled={disabled}
                        className="px-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Ετικέτα</Label>
                  <Input
                    value={item.label || ''}
                    onChange={(e) => updateSocialMedia(index, 'label', e.target.value)}
                    placeholder="π.χ. Επαγγελματικό προφίλ"
                    disabled={disabled}
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSocialMedia(index)}
                disabled={disabled}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        {socialMedia.length === 0 && (
          <div className="text-center text-gray-500 py-8 border rounded-lg bg-gray-50/30">
            <span className="text-2xl mb-2 block">🌐</span>
            <p>Δεν έχουν οριστεί social media</p>
            <p className="text-sm mt-1">Προσθέστε τα προφίλ σας στα social media</p>
          </div>
        )}

        <Button
          variant="outline"
          onClick={addSocialMedia}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Προσθήκη Social Media
        </Button>

        {/* Quick Add Popular Platforms */}
        {socialMedia.length === 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
            {['linkedin', 'facebook', 'instagram', 'twitter'].map(platform => {
              const platformInfo = getPlatformInfo(platform);
              return (
                <Button
                  key={platform}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newItem: SocialMediaInfo = {
                      platform: platform as any,
                      username: '',
                      url: '',
                      label: ''
                    };
                    onChange([newItem]);
                  }}
                  disabled={disabled}
                  className="text-xs"
                >
                  <span className="mr-1">{platformInfo.icon}</span>
                  {platformInfo.label}
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SocialMediaManager;