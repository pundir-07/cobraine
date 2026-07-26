import * as React from "react"
import { cn } from "@/lib/utils"

export function ScreenContainer({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-h-[100dvh] w-full max-w-md mx-auto flex flex-col bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)] overflow-x-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
