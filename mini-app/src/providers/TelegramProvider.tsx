'use client';

import { createContext, useEffect, useState, ReactNode } from 'react';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface TelegramContextType {
  webApp: any | null;
  user: TelegramUser | null;
  initData: string;
  isTelegram: boolean;
}

export const TelegramContext = createContext<TelegramContextType>({
  webApp: null,
  user: null,
  initData: '',
  isTelegram: false,
});

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState<any | null>(null);

  useEffect(() => {
    const initTelegram = async () => {
      if (typeof window !== 'undefined') {
        try {
          // Dynamically import to prevent SSR issues with window object
          const WebApp = (await import('@twa-dev/sdk')).default;
          WebApp.ready();
          WebApp.expand();
          setWebApp(WebApp);
        } catch (error) {
          console.error("Failed to initialize Telegram WebApp", error);
        }
      }
    };
    initTelegram();
  }, []);

  const value: TelegramContextType = {
    webApp,
    user: (webApp?.initDataUnsafe?.user as TelegramUser) || null,
    initData: webApp?.initData || '',
    isTelegram: !!webApp?.initData,
  };

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}
