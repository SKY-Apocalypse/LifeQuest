import { z } from 'zod'
import type { DailyRecap, DmResponse, Rift, WorldState } from '../types'
import { dateKey } from '../engine/rules'
import { mockActionResponse, mockRiftResponse } from './mock'
import { systemPrompt, worldBible } from './prompts'
import { actionSchema, recapSchema, riftSchema } from './schemas'

async function chat<T>(model: string, messages: { role: string; content: string; images?: string[] }[], schema: z.ZodType<T>, ollamaUrl = 'http://localhost:11434'): Promise<T> {
  const response = await fetch(`${(ollamaUrl || 'http://localhost:11434').replace(/\/+$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, format: 'json' }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`)
  const result = await response.json() as { message?: { content?: string } }
  return schema.parse(JSON.parse(result.message?.content ?? ''))
}

async function chatWithRetry<T>(model: string, messages: { role: string; content: string; images?: string[] }[], schema: z.ZodType<T>, ollamaUrl = 'http://localhost:11434'): Promise<T> {
  try {
    return await chat(model, messages, schema, ollamaUrl)
  } catch {
    return chat(model, messages, schema, ollamaUrl)
  }
}

export async function narrateAction(world: WorldState, action: string, photo?: string, location?: string): Promise<{ response: DmResponse; usedMock: boolean }> {
  const fallback = () => mockActionResponse(action, Boolean(photo))
  if (world.settings.mockMode) {
    await new Promise((resolve) => window.setTimeout(resolve, 800 + Math.random() * 700))
    return { response: fallback(), usedMock: true }
  }
  const messages = [
    { role: 'system', content: `${systemPrompt(world)}\nReturn fields: scene_title, narrative, tags, artifact, npc_update, location_name.` },
    { role: 'user', content: `Real-life action: ${action}${location ? `\nUser-provided location label: ${location}. Reinterpret it as a fantasy place without inventing real-world facts.` : ''}${photo ? '\nInterpret the attached photo as an artifact or terrain.' : ''}`, ...(photo && world.settings.vision ? { images: [photo.split(',')[1] ?? photo] } : {}) },
  ]
  try {
    return { response: await chatWithRetry(world.settings.model, messages, actionSchema, world.settings.ollamaUrl), usedMock: false }
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, 800 + Math.random() * 700))
    return { response: fallback(), usedMock: true }
  }
}

export async function generateRift(world: WorldState): Promise<Rift> {
  if (world.settings.mockMode) {
    await new Promise((resolve) => window.setTimeout(resolve, 800 + Math.random() * 700))
    return mockRiftResponse(world.npcs)
  }
  try {
    const schema = riftSchema.refine((value) => value.linked_npc === null || world.npcs.some((npc) => npc.name.toLowerCase() === value.linked_npc?.toLowerCase()), 'Linked NPC must already exist')
    const value = await chatWithRetry(world.settings.model, [
      { role: 'system', content: `${systemPrompt(world)}\nCreate one gentle, intriguing Rift quest. real_world_task must be one tiny action under 10 minutes; no guilt, no danger. Return JSON only with title, hook (2 cliffhanger sentences), real_world_task, deadline_hours, linked_npc, reward_item.` },
      { role: 'user', content: `Generate a Rift using one existing NPC when possible. JSON only.` },
    ], schema, world.settings.ollamaUrl)
    return { ...value, expiresAt: Date.now() + value.deadline_hours * 60 * 60 * 1000 }
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, 800 + Math.random() * 700))
    return mockRiftResponse(world.npcs)
  }
}

export async function compressMemory(world: WorldState) {
  if (world.settings.mockMode || world.events.length < 10 || world.events.length % 10 !== 0) return null
  const oldest = world.events.slice(-10).map(({ action, scene_title, narrative, tags }) => ({ action, scene_title, narrative, tags }))
  try {
    const result = await chatWithRetry(world.settings.model, [
      { role: 'system', content: 'Compress the oldest events into a concise rolling story summary under 140 words. Preserve recurring NPCs, factions, quests, artifacts, callbacks, and unresolved threads. Return JSON only: {"summary":"..."}.' },
      { role: 'user', content: JSON.stringify({ prior_summary: world.summary, oldest_events: oldest, world_bible: worldBible(world) }) },
    ], z.object({ summary: z.string().max(1200) }), world.settings.ollamaUrl)
    return result.summary
  } catch {
    return null
  }
}

export async function generateDailyRecap(world: WorldState): Promise<DailyRecap> {
  const todayEvents = world.events.filter((event) => event.dateKey === dateKey())
  const xpGained = todayEvents.reduce((total, event) => total + event.xpGained, 0)
  const base = {
    title: 'Chronicle of the Day',
    xpGained,
    eventCount: todayEvents.length,
  }
  const fallback = (): DailyRecap => ({
    ...base,
    summary: todayEvents.length
      ? `Today, you turned ${todayEvents.length === 1 ? 'one small moment' : `${todayEvents.length} real moments`} into part of your story: ${todayEvents.slice(0, 3).map((event) => event.action).join('; ')}. Every step counted.`
      : 'The road was quiet today. Even a day of rest belongs in the chronicle; tomorrow, the next page waits for you.',
    teaser: 'At first light, a new mark appears on Mira’s map—and it wasn’t there last night.',
  })
  if (world.settings.mockMode) {
    await new Promise((resolve) => window.setTimeout(resolve, 500))
    return fallback()
  }
  try {
    const result = await chatWithRetry(world.settings.model, [
      { role: 'system', content: 'Write a warm, vivid fantasy daily recap with light humor, never shame the player, and do not invent real-world facts. Summarize the supplied logged actions in 2-3 sentences. Write a short cliffhanger teaser for tomorrow. Return JSON only: {"summary":"...","teaser":"..."}.' },
      { role: 'user', content: JSON.stringify({ player: world.playerName, events: todayEvents.map(({ action, scene_title, narrative, tags }) => ({ action, scene_title, narrative, tags })) }) },
    ], recapSchema, world.settings.ollamaUrl)
    return { ...base, ...result }
  } catch {
    return fallback()
  }
}
