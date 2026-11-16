// @ts-check
/**
 * English locale, translated from ko.js (the reference). Keep the key set identical: `node test/check-locales.mjs`
 * Confidence vocabulary is fixed to three expressions:
 *   "It says ..." (text was read) / "It appears to be ..." (inference) / "cannot tell" (unknown).
 */

export default {
  meta: { code: 'en', htmlLang: 'en', speechTag: 'en-US', ocr: 'eng', name: 'English' },

  ui: {
    title: 'Visual Assistant',
    guideTitle: 'How to use',
    settings: 'Settings',
    guideButton: 'Listen to the guide',
    legendLanguage: 'Language',
    legendOutput: 'Voice output',
    optApp: 'App voice',
    optScreenReader: 'Leave it to my screen reader',
    optSilent: 'Text only, no sound',
    legendLength: 'Description length',
    optOne: 'One sentence',
    optNormal: 'Normal',
    optDetail: 'Detailed',
    legendFont: 'Text size',
    fontDown: 'Smaller text',
    fontUp: 'Larger text',
    legendTheme: 'Display',
    optBasic: 'Standard (light background)',
    optSharp: 'High contrast (dark background)',
    statusTitle: 'Status',
    errorWord: 'Error',
    resultTitle: 'Latest description',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    cameraRetry: 'Try again',
    replay: 'Listen again',
    detail: 'More detail',
    fix: 'Lock',
    unfix: 'Unlock',
    recheck: 'Check again',
    retrySame: 'Retry with the same photo',
    askLabel: 'Ask a question',
    askSend: 'Send question',
    prev: 'Previous sentence',
    next: 'Next sentence',
    first: 'From the beginning',
    newDoc: 'Scan a new document',
    aiSummary: 'Ask AI for a summary',
    aiRead: 'Ask AI to read it',
    speechGroup: 'Voice controls',
    slower: 'Slower',
    faster: 'Faster',
    quieter: 'Quieter',
    louder: 'Louder',
    mute: 'Mute',
    unmute: 'Unmute',
    demoBanner: 'This is a test screen. The descriptions are pre-written examples and have nothing to do with what the camera sees.',
  },

  // Five text sizes
  fontNames: ['Small', 'Normal', 'Slightly large', 'Large', 'Largest'],

  // Mode names and button help text
  modes: {
    object: { name: 'Describe an object', title: '1. Describe an object', desc: 'Tells you about an object in your hand or in front of you' },
    scene: { name: 'Look around', title: '2. Look around', desc: 'For looking around while standing still. It does not give directions' },
    doc: { name: 'Read text and documents', title: '3. Read text and documents', desc: 'Reads a document exactly as written. The photo never leaves your phone' },
  },

  // The four first-use sentences
  guide: [
    'This tool is for use while standing still. Do not use it while walking, and do not use it to decide where to walk.',
    'Describe an object and Look around send the photo to an external AI. Read text and documents does not send it.',
    'It may be wrong. Double-check medicine, money, and dates.',
    'There is a daily limit on how many times you can use it.',
  ],

  // Status messages
  status: {
    startObject: 'Starting Describe an object. Hold the object in front of the camera.',
    startScene: 'Starting Look around. This is for looking around while standing still. Do not use it while walking or to decide where to walk.',
    startDoc: 'Starting Read text and documents. Hold the document in front of the camera.', // draft
    notConnected: 'Not connected to the real AI yet. Describe an object and Look around cannot be used now. Read text and documents can be used.', // draft
    demoStart: 'This is a test. The descriptions from now on are pre-written examples and have nothing to do with what the camera sees.', // draft
    noVoice: 'This device has no English voice, so results are shown as text on the screen instead of spoken.', // draft
    frameWait: 'Please hold the camera still for a moment.',
    steadyHint: "The picture is still moving. Try resting the phone on a table or leaning it against a wall.",
    analyzing: 'Checking now.',
    slow: 'The response is slow. Waiting a little longer.',
    noChange: 'Nothing has changed, so I am waiting.',
    fixed: 'The current subject is locked. You can put the phone down.',
    unfixed: 'Unlocked.', // draft
    paused: 'Paused.',
    resumed: 'Resumed.', // draft
    idlePaused: 'Paused after 3 minutes without any action. Use the Resume button to continue.',
    returned: 'Paused. Please press the Resume button.',
    docFixed: 'The document is locked. Reading it as written.',
    stopped: 'Stopped. The camera is off.',
    sceneMoving: 'No description while you are moving. I will look again when you stop.',
    cameraReconnected: 'The camera is connected again.',
    wakeLockDenied: 'It will stop if the screen turns off.',
    remaining: (n) => `You have ${n} uses left today.`,
    sessionLimit: (n) => `Paused after ${n} descriptions in this session. Use the Resume button to continue.`, // draft
    busy: 'Still checking the previous request. Please press again in a moment.', // draft
    noLast: 'There is no description to replay yet.', // draft
    needQuestion: 'Please write your question first.', // draft
    rateChanged: 'This is the speed.',
    rateLimit: 'The speed cannot be changed any further.', // draft
    volumeChanged: 'This is the volume.', // draft
    volumeMax: 'Please press the volume button on the side of your phone.',
    volumeMin: 'This is the quietest volume.', // draft
    muted: 'Sound is off. Results are shown as text on the screen.', // draft
    unmuted: 'Sound is on.', // draft
    ocrPreparing: 'Getting text reading ready. The first time takes a while.', // draft
    ocrDownloading: (pct) => `Downloading text reading data. ${pct} percent.`, // draft
    ocrReady: 'Text reading is ready.', // draft
    ocrReading: 'Reading the text. Please hold still for a moment.', // draft
    ocrNoText: 'Could not read any text. Move the document a little farther away, or point it again in a brighter place.', // draft
    ocrUnavailable: 'Text reading could not be loaded on this device. Check your internet connection and start again.', // draft
    docEnd: 'That is the end.', // draft
    docFirst: 'This is the first sentence.', // draft
    docLast: 'This is the last sentence.', // draft
    docNew: 'Please show a new document.', // draft
    docNeedText: 'Read the document first before asking for a summary.', // draft
    confirmSendText: 'The text will be sent to an external AI. Press once more to continue.',
    confirmSendPhoto: 'The photo will be sent to an external AI. Press once more to continue.',
    fontSize: (name) => `Text size: ${name}`,
    fontMin: 'This is the smallest text.',
    fontMax: 'This is the largest text.',
    languageChanged: 'Switched to English.',
  },

  // Error messages
  errors: {
    camera_unsupported: 'The camera cannot be used in this browser.',
    camera_denied: 'Camera access was not allowed. Allow the camera in the site settings next to the browser address bar, then press the Try again button.',
    camera_notfound: 'No camera was found.',
    camera_busy: 'Another app is using the camera. Close that app, then press the Try again button.',
    camera_stalled: 'The camera has stopped. Please stop and start again.',
    network: 'The internet connection was lost. It will continue automatically when you are back online. Read text and documents still works now.',
    service: 'The service has a problem. It is not a problem with your phone or your internet. Please try again in a moment.',
    limit_device: 'You have used all of today\'s uses. You can use it again at midnight. Read text and documents is still available.',
    limit_budget: 'This month\'s free operating budget has run out, so Describe an object and Look around are paused. Read text and documents is still available.',
  },

  // Photo quality
  quality: {
    dark: 'It is too dark. Please move to a brighter place.',
    blur: 'The photo is blurred. Please hold still for a moment.',
    blurRepeated: 'The photos keep coming out blurred. Put the object on a table and hold the phone about 30 centimeters above it.',
    cut: 'The text is cut off. Please move the phone a little farther away.',
    glare: 'There is glare. Please change the angle a little.',
    far: 'Too far away to read the text. Please move closer and point the camera again.',
  },

  // Requests outside what this app does
  outOfScope: {
    navigation: 'Route guidance is not provided. I only tell you what is visible while you stand still.',
    identity: 'I do not say who someone is. I only say that a person is visible.',
    usage: 'Instructions for use are not provided. I only read the text printed on buttons.',
    medicine_advice: 'I do not say what a medicine does or how to take it. I only read the printed text. Please ask a pharmacist.',
    absent: 'It is not visible on the screen now. Please move the camera slowly to the side.',
    uncertain: 'Something similar is visible, but I am not certain. Please bring it closer and check again.',
    moving: 'I cannot read things that are moving.',
    absence: 'It is not in the visible range. I cannot tell about places the camera has not captured.',
    display_off: 'The display is off, or no text is visible.',
    small_object: 'Small objects may be missed. Not finding something does not mean it is not there.',
  },

  // Fixed vocabulary for sentence rules
  rule: {
    unsurePrefix: 'Not certain: ', // placed in front of a sentence or a raw line of text
    unknown: 'I cannot tell what it is.',
    readFail: 'I could not read the text.',
    cut: 'The text is cut off, so I read only part of it.',
    occluded: 'Part of it is hidden and cannot be seen.',
    importantClosing: 'Please double-check anything important by another method.',
    medicineClosing: 'Before taking it, please double-check with a pharmacist or another person.',
    medicalValueClosing: 'Number displays are easy to misread. Please check important values by another method.',
    medicalValueUnverified: 'I could not confirm the number by reading it twice. I will not say the number.', // draft
    navReplaced: 'Route guidance is not provided. I only tell you what is visible.',
    recheckSame: (n) => `It looks the same when checked again. Checked ${n} more time${n === 1 ? '' : 's'}.`, // draft
    docPartial: 'Some of the text could not be read.',
    docNumberOnce: 'The number was read only once, so it could not be confirmed.', // draft
    numberClosing: 'Numbers and units may be read wrong. Please double-check the numbers by another method.',
    demoNotice: 'This is a test example. It has nothing to do with the real object.', // draft; added to every mock response
  },

  // Headings for the text area
  labels: {
    subject: 'Subject', readText: 'Printed text', inferred: 'Inference', notice: 'Notice', answer: 'Answer',
    unread: 'Not seen', capture: 'Shooting tip', confirm: 'Confirm', recheck: 'Check again', demo: 'Test',
  },

  // Forbidden phrases for free-form model output. Compared in lowercase with includes()
  forbidden: {
    // movement directions, walkability, safety assurances, obstacle talk
    navigation: ['turn left', 'turn right', 'go left', 'go right', 'go straight', 'go ahead', 'go forward', 'go through', 'go around',
      'walk', 'keep going', 'head to', 'head toward', 'move forward', 'step forward', 'step back', 'proceed', 'cross the', 'you can pass',
      'you can go', 'you can cross', 'you can get through', 'you may pass', 'safe to', 'is safe', 'are safe', 'not safe', 'unsafe', 'safely',
      'clear path', 'path is clear', 'way is clear', 'way ahead is clear', 'is clear to', 'nothing in your way', 'in your way',
      'watch out', 'be careful', 'careful of', 'beware', 'danger', 'obstacle', 'avoid ', 'stay away', 'stop here', 'stop moving'],
    // device operating instructions
    usage: ['press ', 'push the', 'tap the', 'tap on', 'tap it', 'select ', 'choose ', 'touch the', 'hold down', 'long press', 'long-press',
      'turn the', 'turn it on', 'turn it off', 'to turn on', 'to turn off', 'switch it on', 'switch it off', 'flip the', 'slide the',
      'you can use', 'to operate', 'to start the', 'to begin'],
    // medicine efficacy or dosing advice
    medicine: ['effective', 'efficacy', 'side effect', 'relieve', 'relief', 'reduces', 'cure', 'treat', 'helps with', 'helps to', 'good for',
      'used for', 'used to', 'works for', 'take one', 'take two', 'take it', 'take this', 'you should take', 'should be taken', 'you can take',
      'safe to take', 'dosage', 'recommended dose', 'daily dose', 'dose of', 'before bed', 'with food'],
  },

  // Sorting out questions outside scope. Checked in this order; first match wins
  question: {
    medicine_advice: /(side effects?|efficacy|effective|dosage|\bdoses?\b|how (much|many|often|long) .{0,30}\b(take|dose)\b|(how|when|where) (do|should|can|could|to) (i |we )?(take|use|swallow|apply)\b.{0,20}\b(medicine|medication|pills?|tablets?|capsules?|drug|ointment|syrup)|can i take|should i take|what (is|does|are) (this|it|the) (medicine|medication|pills?|tablets?|capsules?|drug)s? (for|do)|what (medicine|medication|pills?|drug) is (this|that|it)|what (kind|type) of (medicine|medication|pills?|drug)|\b(good|used) for\b|\b(treat|treats|treating|cure|cures|relieve|relieves)\b|how (do|should) i apply|how to apply)/i,
    identity: /(who('s| is| are) (this|that|he|she|they|these|those|there|the (person|man|woman|guy|lady))|\bwhose\b|(his|her|their) name|name of (this|that|the) (person|man|woman)|do i know|is (this|that|it) (my|the) (car|taxi|cab|friend)|\bmy (car|taxi|cab)\b|recogni[sz]e|\bfaces?\b)/i,
    usage: /(how (do|can|should|to|does) (i |you |we )?(use|operate|work|turn|switch|start|stop|set|run|control|control)\b|how (does|do) (this|it|the [\w ]{1,30}) work|how to (use|operate|turn|switch|start|set|run|control)\b|which button|what button|what (do|should) i (press|push|tap|touch)|where (do|should|can) i (press|push|tap|touch)|instructions|operat(e|ing) (this|it)|turn (it |this )?(on|off)|(settings?|setup|set up) (this|it))/i,
    navigation: /(how (do|can|should|would|to) (i |we )?(get|go|walk|reach|find my way)|how far|which way|what way|what direction|\bdirections?\b|\broute\b|\bway to\b|can (i|we) (go|walk|cross|pass|get through|step)|(is|are) (it|this|that|there) (safe|ok|okay|clear|fine) to|is (it|this|that|the [\w ]{1,20}) (safe|clear|ok|okay)\b|safe to|\bcross\b|where (do|should|can) (i|we) (go|walk|turn)|which (exit|door|way)|obstacles?|\bbump|collide|walk(ing)? (to|through|straight|forward)|go (to|straight|left|right|ahead|through|forward)|walkable)/i,
  },

  // Words that mark medicine or important documents
  docWords: {
    medicine: /(pharmacy|pharmacist|dispens|prescri|\brx\b|dosage|\bdoses?\b|take (one|two|three|\d)|tablets?|capsules?|syrup|ointment|eye ?drops?|\bmg\b|\bml\b|milligram|\d+ ?times? (a|per|each|daily)|\bdaily\b|after meals?|before meals?|with meals?|bedtime|directions for use|\bdirections:)/i,
    important: /(amount due|total due|due date|pay(ment)? (by|due)|balance|invoice|\bbill\b|statement|payment|\btotal\b|[$€£₩]\s?\d|\d\s?(usd|krw|won|dollars|euros)\b|contract|agreement|account (no|number|#)|\baccount\b|deposit|maturity|deadline|expir|insurance|\btax\b|penalty|late fee|\bunit\s?#?\d+|\bapt\.? ?\d+|\bapartment\b)/i,
  },

  // Sentence templates. Confidence vocabulary is fixed: "It says ..." / "It appears to be ..." / "cannot tell"
  fmt: {
    seems: (subject) => `It appears to be ${subject}.`,
    quote: (text) => `It says "${text}".`,
    recheckChanged: (before, now) => `At first it appeared to be ${before}, and now it appears to be ${now}. I am not certain.`,
    /** Add "relative to the camera" right after the first left/right mention */
    cameraBasis: (s) => (!/\b(left|right)\b/i.test(s) || /relative to the camera/i.test(s) ? s : s.replace(/\b(left|right)\b/i, '$1 relative to the camera')),
    valueEither: (a, b) => `The number reads as ${a} or ${b}.`,
    valueNone: 'not readable',
    docEither: (a, b) => `It reads as ${a} or ${b}`,
    docMismatch: (a) => `${a} did not match when read again`,
    docTail: (list) => ` The numbers on this line: ${list}.`,
  },
};
