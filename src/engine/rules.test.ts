import { describe, expect, it } from 'vitest'
import { applyAction, assessDifficulty, calculateLevel, calculateStreak, demoLevelUpXp, inferTaskStats, mockResponse, rollXp } from './rules'
import { shouldOfferRift } from './rifts'
import type { GameEvent, WorldState } from '../types'
import { createDemoSave } from '../data/demoSave'

const initialWorld = (events: GameEvent[] = []): WorldState => ({
  playerName: 'Wayfarer',
  playerClass: 'Warden',
  hasOnboarded: true,
  openingScene: null,
  stats: { STR: 5, INT: 5, VIT: 5, SPI: 5 },
  totalXp: 0,
  events,
  summary: '',
  npcs: [],
  factions: [],
  discoveredLocations: [],
  artifacts: [],
  activeRift: null,
  dismissedRiftDate: null,
  riftIntro: false,
  lastRiftMessage: null,
  settings: { ollamaUrl: 'http://localhost:11434', model: 'gemma4', mockMode: true, vision: false, sound: false },
})

describe('task-based rewards', () => {
  it('rolls XP only within the band for the assessed difficulty', () => {
    expect(rollXp('gentle', () => 0)).toBe(5)
    expect(rollXp('gentle', () => 0.999)).toBe(10)
    expect(rollXp('epic', () => 0)).toBe(25)
    expect(rollXp('epic', () => 0.999)).toBe(35)
    expect(assessDifficulty('Took a short easy walk')).toBe('gentle')
    expect(assessDifficulty('I studied for 45 minutes')).toBe('challenging')
    expect(assessDifficulty('I ran a marathon after months of intense training and finished my personal best')).toBe('epic')
    const earned = applyAction(initialWorld(), 'I did a very small easy task', mockResponse('I did a very small easy task')).event.xpGained
    expect(earned).toBeGreaterThanOrEqual(5)
    expect(earned).toBeLessThanOrEqual(10)
  })

  it('awards stats for the activities the user actually described', () => {
    expect(inferTaskStats('I cooked dinner, then went for a walk')).toEqual(['STR', 'VIT'])
    const result = applyAction(initialWorld(), 'I cooked dinner, then went for a walk', mockResponse('I cooked dinner, then went for a walk'))
    expect(result.event.statGained).toEqual(['STR', 'VIT'])
    expect(result.stats).toEqual({ STR: 6, INT: 5, VIT: 6, SPI: 5 })
  })

  it('enforces the per-stat daily cap while allowing another relevant stat to grow', () => {
    const today = new Date()
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const priorEvents = Array.from({ length: 3 }, (_, index) => ({
      ...mockResponse('Ran today'),
      id: String(index),
      action: 'Ran today',
      createdAt: Date.now() - index,
      dateKey,
      xpGained: 8,
      completedRift: false,
      statGained: ['STR'] as ('STR' | 'INT' | 'VIT' | 'SPI')[],
    }))
    const result = applyAction(initialWorld(priorEvents), 'I studied for class and walked home', mockResponse('I studied for class and walked home'))
    expect(result.stats.STR).toBe(5)
    expect(result.stats.INT).toBe(6)
  })

  it('uses the defined level curve and counts consecutive activity days', () => {
    expect(calculateLevel(0)).toBe(1)
    expect(calculateLevel(450)).toBe(4)
    const days = Array.from({ length: 3 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - index)
      return { ...mockResponse('Read a chapter'), id: `streak-${index}`, action: 'Read a chapter', createdAt: date.getTime(), dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, xpGained: 8, completedRift: false }
    })
    expect(calculateStreak(days)).toBe(3)
  })

  it('maps the demo programming entry to INT and seeds the promised demo world', () => {
    const demo = createDemoSave(initialWorld())
    expect(demo.events).toHaveLength(14)
    expect(demo.npcs).toHaveLength(6)
    expect(demo.factions).toHaveLength(3)
    expect(demo.artifacts).toHaveLength(8)
    expect(calculateLevel(demo.totalXp)).toBe(4)
    expect(calculateStreak(demo.events)).toBe(9)
    expect(demo.events.reduce((total, event) => total + event.xpGained, 0)).toBe(620)
    expect(inferTaskStats('Finished a 30-minute programming session', mockResponse('Finished a 30-minute programming session').tags)).toContain('INT')
  })

  it('doubles a task-matched Rift reward and records its completion', () => {
    const world = initialWorld()
    world.activeRift = {
      title: 'A small walk',
      hook: 'A path glimmers. A raven waits.',
      real_world_task: 'Take a five-minute walk outside.',
      deadline_hours: 6,
      linked_npc: null,
      reward_item: 'Riftglass',
      expiresAt: Date.now() + 60_000,
    }
    const action = 'I took a five-minute walk outside and noticed a new flower.'
    const result = applyAction(world, action, mockResponse(action))
    expect(result.event.completedRift).toBe(true)
    expect(result.event.xpGained).toBeGreaterThanOrEqual(22)
    expect(result.artifacts[0].name).toBe('Riftglass')
  })

  it('keeps the demo level-up action on the next valid level threshold', () => {
    expect(demoLevelUpXp(620)).toBe(800)
    expect(calculateLevel(demoLevelUpXp(620))).toBe(5)
  })

  it('detects a quiet day from two rest-only actions', () => {
    const events = Array.from({ length: 2 }, (_, index) => ({
      ...mockResponse('Rested today'),
      id: `rest-${index}`,
      action: 'Rested today',
      createdAt: Date.now() - index,
      dateKey: '2000-01-01',
      xpGained: 8,
      completedRift: false,
    }))
    expect(shouldOfferRift(initialWorld(events))).toBe(true)
    expect(shouldOfferRift({ ...initialWorld(events), activeRift: { title: 'Already open', hook: '', real_world_task: '', deadline_hours: 6, linked_npc: null, reward_item: '', expiresAt: Date.now() + 10_000 } })).toBe(false)
  })
})
