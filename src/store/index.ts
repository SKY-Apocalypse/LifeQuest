import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { get, set, del } from 'idb-keyval'
import type { WorldState } from '../types'

const storage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: async (name, value) => { await set(name, value) },
  removeItem: async (name) => { await del(name) },
}

const initialState: WorldState = {
  playerName: 'Wayfarer',
  playerClass: 'Warden of Small Wonders',
  hasOnboarded: false,
  openingScene: null,
  stats: { STR: 5, INT: 5, VIT: 5, SPI: 5 },
  totalXp: 0,
  events: [],
  summary: '',
  npcs: [{ name: 'Mira the Mapmaker', role: 'Guide', lastNote: 'Keeps an eye on your progress from the next crossroads.' }],
  factions: [
    { name: 'The Wayfarers’ Guild', alignment: 'Helpful', description: 'A welcoming fellowship of everyday adventurers.' },
    { name: 'The Gloaming Court', alignment: 'Unpredictable', description: 'Mysterious patrons who favor riddles over introductions.' },
    { name: 'The Hearthkeepers', alignment: 'Nurturing', description: 'Guardians of rest, nourishment, and small comforts.' },
  ],
  discoveredLocations: ['The Crossroads of Beginnings'],
  artifacts: [],
  activeRift: null,
  dismissedRiftDate: null,
  riftIntro: false,
  lastRiftMessage: null,
  settings: { ollamaUrl: 'http://localhost:11434', model: 'gemma4', mockMode: true, vision: true, sound: true },
}

interface Store extends WorldState {
  hydrated: boolean
  setHydrated: (value: boolean) => void
  update: (patch: Partial<WorldState>) => void
  reset: () => void
}

function migratePersistedState(persistedState: unknown, version: number): Store {
  const persisted = (persistedState ?? {}) as Partial<Store>
  return {
    ...initialState,
    ...persisted,
    settings: {
      ...initialState.settings,
      ...persisted.settings,
      ...(version < 1 ? { vision: true } : {}),
    },
  } as Store
}

export const useGame = create<Store>()(persist(
  (setState) => ({
    ...initialState,
    hydrated: false,
    setHydrated: (value) => setState({ hydrated: value }),
    update: (patch) => setState((state) => ({ ...state, ...patch })),
    reset: () => setState({ ...initialState, hydrated: true }),
  }),
  {
    name: 'lifequest-world',
    version: 1,
    storage: createJSONStorage(() => storage),
    migrate: migratePersistedState,
    merge: (persistedState, currentState) => {
      const persisted = (persistedState ?? {}) as Partial<Store>
      return {
        ...currentState,
        ...persisted,
        hasOnboarded: persisted.hasOnboarded ?? Boolean(persisted.events?.length || persisted.totalXp),
        factions: persisted.factions ?? initialState.factions,
        discoveredLocations: persisted.discoveredLocations ?? initialState.discoveredLocations,
        settings: { ...initialState.settings, ...persisted.settings },
      }
    },
    partialize: (state) => ({
      playerName: state.playerName, playerClass: state.playerClass, stats: state.stats,
      hasOnboarded: state.hasOnboarded, openingScene: state.openingScene,
      totalXp: state.totalXp, events: state.events, summary: state.summary, npcs: state.npcs,
      factions: state.factions, discoveredLocations: state.discoveredLocations,
      artifacts: state.artifacts, activeRift: state.activeRift, dismissedRiftDate: state.dismissedRiftDate,
      riftIntro: state.riftIntro, lastRiftMessage: state.lastRiftMessage, settings: state.settings,
    }) as Store,
    onRehydrateStorage: () => (state) => state?.setHydrated(true),
  },
))
