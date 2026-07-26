'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Brain, Bell, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Memory", href: "/memory", icon: Brain },
  { name: "Reminders", href: "/reminders", icon: Bell },
  { name: "Search", href: "/search", icon: Search },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 w-full max-w-md mx-auto items-center justify-around border-t border-[var(--tg-theme-secondary-bg-color)] bg-[var(--tg-theme-bg-color)]/90 backdrop-blur-md pb-safe">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors active:scale-95",
              isActive 
                ? "text-[var(--tg-theme-button-color)]" 
                : "text-[var(--tg-theme-hint-color)] hover:text-[var(--tg-theme-text-color)]"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
