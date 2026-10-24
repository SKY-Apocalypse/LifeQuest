import type { WorldState } from '../types'

const asJson = (value: unknown) => JSON.stringify(value)

export function worldBible(world: WorldState) {
  const level = Math.floor(Math.sqrt(world.totalXp / 50)) + 1
  return [
    `Player: ${world.playerName}, ${world.playerClass}, level ${level}.`,
    `Stats: STR ${world.stats.STR}, INT ${world.stats.INT}, VIT ${world.stats.VIT}, SPI ${world.stats.SPI}.`,
    `Factions: ${(world.factions ?? []).map((faction) => `${faction.name} (${faction.alignment})`).join('; ') || 'The Wayfarers’ Guild (helpful), The Gloaming Court (unpredictable)'}.`,
    `NPCs: ${world.npcs.map((npc) => `${npc.name} (${npc.role}; ${npc.lastNote})`).join('; ') || 'Mira the Mapmaker (guide; watching from the crossroads)'}.`,
    `Active quest: ${world.activeRift ? `${world.activeRift.title} — ${world.activeRift.real_world_task}` : 'none'}.`,
    `Artifacts: ${world.artifacts.map((item) => item.name).join(', ') || 'none yet'}.`,
    `Running joke: the party's raven is an unforgiving critic of posture.`,
  ].join('\n').split(/\s+/).slice(0, 550).join(' ')
}

export function systemPrompt(world: WorldState) {
  return `You are the Dynamic Dungeon Master for LifeQuest AI, an epic fantasy adventure with light humor. Never shame the player, invent real-world facts, or mention stats or XP. Reuse NPCs and factions from the world bible and callback to past events when relevant. For action responses, narrate the real action as a vivid fantasy scene in second person, present tense, 2-4 sentences, scene title at most 6 words. For photos, reinterpret the pictured object as a mystical artifact or hazardous terrain; only use photo details if an image is provided. Return JSON only, no markdown, matching the requested schema exactly.\nWORLD BIBLE:\n${worldBible(world)}\nROLLING SUMMARY:\n${world.summary || 'The journey is just beginning.'}\nLAST FIVE EVENTS:\n${asJson(world.events.slice(0, 5).map(({ action, scene_title, narrative, tags }) => ({ action, scene_title, narrative, tags })))}`
}
