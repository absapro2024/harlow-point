// Dialogue generator. Each line is built from: personality style × current mood × opinion of the
// player × specific memories (with their source) × knowledge domain × world context
// (time, weather, plant state, current task). There are no fixed scripts. Options appear only when they make sense.
import { bus } from '../core/events.js';
import { NPCS } from '../data/npcs.js';

const pick = (npc, arr) => { const fresh = arr.filter(l => !npc.recentLines.includes(l)); const l = (fresh.length ? fresh : arr)[Math.floor(Math.random() * (fresh.length || arr.length))]; npc.recentLines.push(l); if (npc.recentLines.length > 12) npc.recentLines.shift(); return l; };
export function tone(npc) { const d = npc.memory.disposition + npc.emotion.valence * 0.15; return d > 0.62 ? 'warm' : d < 0.4 ? 'cool' : 'neutral'; }
const pn = (G) => G.player.name.split(' ')[0];

const TOPIC_OWNERS = { radprotect: 'priya', security: 'dana', mechanical: 'tom', training: 'lena', career: 'marcus', emergency: 'lena', operations: 'marcus' };
const TOPIC_Q = { radprotect: 'radiation protection', security: 'site security', mechanical: 'maintenance work', training: 'training and certifications', career: 'career advancement', emergency: 'drills and emergencies' };
const KNOW = {
  radprotect: ['In RP we treat every dose as something to minimize. In the game that means time, distance, shielding, and proper monitoring, using fictional units here.', 'You will get a dosimeter (fictional) before any controlled-area work. Reading it is your job; trusting it is my job.'],
  security: ['Badge in, every reader, every time. The log shows me every tap, including the denied ones.', 'If you are not sure you are allowed somewhere, you probably are not. Ask first and I will help.'],
  mechanical: ['Half of maintenance is the paperwork. Right part, right work order, right tag.', 'Never touch tagged equipment. Tags are there for somebody\'s safety, sometimes mine.'],
  training: ['GET-1 is the base. After that, HU-1 human performance and DRILL-1 are worth doing early. They expire, so watch your dates.', 'The training terminal has a glossary and help center. Use it whenever you like; nobody grades that part.'],
  career: ['Access comes with trust: training, time in role, and a clean safety record. Tier 1 after orientation, then it is up to you.', 'Supervisors talk. A reputation for stopping when unsure will get you further than speed ever will.'],
  emergency: ['Drills are announced as drills. Walk to your assembly area and check in with Security so you are counted.', 'In a real event you follow emergency personnel. In a drill you practice doing exactly that.'],
};
const GOSSIP = {
  tailgate: ['followed someone through a badge door', 'went through the turnstile without badging'],
  no_ppe: ['walked into the mockup hall without PPE'], ran_indoors: ['was running in the corridor'],
  denied_restricted: ['kept trying the Protected Area reader'], tried_panel: ['was poking at the LP-2 panel'],
  helped: ['helped out without being asked'], returned_item: ['found Tom\'s flashlight and returned it'], turned_in_item: ['turned in a lost flashlight'],
  lied: ['said they read the handbook, but the sheet wasn\'t signed'], passed_training: ['passed GET-1'], missed_drill: ['never showed up at the assembly area'],
  attended_drill: ['handled the drill well'], rude: ['was pretty short with me'], completed_wo: ['wrapped up a work order cleanly'], quality_work: ['does careful work'],
};
export function gossipText(e) { const g = GOSSIP[e.type]; return g ? g[0] : null; }

function greeting(npc, G) {
  const t = tone(npc), first = !npc.memory.has('first_meet'), name = pn(G), per = G.clock.period;
  if (first) {
    return pick(npc, {
      mentor: [`Morning. You must be ${G.player.name}. I'm Marcus Hale, your supervisor for orientation.`],
      by_the_book: ['Good morning. I\'ll need to see some ID before you go any further.', 'Morning. New hire? Badge processing is right here.'],
      teacher: [`Hi, you're the new ${G.player.roleName}? I'm ${npc.def.name.split(' ')[0]}. Welcome to Cedar Ridge.`],
      buddy: [`Hey, new face. Tom Becker, mechanical. Welcome aboard. Coffee's terrible, people are great.`],
    }[npc.def.style]);
  }
  // memory-driven openers (only things this NPC actually knows)
  const lied = npc.memory.latest('lied'), ret = npc.memory.latest('returned_item'), tg = npc.memory.latest('tailgate');
  if (lied && t !== 'warm') return pick(npc, [`${name}. I'll be straight with you: I checked the sheet. I need to be able to trust what you tell me.`]);
  if (ret && npc.id === 'tom') return pick(npc, [`There's my flashlight hero. What's up, ${name}?`, `${name}! Still owe you for the flashlight.`]);
  if (tg && npc.id === 'dana' && !npc.flags.tgDiscussed) return 'Before anything else, about that badge door. Everyone badges for themselves.';
  if (G.emergency) return 'Not now. Head to the assembly area, please.';
  const base = {
    warm: [`Hey ${name}, how's the ${per} going?`, `Good to see you, ${name}.`, `${name}, what can I do for you?`],
    neutral: [`${name}.`, `Yes?`, `What do you need?`, `Good ${per === 'night' ? 'evening' : per}.`],
    cool: ['Yes?', 'Make it quick, please.', `${name}.`],
  }[t];
  return pick(npc, base);
}

function smalltalk(npc, G) {
  const lines = [];
  // share a piece of second-hand info, clearly attributed (never omniscient)
  const told = npc.memory.entries.filter(e => e.subject === 'player' && e.source === 'told' && gossipText(e)).sort((a, b) => b.t - a.t)[0];
  if (told && npc.traits.talkative > 0.5) { const who = NPCS.find(n => n.id === told.from)?.name.split(' ')[0] || 'someone'; lines.push(`${who} mentioned you ${gossipText(told)}. ${['helped', 'returned_item', 'passed_training', 'attended_drill', 'completed_wo', 'quality_work', 'turned_in_item'].includes(told.type) ? 'Nice work.' : 'Just so you know, people notice.'}`); }
  const w = G.weather.type.id;
  lines.push(w === 'coastal_fog' ? 'Fog\'s thick today. Watch for forklifts out by the warehouse road.' : w === 'drizzle' ? 'Rain\'s making the lot slick. Walk, don\'t hustle.' : `Nice out. ${G.weather.tempF}°F at the weather station.`);
  lines.push(`Word is Unit 2 is getting ready for its planned outage in about ${G.plant.outageDaysAway} days. Everyone's backlog is growing.`);
  const style = { buddy: ['You know what separates good mechanics from great ones? Great ones put their tools back. I\'m working on it.', 'Best lunch spot is the far table. Sun hits it around noon.'],
    mentor: ['The best operators I know ask the most questions.', 'Write it down. Your memory at hour eleven of a shift is not your memory at hour one.'],
    teacher: ['If anything in the glossary doesn\'t make sense, tell me. That\'s a training problem, not a you problem.', 'I like it when people ask "why." It means they\'ll remember.'],
    by_the_book: ['Quiet morning. I like quiet mornings.', 'The badge log tells you a lot about a building.'] }[npc.def.style];
  lines.push(...style);
  // relationships between NPCs
  const friend = Object.entries(npc.rel).sort((a, b) => b[1] - a[1])[0];
  if (friend && friend[1] > 0.7) lines.push(`If you get a chance, talk to ${NPCS.find(n => n.id === friend[0]).name.split(' ')[0]}. Good people.`);
  return pick(npc, lines);
}

/** Root conversation node. Options are generated from context. */
export function rootNode(npc, G) {
  npc.inConversation = true;
  const first = !npc.memory.has('first_meet');
  let greet = greeting(npc, G);
  if (npc.concern && G.now - npc.correctedAt > 30) { greet = G.ai.bark(npc, 'correct_' + npc.concern, G); npc.correctedAt = G.now; npc.flags.radioed = false; }
  if (first) npc.memory.add('first_meet', { t: G.now, source: 'self' });
  const opts = [];
  const M = G.missions;
  // ---- mission topics ----
  if (npc.id === 'dana' && M.stepOpen('WO-0001', 'checkin')) {
    opts.push({ label: 'Hi! I\'m the new hire, here for orientation. Here\'s my ID.', fn: () => checkin(npc, G, true) });
    opts.push({ label: '(Hand over ID without a word)', fn: () => checkin(npc, G, false) });
  }
  if (npc.id === 'marcus' && M.stepOpen('WO-0001', 'meet_sup')) {
    opts.push({ label: 'Hi Marcus, I\'m ready to get started.', fn: () => meetSup(npc, G, 'polite') });
    opts.push({ label: 'Can we speed this up? I learn fast.', fn: () => meetSup(npc, G, 'rush') });
  }
  if (npc.id === 'marcus' && M.stepOpen('WO-0001', 'report') && M.readyToReport('WO-0001')) opts.push({ label: 'I\'ve finished my orientation tasks.', fn: () => report(npc, G) });
  if (npc.id === 'priya' && M.stepOpen('WO-0003', 'brief') && M.stepDone('WO-0003', 'enter')) opts.push({ label: 'I\'m here for my simulator pre-job brief.', fn: () => prejob(npc, G) });
  // ---- items & favors ----
  if (G.player.inv.includes('flashlight')) {
    if (npc.id === 'tom') opts.push({ label: 'Is this your flashlight? I found it.', fn: () => returnItem(npc, G) });
    else if (npc.id === 'dana') opts.push({ label: 'I found a flashlight. Can I turn it in to lost and found?', fn: () => turnIn(npc, G) });
  }
  if (npc.favorPending) opts.push({ label: 'Still looking for that flashlight. Where did you last have it?', fn: () => ({ lines: [npc.favorHint()], options: back(npc, G) }) });
  if (npc.concern) opts.push({ label: 'About earlier, I\'m sorry. It won\'t happen again.', fn: () => apologize(npc, G) });
  // ---- general ----
  if (G.player.cred.tier < 1 && ['priya', 'marcus'].includes(npc.id) && M.stepDone('WO-0001', 'checkin')) opts.push({ label: 'Could you escort me into the Simulator Hall to look around?', fn: () => escort(npc, G) });
  opts.push({ label: 'Where should I go next?', fn: () => helpNext(npc, G) });
  opts.push({ label: 'What do you do here?', fn: () => ({ lines: [`${npc.def.role}. ${npc.def.bio}`], options: back(npc, G) }) });
  opts.push({ label: 'Can I ask you about something?', fn: () => askMenu(npc, G) });
  if (G.player.needs.energy < 35) opts.push({ label: 'Honestly, I\'m feeling really worn out.', fn: () => fatigue(npc, G) });
  opts.push({ label: 'How\'s your day going?', fn: () => { bus.emit('npc_talk', { npc: npc.id, kind: 'smalltalk' }); npc.memory.add('polite', { t: G.now, source: 'self' }); npc.needs.social = Math.max(0, npc.needs.social - 30); return { lines: [smalltalk(npc, G)], options: back(npc, G) }; } });
  opts.push({ label: 'See you later.', fn: () => null });
  bus.emit('npc_talk', { npc: npc.id, kind: 'start' });
  return { lines: [greet], options: opts };
}
const back = (npc, G) => [{ label: 'Something else…', fn: () => rootNode(npc, G) }, { label: 'Thanks. See you.', fn: () => null }];

function checkin(npc, G, polite) {
  npc.memory.add(polite ? 'polite' : 'rude', { t: G.now, source: 'self' });
  G.issueBadge();
  bus.emit('talk_topic', { topic: 'checkin', npc: npc.id });
  const l = polite ? `Thanks, ${pn(G)}. Your photo's on file. Here's your badge: Tier 0, trainee. It opens the turnstile and the training wing. Badge in at every reader, and never let anyone follow you through.`
    : 'Mm. Badge, Tier 0. Badge at every reader. No tailgating. Next.';
  return { lines: [l, polite ? 'Your supervisor, Marcus Hale, is in Classroom 1 down the corridor, first door on the right.' : 'Supervisor\'s in Classroom 1.'], options: back(npc, G) };
}
function meetSup(npc, G, style) {
  bus.emit('talk_topic', { topic: 'meet_sup', npc: npc.id });
  if (style === 'rush') { npc.memory.add('impatient', { t: G.now, source: 'self' }); G.director.note('rush', 2); }
  else npc.memory.add('polite', { t: G.now, source: 'self' });
  const prof = G.director.style();
  const intro = style === 'rush' ? 'Fast is fine. Fast and right is the job. Nobody here will ever criticize you for taking an extra minute to be sure.' : `Good to meet you, ${pn(G)}. Welcome to the team.`;
  return { lines: [intro,
    'Here\'s your orientation work order, WO-0001. Check it any time with the WO button. Get your PPE in the locker room, grab a radio from my office, pass GET-1 at the terminal behind me, and find the break room. Hydration matters here.',
    prof === 'explorer' ? 'And feel free to look around. Just respect the signs. If a door says no, it means no.' : 'If you get stuck, ask anyone. Once you have a radio, call me.'],
  options: [{ label: 'Understood. PPE, radio, GET-1, break room. Then I report back to you.', fn: () => { npc.memory.add('safe_choice', { t: G.now, source: 'self' }); return { lines: ['That\'s a perfect repeat-back. That is three-way communication, and you\'re already doing it.'], options: back(npc, G) }; } },
    { label: 'Got it.', fn: () => ({ lines: [pick(npc, ['Good. Go on, then.', 'Alright. I\'ll be around.'])], options: back(npc, G) }) }] };
}
function report(npc, G) {
  const readIt = G.player.readDocs.includes('handbook');
  return { lines: ['Good. Before I sign this off, did you read and sign the Safety Handbook?'], options: [
    { label: 'Yes, I did.', fn: () => finishReport(npc, G, readIt ? 'truth' : 'lie') },
    ...(!readIt ? [{ label: 'Not yet. I skipped it; I\'ll read it now.', fn: () => finishReport(npc, G, 'honest') }] : []),
  ] };
}
function finishReport(npc, G, kind) {
  if (kind === 'honest') { npc.memory.add('honest', { t: G.now, source: 'self' }); }
  if (kind === 'lie') { npc.pendingClaim = { claim: 'read_handbook', t: G.now }; } // he does not know yet; he will check the sheet later
  if (kind === 'truth') { npc.memory.add('safe_choice', { t: G.now, source: 'self' }); }
  bus.emit('talk_topic', { topic: 'report', npc: npc.id });
  const lines = [kind === 'honest' ? 'I appreciate the honesty. That matters more to me than the checkbox. Read it when you can.' : 'Good.',
    `Orientation complete. I'm upgrading your badge to Tier 1. That gets you the Simulator Hall. Two new work orders are waiting for you at the WO-03 terminal in my office.`];
  if (npc.memory.op.tru > 0.65) lines.push('Between us, you\'re off to a strong start.');
  return { lines, options: back(npc, G) };
}
function prejob(npc, G) {
  const ppe = G.player.ppe.hardhat && G.player.ppe.glasses;
  if (!ppe) {
    npc.concern = npc.concern || 'no_ppe';
    return { lines: ['Stop right there. Where\'s your hard hat and glasses? I can\'t brief you until you\'re in PPE. It\'s posted at the door.', 'PPE cabinet\'s in the locker room. I\'ll be here.'], options: back(npc, G) };
  }
  bus.emit('talk_topic', { topic: 'prejob', npc: npc.id });
  npc.memory.add('safe_choice', { t: G.now, source: 'self' });
  return { lines: ['PPE on, good. Pre-job brief: this is a fictional unit-balance trainer, not connected to anything real.',
    'Your goal is to keep the balance needle in the green band by adjusting the demand dial. If an alarm card appears, use the right response sequence: announce it, consult the card, act. Questions?'],
  options: [{ label: 'What happens if I can\'t keep it in the band?', fn: () => ({ lines: ['Then you stop, announce it, and we talk it through. In training a stop is a success, not a failure.'], options: back(npc, G) }) }, { label: 'No questions. Starting now.', fn: () => null }] };
}
function returnItem(npc, G) {
  G.player.inv.splice(G.player.inv.indexOf('flashlight'), 1); G.removeLostItem();
  npc.memory.add('returned_item', { t: G.now, source: 'saw' }); npc.favorPending = false; npc.lostItem = null;
  npc.emotion.valence = Math.min(1, npc.emotion.valence + 0.5);
  bus.emit('player_helped', { npc: npc.id, x: npc.x, z: npc.z });
  return { lines: [pick(npc, ['That\'s it! You\'re a lifesaver. I\'ve been retracing my steps all morning.', 'My flashlight! I owe you one. Seriously.']), 'Where was it?', 'Ha, of course it was. Thanks. I won\'t forget it.'], options: back(npc, G) };
}
function turnIn(npc, G) {
  G.player.inv.splice(G.player.inv.indexOf('flashlight'), 1);
  npc.memory.add('turned_in_item', { t: G.now, source: 'saw' }); npc.carrying = 'flashlight';
  G.removeLostItem();
  npc.queueGoal({ kind: 'return_item', to: 'tom', item: 'flashlight', score: 0.75 });
  return { lines: ['Lost and found, thank you. That\'s Tom Becker\'s. His name is on the tape. I\'ll get it to him.'], options: back(npc, G) };
}
function apologize(npc, G) {
  npc.memory.add('apologized', { t: G.now, source: 'self' }); const c = npc.concern; npc.concern = null; npc.flags.tgDiscussed = true;
  return { lines: [tone(npc) === 'cool' ? 'Okay. Show me, don\'t tell me.' : `Appreciated. ${c === 'tailgate' ? 'Badge every time and we\'re good.' : 'We all learn. Just keep it up.'}`], options: back(npc, G) };
}
function escort(npc, G) {
  if (npc.goal && ['evacuate', 'headcount'].includes(npc.goal.kind)) return { lines: ['Not during a drill.'], options: back(npc, G) };
  if (npc.memory.op.tru < 0.42) return { lines: ['Not today. Finish your orientation and earn your own access.'], options: back(npc, G) };
  npc.queueGoal({ kind: 'escort', score: 0.9, until: G.now + 6 });
  return { lines: ['Sure, a quick look. Stay within arm\'s reach; that\'s what an escort means. I\'ll badge us in. You\'ll still need PPE past the yellow line.'], options: [{ label: 'Thanks. Lead the way.', fn: () => null }] };
}
function fatigue(npc, G) {
  npc.memory.add('reported_fatigue', { t: G.now, source: 'self' });
  if (npc.id === 'marcus') return { lines: ['Thanks for telling me. That\'s exactly right. Go take fifteen at the break table and get some water. The work will be here.'], options: back(npc, G) };
  return { lines: ['You should let Marcus know. He\'d rather you rest than make a mistake. And grab some water.'], options: back(npc, G) };
}
function helpNext(npc, G) {
  bus.emit('npc_talk', { npc: npc.id, kind: 'help' }); G.director.note('ask_help');
  const step = G.missions.currentStep();
  if (!step) return { lines: ['No open work for you right now. Check the WO-03 terminal in the office for anything new.'], options: back(npc, G) };
  return { lines: [G.directions(step, npc)], options: back(npc, G) };
}
function askMenu(npc, G) {
  return { lines: ['Sure, what about?'], options: [...Object.entries(TOPIC_Q).map(([k, label]) => ({ label: `About ${label}?`, fn: () => answerTopic(npc, G, k) })), { label: 'Never mind.', fn: () => rootNode(npc, G) }] };
}
function answerTopic(npc, G, k) {
  if (npc.def.domains.includes(k) || (k === 'training' && npc.def.domains.includes('training'))) return { lines: [pick(npc, KNOW[k])], options: back(npc, G) };
  const owner = NPCS.find(n => n.id === TOPIC_OWNERS[k]);
  return { lines: [pick(npc, [`That's outside my area. ${owner.name.split(' ')[0]} is who you want for ${TOPIC_Q[k]}.`, `Honestly, I'd only be guessing. Ask ${owner.name} (${owner.role}).`])], options: back(npc, G) };
}
