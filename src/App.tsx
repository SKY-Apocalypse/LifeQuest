import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import { useGame } from './store/index'
import { EventCard } from './components/EventCard'
import { Onboarding } from './screens/Onboarding'
import { DailyRecapScreen } from './screens/DailyRecap'
import { WorldScreen } from './screens/World'
import { applyAction, calculateStreak, dateKey, demoLevelUpXp, levelProgress } from './engine/rules'
import { shouldOfferRift } from './engine/rifts'
import { compressMemory, generateDailyRecap, generateRift, narrateAction } from './ai/client'
import { createDemoSave } from './data/demoSave'
import type { DailyRecap, DmResponse, GameEvent, Rift } from './types'

const icons: Record<string, string> = { STR: '⚔', INT: '✧', VIT: '♡', SPI: '☼' }
const tagNames: Record<string, string> = { exercise: 'Training', study: 'Study', food: 'Nourishment', walk: 'Exploration', rest: 'Rest', social: 'Allies', work: 'Craft', other: 'Adventure' }
const statNames = (event: GameEvent) => event.statGained ? Array.isArray(event.statGained) ? event.statGained : [event.statGained] : []

function playSound(kind: 'level' | 'quest' | 'rift') {
  try {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.connect(gain)
    gain.connect(context.destination)
    const notes = kind === 'rift' ? [196, 146, 110] : kind === 'quest' ? [392, 523, 659] : [523, 659, 784, 1046]
    oscillator.type = kind === 'rift' ? 'sawtooth' : 'sine'
    oscillator.frequency.setValueAtTime(notes[0], context.currentTime)
    notes.slice(1).forEach((note, index) => oscillator.frequency.setValueAtTime(note, context.currentTime + (index + 1) * 0.12))
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + notes.length * 0.14)
    oscillator.start()
    oscillator.stop(context.currentTime + notes.length * 0.14)
    oscillator.onended = () => { void context.close() }
  } catch { /* Audio is optional in restricted browser contexts. */ }
}

function App() {
  const game = useGame()
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<string>()
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [latest, setLatest] = useState<GameEvent | null>(null)
  const [screen, setScreen] = useState<'home' | 'world' | 'recap'>('home')
  const [worldTab, setWorldTab] = useState<'npcs' | 'factions' | 'artifacts' | 'map'>('npcs')
  const [newEventId, setNewEventId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rift, setRift] = useState<Rift | null>(null)
  const [riftBusy, setRiftBusy] = useState(false)
  const [riftTime, setRiftTime] = useState('')
  const [notice, setNotice] = useState('')
  const [recap, setRecap] = useState<DailyRecap | null>(null)
  const [recapLoading, setRecapLoading] = useState(false)
  const [demoToolsOpen, setDemoToolsOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const soundOn = game.settings.sound
  const fileRef = useRef<HTMLInputElement>(null)
  const progress = levelProgress(game.totalXp)
  const streak = calculateStreak(game.events)
  const avatarEmoji = game.playerClass === 'Scholar' ? '🧙' : game.playerClass === 'Warrior' ? '🛡️' : '🏹'
  const visibleEvents = useMemo(() => game.events.slice(0, 40), [game.events])

  useEffect(() => {
    if (!game.activeRift) return
    const update = () => {
      const remaining = game.activeRift!.expiresAt - Date.now()
      if (remaining <= 0) {
        game.update({ activeRift: null, lastRiftMessage: 'The Rift sealed itself. No harm done—the road will open again.' })
        return
      }
      const hours = Math.floor(remaining / 3_600_000)
      const minutes = Math.floor((remaining % 3_600_000) / 60_000)
      setRiftTime(`${hours}h ${String(minutes).padStart(2, '0')}m`)
    }
    update()
    const timer = window.setInterval(update, 30_000)
    return () => window.clearInterval(timer)
  }, [game.activeRift, game.update])

  useEffect(() => {
    if (game.riftIntro) {
      const timer = window.setTimeout(async () => {
        game.update({ riftIntro: false })
        await summonRift()
      }, 2000)
      return () => window.clearTimeout(timer)
    }
  }, [game.riftIntro])

  useEffect(() => {
    const check = () => { if (game.hasOnboarded && shouldOfferRift(game)) void startRiftIntro() }
    const timer = window.setInterval(check, 60_000)
    check()
    return () => window.clearInterval(timer)
  }, [game.events.length, game.activeRift, game.dismissedRiftDate, game.hydrated, game.hasOnboarded])

  const summonRift = async () => {
    if (riftBusy) return
    setRiftBusy(true)
    try {
      const result = await generateRift(game)
      setRift(result)
      if (game.settings.sound) playSound('rift')
    } finally { setRiftBusy(false) }
  }

  const startRiftIntro = async () => {
    if (game.riftIntro) return
    game.update({ riftIntro: true })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!text.trim() || loading) return
    setLoading(true)
    setNotice('')
    const oldLevel = progress.level
    try {
      const result = await narrateAction(game, text.trim(), photo, location.trim())
      const response: DmResponse = { ...result.response, location_name: location.trim() || result.response.location_name }
      const applied = applyAction(game, text.trim(), response, photo)
      game.update({ stats: applied.stats, totalXp: applied.totalXp, events: applied.events, npcs: applied.npcs, artifacts: applied.artifacts, discoveredLocations: response.location_name ? [...new Set([response.location_name, ...game.discoveredLocations])] : game.discoveredLocations, ...(applied.completedRift ? { activeRift: null, lastRiftMessage: `Rift completed! ${game.activeRift?.reward_item ?? ''} joins your collection.` } : {}), ...(result.usedMock && !game.settings.mockMode ? { settings: { ...game.settings, mockMode: true } } : {}) })
      setNewEventId(applied.event.id)
      setText('')
      setPhoto(undefined)
      setLocation('')
      if (fileRef.current) fileRef.current.value = ''
      if (applied.completedRift) {
        if (game.settings.sound) playSound('quest')
        setNotice(`Quest complete · ${game.activeRift?.reward_item} recovered · +${applied.event.xpGained} XP`)
      } else if (game.settings.sound && oldLevel < levelProgress(applied.totalXp).level) {
        playSound('level')
        setNotice(`A new level dawns. +${applied.event.xpGained} XP · ${statNames(applied.event).map((stat) => `${stat} +1`).join(' · ') || 'Your legend grows.'}`)
      } else setNotice(result.usedMock && !game.settings.mockMode ? 'Ollama is unavailable; your adventure continues in Demo mode.' : `+${applied.event.xpGained} XP · ${statNames(applied.event).map((stat) => `${stat} +1`).join(' · ') || 'A story added to your journal.'}`)
      const summary = await compressMemory({ ...game, events: applied.events, totalXp: applied.totalXp, stats: applied.stats })
      if (summary) game.update({ summary })
    } catch {
      setNotice('That entry could not be recorded. Please try again.')
    } finally { setLoading(false) }
  }

  const acceptRift = () => {
    if (!rift) return
    game.update({ activeRift: rift, lastRiftMessage: null })
    setRift(null)
    setNotice('Rift accepted · your next matching action completes the quest')
    if (game.settings.sound) playSound('quest')
  }

  const passRift = () => {
    setRift(null)
    game.update({ dismissedRiftDate: dateKey(), lastRiftMessage: 'The Rift faded into the mist. The party rests easy tonight.' })
  }

  const toggleSound = () => {
    const next = !soundOn
    game.update({ settings: { ...game.settings, sound: next } })
    if (next) playSound('quest')
  }

  const setMockMode = async (enabled: boolean) => {
    game.update({ settings: { ...game.settings, mockMode: enabled } })
    if (!enabled) {
      try {
        const response = await fetch(`${(game.settings.ollamaUrl || 'http://localhost:11434').replace(/\/+$/, '')}/api/tags`, { signal: AbortSignal.timeout(2500) })
        if (!response.ok) throw new Error('Ollama unavailable')
      } catch {
        game.update({ settings: { ...game.settings, mockMode: true } })
        setNotice(`Could not reach Ollama at ${game.settings.ollamaUrl || 'localhost:11434'}. Demo mode stays on.`)
      }
    }
  }

  const showRecap = async () => {
    setScreen('recap')
    setRecapLoading(true)
    try {
      setRecap(await generateDailyRecap(game))
    } catch {
      setNotice('The chronicle could not be opened. Please try again.')
    } finally {
      setRecapLoading(false)
    }
  }

  const downloadRecap = async (element: HTMLDivElement | null) => {
    if (!element || !recap) return
    setSharing(true)
    try {
      const dataUrl = await toPng(element, { pixelRatio: 2, backgroundColor: '#171827', cacheBust: true })
      const link = document.createElement('a')
      link.download = `lifequest-chronicle-${dateKey()}.png`
      link.href = dataUrl
      link.click()
    } catch {
      setNotice('The Chronicle image could not be created. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  const loadDemoSave = () => {
    game.update(createDemoSave(game))
    setScreen('home')
    setWorldTab('npcs')
    setSettingsOpen(false)
    setNotice('Demo save loaded · 14 days, six allies, and a waiting Rift.')
  }

  const fastForwardDay = () => {
    const day = 24 * 60 * 60 * 1000
    const shiftDateKey = (key: string) => {
      const [year, month, date] = key.split('-').map(Number)
      const shifted = new Date(year, month - 1, date - 1)
      return dateKey(shifted)
    }
    game.update({
      events: game.events.map((event) => ({ ...event, createdAt: event.createdAt - day, dateKey: shiftDateKey(event.dateKey) })),
      dismissedRiftDate: game.dismissedRiftDate ? shiftDateKey(game.dismissedRiftDate) : null,
      activeRift: game.activeRift ? { ...game.activeRift, expiresAt: game.activeRift.expiresAt + day } : null,
    })
    setNotice('Time advances one day. The trail continues.')
  }

  const triggerLevelUp = () => {
    const totalXp = demoLevelUpXp(game.totalXp)
    game.update({ totalXp })
    if (game.settings.sound) playSound('level')
    setNotice(`Demo level-up · Level ${levelProgress(totalXp).level}`)
  }

  const beginAdventure = (name: string, playerClass: string) => {
    const opening = `${name}, your story begins at the Crossroads of Small Wonders. A ${playerClass.toLowerCase()} steps into the lamplight as Mira unrolls a map with one curious blank space. Somewhere beyond it, the world is already making room for you.`
    game.update({ playerName: name.trim() || 'Wayfarer', playerClass, hasOnboarded: true, openingScene: opening })
  }

  const formattedDate = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

  if (!game.hydrated) return <main className="loading-screen"><span className="brand-mark">✳</span><p>The world gathers itself…</p></main>
  if (!game.hasOnboarded) return <Onboarding onBegin={beginAdventure} onDemo={loadDemoSave} />

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="LifeQuest home"><span className="brand-mark">✳</span><span>LIFEQUEST<span className="brand-ai"> AI</span></span></a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}>Quest log</button>
          <button className={screen === 'world' ? 'active' : ''} onClick={() => setScreen('world')}>World</button>
          <button className={screen === 'recap' ? 'active' : ''} onClick={() => void showRecap()}>Daily recap</button>
        </nav>
        <div className="topbar-right">
          <div className="mode-pill"><span className={game.settings.mockMode ? 'status-dot demo' : 'status-dot'} />{game.settings.mockMode ? 'DEMO MODE' : 'OLLAMA LIVE'}</div>
          <button className={`icon-button ${soundOn ? '' : 'muted'}`} onClick={toggleSound} title={soundOn ? 'Mute sound' : 'Enable sound'}>{soundOn ? '♫' : '♪'}</button>
          <button className="icon-button" onClick={() => setSettingsOpen(true)} title="Settings">⚙</button>
          <div className="avatar" title={game.playerClass}>{avatarEmoji}</div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR STORY, STILL UNFOLDING</div>
          <h1>Make today<br /><em>legendary.</em></h1>
          <p className="hero-subtitle">Every little thing you do becomes part of a bigger story.</p>
          <div className="hero-date"><span>✧</span>{formattedDate}<span className="date-divider" />{streak > 0 ? <><span className="streak-fire">♨</span>{streak} day streak</> : 'A new chapter begins'}</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-glow" /><div className="moon" /><div className="mountain mountain-back" /><div className="mountain mountain-front" /><div className="art-sigil">✳</div><div className="art-caption">THE LANDS<br />REMEMBER</div>
        </div>
      </section>

      <section className="player-card">
        <div className="player-identity">
          <div className="crest"><span>{avatarEmoji}</span><small>LVL {progress.level}</small></div>
          <div><div className="player-name">{game.playerName}</div><div className="player-class">{game.playerClass}</div></div>
        </div>
        <div className="xp-block">
          <div className="xp-label"><span>EXPERIENCE</span><span>{progress.current} <i>/</i> {progress.needed} XP</span></div>
          <div className="xp-track"><motion.div className="xp-fill" initial={false} animate={{ width: `${progress.percent}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} /></div>
          <div className="xp-caption">{game.totalXp} total XP <span>·</span> {progress.needed - progress.current} XP to level {progress.level + 1}</div>
        </div>
        <button className="level-badge" onClick={() => setScreen('world')}><span>✧</span><small>YOUR<br />WORLD</small></button>
      </section>

      <div className="stats-row">
        {(['STR', 'INT', 'VIT', 'SPI'] as const).map((stat) => <div className="stat-card" key={stat}><div className={`stat-icon ${stat.toLowerCase()}`}>{icons[stat]}</div><div className="stat-label">{stat}</div><div className="stat-value">{game.stats[stat]}</div><div className="stat-hint">{({ STR: 'Strength', INT: 'Insight', VIT: 'Vitality', SPI: 'Spirit' })[stat]}</div><div className="stat-meter"><motion.span initial={false} animate={{ width: `${Math.min(100, game.stats[stat] * 5)}%` }} /></div></div>)}
        <div className="stat-card streak-card"><div className="stat-icon streak-icon">🔥</div><div className="stat-label">STREAK</div><div className="stat-value">{streak}<span className="streak-unit">d</span></div><div className="stat-hint">Days in a row</div></div>
      </div>

      {game.activeRift && <motion.section className="active-quest" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><span className="quest-glyph">✧</span><div className="quest-copy"><span className="quest-kicker">ACTIVE RIFT · {riftTime} LEFT</span><strong>{game.activeRift.title}</strong><span>{game.activeRift.real_world_task}</span></div><span className="quest-reward">✦ {game.activeRift.reward_item}</span></motion.section>}
      {game.openingScene && <motion.div className="opening-scene" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}><span>✧</span><p>{game.openingScene}</p><button onClick={() => game.update({ openingScene: null })} aria-label="Dismiss opening scene">×</button></motion.div>}

      {screen === 'recap' ? <DailyRecapScreen recap={recap} loading={recapLoading} sharing={sharing} events={game.events} streak={streak} formattedDate={formattedDate} notice={notice} onDismissNotice={() => setNotice('')} onRefresh={() => void showRecap()} onShare={(element) => void downloadRecap(element)} /> : screen === 'world' ? <WorldScreen world={game} selected={worldTab} onSelect={setWorldTab} /> : <div className="content-grid">
        <section className="journal-panel">
          <div className="section-heading">
            <div><div className="eyebrow small-eyebrow">THE ADVENTURE LOG</div><h2>Your journal</h2></div>
            <button className="text-link" onClick={() => void showRecap()}>Chronicle of the Day →</button>
          </div>
            <form className="action-composer" onSubmit={submit}>
              <div className="composer-label"><span className="sparkle">✧</span><span>WHAT DID YOU DO TODAY?</span><span className="gentle-note">Big or small, it all counts.</span></div>
              <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="I went for a walk, finally started that book, made a nice lunch..." rows={3} />
              <div className="quick-actions" aria-label="Quick actions">{[['Studied', 'I studied'], ['Gym', 'I went to the gym'], ['Walked', 'I went for a walk'], ['Healthy meal', 'I made a healthy meal'], ['Rested', 'I rested and recharged']].map(([label, value]) => <button type="button" key={label} onClick={() => setText(value)}>{label}</button>)}</div>
              {photo && <div className="photo-preview"><img src={photo} alt="Selected action" /><button type="button" onClick={() => { setPhoto(undefined); if (fileRef.current) fileRef.current.value = '' }}>×</button></div>}
              <div className="composer-bottom">
                <div className="composer-tools"><button type="button" className="tool-button" onClick={() => fileRef.current?.click()}><span>＋</span> Camera / upload</button><input ref={fileRef} className="file-input" type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => setPhoto(String(reader.result)); reader.readAsDataURL(file) } }} /><label className="location-input"><span>⌖</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Add a place" maxLength={50} /></label></div>
                <button className="submit-button" disabled={!text.trim() || loading}>{loading ? <><span className="spinner" /> The DM ponders…</> : <>Send to the DM <span>↗</span></>}</button>
              </div>
              <div className="composer-footnote">XP scales with task difficulty and detail <span>·</span> Rift completions earn double</div>
            </form>
            {notice && <motion.div className="notice" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>{notice}<button onClick={() => setNotice('')}>×</button></motion.div>}
            <div className="timeline-heading"><span>RECENT TALES</span><span>{game.events.length} {game.events.length === 1 ? 'entry' : 'entries'}</span></div>
            <div className="timeline" aria-live="polite">
              {visibleEvents.length === 0 && <div className="empty-state"><span>✧</span><strong>Your first chapter awaits.</strong><p>Log one small thing you did today. The adventure will meet you there.</p></div>}
              <AnimatePresence initial={false}>{visibleEvents.map((event) => <EventCard key={event.id} event={event} animateText={event.id === newEventId} onTyped={() => setNewEventId((current) => current === event.id ? null : current)} onClick={() => setLatest(event)} />)}</AnimatePresence>
            </div>
        </section>

        <aside className="sidebar">
          <section className="side-card">
            <div className="side-title"><span className="side-symbol">✧</span><div><span className="eyebrow small-eyebrow">A WHISPER FROM THE DM</span><h3>When the road goes quiet...</h3></div></div>
            <p>Sometimes the world finds you first. A little nudge, a curious mystery, a reason to step outside.</p>
            {game.lastRiftMessage && <div className="rift-message">{game.lastRiftMessage}</div>}
            <button className="rift-button" disabled={riftBusy} onClick={() => void startRiftIntro()}>{riftBusy ? 'Listening for the Rift…' : <> <span>✳</span> Simulate a quiet day</>}</button>
            <div className="no-pressure"><span>♡</span> No pressure. Let it pass whenever you like.</div>
          </section>
          <section className="side-card world-note">
            <div className="side-title"><span className="book-symbol">▤</span><div><span className="eyebrow small-eyebrow">THE WORLD REMEMBERS</span><h3>Little things add up.</h3></div></div>
            <p>Your choices shape a world that grows with you. Familiar faces, unexpected quests, and all the small wins in between.</p>
            <button className="text-link" onClick={() => setScreen('world')}>Visit your world <span>→</span></button>
          </section>
          <div className="quote-card"><span>“</span><p>Even the longest journey begins with a single, very ordinary step.</p><small>— MIRA, MAPMAKER</small></div>
          <button className="reset-link" onClick={() => setSettingsOpen(true)}>World settings</button>
        </aside>
      </div>}
      <footer className="footer"><span>✳ LIFEQUEST AI</span><span>A little magic for the everyday.</span><button onClick={() => void showRecap()}>Daily Recap</button><button onClick={() => setSettingsOpen(true)}>Settings</button></footer>
      <div className="demo-tools-anchor"><AnimatePresence>{demoToolsOpen && <motion.div className="demo-tools-panel" initial={{ opacity: 0, y: 10, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}><div className="demo-tools-title"><span>✳</span> DEMO TOOLS</div><button onClick={() => void startRiftIntro()}>☾ Simulate boring day</button><button onClick={fastForwardDay}>⌛ Fast-forward 1 day</button><button onClick={triggerLevelUp}>✧ Trigger level-up</button><button onClick={() => void setMockMode(!game.settings.mockMode)}>◈ Toggle mock AI</button><button onClick={loadDemoSave}>⟳ Load demo save</button></motion.div>}</AnimatePresence><button className="demo-tools-trigger" onClick={() => setDemoToolsOpen((open) => !open)} aria-expanded={demoToolsOpen}>✳ <span>Demo Tools</span></button></div>

      <AnimatePresence>{game.riftIntro && <motion.div className="camp-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="camp-card" initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }}><span className="camp-flame">♨</span><span className="eyebrow">A MOMENT OF REST</span><h2>The party camps by the fire.</h2><p>For a little while, the road is quiet. The stars have other plans.</p></motion.div></motion.div>}</AnimatePresence>

      <AnimatePresence>{rift && <RiftOverlay rift={rift} onAccept={acceptRift} onPass={passRift} />}</AnimatePresence>
      <AnimatePresence>{latest && <EventModal event={latest} onClose={() => setLatest(null)} />}</AnimatePresence>
      <AnimatePresence>{settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onMock={setMockMode} onReset={() => { game.reset(); setScreen('home'); setSettingsOpen(false); setLatest(null) }} onDemoSave={loadDemoSave} />}</AnimatePresence>
    </main>
  )

}

function EventModal({ event, onClose }: { event: GameEvent; onClose: () => void }) {
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.div className="story-modal" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><div className="eyebrow">A SCENE FROM YOUR JOURNEY</div><h2>{event.scene_title}</h2><div className="story-meta">{tagNames[event.tags[0]]} · {event.difficulty ?? 'steady'} · {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(event.createdAt)}</div>{event.photo && <img className="story-photo" src={event.photo} alt="Your day" />}<p className="story-narrative">{event.narrative}</p><div className="story-real-action"><span>YOUR REAL-WORLD MOMENT</span><p>{event.action}</p></div>{event.artifact && <div className="modal-artifact"><span>✧</span><div><strong>{event.artifact.name}</strong><p>{event.artifact.description}</p></div></div>}<div className="modal-reward">✧ +{event.xpGained} XP earned</div></motion.div></motion.div>
}

function RiftOverlay({ rift, onAccept, onPass }: { rift: Rift; onAccept: () => void; onPass: () => void }) {
  const [typed, setTyped] = useState('')
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    setTyped('')
    let index = 0
    const typing = window.setInterval(() => { index += 1; setTyped(rift.hook.slice(0, index)); if (index >= rift.hook.length) window.clearInterval(typing) }, 24)
    const updateCountdown = () => {
      const remaining = Math.max(0, rift.expiresAt - Date.now())
      const hours = Math.floor(remaining / 3_600_000)
      const minutes = Math.floor((remaining % 3_600_000) / 60_000)
      setTimeLeft(`${hours}h ${String(minutes).padStart(2, '0')}m`)
    }
    updateCountdown()
    const countdown = window.setInterval(updateCountdown, 30_000)
    return () => { window.clearInterval(typing); window.clearInterval(countdown) }
  }, [rift.hook, rift.expiresAt])
  return <motion.div className="rift-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="rift-orb orb-one" /><div className="rift-orb orb-two" /><motion.div className="rift-content" initial={{ y: 22, opacity: 0 }} animate={{ y: 0, opacity: 1 }}><div className="rift-alert"><span className="rift-alert-dot" /> A RIFT HAS OPENED <span className="rift-alert-dot" /></div><div className="rift-symbol">◈</div><div className="eyebrow rift-eyebrow">A MESSAGE FROM THE GLOAMING</div><h2>{rift.title}</h2><p className="rift-hook">{typed}<span className="typing-cursor">|</span></p><div className="rift-task"><span>YOUR TINY QUEST</span><p>{rift.real_world_task}</p><small>Under 10 minutes · No pressure</small></div><div className="rift-reward-line"><span>✧ REWARD</span><strong>{rift.reward_item}</strong></div><div className="rift-deadline">⌛ THE RIFT SEALS IN {timeLeft}</div><div className="rift-actions"><button className="rift-accept" onClick={onAccept}>Accept the Rift <span>↗</span></button><button className="rift-pass" onClick={onPass}>Let it pass</button></div><div className="rift-reassure">Nothing bad happens if you let it pass. The world will wait.</div></motion.div></motion.div>
}

function SettingsModal({ onClose, onMock, onReset, onDemoSave }: { onClose: () => void; onMock: (enabled: boolean) => Promise<void>; onReset: () => void; onDemoSave: () => void }) {
  const settings = useGame((state) => state.settings)
  const update = useGame((state) => state.update)
  const [model, setModel] = useState(settings.model)
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl || 'http://localhost:11434')
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState('')
  const saveSettings = () => { update({ settings: { ...settings, ollamaUrl: ollamaUrl.trim() || 'http://localhost:11434', model: model.trim() || 'gemma4' } }); setStatus('Settings saved.') }
  const testConnection = async () => {
    setChecking(true); setStatus('')
    try {
      const response = await fetch(`${(ollamaUrl.trim() || 'http://localhost:11434').replace(/\/+$/, '')}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (!response.ok) throw new Error()
      update({ settings: { ...settings, ollamaUrl: ollamaUrl.trim() || 'http://localhost:11434', mockMode: false } }); setStatus('Connected to Ollama.')
    } catch { update({ settings: { ...settings, mockMode: true } }); setStatus('Ollama not found. Demo mode is ready.') }
    finally { setChecking(false) }
  }
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.div className="settings-modal" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><div className="eyebrow">TUNE YOUR ADVENTURE</div><h2>Settings</h2><label className="setting-label">OLLAMA SERVER URL<input value={ollamaUrl} onChange={(event) => setOllamaUrl(event.target.value)} onBlur={saveSettings} placeholder="http://localhost:11434" /></label><label className="setting-label settings-model">MODEL NAME<input value={model} onChange={(event) => setModel(event.target.value)} onBlur={saveSettings} placeholder="gemma4" /></label><button className="connection-button" onClick={testConnection} disabled={checking}>{checking ? 'Checking…' : 'Test Ollama connection'}</button>{status && <div className="settings-status">{status}</div>}<div className="setting-toggle"><div><strong>Mock AI mode</strong><span>Templated stories work without local AI.</span></div><button className={`toggle ${settings.mockMode ? 'on' : ''}`} onClick={() => void onMock(!settings.mockMode)} aria-label="Toggle mock AI"><span /></button></div><div className="setting-toggle"><div><strong>Enable vision</strong><span>Send attached photos to a vision-capable model.</span></div><button className={`toggle ${settings.vision ? 'on' : ''}`} onClick={() => update({ settings: { ...settings, vision: !settings.vision } })} aria-label="Toggle vision"><span /></button></div><div className="setting-toggle"><div><strong>Sound effects</strong><span>Play synthesized quest and level-up sounds.</span></div><button className={`toggle ${settings.sound ? 'on' : ''}`} onClick={() => update({ settings: { ...settings, sound: !settings.sound } })} aria-label="Toggle sound"><span /></button></div><div className="settings-footnote">Ollama must be running at your configured server URL. Enable CORS with <code>OLLAMA_ORIGINS=*</code> for browser access.</div><div className="settings-actions"><button onClick={onDemoSave}>Load demo save</button><button onClick={() => { if (window.confirm('Reset this world and return to onboarding?')) onReset() }}>Reset world</button></div><button className="settings-done" onClick={onClose}>Done</button></motion.div></motion.div>
}


export default App
