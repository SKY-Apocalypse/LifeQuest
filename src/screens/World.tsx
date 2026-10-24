import type { WorldState } from '../types'

type WorldTab = 'npcs' | 'factions' | 'artifacts' | 'map'

export function WorldScreen({ world, selected, onSelect }: { world: WorldState; selected: WorldTab; onSelect: (tab: WorldTab) => void }) {
  return <section className="world-panel">
    <div className="world-intro"><span className="world-seal">✳</span><div><h3>A world shaped by you.</h3><p>{world.summary || 'Your story is just beginning. Every logged action leaves a mark on this world.'}</p></div></div>
    <div className="world-tabs">{(['npcs', 'factions', 'artifacts', 'map'] as const).map((item) => <button key={item} className={selected === item ? 'active' : ''} onClick={() => onSelect(item)}>{item}</button>)}</div>
    {selected === 'npcs' && <><h4 className="world-section-title">PEOPLE YOU'VE MET <span>{world.npcs.length}</span></h4>{world.npcs.map((npc) => <div className="npc-row" key={npc.name}><div className="npc-avatar">{npc.name.slice(0, 1)}</div><div><strong>{npc.name}</strong><span>{npc.role} · {npc.lastNote}</span></div></div>)}</>}
    {selected === 'factions' && <><h4 className="world-section-title">FACTIONS & ALLEGIANCES <span>{world.factions.length}</span></h4><div className="world-factions">{world.factions.map((faction) => <div key={faction.name}><span className="faction-mark">✦</span><strong>{faction.name}</strong><small>{faction.alignment} · {faction.description}</small></div>)}</div></>}
    {selected === 'artifacts' && <><h4 className="world-section-title">RELICS & KEEPSAKES <span>{world.artifacts.length}</span></h4>{world.artifacts.length ? world.artifacts.map((artifact, index) => <div className="artifact-row" key={`${artifact.name}-${index}`}><span>✧</span><div><strong>{artifact.name}</strong><span>{artifact.description}</span></div></div>) : <div className="world-empty">Your first keepsake is waiting somewhere in the story.</div>}</>}
    {selected === 'map' && <><h4 className="world-section-title">PLACES THE MAP REMEMBERS <span>{world.discoveredLocations.length}</span></h4><div className="map-list">{world.discoveredLocations.map((location, index) => <div className="map-location" key={location}><span>{index === 0 ? '✧' : '⌖'}</span><strong>{location}</strong><small>{index === 0 ? 'The beginning of your trail' : 'Discovered along your journey'}</small></div>)}</div></>}
  </section>
}
