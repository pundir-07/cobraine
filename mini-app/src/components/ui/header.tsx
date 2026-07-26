'use client';
import * as React from "react"
import { useTelegram } from "@/hooks/useTelegram"

export function Header() {
  const { user } = useTelegram()
  
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-[var(--tg-theme-bg-color)]/90 backdrop-blur-md border-b border-[var(--tg-theme-secondary-bg-color)]">
      <div className="flex flex-col">
        <h1 className="text-xl font-bold tracking-tight text-[var(--tg-theme-text-color)]">
          Hello, {user?.first_name || "User"}! 👋
        </h1>
        <p className="text-sm font-medium text-[var(--tg-theme-subtitle-text-color)]">
          Welcome to Cobraine
        </p>
      </div>
      {user?.photo_url && (
        <img 
          src={user.photo_url} 
          alt={user.first_name} 
          className="w-10 h-10 rounded-full border-2 border-[var(--tg-theme-secondary-bg-color)] shadow-sm" 
        />
      )}
    </header>
  )
}
