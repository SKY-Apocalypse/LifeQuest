import { z } from 'zod'

export const actionSchema = z.object({
  scene_title: z.string().min(1).max(60).refine((value) => value.trim().split(/\s+/).length <= 6, 'Title must be six words or fewer'),
  narrative: z.string().min(1).max(1600).refine((value) => {
    const sentences = value.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []
    return sentences.length >= 2 && sentences.length <= 4
  }, 'Narrative must contain two to four sentences').refine((value) => !/\b(?:xp|experience|stats?|str|int|vit|spi)\b/i.test(value), 'Narrative must not mention game stats or XP'),
  tags: z.array(z.enum(['exercise', 'study', 'food', 'walk', 'rest', 'social', 'work', 'other'])).min(1).max(8).refine((tags) => new Set(tags).size === tags.length, 'Tags must be unique'),
  artifact: z.object({ name: z.string(), description: z.string() }).nullable(),
  npc_update: z.object({ name: z.string(), note: z.string() }).nullable(),
  location_name: z.string().nullable(),
})

export const riftSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1).refine((value) => (value.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).length === 2, 'Hook must contain two sentences'),
  real_world_task: z.string().min(1),
  deadline_hours: z.literal(6),
  linked_npc: z.string().nullable(),
  reward_item: z.string().min(1),
})

export const recapSchema = z.object({
  summary: z.string().min(1).max(1200),
  teaser: z.string().min(1).max(400),
})

