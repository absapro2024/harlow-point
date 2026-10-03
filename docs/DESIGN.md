# HARLOW POINT — Design & Technical Plan

Working title: Harlow Point: Shift Work
A first-person career simulation set at fictional U.S.-inspired civilian nuclear generating stations. Everything (stations, reactors, rooms, panels, procedures) is fictional. The game is professional, educational and grounded. It has no combat, gore or disaster spectacle.

---

## 1. Concise Game Design Document

Fantasy: You are a new employee building a career in a safety-first, team-oriented workplace that feels alive.

Pillars
1. A living workplace. NPC coworkers have their own goals, schedules, memory and opinions. The plant runs with or without you.
2. Earned trust. You gain access, responsibility and promotions through training, reliability and safe behavior.
3. Systems over scripts. Plant state, needs, time, weather, staffing and NPC AI all affect each other to create each day's work.
4. Safe abstraction. Plant "physics" are abstract game variables. Fictional procedures teach safety culture and teamwork, not real operation.

Player journey: character creation → placement assessment → orientation (badge, PPE, training, supervisor) → routine shifts → certifications → promotions → temporary assignments at other fictional stations → senior and leadership roles.

Fictional stations (roadmap)
| Station | Setting | Era / type (fictional) | Identity |
|---|---|---|---|
| Harlow Point Generating Station (primary) | Pacific coast | 2-unit pressurized-water design, 1980s | Fog, salt air, a mature workforce |
| Cedar Ridge Training Center (M1 slice) | Harlow Point campus | Training & simulation | Onboarding, certifications |
| Marrow River Station | Midwest river | Boiling-water design, 1970s | Floods, ice, tight-knit crews |
| Saguaro Flats Station | Desert | Single unit, 1990s | Heat stress, water management |
| Brannock Station | Northeast | Older plant under modernization | Digital upgrades, union culture |

Gameplay loops: see section 3. Roles: 21 civilian roles (Operations Trainee through Visiting Specialist), each with its own task pool, training path, tools and access profile.

Tone guardrails: Following procedures, communicating and stopping when unsure are always rewarded. Shortcuts may look faster but cost trust, health or access. Emergencies are drills or abstract events, and how you handle them is about protocol and teamwork.

---

## 2. Engine, language, tools, folder structure

Constraint: the player has only an iPhone (no Mac, Xcode or Apple Developer account). A native Unity, Unreal or Swift build cannot be compiled or installed without a Mac.

Decision: WebGL with Three.js (JavaScript ES modules), shipped as an iOS-only Progressive Web App. You open it in Safari and use Add to Home Screen. It then launches full-screen with an icon like an app, keeps saves locally and works offline through a service worker. Non-iOS devices see an "iOS only" gate. Developers can bypass it with `?dev=1`, which also enables keyboard and mouse.

Why this is the best option now
- It runs on an iPhone 17e today with no Mac and no App Store review.
- The architecture is engine-agnostic: data models, AI and simulation are plain modules. If you later get a Mac, the design ports directly to Unity (C#) or Swift/RealityKit for an App Store build. Section 6 has a milestone for this.

Tools: Three.js r169 (vendored, no CDN dependency), vanilla JS modules, localStorage saves, and a service worker for offline play. There is no build step.

```
atomsim/
  index.html            entry, UI shell, PWA meta
  manifest.webmanifest  PWA manifest     sw.js  offline cache
  css/style.css         HUD and menus (mobile-first)
  vendor/three.module.js
  js/
    main.js             bootstrap, game loop, iOS gate
    core/               events.js (event bus), clock.js, save.js, settings.js
    world/              builder.js (procedural PLACEHOLDER geometry), facility.js (Cedar Ridge layout), nav.js (waypoint graph + A*)
    player/             controls.js (touch joystick/look + dev keyboard), player.js (movement, collision, needs)
    systems/            access.js, interaction.js, missions.js, needs.js, plant.js, weather.js, radio.js
    ai/                 npc.js (agent), perception.js, memory.js, utility.js, planner.js, dialogue.js, director.js (adaptive), personalities.js
    data/               npcs.js, roles.js, workorders.js, training.js, glossary.js
    ui/                 hud.js, menus.js, chargen.js, dialogue_ui.js, terminal.js
  docs/                 DESIGN.md, AI.md, ASSETS.md
```

---

## 3. Core gameplay loops

- Moment (seconds): look → read prompt → interact. Badge in, inspect a tag, drink water, talk.
- Task (minutes): receive work order → check prerequisites (training, PPE, access) → travel → perform steps → document → report.
- Shift (one day): handover → assigned tasks plus emergent requests from NPCs → manage needs (water, food, rest, stress) → drills or alerts → handover notes.
- Career (weeks): training modules → certifications (they expire and need renewal) → trust and performance record → access tiers → promotion or cross-qualification → assignments at other stations.
- Social (ongoing): your actions → NPC perception → memories → opinions → gossip → how coworkers treat you, help you and vouch for you.

---

## 4. System architecture (text diagram)

```
                     ┌─────────────── main.js (loop, fixed 60Hz sim / rAF render) ───────────────┐
 Input ─ controls ─► Player ─► collision (facility walls/doors)                                  │
                       │  needs.js (fatigue, hydration, hunger, stress, focus, strain, dose)     │
                       ▼                                                                         │
                  interaction.js ── categories: INSPECT / USE / REPAIR / RESTRICTED / BACKGROUND │
                       │                     │                                                   │
                       ▼                     ▼                                                   │
                 access.js ◄── credentials (tier, quals, assignment, escort, visitor, emergency) │
                       │                                                                         │
     ┌──────── EventBus (events.js): every gameplay fact is an event with position + time ───────┤
     │                 │                     │                     │                             │
 missions.js     plant.js (abstract      clock.js / weather.js   radio.js / PA                   │
 (work orders)   state variables)        (calendar, shifts)      (traffic, announcements)        │
     │                 │                     │                     │                             │
     └────────────► AI layer ◄───────────────┴─────────────────────┘                             │
          perception (sight cone + LOS, hearing radius, radio/told)                              │
            → memory (episodic, salience, decay, source)                                         │
            → beliefs/opinion (trust, respect, affinity)                                         │
            → utility scoring (choose goal)  → planner (goal → step plan)                        │
            → steering + nav A*  → dialogue generator (personality × mood × memory × knowledge)  │
          director.js: player-style model → adapts hints, NPC vigilance, task pacing (fair caps)  │
                                                                                                 │
 save.js ◄── serialize(player, npcs incl. memories, missions, clock, plant, settings) ──────────┘
```

---

## 5. Data model (JSON-style)

```js
Player { id, name, pronouns, appearance{skin,hair,build}, background, education, priorExperience,
  roleId, departmentId, stationId, position{x,y,z}, yaw,
  credentials: Credential, needs: Needs, inventory:[itemId], ppe:{hardhat,glasses,dosimeter},
  trainingRecords:[TrainingRecord], performance{reliability,safety,quality,teamwork},
  stats{violations, helps, deniedAttempts}, readDocs:[docId] }
Credential { badgeId, tier:0..5, quals:[qualId], assignment:[workOrderId], escortOf:npcId|null,
  visitor:boolean, homeStation, tempGrants:[{areaId, expires}], securityHold:boolean }
Needs { health, energy, sleepQuality, hydration, nutrition, stress, strain, focus, workload,
  illness:null|{type,severity}, injury:null|{...}, doseFictional:{shift, annual} }
NPC { id, name, role, dept, shift, tier, skills{}, experience, traits{conscientious, warmth,
  talkative, strictness, curiosity, confidence, patience}, homePost, schedule:[{from,to,activity,place}],
  knowledgeDomains:[], needs{energy,hydration,social}, emotion{valence,arousal,stress,confidence},
  memory:[MemoryEntry], opinionOfPlayer{trust,respect,affinity}, relationships{npcId:affinity} }
MemoryEntry { id, type, subject, place, gameTime, salience 0..1, source:'saw'|'heard'|'told'|'log', from? }
Facility { id, name, region, era, weather profile, rooms:[Room], doors:[Door], navNodes }
Room { id, name, bounds, dept, requiredAccess:AccessRule, ambient }
Door { id, from, to, rule:AccessRule, state:'open'|'closed'|'locked', reader:boolean }
AccessRule { minTier, quals:[], assignment?, escortOk, visitorOk, emergencyOverride, deptOnly? }
WorkOrder { id, title, type, priority, roleIds:[], prereqQuals:[], steps:[Step], timeWindow,
  status:'available'|'assigned'|'active'|'done'|'failed', quality, notes }
Step { id, text, kind:'talk'|'interact'|'reach'|'quiz'|'read', target, done }
TrainingModule { id, title, pages:[], quiz:[{q, options, answer, explain}], grantsQual, validDays }
TrainingRecord { moduleId, score, completedOn, expiresOn }
PlantState { unitState, outputBand, maintenance, reliability, staffing, backlog, safetyCulture,
  radControl, environment, budget, outagePlan, regulatoryAttention, publicConfidence }
SaveData { version, savedAt, clock{day,minute}, weather, player, npcs, missions, plant, director, settings }
```

---

## 6. Milestone roadmap

| # | Milestone | Content |
|---|---|---|
| M1 | Vertical slice (this build) | Cedar Ridge Training Center, character creation, placement assessment, first-person touch controls, prompts, badge/access, 5 AI coworkers (full AI stack), orientation work order plus 2 side work orders, clock and shifts, weather, needs, training terminal and help library, fire drill, radio, save/load, accessibility settings |
| M2 | Harlow Point admin/protected-area entry | Security processing, locker and PPE flow, dosimetry (fictional), 3 role loops (Field Op, Mech Tech, RP Tech), shift handovers |
| M3 | Industrial spaces | Turbine-hall-inspired spaces, maintenance shop, warehouse, LOTO-inspired tagging, calibration minigames |
| M4 | Fictional control room plus abstract plant sim | Board UI with fictional systems, plant variables driving the world, outage planning |
| M5 | Career and calendar | Promotions, recertification, weekends and holidays, NPC schedules that run off-screen |
| M6 | Second station | Marrow River, visitor credentials and escorts, travel |
| M7 | Content and art pass | Replace placeholders, audio, voice-over, optimization |
| M8 (optional) | Native port | Unity or Swift on a Mac, App Store or TestFlight |

---

## 7. Risk & scope assessment

| System | Approach | Why |
|---|---|---|
| Reactor/plant physics | Abstracted into bands and scores | Safety boundary; also more fun |
| Control boards | Fictional, simplified (M4) | No real mappings |
| Radiation | Fictional dose units, monitoring and PPE behavior only | Educational, not operational |
| Security | Badge tiers, escorts, holds; no real vulnerabilities | Safety boundary |
| NPC AI | Fully simulated (core feature) | Biggest effect on player experience |
| Natural-language AI | Template-based generative dialogue; LLM optional later via server | Client-side keys are unsafe and LLMs can be unreliable |
| Large open world | Postponed; one building per milestone | Mobile performance |
| Multiplayer | Postponed indefinitely | Scope |
| Realistic art | Placeholder primitives now (clearly marked) | Iteration speed |

Main risks: mobile GPU budget (mitigation: low-poly, pixel-ratio cap, fog), Safari storage eviction (mitigation: export/import save code), and scope creep (mitigation: every system ships first in the M1 slice).

---

## 8. Original-asset & IP plan

- All layouts are invented on a grid and do not trace any real plant. Station, reactor, company and person names are fictional and checked against obvious real names.
- Procedures are written in-house, labeled "FICTIONAL TRAINING CONTENT", and teach generic safety culture (STOP when unsure, three-way communication, PPE, housekeeping).
- No proprietary manuals, NRC-licensed training material, logos or copyrighted textures.
- M1 art is procedural primitives with "PLACEHOLDER" tags in code (`PLACEHOLDER_ASSET`). Final art will be made in-house or with CC0 assets, with licenses tracked in `docs/ASSETS.md`.
- Fonts and audio will be system fonts and procedurally generated WebAudio tones only.
