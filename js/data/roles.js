// Career roles. Only starter roles are selectable in M1; others appear in the career ladder.
export const CATEGORIES = ['mechanical', 'electrical', 'operations', 'chemistry', 'radprotect', 'security', 'logistics', 'it', 'admin', 'emergency', 'engineering'];
export const CAT_NAMES = { mechanical: 'Mechanical', electrical: 'Electrical', operations: 'Operations', chemistry: 'Chemistry', radprotect: 'Radiation Protection', security: 'Security', logistics: 'Logistics', it: 'Information Systems', admin: 'Administration', emergency: 'Emergency Response', engineering: 'Engineering Support' };
export const ROLES = [
  { id: 'ops_trainee', name: 'Operations Trainee', dept: 'Operations', cat: 'operations', starter: true, ladder: ['Field Operator', 'Control-Room Operator', 'Senior Operator (fictional license)', 'Shift Supervisor'] },
  { id: 'mech_tech', name: 'Mechanical Maintenance Technician (Apprentice)', dept: 'Maintenance', cat: 'mechanical', starter: true, ladder: ['Mechanic II', 'Mechanic I', 'Lead Mechanic', 'Maintenance Supervisor'] },
  { id: 'elec_tech', name: 'Electrical Maintenance Technician (Apprentice)', dept: 'Maintenance', cat: 'electrical', starter: true, ladder: ['Electrician II', 'Electrician I', 'Lead Electrician'] },
  { id: 'ic_tech', name: 'Instrumentation & Controls Technician (Apprentice)', dept: 'Maintenance', cat: 'electrical', starter: true, ladder: ['I&C Tech II', 'I&C Tech I', 'I&C Specialist'] },
  { id: 'rp_tech', name: 'Radiation Protection Technician (Junior)', dept: 'Radiation Protection', cat: 'radprotect', starter: true, ladder: ['RP Tech', 'Senior RP Tech', 'RP Supervisor'] },
  { id: 'chem_tech', name: 'Chemistry Technician (Junior)', dept: 'Chemistry', cat: 'chemistry', starter: true, ladder: ['Chem Tech', 'Senior Chem Tech', 'Chemistry Supervisor'] },
  { id: 'security', name: 'Security Officer (Trainee)', dept: 'Security', cat: 'security', starter: true, ladder: ['Security Officer', 'Senior Officer', 'Security Shift Lead'] },
  { id: 'logistics', name: 'Warehouse & Logistics Worker', dept: 'Supply Chain', cat: 'logistics', starter: true, ladder: ['Material Handler', 'Warehouse Lead', 'Supply Chain Coordinator'] },
  { id: 'it_tech', name: 'IT & Communications Technician', dept: 'Information Systems', cat: 'it', starter: true, ladder: ['IT Tech II', 'Systems Specialist', 'IT Lead'] },
  { id: 'admin', name: 'Administrative Assistant', dept: 'Administration', cat: 'admin', starter: true, ladder: ['Admin Specialist', 'Office Coordinator', 'Department Administrator'] },
  { id: 'ep_worker', name: 'Emergency Preparedness Coordinator (Junior)', dept: 'Emergency Preparedness', cat: 'emergency', starter: true, ladder: ['EP Coordinator', 'EP Specialist', 'EP Manager'] },
  { id: 'eng_support', name: 'Engineering Support Associate', dept: 'Engineering', cat: 'engineering', starter: true, ladder: ['Engineer I', 'Engineer II', 'Senior Engineer'] },
  { id: 'fire_brigade', name: 'Fire Brigade Member', dept: 'Fire Protection', cat: 'emergency', starter: false },
  { id: 'env_tech', name: 'Environmental Monitoring Technician', dept: 'Chemistry', cat: 'chemistry', starter: false },
  { id: 'facilities', name: 'Facilities Worker', dept: 'Facilities', cat: 'mechanical', starter: false },
  { id: 'instructor', name: 'Training Instructor', dept: 'Training', cat: 'admin', starter: false },
  { id: 'planner', name: 'Planner & Scheduler', dept: 'Work Management', cat: 'engineering', starter: false },
  { id: 'qa', name: 'Quality Assurance Inspector', dept: 'Quality', cat: 'engineering', starter: false },
  { id: 'contractor', name: 'Contractor / Visiting Specialist', dept: 'Contractor', cat: 'mechanical', starter: false },
  { id: 'field_op', name: 'Field Operator', dept: 'Operations', cat: 'operations', starter: false },
  { id: 'cr_op', name: 'Control-Room Operator', dept: 'Operations', cat: 'operations', starter: false },
];
// Placement assessment. Each answer adds aptitude points to categories.
export const QUIZ = [
  { q: 'A machine starts making an unusual noise. Your first instinct is to…', a: [
    ['Figure out which part is wearing out', { mechanical: 2, engineering: 1 }],
    ['Check the readings and the operating log', { operations: 2, engineering: 1 }],
    ['Make sure the area is safe and people are clear', { emergency: 2, security: 1 }],
    ['Write it up so the right team knows', { admin: 2, logistics: 1 }]] },
  { q: 'Which school subject did you enjoy most?', a: [
    ['Physics or electronics', { electrical: 2, engineering: 1 }], ['Chemistry or biology', { chemistry: 2, radprotect: 1 }],
    ['Computers', { it: 2, electrical: 1 }], ['Shop class or auto tech', { mechanical: 2 }]] },
  { q: 'Your ideal shift is…', a: [
    ['Monitoring systems and making careful decisions', { operations: 2 }], ['Hands-on repair work', { mechanical: 1, electrical: 1 }],
    ['Patrolling and keeping people safe', { security: 2 }], ['Organizing parts, people, and schedules', { logistics: 1, admin: 1 }]] },
  { q: 'A coworker skips a safety step to save time. You…', a: [
    ['Respectfully stop the job and ask about it', { operations: 1, radprotect: 1, emergency: 1 }], ['Report it through the proper channel', { security: 1, admin: 1 }],
    ['Show them the procedure step', { engineering: 1, chemistry: 1 }], ['Ask them to show you the right way, then do it together', { mechanical: 1, electrical: 1 }]] },
  { q: 'Which tool would you most like to master?', a: [
    ['A calibrated multimeter', { electrical: 2 }], ['A survey meter (fictional)', { radprotect: 2 }], ['A lab analyzer', { chemistry: 2 }], ['A torque wrench', { mechanical: 2 }]] },
  { q: 'In a drill, you would rather…', a: [
    ['Coordinate communications', { emergency: 2, it: 1 }], ['Account for people at assembly', { security: 1, admin: 1 }],
    ['Check equipment status', { operations: 1, engineering: 1 }], ['Bring supplies where they are needed', { logistics: 2 }]] },
  { q: 'How do you like to learn?', a: [
    ['Read the manual first', { engineering: 1, operations: 1 }], ['Watch an expert and then try it', { mechanical: 1, electrical: 1 }],
    ['Practice in a simulator', { operations: 2 }], ['Take checklists and notes', { admin: 1, chemistry: 1, radprotect: 1 }]] },
  { q: 'The work environment you would prefer is…', a: [
    ['Offices and screens', { it: 1, admin: 1, engineering: 1 }], ['Labs and sampling', { chemistry: 2 }],
    ['Industrial spaces', { mechanical: 1, electrical: 1, radprotect: 1 }], ['Gates, grounds, and the outdoors', { security: 1, emergency: 1 }]] },
];
export const PRIOR = { none: {}, industrial: { mechanical: 2 }, electrical: { electrical: 2 }, healthcare: { radprotect: 1, emergency: 1 }, security: { security: 2 }, office: { admin: 1, it: 1 }, lab: { chemistry: 2 } };
