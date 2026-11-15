// German mock texts (sample only, unrelated to real photos). Same key set as ko.js.
// Rules: *Bad sentences must hit the forbidden lists; all others must not.
//   shelfLeft, shelfRight, deskMonitor, panelPosition, corridorDoor mention left/right without the camera marker on purpose.
export default {
  langName: 'Deutsch',
  subjects: {
    milk: 'ein Milchkarton', noodles: 'eine Instantnudel-Schale', water: 'eine Wasserflasche', remote: 'eine Fernbedienung',
    shelf: 'ein Getränkeregal im Laden', table: 'ein Esstisch', desk: 'ein Büroschreibtisch',
    medicine: 'eine Medikamententüte', panel: 'ein Bedienfeld an einer Waschmaschine', thermometer: 'ein Fieberthermometer',
    corridor: 'ein Flur', snack: 'eine Snacktüte', sign: 'ein Hinweisschild', bill: 'eine Rechnung', document: 'ein Dokument',
  },
  read: {
    medicine: ['Max Mustermann', '3-mal täglich nach dem Essen', 'Paracetamol 500 mg'],
    panel: ['Ein/Aus', 'Standard', 'Spülen', 'Schleudern'],
    remote: ['Ein/Aus', 'Lautstärke', 'Kanal'],
    bill: ['Zu zahlen 15,00 EUR', 'Fällig am 30.11.2026'],
    docRead: ['(Testantwort) Beispiel für gelesenen Text'],
  },
  details: {
    milk: 'Es scheint ein weiß-grüner Karton zu sein.',
    noodles: 'Es scheint eine Papierschale mit rotem Deckel zu sein.',
    water: 'Es scheint eine durchsichtige Plastikflasche zu sein.',
    remote: 'Es scheint ein langer schwarzer Stab zu sein.',
    shelfLeft: 'Im linken Fach scheint Wasser zu stehen.',
    shelfRight: 'Im rechten Fach scheinen Getränkedosen zu stehen.',
    table: 'Aus Kamerasicht scheint links eine Reisschale und in der Mitte eine Suppenschale zu stehen.',
    deskPerson: 'Es scheint eine Person zu sehen zu sein.',
    deskMonitor: 'Rechts scheint ein Monitor zu stehen.',
    medicineBad: 'Es scheint ein Fiebermittel zu sein. Es wirkt gegen Kopfschmerzen.',
    panelBad: 'Zum Einschalten die Starttaste drücken. Wählen Sie das Standardprogramm.',
    panelPosition: 'Ganz rechts scheint das Wort „Ein/Aus“ zu stehen.',
    corridorBad1: 'Vor Ihnen ist frei, gehen Sie geradeaus.',
    corridorDoor: 'Rechts scheint eine Tür zu sein.',
    corridorBad2: 'Es ist kein Hindernis da, es ist sicher.',
  },
  answer: 'Das Gefragte scheint in der Mitte zu stehen.',
  docSummary: (n) => `Es scheint ein Dokument mit ${n} Zeichen zu sein.`,
  // Mock question detection: absence questions, moving-object questions
  questionPatterns: { absence: /(kein|niemand|nicht da|fehlt)/i, moving: /(bus|straßenbahn|fahrzeug|bewegt)/i },
  questions: {
    navigation: 'Wie komme ich zum Bahnhof?',
    identity: 'Wer ist diese Person?',
    usage: 'Wie bediene ich diese Waschmaschine?',
    medicine_advice: 'Welche Wirkung hat dieses Medikament?',
    absence: 'Ist hier niemand?',
    moving: 'Wie lautet die Busnummer?',
    ok: 'Wo steht die Cola?',
  },
};
