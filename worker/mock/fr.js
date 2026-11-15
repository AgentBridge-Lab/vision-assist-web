// Mock (test) responses in French. Examples unrelated to any real photo.
// Rules: *Bad sentences must hit the forbidden lists in js/locales/fr.js, the rest must not.
//        shelfLeft, shelfRight, deskMonitor, panelPosition, corridorDoor mention left/right without the camera marker on purpose.
export default {
  langName: 'français',
  subjects: {
    milk: 'une brique de lait', noodles: 'un pot de nouilles instantanées', water: "une bouteille d'eau", remote: 'une télécommande',
    shelf: 'un rayon de boissons de supérette', table: 'une table de repas', desk: 'un bureau de travail',
    medicine: 'une pochette de médicaments', panel: "le panneau de commande d'un lave-linge", thermometer: 'un thermomètre médical',
    corridor: 'un couloir', snack: 'un paquet de biscuits', sign: "un panneau d'information", bill: 'une facture', document: 'un document',
  },
  read: {
    medicine: ['M. Hong Gildong', '1 comprimé 3 fois par jour, 30 minutes après le repas', 'Paracétamol 500 mg'],
    panel: ['Marche', 'Standard', 'Rinçage', 'Essorage'],
    remote: ['Marche', 'Volume', 'Chaîne'],
    bill: ['Montant à payer : 15,000 KRW', 'Échéance : 2026.11.30'],
    docRead: ['(réponse test) exemple de texte lu'],
  },
  details: {
    milk: 'Cela semble être une brique en carton blanche et verte.',
    noodles: 'Cela semble être un pot en carton avec un couvercle rouge.',
    water: 'Cela semble être une bouteille en plastique transparent.',
    remote: 'Cela semble être un objet noir long et étroit.',
    shelfLeft: "Il semble y avoir des bouteilles d'eau dans la case de gauche.",
    shelfRight: 'Il semble y avoir des canettes de boisson dans la case de droite.',
    table: 'À gauche par rapport à la caméra, il semble y avoir un bol de riz, et au centre un bol de soupe.',
    deskPerson: 'Il semble y avoir une personne.',
    deskMonitor: 'Il semble y avoir un écran à droite.',
    medicineBad: "Cela semble être un antipyrétique. Il est efficace contre les maux de tête.",
    panelBad: 'Appuyez sur le bouton Marche pour allumer. Sélectionnez le programme Standard.',
    panelPosition: "Le mot Marche semble se trouver à l'extrémité droite.",
    corridorBad1: 'La voie est libre, avancez.',
    corridorDoor: 'Il semble y avoir une porte à droite.',
    corridorBad2: "Il n'y a pas d'obstacle, c'est sans danger.",
  },
  answer: 'Ce que vous demandez semble se trouver au centre.',
  docSummary: (n) => `Cela semble être un document de ${n} caractères.`,
  // Mock question detection: absence question, moving-subject question
  questionPatterns: { absence: /(n'y a[- ](t-il )?(pas|personne|rien|aucun)|il manque|absent)/i, moving: /(\bbus\b|autobus|tramway|\btram\b|bouge|mouvement)/i },
  // Sample user questions (used by check-locales and manual tests)
  questions: {
    navigation: 'Comment aller à la gare ?',
    identity: 'Qui est cette personne ?',
    usage: 'Comment utiliser ce lave-linge ?',
    medicine_advice: 'Combien de comprimés dois-je prendre ?',
    absence: "Il n'y a personne ici ?",
    moving: 'Quel est le numéro du bus ?',
    ok: 'Où est le coca ?',
  },
};
