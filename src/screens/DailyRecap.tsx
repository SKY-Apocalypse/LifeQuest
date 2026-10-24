import { useRef } from 'react'
import type { DailyRecap, GameEvent } from '../types'
import { dateKey } from '../engine/rules'

export function DailyRecapScreen({ recap, loading, sharing, events, streak, formattedDate, notice, onDismissNotice, onRefresh, onShare }: {
  recap: DailyRecap | null
  loading: boolean
  sharing: boolean
  events: GameEvent[]
  streak: number
  formattedDate: string
  notice: string
  onDismissNotice: () => void
  onRefresh: () => void
  onShare: (card: HTMLDivElement | null) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const todaysEvents = events.filter((event) => event.dateKey === dateKey())
  return <section className="recap-screen">
    <div className="section-heading"><div><div className="eyebrow small-eyebrow">THE DAY, REMEMBERED</div><h2>Daily recap</h2></div><button className="text-link" onClick={onRefresh}>Refresh chronicle ↻</button></div>
    {notice && <div className="notice" role="status">{notice}<button onClick={onDismissNotice} aria-label="Dismiss notice">×</button></div>}
    {loading ? <div className="recap-loading"><span className="spinner" /> The DM gathers the day’s threads…</div> : recap ? <>
      <div className="recap-card" ref={cardRef}>
        <div className="recap-card-top"><span>✳ LIFEQUEST AI</span><span>{formattedDate}</span></div>
        <div className="recap-ornament">✧</div><div className="eyebrow">YOUR PERSONAL CHRONICLE</div>
        <h2>{recap.title}</h2><p className="recap-summary">{recap.summary}</p>
        <div className="recap-metrics"><div><strong>{recap.eventCount}</strong><span>CHAPTERS</span></div><div><strong>{recap.xpGained}</strong><span>EXPERIENCE</span></div><div><strong>{streak}</strong><span>DAY STREAK</span></div></div>
        {todaysEvents.length > 0 && <div className="recap-events">{todaysEvents.slice(0, 5).map((event) => <div key={event.id}><span>✦</span><strong>{event.scene_title}</strong><small>+{event.xpGained} XP</small></div>)}</div>}
        <div className="recap-teaser"><span>TOMORROW, THE STORY CONTINUES</span><p>{recap.teaser}</p></div><div className="recap-card-footer">Every small thing counts. Keep writing your story.</div>
      </div>
      <button className="submit-button recap-share" onClick={() => onShare(cardRef.current)} disabled={sharing}>{sharing ? 'Preparing your chronicle…' : <>Share your chronicle <span>↓</span></>}</button>
    </> : <div className="recap-loading">Your chronicle is ready to be written.</div>}
  </section>
}
