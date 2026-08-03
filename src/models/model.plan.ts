export type Plan = {
    id: string
    userId: string
    userTelegramId: string | number
    title: string
    description: string
    checkpoints: CheckPoint[]
    recurrence: "single" | "daily" | "weekly" | "monthly"
    importance: "high" | "medium" | "low"
}

export type CheckPoint = {
    id: string
    planId: string
    title: string
    description: string
    conditions: string[]
    initialTargetTime: Date
    nextTargetTime: Date
    missedCount: number
    achieved: boolean
}

