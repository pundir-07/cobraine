import { ScreenContainer } from "@/components/ui/screen-container"
import { Navigation } from "@/components/ui/navigation"

export default function MemoryPage() {
  return (
    <ScreenContainer className="pb-20">
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-[var(--tg-theme-bg-color)]/90 backdrop-blur-md border-b border-[var(--tg-theme-secondary-bg-color)]">
        <h1 className="text-xl font-bold tracking-tight text-[var(--tg-theme-text-color)]">Memory</h1>
      </header>
      <main className="flex-1 p-4 flex flex-col items-center justify-center text-center">
        <p className="text-[var(--tg-theme-hint-color)]">Memory agent interface coming soon.</p>
      </main>
      <Navigation />
    </ScreenContainer>
  )
}
