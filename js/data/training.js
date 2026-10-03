// FICTIONAL TRAINING CONTENT. It teaches generic workplace safety culture only.
// It contains no real plant procedures.
export const MODULES = [
  { id: 'GET-1', title: 'General Employee Training 1: Site Safety Basics', grantsQual: 'GET-1', validDays: 365, pass: 0.75, required: true,
    pages: [
      'Welcome to Harlow Point (a fictional station). Safety comes before schedule, every time. Anyone can and should STOP work that seems unsafe.',
      'Badges: Badge in at every reader, every time. Never let anyone follow you through a door ("tailgating") and never lend your badge.',
      'PPE: Wear a hard hat and safety glasses wherever signs say they are required. Get them at the PPE issue cabinet in the locker room.',
      'Communication: Use three-way communication. The sender says the message, the receiver repeats it back, and the sender confirms. When unsure, ask.',
      'Drills: When you hear a drill announcement, walk (don\'t run) to your assigned assembly area and check in with Security.',
      'Health: Report every injury, stay hydrated, and tell your supervisor if you are too fatigued to work safely. That is a professional choice, not a weakness.',
    ],
    quiz: [
      { q: 'A coworker holds the secure door open for you. What should you do?', options: ['Walk through quickly', 'Badge in yourself at the reader', 'Wave your badge at them'], answer: 1, explain: 'Everyone badges for themselves. That is how the site knows who is inside.' },
      { q: 'The sign says hard hat and safety glasses are required. You left yours in your locker. You…', options: ['Go in carefully without them', 'Go get your PPE first', 'Borrow a coworker\'s glasses'], answer: 1, explain: 'PPE requirements are not optional. Going back for your gear is the right call.' },
      { q: 'Your supervisor radios a task. In three-way communication you…', options: ['Say "Got it"', 'Repeat the task back, and they confirm', 'Text them later'], answer: 1, explain: 'Repeat back and confirm. This catches misunderstandings early.' },
      { q: 'You feel too tired to concentrate on a task. The best choice is to…', options: ['Push through it', 'Tell your supervisor and take a break', 'Drink three energy drinks'], answer: 1, explain: 'Fatigue causes errors. Speaking up is part of good safety culture.' },
    ] },
  { id: 'HU-1', title: 'Human Performance Tools (optional)', grantsQual: 'HU-1', validDays: 730, pass: 0.67,
    pages: ['Human performance tools help prevent errors: pre-job briefs, self-checking (STAR), peer checks, procedure use, and questioning attitude.',
      'STAR: Stop, Think, Act, Review. Pause before you touch anything, confirm it is the right component, act, then check the result.',
      'Questioning attitude: if something does not match what you expect, stop and resolve the difference before you continue.'],
    quiz: [
      { q: 'STAR stands for…', options: ['Start, Turn, Adjust, Run', 'Stop, Think, Act, Review', 'Safety, Training, Access, Readiness'], answer: 1, explain: 'Stop, Think, Act, Review.' },
      { q: 'A label does not match your work order. You…', options: ['Proceed anyway', 'Stop and resolve it with your supervisor', 'Fix the label yourself'], answer: 1, explain: 'A mismatch is a reason to stop.' },
      { q: 'A peer check is…', options: ['A second qualified person verifying before you act', 'Checking on a coworker\'s mood', 'A paycheck review'], answer: 0, explain: 'A second set of eyes before an important action.' },
    ] },
  { id: 'DRILL-1', title: 'Emergency Response Basics (optional)', grantsQual: 'DRILL-1', validDays: 365, pass: 0.67,
    pages: ['Drills prepare everyone to act calmly. Drill announcements begin and end with "This is a drill."',
      'Walk to your assembly area. Do not stop to collect belongings. Check in with Security so you are counted.',
      'Wait for the all-clear before you return. Follow the directions of emergency response personnel.'],
    quiz: [
      { q: 'During a drill you should…', options: ['Run to the exit', 'Walk to your assembly area and check in', 'Finish your coffee first'], answer: 1, explain: 'Walk, assemble, and check in.' },
      { q: 'Why do you check in at assembly?', options: ['So you are counted', 'To get a snack', 'It is optional'], answer: 0, explain: 'Accountability makes sure nobody is missing.' },
      { q: 'You may return inside when…', options: ['You feel like it', 'The all-clear is announced', 'Your friend goes back in'], answer: 1, explain: 'Only after the all-clear.' },
    ] },
];
export const HELP = [
  ['Moving', 'Drag the left stick to walk. Drag anywhere on the right side to look. Tap RUN to toggle a brisk pace (running indoors is discouraged).'],
  ['Interacting', 'Look at an object until a prompt appears, then tap the hand button. The prompt color and icon show the type: 🔍 Inspect, ✋ Use, 🔧 Repair, ⛔ Restricted, ▫ Background.'],
  ['Badges & doors', 'Doors with readers need a badge tap. Use the interact button at the door. If you are denied, the message explains which requirement is missing.'],
  ['Work orders', 'Tap WO to see assigned work and its steps. Accept new work orders at the work-order terminal in the Ops Training Office.'],
  ['Radio', 'Once you pick up a radio from the office charging rack, tap RADIO to hear traffic and call your supervisor or Security.'],
  ['Talking', 'Walk up to a coworker and tap Talk. Coworkers remember how you treat them and what they have seen you do.'],
  ['Health', 'Watch Energy, Water, Food, and Stress. Drink at fountains, eat in the break room, rest at the break table. Low values reduce focus and work quality.'],
  ['Alerts', 'Overhead (PA) announcements appear as subtitles. During a drill, walk to Assembly Area B in the parking lot.'],
  ['Saving', 'The game autosaves at key steps. Save manually at your locker or from the Menu. You can export a save code from the Menu as a backup.'],
];
export const POLICY = [
  ['PM-001 Safety Over Schedule', 'No task is so urgent that it cannot be done safely. Anyone may stop work. (Fictional policy manual.)'],
  ['PM-014 Access Control', 'Personnel badge at every reader. Tailgating, badge sharing, and propping doors open are prohibited. Visitors require an escort.'],
  ['PM-022 Personal Protective Equipment', 'PPE as posted. Hard hat and safety glasses in industrial and mockup areas.'],
  ['PM-031 Fitness for Duty', 'Report illness, injury, or fatigue that may affect your work. Supervisors will help adjust assignments.'],
  ['PM-040 Work Management', 'Work is performed only under an assigned work order, within your qualifications. Document results accurately.'],
  ['PM-052 Communications', 'Use three-way communication for instructions. Keep radio traffic brief and professional.'],
];
