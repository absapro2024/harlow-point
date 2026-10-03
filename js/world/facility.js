// Cedar Ridge Training Center — fictional employee entrance + training building on the
// fictional Harlow Point Generating Station campus. Layout invented on a 1 m grid; it is NOT
// based on any real facility. All geometry is PLACEHOLDER_ASSET.
import * as THREE from '../../vendor/three.module.js';
import { box, cyl, sign, WallBuilder, WALL_H, mat } from './builder.js';

export const ROOMS = [
  { id: 'lot', name: 'Employee Parking & Grounds', minX: -20, maxX: 20, minZ: 20, maxZ: 40, outdoor: true, node: 'lot' },
  { id: 'lobby', name: 'Entrance Lobby & Security Desk', minX: -12, maxX: 12, minZ: 10, maxZ: 20, node: 'lobby' },
  { id: 'corridor', name: 'Main Corridor', minX: -2, maxX: 2, minZ: -10, maxZ: 10, nodes: ['c5', 'c0', 'c_5'] },
  { id: 'locker', name: 'Locker Room & PPE Issue', minX: -12, maxX: -2, minZ: 0, maxZ: 10, node: 'locker' },
  { id: 'break', name: 'Break Room', minX: -12, maxX: -2, minZ: -10, maxZ: 0, node: 'break' },
  { id: 'training', name: 'Classroom 1 / Training Terminals', minX: 2, maxX: 12, minZ: 0, maxZ: 10, node: 'training' },
  { id: 'office', name: 'Operations Training Office', minX: 2, maxX: 12, minZ: -10, maxZ: 0, node: 'office' },
  { id: 'sim', name: 'Simulator & Mockup Hall', minX: -12, maxX: 12, minZ: -20, maxZ: -10, node: 'sim', ppeRequired: true },
];
export function roomAt(x, z) { return ROOMS.find(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) || ROOMS[0]; }

export const NAV_NODES = {
  lot: [0, 30], entrance: [0, 20.5], lobby: [0, 15], turnstile: [0, 10], c5: [0, 5], c0: [0, 0], c_5: [0, -5],
  locker_d: [-2, 5], locker: [-7, 5], break_d: [-2, -5], break: [-7, -5], train_d: [2, 5], training: [7, 5],
  office_d: [2, -5], office: [7, -5], sim_d: [0, -10], sim: [0, -15],
};
export const NAV_EDGES = [['lot', 'entrance'], ['entrance', 'lobby'], ['lobby', 'turnstile'], ['turnstile', 'c5'], ['c5', 'c0'], ['c0', 'c_5'],
  ['c_5', 'sim_d'], ['sim_d', 'sim'], ['c5', 'locker_d'], ['locker_d', 'locker'], ['c_5', 'break_d'], ['break_d', 'break'],
  ['c5', 'train_d'], ['train_d', 'training'], ['c_5', 'office_d'], ['office_d', 'office']];

// Stand points NPCs use as plan targets.
export const POINTS = {
  sec_post: [-7, 15], lobby_patrol_a: [8, 13], lobby_patrol_b: [-3, 18], fountain: [-10.9, -2], coffee: [-10.8, -4.5],
  vending: [-10.5, -6.5], bench: [-7, -3.8], bench2: [-7, -6.2], train_front: [6, 7.8], lena_post: [9.3, 8.3], office_post: [8, -7.2],
  sim_post: [2.2, -13.2], sim_mock: [-8, -17], assembly: [3, 35], lot_center: [0, 30], corridor_mid: [0, 0], lobby_mid: [0, 15],
  locker_mid: [-7, 5], break_mid: [-7, -5], training_mid: [7, 4], office_mid: [7, -4], sim_mid: [0, -15], ppe: [-10.6, 8],
  wo_terminal: [10.2, -7.3], c_lp2: [-1.2, -8], break_counter: [-6, -8.8],
};

export function buildFacility(scene) {
  const colliders = [];
  const interactables = [];
  const doors = [];
  const W = new WallBuilder(scene, colliders);

  // ---------- ground, floors, ceiling ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), mat(0x3b4045)); // asphalt lot
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 30); scene.add(ground);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat(0x4d6b3c));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.02, 0); scene.add(grass);
  for (let x = -16; x <= 16; x += 4) box(scene, 0.12, 0.01, 4.5, 0xe8e2c8, x, 0.01, 27); // parking stripes
  box(scene, 3, 0.01, 18, 0x50555a, 0, 0.005, 31); // walkway
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 40), mat(0xb9bcb6)); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.01, 0); scene.add(floor);
  box(scene, 4, 0.005, 20, 0x8c949a, 0, 0.015, 0); // corridor runner
  box(scene, 24, 0.005, 10, 0x6f7a82, 0, 0.015, -15); // sim hall epoxy floor
  box(scene, 2.2, 0.006, 1.2, 0xd2b13a, 0, 0.02, -10.8); // yellow "PPE line"
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(24, 40), mat(0xe9e8e3, { side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, WALL_H, 0); scene.add(ceil);
  for (let x = -9; x <= 9; x += 6) for (let z = -17; z <= 17; z += 5) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ color: 0xfffbea })); p.rotation.x = Math.PI / 2; p.position.set(x, WALL_H - 0.01, z); scene.add(p);
  }
  // roof & exterior shell
  box(scene, 24.6, 0.4, 40.6, 0x7d858a, 0, WALL_H + 0.2, 0);
  box(scene, 7, 0.2, 3, 0x9aa3a8, 0, 3.0, 21.6); // entrance canopy
  cyl(scene, 0.1, 3, 0x9aa3a8, -3.3, 1.5, 23); cyl(scene, 0.1, 3, 0x9aa3a8, 3.3, 1.5, 23);
  sign(scene, ['CEDAR RIDGE TRAINING CENTER', 'Harlow Point Generating Station • Fictional'], 0, 3.55, 20.35, 0, 6, 0.7, { w: 1024, h: 128, size: 54, border: null, bg: '#1d3b52', fg: '#ffffff' });

  // ---------- walls ----------
  W.h(20, -12, 12, [[0, 3]]);            // front, main entrance
  W.h(-20, -12, 12, [[0, 2]]);           // back, protected-area door
  W.v(-12, -20, 20); W.v(12, -20, 20);
  W.h(10, -12, 12, [[0, 2]]);            // lobby/secure boundary, turnstile
  W.v(-2, -10, 10, [[5, 1.6], [-5, 1.6]]);
  W.v(2, -10, 10, [[5, 1.6], [-5, 1.6]]);
  W.h(0, -12, -2); W.h(0, 2, 12);
  W.h(-10, -12, 12, [[0, 2]]);           // simulator hall door
  // site fence
  const fence = (x1, z1, x2, z2) => { box(scene, Math.abs(x2 - x1) || 0.08, 1.8, Math.abs(z2 - z1) || 0.08, 0x8f979c, (x1 + x2) / 2, 0.9, (z1 + z2) / 2, { transparent: true, opacity: 0.55 });
    colliders.push({ low: true, minX: Math.min(x1, x2) - 0.05, maxX: Math.max(x1, x2) + 0.05, minZ: Math.min(z1, z2) - 0.05, maxZ: Math.max(z1, z2) + 0.05 }); };
  fence(-20, 20, -20, 40); fence(20, 20, 20, 40); fence(-20, 40, 20, 40); fence(-20, 20, -12, 20); fence(12, 20, 20, 20);

  // ---------- doors ----------
  // rule ids resolve in systems/access.js
  const mkDoor = (id, name, x, z, axis, width, rule, reader, color = 0x9fb8c6) => {
    const glass = color === 0x9fb8c6;
    const mesh = box(scene, axis === 'x' ? width : 0.08, 2.3, axis === 'x' ? 0.08 : width, color, x, 1.15, z, glass ? { transparent: true, opacity: 0.45 } : {});
    const d = { id, name, x, z, axis, width, rule, reader, mesh, openT: 0, holdUntil: 0, home: mesh.position.clone(),
      collider: axis === 'x' ? { minX: x - width / 2, maxX: x + width / 2, minZ: z - 0.12, maxZ: z + 0.12, door: id } : { minX: x - 0.12, maxX: x + 0.12, minZ: z - width / 2, maxZ: z + width / 2, door: id } };
    if (reader) { // badge reader pads both sides
      const off = axis === 'x' ? [width / 2 + 0.25, 0] : [0, width / 2 + 0.25];
      for (const s of [-1, 1]) { const r = box(scene, 0.12, 0.18, 0.12, 0x1d2329, x + off[0], 1.15, z + off[1] + (axis === 'x' ? s * 0.18 : 0)); d.lamp = d.lamp || [];
        const lamp = box(scene, 0.05, 0.05, 0.13, 0xd23b3b, x + off[0], 1.27, z + off[1] + (axis === 'x' ? s * 0.18 : 0)); d.lamp.push(lamp); }
    }
    doors.push(d); colliders.push(d.collider); return d;
  };
  mkDoor('main_entrance', 'Main Entrance (auto)', 0, 20, 'x', 3, 'public', false);
  mkDoor('turnstile', 'Security Turnstile — Badge Required', 0, 10, 'x', 2, 'badge', true, 0x6c7a84);
  mkDoor('locker_door', 'Locker Room', -2, 5, 'z', 1.6, 'badge_inside', false, 0x8a6a4a);
  mkDoor('break_door', 'Break Room', -2, -5, 'z', 1.6, 'badge_inside', false, 0x8a6a4a);
  mkDoor('training_door', 'Classroom 1', 2, 5, 'z', 1.6, 'badge_inside', false, 0x8a6a4a);
  mkDoor('office_door', 'Ops Training Office', 2, -5, 'z', 1.6, 'badge_inside', false, 0x8a6a4a);
  mkDoor('sim_door', 'Simulator Hall — Tier 1 + GET-1', 0, -10, 'x', 2, 'sim_hall', true, 0x5e6e78);
  mkDoor('pa_door', 'Protected Area Access — Tier 3', 0, -20, 'x', 2, 'protected_area', true, 0x4a545b);
  for (const d of doors) d.insideSign = -1; // secure side is toward -z for every reader door in this building
  sign(scene, ['SIMULATOR HALL', 'Tier 1 + GET-1 required • Badge in'], 0, 2.75, -9.88, 0, 2.6, 0.5, { size: 44 });
  sign(scene, ['PROTECTED AREA', 'Tier 3 • Security processing required'], 0, 2.75, -19.88, 0, 2.8, 0.55, { bg: '#7a1f1f', fg: '#fff', border: '#f2c94c', size: 44 });
  sign(scene, ['SECURE SIDE', 'Badge in & out — no tailgating'], 0, 2.75, 10.12, 0, 2.6, 0.5, { size: 44 });

  // ---------- interactables ----------
  const I = (def) => { interactables.push(def); return def; };
  // lot
  box(scene, 1.8, 1.2, 4.2, 0x36506b, -8, 0.6, 30); box(scene, 1.6, 0.6, 2.2, 0x26384a, -8, 1.45, 30.2);
  I({ id: 'car_player', name: 'Your car (clock out)', cat: 'use', x: -8, y: 1, z: 30, desc: 'Your car. Your shift starts at 07:00 (fictional placeholder vehicle).' });
  box(scene, 1.8, 1.2, 4.2, 0x7a2e2e, 8, 0.6, 26); box(scene, 1.8, 1.2, 4.2, 0xb8b8b0, 12, 0.6, 30);
  cyl(scene, 0.05, 2.2, 0x777777, 6, 1.1, 36); sign(scene, ['ASSEMBLY AREA B', 'Report here during drills'], 6, 2.3, 36.03, 0, 1.6, 0.6, { bg: '#1f6f43', fg: '#fff', border: null });
  I({ id: 'assembly_sign', name: 'Assembly Area B sign', cat: 'inspect', x: 6, y: 2, z: 36, desc: 'During a drill or evacuation, go to Assembly Area B, check in with Security, and wait for the all-clear.' });
  cyl(scene, 0.06, 2.5, 0x999999, -14, 1.25, 36); box(scene, 0.5, 0.3, 0.3, 0xdddddd, -14, 2.5, 36);
  I({ id: 'weather_station', name: 'Site weather station', cat: 'inspect', x: -14, y: 2, z: 36, desc: '' });
  // lobby
  box(scene, 1.0, 1.1, 2.6, 0x4b5d6b, -5.5, 0.55, 15); box(scene, 1.1, 0.06, 2.7, 0xcfc6b0, -5.5, 1.12, 15);
  colliders.push({ low: true, minX: -6.0, maxX: -5.0, minZ: 13.7, maxZ: 16.3 });
  box(scene, 0.4, 0.3, 0.05, 0x111111, -5.6, 1.35, 14.6); // monitor
  I({ id: 'sec_desk', name: 'Security desk', cat: 'background', x: -5.5, y: 1.1, z: 15, desc: 'Security desk console. Only security officers use it. Badge-reader events are logged here.' });
  box(scene, 0.05, 1.2, 2.2, 0x6b4f2e, 11.93, 1.6, 15);
  sign(scene, ['NOTICE BOARD', 'Safety • Shift news • Weather'], 11.88, 1.6, 15, -Math.PI / 2, 2.0, 1.0, { size: 46, border: '#2b5d8a' });
  I({ id: 'notice_lobby', name: 'Lobby notice board', cat: 'inspect', x: 11.7, y: 1.6, z: 15, desc: '' });
  box(scene, 0.5, 0.9, 0.5, 0x5c6b5a, 8, 0.45, 18.6); box(scene, 0.5, 0.9, 0.5, 0x5c6b5a, 9, 0.45, 18.6); // planters
  box(scene, 2.4, 0.45, 0.7, 0x2f4858, 6, 0.23, 18.8); // bench
  I({ id: 'visitor_log', name: 'Visitor sign-in kiosk', cat: 'inspect', x: -3.6, y: 1.1, z: 17.5, desc: 'Visitors must sign in, show ID, and be escorted. Employees with badges do not sign in here.' });
  box(scene, 0.5, 1.2, 0.4, 0x2a3a46, -3.6, 0.6, 17.5);
  // corridor
  sign(scene, ['STOP • THINK • ACT • REVIEW', 'When unsure — stop and ask.'], 1.88, 1.6, 0, -Math.PI / 2, 2.2, 0.8, { size: 40, border: '#d6a21e' });
  I({ id: 'poster_stop', name: 'STAR safety poster', cat: 'inspect', x: 1.7, y: 1.6, z: 0, desc: 'STOP when something is unclear. THINK about what should happen. ACT with care. REVIEW the result. (Fictional human-performance poster.)' });
  box(scene, 0.15, 1.0, 0.7, 0x88939a, -1.9, 1.3, -8);
  sign(scene, ['LP-2', 'Lighting Panel (fictional)', 'Qualified electricians only'], -1.82, 1.3, -8, Math.PI / 2, 0.6, 0.5, { size: 60, border: '#c9302c' });
  I({ id: 'lp2_panel', name: 'Lighting Panel LP-2', cat: 'restricted', x: -1.8, y: 1.3, z: -8, desc: 'Electrical panel. Only qualified electrical maintenance staff on an approved work order may open it.' });
  // extinguishers
  const ext = (id, x, z, label) => { cyl(scene, 0.09, 0.5, 0xc0262d, x, 0.55, z); box(scene, 0.06, 0.09, 0.02, 0xf2f2f2, x, 0.6, z + 0.09);
    I({ id, name: `Fire extinguisher ${label}`, cat: 'inspect', x, y: 0.6, z, desc: '' }); };
  ext('ext_1', -1.8, 0.8, 'FE-C1 (corridor)'); ext('ext_2', 11.7, 12, 'FE-L1 (lobby)'); ext('ext_3', -11.7, -8.5, 'FE-B1 (break room)');
  // locker room
  for (let i = 0; i < 7; i++) box(scene, 0.8, 2.0, 0.55, i === 3 ? 0x3e6f8f : 0x5f7482, -9.6 + i * 0.85, 1.0, 0.4);
  colliders.push({ low: true, minX: -10.0, maxX: -3.6, minZ: 0, maxZ: 0.7 });
  I({ id: 'locker_player', name: 'Your locker (#114)', cat: 'use', x: -7.05, y: 1, z: 0.6, desc: 'Store personal items and save your progress.' });
  box(scene, 0.6, 2.0, 1.6, 0xd4b13a, -11.6, 1.0, 8); colliders.push({ low: true, minX: -12, maxX: -11.3, minZ: 7.2, maxZ: 8.8 });
  sign(scene, ['PPE ISSUE', 'Hard hat • Safety glasses'], -11.28, 1.6, 8, Math.PI / 2, 1.2, 0.5, { size: 46 });
  I({ id: 'ppe_cabinet', name: 'PPE issue cabinet', cat: 'use', x: -11.3, y: 1.2, z: 8, desc: '' });
  box(scene, 0.5, 0.9, 1.2, 0xe8e8e8, -11.7, 0.45, 2.5); colliders.push({ low: true, minX: -12, maxX: -11.45, minZ: 1.9, maxZ: 3.1 });
  I({ id: 'sink', name: 'Hand-wash sink', cat: 'use', x: -11.5, y: 0.9, z: 2.5, desc: 'Wash your hands. Good habits.' });
  sign(scene, ['FIRST AID', 'Report ALL injuries'], -4, 1.6, 9.88, Math.PI, 0.9, 0.45, { bg: '#ffffff', fg: '#1f6f43', border: '#1f6f43' });
  I({ id: 'first_aid', name: 'First-aid station', cat: 'inspect', x: -4, y: 1.4, z: 9.8, desc: 'Report every injury, even a small one, to your supervisor. Medical staff decide on restrictions. (Fictional policy.)' });
  box(scene, 2.4, 0.45, 0.5, 0x6b5a45, -7, 0.23, 5); // bench
  // break room
  box(scene, 0.4, 1.0, 0.5, 0xbfc5c8, -11.75, 0.5, -2); colliders.push({ low: true, minX: -12, maxX: -11.5, minZ: -2.3, maxZ: -1.7 });
  I({ id: 'fountain', name: 'Water fountain / bottle filler', cat: 'use', x: -11.6, y: 0.9, z: -2, desc: '' });
  box(scene, 0.6, 0.9, 2.6, 0x8a7a66, -11.7, 0.45, -4.5); colliders.push({ low: true, minX: -12, maxX: -11.4, minZ: -5.8, maxZ: -3.2 });
  box(scene, 0.35, 0.45, 0.35, 0x222222, -11.7, 1.15, -4.5);
  I({ id: 'coffee', name: 'Coffee maker', cat: 'use', x: -11.6, y: 1.1, z: -4.5, desc: '' });
  box(scene, 0.9, 1.9, 0.8, 0x2c4f7c, -11.5, 0.95, -6.8); colliders.push({ low: true, minX: -12, maxX: -11.05, minZ: -7.2, maxZ: -6.4 });
  I({ id: 'vending', name: 'Vending machine (snacks)', cat: 'use', x: -11.1, y: 1.1, z: -6.8, desc: '' });
  box(scene, 2.2, 0.75, 1.1, 0xc8b89a, -7, 0.75, -5); colliders.push({ low: true, minX: -8.1, maxX: -5.9, minZ: -5.55, maxZ: -4.45 });
  box(scene, 2.2, 0.45, 0.4, 0x4a4036, -7, 0.23, -3.9); box(scene, 2.2, 0.45, 0.4, 0x4a4036, -7, 0.23, -6.1);
  I({ id: 'bench', name: 'Break table — sit & rest', cat: 'use', x: -7, y: 0.8, z: -5, desc: '' });
  box(scene, 3, 0.9, 0.6, 0x8a7a66, -6, 0.45, -9.6); box(scene, 0.5, 0.3, 0.35, 0xdddddd, -5.4, 1.05, -9.6);
  I({ id: 'microwave', name: 'Microwave', cat: 'background', x: -5.4, y: 1.05, z: -9.6, desc: 'Break-room microwave. Someone left a lid inside. Not part of your job.' });
  box(scene, 0.05, 1.0, 1.8, 0x6b4f2e, -6, 1.6, -0.12).rotation.y = Math.PI / 2;
  I({ id: 'break_board', name: 'Break-room board', cat: 'inspect', x: -6, y: 1.6, z: -0.3, desc: '' });
  // training room
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { box(scene, 1.4, 0.05, 0.6, 0xd8d0bd, 4.5 + c * 2.3, 0.75, 2 + r * 1.6); box(scene, 0.45, 0.45, 0.45, 0x2f4858, 4.5 + c * 2.3, 0.23, 2.6 + r * 1.6); }
  colliders.push({ low: true, minX: 3.7, maxX: 10.2, minZ: 1.6, maxZ: 5.6 });
  I({ id: 'chairs', name: 'Classroom seating', cat: 'background', x: 6.8, y: 0.75, z: 3.6, desc: 'Classroom tables for instructor-led sessions.' });
  box(scene, 1.2, 0.8, 0.6, 0x5b6770, 10.5, 0.4, 8.6); box(scene, 0.55, 0.35, 0.05, 0x0c1a24, 10.5, 1.05, 8.5);
  colliders.push({ low: true, minX: 9.9, maxX: 11.1, minZ: 8.3, maxZ: 8.9 });
  I({ id: 'train_terminal', name: 'Training terminal TT-01', cat: 'use', x: 10.5, y: 1.0, z: 8.4, desc: '' });
  box(scene, 0.04, 1.2, 3, 0xffffff, 11.95, 1.6, 5);
  sign(scene, ['TODAY: New Employee Orientation', 'Instructor: L. Okafor • 07:00'], 11.9, 1.6, 5, -Math.PI / 2, 2.8, 1.1, { size: 40, border: null });
  I({ id: 'whiteboard', name: 'Whiteboard', cat: 'inspect', x: 11.8, y: 1.6, z: 5, desc: '' });
  box(scene, 1.6, 1.9, 0.4, 0x7a5c3a, 3.4, 0.95, 9.7); colliders.push({ low: true, minX: 2.5, maxX: 4.2, minZ: 9.4, maxZ: 10 });
  I({ id: 'policy_shelf', name: 'Safety Handbook & Policy Manual shelf', cat: 'inspect', x: 3.4, y: 1.2, z: 9.4, desc: '' });
  // office
  box(scene, 1.8, 0.8, 0.8, 0x6d5537, 6, 0.4, -8.6); colliders.push({ low: true, minX: 5.1, maxX: 6.9, minZ: -9.0, maxZ: -8.2 });
  I({ id: 'shift_log', name: 'Shift log binder', cat: 'inspect', x: 6, y: 0.9, z: -8.4, desc: '' });
  box(scene, 1.2, 0.8, 0.6, 0x5b6770, 10.5, 0.4, -8.6); box(scene, 0.55, 0.35, 0.05, 0x0c1a24, 10.5, 1.05, -8.5);
  colliders.push({ low: true, minX: 9.9, maxX: 11.1, minZ: -8.9, maxZ: -8.3 });
  I({ id: 'wo_terminal', name: 'Work-order terminal WO-03', cat: 'use', x: 10.5, y: 1.0, z: -8.4, desc: '' });
  box(scene, 0.4, 0.5, 1.2, 0x333b40, 11.75, 1.0, -2); colliders.push({ low: true, minX: 11.5, maxX: 12, minZ: -2.6, maxZ: -1.4 });
  I({ id: 'radio_charger', name: 'Radio charging rack', cat: 'use', x: 11.6, y: 1.2, z: -2, desc: '' });
  // sim hall
  box(scene, 4, 1.0, 1.0, 0x3c4a54, 0, 0.5, -14); box(scene, 3.8, 0.9, 0.08, 0x0e2230, 0, 1.45, -14.45);
  colliders.push({ low: true, minX: -2, maxX: 2, minZ: -14.5, maxZ: -13.5 });
  I({ id: 'sim_console', name: 'Fictional unit-balance trainer', cat: 'use', x: 0, y: 1.2, z: -13.5, desc: '' });
  for (let i = 0; i < 4; i++) { const p = cyl(scene, 0.15, 6, 0x8d9aa3, -10.5, 0.8 + i * 0.45, -15); p.rotation.x = Math.PI / 2; }
  box(scene, 1.2, 1.4, 1.2, 0x6f8a5a, -8.5, 0.7, -17.5);
  colliders.push({ low: true, minX: -11, maxX: -7.8, minZ: -18.2, maxZ: -12 });
  sign(scene, ['TRAINING MOCKUP', 'Not connected • Do not climb'], -7.7, 1.8, -14, Math.PI / 2, 1.4, 0.5, { size: 40 });
  I({ id: 'sim_pipes', name: 'Training mockup piping', cat: 'background', x: -8, y: 1.2, z: -15, desc: 'Training mockup used in hands-on classes. It is not connected to anything and is not part of your work today.' });
  sign(scene, ['HARD HAT & SAFETY GLASSES', 'REQUIRED BEYOND THIS POINT'], -2.6, 2.0, -10.12, Math.PI, 1.8, 0.6, { bg: '#f2c94c', fg: '#111', border: '#111', size: 40 });
  I({ id: 'pa_reader', name: 'Protected Area door reader', cat: 'restricted', x: 1.3, y: 1.2, z: -19.6, desc: 'Protected Area access needs Tier 3, PA qualification, and security processing. You are not authorized yet.' });

  return { colliders, interactables, doors };
}
