import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, icon, className, ...props }: StatCardProps) {
  return (
    <Card className={cn("", className)} {...props}>
      <CardContent className="p-4 flex items-center gap-3">
        {icon && (
          <div className="p-3 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,rgba(0,0,0,0.05))] text-[var(--tg-theme-accent-text-color,#2481cc)]">
            {icon}
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-2xl font-bold tracking-tight text-[var(--tg-theme-text-color)]">
            {value}
          </span>
          <span className="text-xs font-medium text-[var(--tg-theme-subtitle-text-color)]">
            {title}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
