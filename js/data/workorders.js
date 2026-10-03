// Work-order templates. Steps complete when a matching bus event fires.
// target = guided-nav destination: 'npc:<id>' | 'ia:<interactableId>' | 'pt:<point>' | 'door:<id>'
export const WORK_ORDERS = [
  { id: 'WO-0001', title: 'New Employee Orientation', type: 'Training', priority: 'High', minTier: 0, quals: [], autoAssign: true,
    summary: 'Complete your first-day orientation at Cedar Ridge Training Center.',
    steps: [
      { id: 'checkin', text: 'Check in with Security Officer Dana Ruiz at the lobby desk', on: { type: 'talk_topic', topic: 'checkin' }, target: 'npc:dana' },
      { id: 'turnstile', text: 'Badge through the security turnstile', on: { type: 'door_badge', id: 'turnstile' }, target: 'door:turnstile' },
      { id: 'meet_sup', text: 'Meet your supervisor, Marcus Hale', on: { type: 'talk_topic', topic: 'meet_sup' }, target: 'npc:marcus' },
      { id: 'ppe', text: 'Get a hard hat and safety glasses from the locker-room PPE cabinet', on: { type: 'interact', id: 'ppe_cabinet' }, target: 'ia:ppe_cabinet' },
      { id: 'radio', text: 'Pick up a radio from the charging rack in the Ops Training Office', on: { type: 'interact', id: 'radio_charger' }, target: 'ia:radio_charger' },
      { id: 'handbook', text: '(Recommended) Read and sign the Safety Handbook in Classroom 1', on: { type: 'read', id: 'handbook' }, target: 'ia:policy_shelf', optional: true },
      { id: 'get1', text: 'Pass GET-1 Site Safety Basics at training terminal TT-01', on: { type: 'quiz_pass', id: 'GET-1' }, target: 'ia:train_terminal' },
      { id: 'hydrate', text: 'Find the break room and get a drink of water', on: { type: 'interact', id: 'fountain' }, target: 'ia:fountain' },
      { id: 'report', text: 'Report back to Marcus Hale to finish orientation', on: { type: 'talk_topic', topic: 'report' }, target: 'npc:marcus' },
    ], reward: { tier: 1, trust: 0.1, unlock: ['WO-0002', 'WO-0003'] } },
  { id: 'WO-0002', title: 'Monthly Extinguisher Tag Check (fictional)', type: 'Routine rounds', priority: 'Normal', minTier: 1, quals: ['GET-1'],
    summary: 'Inspect three extinguishers. Record each tag status and report any that are out of date.',
    steps: [
      { id: 'e1', text: 'Inspect FE-C1 in the main corridor', on: { type: 'inspect_ext', id: 'ext_1' }, target: 'ia:ext_1' },
      { id: 'e2', text: 'Inspect FE-L1 in the lobby', on: { type: 'inspect_ext', id: 'ext_2' }, target: 'ia:ext_2' },
      { id: 'e3', text: 'Inspect FE-B1 in the break room', on: { type: 'inspect_ext', id: 'ext_3' }, target: 'ia:ext_3' },
      { id: 'doc', text: 'Document your findings at work-order terminal WO-03', on: { type: 'wo_document', id: 'WO-0002' }, target: 'ia:wo_terminal' },
    ], reward: { trust: 0.08 } },
  { id: 'WO-0003', title: 'Simulator Familiarization (fictional trainer)', type: 'Training module', priority: 'Normal', minTier: 1, quals: ['GET-1'],
    summary: 'Wear PPE in the Simulator Hall and complete one session on the fictional Unit-Balance Trainer.',
    steps: [
      { id: 'enter', text: 'Badge into the Simulator Hall (PPE required)', on: { type: 'door_badge', id: 'sim_door' }, target: 'door:sim_door' },
      { id: 'brief', text: 'Get a pre-job brief from RP Technician Priya Natarajan', on: { type: 'talk_topic', topic: 'prejob' }, target: 'npc:priya' },
      { id: 'run', text: 'Complete a Unit-Balance Trainer session', on: { type: 'sim_done' }, target: 'ia:sim_console' },
    ], reward: { trust: 0.08, qual: 'SIM-0' } },
];
