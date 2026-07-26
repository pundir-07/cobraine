import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--tg-theme-button-color)] disabled:pointer-events-none disabled:opacity-50 active:scale-95",
          {
            "bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] hover:opacity-90": variant === "default",
            "bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)] hover:opacity-90": variant === "secondary",
            "bg-[var(--tg-theme-destructive-text-color)] text-white hover:opacity-90": variant === "destructive",
            "border border-[var(--tg-theme-hint-color)] bg-transparent hover:bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]": variant === "outline",
            "hover:bg-[var(--tg-theme-secondary-bg-color)] hover:text-[var(--tg-theme-text-color)]": variant === "ghost",
            "text-[var(--tg-theme-link-color)] underline-offset-4 hover:underline": variant === "link",
            "h-11 px-4 py-2": size === "default",
            "h-9 rounded-lg px-3": size === "sm",
            "h-12 rounded-xl px-8 text-base": size === "lg",
            "h-11 w-11": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
