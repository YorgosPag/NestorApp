/**
 * Channel Sharing — Multi-Channel Photo Sharing to CRM Contacts
 * @module components/ui/channel-sharing
 */

export { ContactChannelPicker } from './ContactChannelPicker';
export type { ContactChannelPickerProps } from './ContactChannelPicker';

export { ChannelShareForm } from './ChannelShareForm';
export type { ChannelShareFormProps } from './ChannelShareForm';

export type {
  ChannelProvider,
  ChannelCapabilities,
  PhotoMethod,
  AvailableChannel,
  ChannelShareRequest,
  ChannelShareResponse,
  ContactChannelsResponse,
} from './types';

export {
  CHANNEL_CAPABILITIES,
  CHANNEL_PROVIDERS,
} from './types';
