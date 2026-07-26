import { ScreenContainer } from "@/components/ui/screen-container"
import { Header } from "@/components/ui/header"
import { Navigation } from "@/components/ui/navigation"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { Brain, Bell, Search, Settings } from "lucide-react"

export default function DashboardPage() {
  return (
    <ScreenContainer className="pb-20">
      <Header />
      
      <main className="flex-1 p-4 flex flex-col gap-6">
        <section>
          <h2 className="text-sm font-semibold text-[var(--tg-theme-subtitle-text-color)] mb-3 px-1 uppercase tracking-wider">
            Overview
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard 
              title="Memories" 
              value={12} 
              icon={<Brain className="w-5 h-5" />} 
            />
            <StatCard 
              title="Reminders" 
              value={4} 
              icon={<Bell className="w-5 h-5" />} 
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-[var(--tg-theme-subtitle-text-color)] mb-3 px-1 uppercase tracking-wider">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" className="h-auto py-4 flex flex-col gap-2">
              <Brain className="w-6 h-6 mb-1 text-[var(--tg-theme-accent-text-color)]" />
              <span>Add Memory</span>
            </Button>
            <Button variant="secondary" className="h-auto py-4 flex flex-col gap-2">
              <Bell className="w-6 h-6 mb-1 text-[var(--tg-theme-accent-text-color)]" />
              <span>Set Reminder</span>
            </Button>
            <Button variant="secondary" className="h-auto py-4 flex flex-col gap-2">
              <Search className="w-6 h-6 mb-1 text-[var(--tg-theme-accent-text-color)]" />
              <span>Search</span>
            </Button>
            <Button variant="secondary" className="h-auto py-4 flex flex-col gap-2">
              <Settings className="w-6 h-6 mb-1 text-[var(--tg-theme-accent-text-color)]" />
              <span>Settings</span>
            </Button>
          </div>
        </section>
      </main>

      <Navigation />
    </ScreenContainer>
  )
}
