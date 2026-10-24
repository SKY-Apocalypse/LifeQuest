import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { GameEvent } from '../types'

const tagNames: Record<string, string> = { exercise: 'Training', study: 'Study', food: 'Nourishment', walk: 'Exploration', rest: 'Rest', social: 'Allies', work: 'Craft', other: 'Adventure' }
const statNames = (event: GameEvent) => event.statGained ? Array.isArray(event.statGained) ? event.statGained : [event.statGained] : []

export function EventCard({ event, onClick, animateText = false, onTyped }: { event: GameEvent; onClick: () => void; animateText?: boolean; onTyped: () => void }) {
  const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(event.createdAt)
  const [narrative, setNarrative] = useState(animateText ? '' : event.narrative)
  useEffect(() => {
    if (!animateText) { setNarrative(event.narrative); return }
    setNarrative('')
    let index = 0
    const timer = window.setInterval(() => {
      index = Math.min(event.narrative.length, index + 4)
      setNarrative(event.narrative.slice(0, index))
      if (index >= event.narrative.length) { window.clearInterval(timer); onTyped() }
    }, 18)
    return () => window.clearInterval(timer)
  }, [animateText, event.narrative])
  return <motion.button className="event-card" onClick={onClick} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} layout>
    <div className="event-marker"><span>✧</span></div><div className="event-content"><div className="event-meta"><span>{time}</span><span className="event-dot">·</span><span>{tagNames[event.tags[0]] ?? 'Adventure'}</span><span className={`difficulty-chip ${(event.difficulty ?? 'steady').toLowerCase()}`}>{event.difficulty ?? 'steady'}</span>{event.location_name && <><span className="event-dot">·</span><span>⌖ {event.location_name}</span></>}</div><h3>{event.scene_title}</h3><p>{narrative}{animateText && narrative.length < event.narrative.length && <span className="typing-cursor">|</span>}</p><div className="event-bottom"><span className="event-action">“{event.action}”</span><span className="event-xp">✧ +{event.xpGained} XP</span></div>{animateText && statNames(event).map((stat) => <span className="floating-stat" key={stat}>{stat} +1</span>)}{event.completedRift && <div className="event-rift-badge">RIFT COMPLETED</div>}</div><span className="event-arrow">↗</span>
  </motion.button>
}
