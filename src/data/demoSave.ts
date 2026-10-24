import type { ActionTag, Faction, GameEvent, Npc, Rift, StatName, WorldState } from '../types'
import { mockResponse } from '../engine/rules'

const npcData: Npc[] = [
  { name: 'Brewmaster Orin', role: 'Cafe keeper', lastNote: 'Saved you the last honey-oat bun and insists it was absolutely not strategic.' },
  { name: 'Warden Kael', role: 'Gym trainer', lastNote: 'Claims the training dummies are getting tougher. The dummies deny everything.' },
  { name: 'Mira the Mapmaker', role: 'Guide', lastNote: 'Has marked a fresh trail where your small victories keep appearing.' },
  { name: 'Sister Elowen', role: 'Hearthkeeper', lastNote: 'Reminded the party that drinking water is a perfectly valid side quest.' },
  { name: 'Pip Underbough', role: 'Ranger', lastNote: 'Found a shortcut and only got slightly lost explaining it.' },
  { name: 'Archivist Nyx', role: 'Scholar', lastNote: 'Is cataloguing your discoveries under “surprisingly good instincts.”' },
]

const factionData: Faction[] = [
  { name: 'The Wayfarers’ Guild', alignment: 'Helpful', description: 'A fellowship that celebrates every honest step along the road.' },
  { name: 'The Gloaming Court', alignment: 'Unpredictable', description: 'Keepers of strange lanterns, riddles, and inconveniently timed portals.' },
  { name: 'The Hearthkeepers', alignment: 'Nurturing', description: 'Protectors of good meals, gentle rests, and warm places to begin again.' },
]

const artifactData = [
  ['Orin’s Bottomless Cup', 'A comforting brew that is, somehow, always nearly finished.'],
  ['Ironwood Gripstone', 'A smooth stone that remembers every patient repetition.'],
  ['The Margin Quill', 'A feather that writes more clearly after a little practice.'],
  ['Wayfarer’s Compass', 'It points toward the next small thing worth doing.'],
  ['Hearthseed Locket', 'Warm to the touch whenever you choose to care for yourself.'],
  ['Pip’s Muddy Map', 'Every smudge marks a shortcut Pip swears was intentional.'],
  ['Archive Star Chart', 'A constellation of ideas, still gaining bright new points.'],
  ['Raven’s Approval Feather', 'The raven claims it is not a participation prize.'],
] satisfies [string, string][]

const tagStats: Partial<Record<ActionTag, StatName>> = {
  exercise: 'STR', walk: 'STR', study: 'INT', work: 'INT', food: 'VIT', rest: 'SPI', social: 'SPI',
}

const history: { action: string; xp: number; location: string; tags: GameEvent['tags'] }[] = [
  { action: 'Took a gentle evening walk', xp: 38, location: 'The Fernlit Path', tags: ['walk'] },
  { action: 'Read a chapter before bed', xp: 42, location: 'The Lantern Archive', tags: ['study'] },
  { action: 'Made a nourishing breakfast', xp: 44, location: 'Orin’s Copper Kettle', tags: ['food'] },
  { action: 'Finished a focused programming session', xp: 45, location: 'The Gilded Desk', tags: ['work', 'study'] },
  { action: 'Trained with Kael at the gym', xp: 46, location: 'Ironwood Yard', tags: ['exercise'] },
  { action: 'Called a friend and caught up', xp: 40, location: 'The Crossroads', tags: ['social'] },
  { action: 'Cooked a healthy dinner', xp: 41, location: 'The Hearth of Small Wonders', tags: ['food'] },
  { action: 'Took a five-minute stretch break', xp: 43, location: 'The Sunroom', tags: ['exercise'] },
  { action: 'Studied a new chapter for class', xp: 47, location: 'The Lantern Archive', tags: ['study'] },
  { action: 'Walked to the cafe and back', xp: 48, location: 'Orin’s Copper Kettle', tags: ['walk'] },
  { action: 'Prepared lunch and drank a full glass of water', xp: 46, location: 'The Hearth of Small Wonders', tags: ['food'] },
  { action: 'Worked on a personal project for 30 minutes', xp: 44, location: 'The Gilded Desk', tags: ['work'] },
  { action: 'Completed a strength workout with Kael', xp: 48, location: 'Ironwood Yard', tags: ['exercise'] },
  { action: 'Read quietly and got to bed early', xp: 48, location: 'The Lantern Archive', tags: ['study', 'rest'] },
]

function localDate(daysAgo: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return date
}

function makeEvents(): GameEvent[] {
  return history.map((entry, index) => {
    const daysAgo = index < 5 ? 10 + index : index - 5
    const created = localDate(daysAgo)
    const response = mockResponse(entry.action)
    const tags = entry.tags
    const statGained = [...new Set(tags.map((tag) => tagStats[tag]).filter((stat): stat is StatName => Boolean(stat)))]
    return {
      ...response,
      tags,
      id: `demo-event-${index}`,
      action: entry.action,
      createdAt: created.getTime(),
      dateKey: `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`,
      xpGained: entry.xp,
      completedRift: false,
      difficulty: 'steady' as const,
      statGained,
      location_name: entry.location,
    }
  }).sort((a, b) => b.createdAt - a.createdAt)
}

export function createDemoSave(base: WorldState): WorldState {
  const events = makeEvents()
  const rift: Rift = {
    title: 'The Lantern in the Fog',
    hook: 'A violet lantern flickers beyond the old boundary stones, and Mira calls your name from the mist. The light is going out—but something on the other side has just answered.',
    real_world_task: 'Take a five-minute walk outside and notice one thing you have not seen before.',
    deadline_hours: 6,
    linked_npc: 'Mira the Mapmaker',
    reward_item: 'Riftglass Lantern',
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  }
  return {
    ...base,
    playerName: 'Rowan',
    playerClass: 'Ranger',
    hasOnboarded: true,
    openingScene: 'The road knows your name now. Mira unrolls a map, Orin pours one last cup, and somewhere beyond the lantern light, the next page begins to turn.',
    stats: { STR: 13, INT: 12, VIT: 11, SPI: 10 },
    totalXp: 620,
    events,
    summary: 'Over two weeks, Rowan has trained with Warden Kael, found quiet wisdom in the Lantern Archive, and become a regular at Orin’s Copper Kettle. Mira, Pip, Sister Elowen, and Archivist Nyx have each joined the growing circle. The Gloaming Court has been watching the party’s progress.',
    npcs: npcData,
    factions: factionData,
    discoveredLocations: [...new Set(events.map((event) => event.location_name).filter((location): location is string => Boolean(location)))],
    artifacts: artifactData.map(([name, description]) => ({ name, description })),
    activeRift: rift,
    dismissedRiftDate: null,
    riftIntro: false,
    lastRiftMessage: null,
    settings: { ...base.settings, mockMode: true },
  }
}
