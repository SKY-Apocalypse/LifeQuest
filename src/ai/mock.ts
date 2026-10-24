import { mockResponse, mockRift } from '../engine/rules'
import type { Npc } from '../types'

export function mockActionResponse(action: string, hasPhoto = false) {
  const response = mockResponse(action)
  if (hasPhoto) response.artifact = { name: 'Wayfinder’s Keepsake', description: 'A curious object transformed by the story of your day.' }
  return response
}

export function mockRiftResponse(npcs: Npc[]) {
  return mockRift(npcs)
}
