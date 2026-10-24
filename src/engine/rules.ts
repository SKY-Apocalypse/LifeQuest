import type { ActionTag, DmResponse, GameEvent, Rift, StatName, TaskDifficulty, WorldState } from '../types'

export const statForTag: Partial<Record<ActionTag, StatName>> = {
  exercise: 'STR',
  study: 'INT',
  work: 'INT',
  food: 'VIT',
  walk: 'STR',
  rest: 'SPI',
  social: 'SPI',
}

const xpBands: Record<TaskDifficulty, [number, number]> = {
  gentle: [5, 10],
  steady: [11, 16],
  challenging: [17, 24],
  epic: [25, 35],
}

const statPatterns: [StatName, RegExp][] = [
  ['STR', /\b(?:exercise|workout|gym|lifting|lifted|weights|strength train\w*|ran|running|run|jog\w*|cycling|bik\w*|swim\w*|walk\w*|stroll\w*|hike\w*|steps)\b/i],
  ['INT', /\b(?:stud\w*|learn\w*|read\w*|course|class|homework|research\w*|practice\w*|work|worked|job|project|program\w*|cod\w*|develop\w*|meeting|present\w*|wrote|writing|plan\w*|focus\w*)\b/i],
  ['VIT', /\b(?:meal|ate|eat\w*|cook\w*|food|lunch|dinner|breakfast|water|hydrat\w*|drink\w*|nutrition)\b/i],
  ['SPI', /\b(?:rest\w*|sleep\w*|nap\w*|meditat\w*|breath\w*|friend\w*|family|partner|social\w*|talk\w*|call\w*|visit\w*|connect\w*|yoga)\b/i],
]

export function inferTaskStats(action: string, tags: ActionTag[] = []): StatName[] {
  const matches = statPatterns.filter(([, pattern]) => pattern.test(action)).map(([stat]) => stat)
  if (matches.length > 0) return matches
  return [...new Set(tags.map((tag) => statForTag[tag]).filter((stat): stat is StatName => Boolean(stat)))]
}

export function assessDifficulty(action: string, tags: ActionTag[] = []): TaskDifficulty {
  const text = action.trim().toLowerCase()
  let score = 0
  const wordCount = text.split(/\s+/).filter(Boolean).length
  if (wordCount >= 10) score += 1
  if (wordCount >= 25) score += 1

  const durations = [...text.matchAll(/\b(\d+(?:\.\d+)?)[-\s]*(hours?|hrs?|h|minutes?|mins?|min)\b/g)]
  const minutes = durations.reduce((total, match) => {
    const amount = Number(match[1])
    return total + (/\b(?:hours?|hrs?|h)\b/.test(match[2]) ? amount * 60 : amount)
  }, 0)
  if (minutes >= 20) score += 1
  if (minutes >= 45) score += 1
  if (minutes >= 90) score += 2

  if (/\b(?:hard|tough|intense|challenging|difficult|exhausting|long|full|complete(?:d)?|finish(?:ed)?|deadline|exam|presentation|marathon|personal best|first time)\b/.test(text)) score += 2
  if (/\b(?:marathon|personal best|first time|deadline|exam|presentation)\b/.test(text)) score += 2
  if (/\b(?:small|quick|brief|short|easy|simple|few minutes|5 min|five minutes)\b/.test(text)) score -= 1

  const taskStats = inferTaskStats(action, tags)
  if (taskStats.some((stat) => stat === 'INT' || stat === 'STR')) score += 1
  if (taskStats.length > 1) score += 1

  if (score <= 0) return 'gentle'
  if (score <= 2) return 'steady'
  if (score <= 4) return 'challenging'
  return 'epic'
}

export function rollXp(difficulty: TaskDifficulty, random = Math.random) {
  const [minimum, maximum] = xpBands[difficulty]
  const roll = Math.min(Math.max(random(), 0), 0.999999999)
  return minimum + Math.floor(roll * (maximum - minimum + 1))
}

export const dateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calculateLevel(xp: number) {
  return Math.floor(Math.sqrt(xp / 50)) + 1
}

export function demoLevelUpXp(xp: number) {
  return Math.max(xp + 1, 50 * calculateLevel(xp) ** 2)
}

export function levelProgress(xp: number) {
  const level = calculateLevel(xp)
  const currentThreshold = 50 * (level - 1) ** 2
  const nextThreshold = 50 * level ** 2
  return { level, current: xp - currentThreshold, needed: nextThreshold - currentThreshold, percent: Math.min(100, ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100) }
}

export function calculateStreak(events: GameEvent[]) {
  const days = new Set(events.map((event) => event.dateKey))
  const today = dateKey()
  const cursor = new Date()
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function applyAction(state: WorldState, action: string, response: DmResponse, photo?: string) {
  const now = Date.now()
  const today = dateKey(new Date(now))
  const completedRift = Boolean(state.activeRift && matchesRift(state.activeRift.real_world_task, action, response.tags))
  const difficulty = assessDifficulty(action, response.tags)
  const xpGained = rollXp(difficulty) * (completedRift ? 2 : 1)
  const stats = { ...state.stats }
  const statCaps = Object.fromEntries((['STR', 'INT', 'VIT', 'SPI'] as StatName[]).map((stat) => [stat, 0])) as Record<StatName, number>
  for (const event of state.events) {
    if (event.dateKey !== today) continue
    const priorStats = event.statGained
      ? Array.isArray(event.statGained) ? event.statGained : [event.statGained]
      : inferTaskStats(event.action, event.tags)
    for (const stat of priorStats) statCaps[stat] += 1
  }
  const statGained: StatName[] = []
  for (const stat of inferTaskStats(action, response.tags)) {
    if (stat && statCaps[stat] < 3) {
      stats[stat] += 1
      statCaps[stat] += 1
      statGained.push(stat)
    }
  }
  const event: GameEvent = {
    ...response,
    id: crypto.randomUUID(),
    action: action.trim(),
    createdAt: now,
    dateKey: today,
    xpGained,
    completedRift,
    difficulty,
    ...(statGained.length > 0 ? { statGained } : {}),
    ...(photo ? { photo } : {}),
  }
  const npcs = response.npc_update
    ? state.npcs.some((npc) => npc.name.toLowerCase() === response.npc_update!.name.toLowerCase())
      ? state.npcs.map((npc) => npc.name.toLowerCase() === response.npc_update!.name.toLowerCase() ? { ...npc, lastNote: response.npc_update!.note } : npc)
      : [...state.npcs, { name: response.npc_update.name, role: 'Wayfarer', lastNote: response.npc_update.note }]
    : state.npcs
  const artifacts = response.artifact ? [response.artifact, ...state.artifacts].slice(0, 12) : [...state.artifacts]
  if (completedRift && state.activeRift) artifacts.unshift({ name: state.activeRift.reward_item, description: 'A reward recovered from the sealed Rift.' })
  return { event, stats, totalXp: state.totalXp + xpGained, events: [event, ...state.events], npcs, artifacts, completedRift }
}

function matchesRift(task: string, action: string, tags: ActionTag[]) {
  const text = task.toLowerCase()
  const requiredTag: ActionTag | undefined =
    /walk|stroll|hike|step outside/.test(text) ? 'walk'
      : /study|read|learn|write|journal/.test(text) ? 'study'
        : /meal|eat|cook|food|water|drink/.test(text) ? 'food'
          : /stretch|exercise|workout|move your body|training/.test(text) ? 'exercise'
            : /friend|family|call someone|reach out|social/.test(text) ? 'social'
              : /sleep|rest|meditat|breath/.test(text) ? 'rest' : undefined
  if (requiredTag) return tags.includes(requiredTag)
  const ignored = new Set(['your', 'this', 'that', 'with', 'from', 'into', 'for', 'and', 'the', 'one', 'thing', 'notice', 'take', 'make'])
  const keywords = text.split(/\W+/).filter((word) => word.length > 3 && !ignored.has(word))
  const actionWords = new Set(action.toLowerCase().split(/\W+/))
  return tags.some((tag) => tag !== 'other' && tag !== 'rest') && keywords.some((word) => actionWords.has(word))
}

export function mockResponse(action: string): DmResponse {
  const text = action.toLowerCase()
  const tags: ActionTag[] = /gym|lift|run|workout|exercise|training/.test(text) ? ['exercise']
    : /study|read|learn|class|course|homework/.test(text) ? ['study']
      : /meal|ate|eat|cook|lunch|dinner|breakfast|water|drink/.test(text) ? ['food']
        : /walk|stroll|hike/.test(text) ? ['walk']
          : /sleep|nap|rest|meditat|breath/.test(text) ? ['rest']
            : /friend|family|partner|talk|social|called/.test(text) ? ['social']
              : /work|job|project|meeting|email|program\w*|cod\w*|develop\w*/.test(text) ? ['work'] : ['other']
  const scenes: Record<ActionTag, [string, string]> = {
    exercise: ['The Ironwood Trial', 'You set your shoulders beneath the old ironwood boughs and begin your trial. Each steady movement wakes a little more strength in the sleeping grove. Somewhere in the canopy, a raven gives an approving, if deeply judgmental, caw.'],
    study: ['The Archive Stirs', 'You unroll a page in the lantern-lit archive, and its ink rearranges itself around your curious gaze. Each new idea clicks into place like a hidden star chart. The keeper insists this is how all the best adventures begin.'],
    food: ['A Hearthside Blessing', 'You gather around a warm hearth and give your body the provisions it deserves. Steam curls into the shape of a tiny dragon, who politely asks for seconds. The party sets out lighter in spirit and better prepared.'],
    walk: ['Footsteps of the Wild', 'You follow a winding trail where the breeze carries whispers from a greener world. Sunlight finds its way through the leaves, marking each step like a golden rune. Even the map seems pleased to be getting some use.'],
    rest: ['The Quiet Constellation', 'You let the noise of the day soften as the camp settles beneath a patient sky. One by one, the constellations appear, keeping watch while you recover. The fire pops as if it has just remembered a very good joke.'],
    social: ['Allies at the Crossroads', 'You share a moment with someone who makes the road feel less long. Their laughter travels ahead like a signal fire, drawing warmth into the evening. Somewhere, a bard quietly adds a verse to your growing legend.'],
    work: ['The Gilded Ledger', 'You bring focus to the task before you, turning loose ends into a tidy row of victories. A brass compass on the desk spins once and points decisively toward done. It has been waiting all morning to be useful.'],
    other: ['A Curious Encounter', 'You pause long enough to notice the day has left a small gift in your path. It may not look like much, but even the oldest legends begin with one curious step. The road ahead gives a friendly little wink.'],
  }
  const [scene_title, narrative] = scenes[tags[0]]
  return {
    scene_title,
    narrative,
    tags,
    artifact: /photo|picture|image/.test(text) ? { name: 'Wayfinder’s Keepsake', description: 'A curious object transformed by the story of your day.' } : null,
    npc_update: { name: 'Mira the Mapmaker', note: 'Keeps an eye on your progress from the next crossroads.' },
    location_name: null,
  }
}

export function mockRift(npcs: WorldState['npcs']): Rift {
  const npc = npcs[0]?.name ?? null
  return {
    title: 'The Lantern in the Fog',
    hook: `A violet lantern flickers beyond the old boundary stones, and ${npc ?? 'a familiar voice'} calls your name from the mist. The light is going out—but something on the other side has just answered.`,
    real_world_task: 'Step outside for a five-minute walk and notice one thing you have not seen before.',
    deadline_hours: 6,
    linked_npc: npc,
    reward_item: 'Riftglass Lantern',
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  }
}
