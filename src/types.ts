export type StatName = 'STR' | 'INT' | 'VIT' | 'SPI'
export type ActionTag = 'exercise' | 'study' | 'food' | 'walk' | 'rest' | 'social' | 'work' | 'other'
export type TaskDifficulty = 'gentle' | 'steady' | 'challenging' | 'epic'

export interface DmResponse {
  scene_title: string
  narrative: string
  tags: ActionTag[]
  artifact: { name: string; description: string } | null
  npc_update: { name: string; note: string } | null
  location_name: string | null
}

export interface Rift {
  title: string
  hook: string
  real_world_task: string
  deadline_hours: number
  linked_npc: string | null
  reward_item: string
  expiresAt: number
}

export interface GameEvent extends DmResponse {
  id: string
  action: string
  createdAt: number
  dateKey: string
  xpGained: number
  completedRift: boolean
  difficulty?: TaskDifficulty
  statGained?: StatName | StatName[]
  photo?: string
}

export interface Npc {
  name: string
  role: string
  lastNote: string
}

export interface Faction {
  name: string
  alignment: string
  description: string
}

export interface DailyRecap {
  title: string
  summary: string
  xpGained: number
  eventCount: number
  teaser: string
}

export interface WorldState {
  playerName: string
  playerClass: string
  hasOnboarded: boolean
  openingScene: string | null
  stats: Record<StatName, number>
  totalXp: number
  events: GameEvent[]
  summary: string
  npcs: Npc[]
  factions: Faction[]
  discoveredLocations: string[]
  artifacts: { name: string; description: string }[]
  activeRift: Rift | null
  dismissedRiftDate: string | null
  riftIntro: boolean
  lastRiftMessage: string | null
  settings: { ollamaUrl: string; model: string; mockMode: boolean; vision: boolean; sound: boolean }
}
