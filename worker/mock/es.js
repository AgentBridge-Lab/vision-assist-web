// Mock (test) response texts in Spanish. Examples only, unrelated to any real photo.
// Same key set as ko.js: `node test/check-locales.mjs --only es`
// Rules: *Bad sentences must hit the forbidden lists in js/locales/es.js; all others must not.
//        shelfLeft, shelfRight, deskMonitor, panelPosition, corridorDoor mention left/right and deliberately omit "respecto a la cámara".
export default {
  langName: 'español',
  subjects: {
    milk: 'un cartón de leche', noodles: 'un vaso de fideos instantáneos', water: 'una botella de agua', remote: 'un mando a distancia',
    shelf: 'un expositor de bebidas de una tienda', table: 'una mesa de comedor', desk: 'un escritorio de oficina',
    medicine: 'una bolsa de medicamentos', panel: 'el panel de una lavadora', thermometer: 'un termómetro',
    corridor: 'un pasillo', snack: 'una bolsa de aperitivos', sign: 'un cartel informativo', bill: 'una factura', document: 'un documento',
  },
  read: {
    medicine: ['Sr. D. Juan Pérez', '3 veces al día, 30 minutos después de las comidas', 'Paracetamol 500 mg'],
    panel: ['Encendido', 'Estándar', 'Aclarado', 'Centrifugado'],
    remote: ['Encendido', 'Volumen', 'Canal'],
    bill: ['Importe a pagar 15.000 €', 'Vencimiento 30.11.2026'],
    docRead: ['(respuesta de prueba) ejemplo de texto descifrado'],
  },
  details: {
    milk: 'Parece un cartón blanco y verde.',
    noodles: 'Parece un envase de cartón con una tapa roja.',
    water: 'Parece una botella de plástico transparente.',
    remote: 'Parece una barra larga de color negro.',
    shelfLeft: 'En el estante de la izquierda parece haber botellas de agua.',
    shelfRight: 'En el estante de la derecha parece haber latas de bebida.',
    table: 'A la izquierda, respecto a la cámara, parece haber un cuenco de arroz y en el centro un cuenco de sopa.',
    deskPerson: 'Parece haber una persona.',
    deskMonitor: 'A la derecha parece haber un monitor.',
    medicineBad: 'Parece un antitérmico. Es eficaz contra el dolor de cabeza.',
    panelBad: 'Pulse el botón de encendido y se enciende. Seleccione el programa estándar.',
    panelPosition: 'En el extremo de la derecha parece estar escrita la palabra Encendido.',
    corridorBad1: 'Delante está libre, siga recto.',
    corridorDoor: 'A la derecha parece haber una puerta.',
    corridorBad2: 'No hay obstáculos, es seguro.',
  },
  answer: 'Lo que pregunta parece estar en el centro.',
  docSummary: (n) => `Parece ser un documento de ${n} caracteres.`,
  // Mock question detection: absence questions, questions about moving things
  questionPatterns: { absence: /(no hay|hay alg|hay nadie|hay ning)/i, moving: /(autob[uú]s|\bbus\b|se mueve|movimiento)/i },
  // Sample user questions (used by check-locales and manual tests)
  questions: {
    navigation: '¿Cómo llego a la estación?',
    identity: '¿Quién es esta persona?',
    usage: '¿Cómo se usa esta lavadora?',
    medicine_advice: '¿Qué efectos secundarios tiene esta pastilla?',
    absence: '¿No hay nadie aquí?',
    moving: '¿Cuál es el número del autobús?',
    ok: '¿Dónde está la cola?',
  },
};
