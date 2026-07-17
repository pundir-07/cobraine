export type Interactions={
  IDLE:"idle",
  SET_REMINDER:'awaiting_type'|'awaiting_title'| "awaiting_date" |"awaiting_time"
}
export type UserInteraction = keyof Interactions

export type UserInteractionState<I extends UserInteraction= UserInteraction>={
  interaction:I,
  state:Interactions[I],
}