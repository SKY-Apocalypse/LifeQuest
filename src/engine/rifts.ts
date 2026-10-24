import { calculateStreak, dateKey } from './rules'
import type { GameEvent, WorldState } from '../types'

export function shouldOfferRift(state: WorldState) {
  const today = dateKey()
  if (state.activeRift || state.dismissedRiftDate === today) return false
  const todaysEvents = state.events.filter((event: GameEvent) => event.dateKey === today)
  const recent = state.events.slice(0, 2)
  const onlyRest = recent.length === 2 && recent.every((event) => event.tags.every((tag) => tag === 'rest' || tag === 'other'))
  const streak = calculateStreak(state.events)
  const time = new Date()
  const lateAndQuiet = todaysEvents.length === 0 && time.getHours() >= 18
  const aboutToBreak = todaysEvents.length === 0 && streak >= 3
  return lateAndQuiet || onlyRest || aboutToBreak
}
