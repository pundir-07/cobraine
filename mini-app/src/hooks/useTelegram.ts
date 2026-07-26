import { useContext } from 'react';
import { TelegramContext } from '@/providers/TelegramProvider';

export function useTelegram() {
  const context = useContext(TelegramContext);
  if (context === undefined) {
    throw new Error('useTelegram must be used within a TelegramProvider');
  }
  return context;
}
