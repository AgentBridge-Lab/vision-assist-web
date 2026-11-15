// Mock (test) response text in English. These are examples unrelated to any real photo.
// The key set must match the other language files: `node test/check-locales.mjs`
// Rule: *Bad sentences must hit the forbidden lists in js/locales; all other sentences must not.
//       shelfLeft, shelfRight, deskMonitor, panelPosition, corridorDoor mention left/right but deliberately omit
//       "relative to the camera" (to test that the front end adds it).
export default {
  langName: 'English',
  subjects: {
    milk: 'a milk carton', noodles: 'a cup of instant noodles', water: 'a bottle of water', remote: 'a remote control',
    shelf: 'a convenience store drink shelf', table: 'a dining table', desk: 'an office desk',
    medicine: 'a medicine bag', panel: 'a washing machine control panel', thermometer: 'a thermometer',
    corridor: 'a corridor', snack: 'a snack bag', sign: 'a sign', bill: 'a bill', document: 'a document',
  },
  read: {
    medicine: ['John Smith', '3 times a day, 30 minutes after meals', 'Acetaminophen 500mg'],
    panel: ['Power', 'Standard', 'Rinse', 'Spin'],
    remote: ['Power', 'Volume', 'Channel'],
    bill: ['Amount due 15,000 won', 'Due date 2026.11.30'],
    docRead: ['(mock response) sample of read text'],
  },
  details: {
    milk: 'It appears to be a white and green paper carton.',
    noodles: 'It appears to be a paper cup with a red lid.',
    water: 'It appears to be a clear plastic bottle.',
    remote: 'It appears to be a long black bar shape.',
    shelfLeft: 'Bottled water appears to be on the left shelf.',
    shelfRight: 'Canned drinks appear to be on the right shelf.',
    table: 'Relative to the camera, a rice bowl appears to be on the left and a soup bowl in the middle.',
    deskPerson: 'It appears to be one person at the desk.',
    deskMonitor: 'A monitor appears to be on the right.',
    medicineBad: 'It appears to be a fever reducer. It is effective for headaches.',
    panelBad: 'Press the power button to turn it on. Select the standard cycle.',
    panelPosition: 'The word Power appears to be at the far right end.',
    corridorBad1: 'The way ahead is clear, so go straight.',
    corridorDoor: 'A door appears to be on the right.',
    corridorBad2: 'There are no obstacles, so it is safe.',
  },
  answer: 'It appears to be in the middle, which is what you asked about.',
  docSummary: (n) => `It appears to be a document with ${n} characters.`,
  // Mock question matching: a question asking about absence, and one about a moving object
  questionPatterns: { absence: /(nobody|no one|nothing|isn'?t there|aren'?t there|none)/i, moving: /\b(bus|moving|moves?)\b/i },
  // Sample questions (used by check-locales and manual testing)
  questions: {
    navigation: 'How do I get to the station?',
    identity: 'Who is this person?',
    usage: 'How do I use this washing machine?',
    medicine_advice: 'What are the side effects of this medicine?',
    absence: 'Is there nobody here?',
    moving: 'What is the bus number?',
    ok: 'Where is the cola?',
  },
};
