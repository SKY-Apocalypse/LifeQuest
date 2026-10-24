# LifeQuest AI

A polished, local-first fantasy RPG for real life. Log something you did and the Dynamic Dungeon Master turns it into an unfolding story. Your world, journal, NPCs, factions, artifacts, and quests persist in IndexedDB; deterministic game rules own XP and stat changes.

## Setup

```sh
npm i && npm run dev
```

Use Node.js 20.19+ or 22.12+ (required by Vite 8). The app runs in the browser with no backend. To create a production build, run `npm run build`; to run the focused engine tests, use `npm test`.

## Ollama

Mock AI is enabled by default, so the app works without a local model. To use Ollama, install it and pull a compatible model:

```sh
ollama pull gemma4
```

Allow browser requests by setting the Ollama CORS environment variable before starting the server:

```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

On macOS/Linux, run `OLLAMA_ORIGINS="*" ollama serve`. In Settings, set the Ollama URL and model, test the connection, and disable Mock AI. Vision is enabled by default; attached photos are sent as base64 only when Vision is enabled, and the selected model must support image input. Unreachable Ollama or invalid JSON is retried once, then safely falls back to the mock storyteller.

## Demo script

1. Select **Load demo save** in Demo Tools or Settings.
2. Log **“Finished a 30-minute programming session”** and watch the story stream in, INT increase, and XP appear.
3. Attach a photo of a coffee cup and submit an entry; the mock DM turns it into a keepsake artifact.
4. Click **Simulate boring day** and wait for the campfire beat and dramatic Rift overlay.
5. Accept the Rift, then log **“I took a five-minute walk outside and noticed a new flower.”** It completes the walk quest, grants double XP, and adds the reward relic.
6. Open **Daily recap** and click **Share your chronicle** to download the PNG.

## Game rules and memory

The engine—not the LLM—owns XP, levels, stats, streaks, daily caps, and Rift rewards. XP is randomly rolled within code-owned difficulty bands based on the action’s described effort, duration, detail, and milestones: gentle (5–10), steady (11–16), challenging (17–24), or epic (25–35). Rift completion doubles the roll. Levels follow `floor(sqrt(totalXP / 50)) + 1`. Stats are inferred from the real-world action text first and validated AI tags second. Each relevant stat can increase once per action, up to three increases per stat per local day.

The DM prompt uses a compact world bible, rolling summary, and five recent events, not the full history. Every tenth event can trigger a live-model summary of the oldest ten. Chronicle summaries use the model when available and local fallback text otherwise. Sharing the recap downloads a PNG.

The **World** screen has NPC, faction, artifact, and discovered-location map tabs. The floating **Demo Tools** panel can simulate a quiet day, fast-forward, trigger a level-up, toggle mock AI, or load the seed save. Onboarding asks only for a name and class, then creates an opening scene locally without waiting on AI.

## Assumptions

- This is a single-player browser demo. IndexedDB is local to the browser; no account sync or server-side storage is used.
- Demo data is generated relative to the local calendar and includes 14 entries, six NPCs, three factions, eight artifacts, 620 XP (level 4), a nine-day streak, and an active Rift.
- Demo Tools intentionally manipulate the local world for presentations; ordinary XP, stat, streak, and quest rewards remain engine-owned.
- A task-matched action completes a Rift; the demo quest asks for a short walk. Letting a Rift pass has no penalty.
- Automatic quiet-day detection runs while the app is open. Audio uses optional WebAudio synthesis, and Google Fonts fall back to system fonts offline.
