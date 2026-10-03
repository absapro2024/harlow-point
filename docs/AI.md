# Coworker AI: How It Works

Harlow Point has no combat, so the requested AI behaviors (cooperate, plan, investigate, search, call for help, adapt to repeated player tactics) are expressed as workplace behaviors. The structure is the same layered architecture used for combat AI. Here it serves safety culture, teamwork and believable coworkers.

## Layers
| Layer | File | What it does |
|---|---|---|
| 1. Reliable game logic | `world/nav.js`, `systems/access.js` | A* over a room graph. NPCs badge at readers under the same access rules as the player, get unstuck when crowded at doors, and keep the game's rules consistent. |
| 2. Perception | `ai/perception.js` | Sight cone (110–140° depending on curiosity), line of sight against walls, a reaction delay before they "notice," and attention that drops when busy or stressed. Hearing works through doors at half range. NPCs also notice objects, such as a lost flashlight. |
| 3. Memory and opinion | `ai/memory.js` | Episodic memories tagged with a source: saw, heard, log, told or self. Memories have salience and decay. Safety and honesty memories fade slowly. Opinion is tracked as trust, respect and rapport, weighted by personality: strict NPCs care more about safety and warm NPCs care more about rapport. |
| 4. Utility scoring | `ai/utility.js`, `NPC.decide()` | Each tick an NPC scores about 15 possible goals: work, patrol, water, coffee, rest, lunch, socialize, greet, correct the player, help the player, ask a favor, search, verify a claim, investigate, evacuate, headcount, escort and return an item. Scores use response curves, commitment (to avoid dithering), personality-weighted noise and cooldowns. |
| 5. Goal planner | `ai/planner.js` | Turns the chosen goal into steps. Methods branch on beliefs. For example, Tom searches for his flashlight in the rooms where he thinks it is, but goes straight to the right spot if a coworker told him where they saw it. |
| 6. Expression | `ai/dialogue.js`, `NPC.say` | Dialogue is built from personality style × tone (opinion + mood) × specific memories (with attribution) × knowledge domain × world context (weather, plant state, task). Lines don't repeat back to back. |
| Adaptive director | `ai/director.js` | Reads your playstyle (rusher, explorer, methodical, social or balanced) and adjusts when help is offered, the supervisor's advice and Security's patrols. It caps interventions to stay fair. |

## No cheating
- NPCs learn things only by seeing them (in their cone, with line of sight, while paying attention), hearing them, reading a system log (Security's badge log, the training records system) or being told by someone else.
- Example: you tell Marcus you read the handbook when you didn't. He does not know you lied. About 15 game minutes later he walks to the shelf, checks the acknowledgment sheet and then confronts you. If you aren't around, he radios you (if you carry a radio).
- Second-hand information is weaker (×0.5) and scaled by how much the listener trusts the teller.

## Adapting to repeated player tactics
- Repeatedly badging at the Protected Area door: Security notices the denials in the badge log, radios that she is investigating, then adds that door to her patrol route for two game hours.
- Tailgating while a strict coworker is watching: they radio Security, and Security comes to speak with you.
- Rushing through dialogue or sprinting: the director labels you a "rusher." Coworkers comment on pace, and Marcus explains why care beats speed.
- Exploring a lot: help is held back longer so it doesn't nag, and Marcus encourages respectful exploration.
- Getting stuck: after a threshold (scaled by difficulty and playstyle), a warm and patient coworker who can see you offers help. Later the guided arrow turns on temporarily. There is at most one proactive intervention per 10 game minutes.

## Believable limits
Reaction delays, a limited cone of vision, reduced attention when busy, fatigue (slower walking), schedules and breaks. NPCs make mistakes: Tom loses his flashlight and searches using imperfect beliefs. Knowledge is domain-limited: ask Tom about radiation protection and he sends you to Priya.

## The cast
| NPC | Role | Personality and behavior |
|---|---|---|
| Marcus Hale | Ops Training Supervisor | Mentor. Gives tasks, verifies claims, comes to you about missed drills, values honesty over checkboxes |
| Dana Ruiz | Security Officer | By the book, observant. Watches the badge log, patrols adaptively, runs the drill headcount (counts only who she sees), handles lost and found |
| Priya Natarajan | RP Technician | Teacher. Enforces PPE, gives pre-job briefs, will escort you if she trusts you |
| Tom Becker | Mechanic | Friendly, chatty, a little disorganized. Loses things, asks for favors, spreads news fastest |
| Lena Okafor | Instructor | Very patient. Notices when you struggle or fail a quiz and offers help first |

## Inspecting it in game
Menu → What coworkers think of you shows each NPC's trust, respect and rapport, their current activity, the top goals they are considering with utility scores, and their memories of you with sources. Settings → Show coworker goals displays live goals above heads.

## Why it makes the game better
Your reputation is a real system: honesty, safety and helpfulness have consequences that spread socially and fairly. The workplace keeps running without you. Tom will eventually find his own flashlight. Help adapts to you instead of nagging.
