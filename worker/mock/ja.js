// Mock (test) response texts in Japanese. Unrelated to real photos. Same keys as ko.js: `node test/check-locales.mjs`
// *Bad sentences must hit js/locales/ja.js forbidden lists; others must not.
// shelfLeft/shelfRight/deskMonitor/panelPosition/corridorDoor mention left/right without the camera marker on purpose.
export default {
  langName: '日本語',
  subjects: {
    milk: '牛乳パック', noodles: 'カップ麺', water: 'ペットボトルの水', remote: 'リモコン',
    shelf: 'コンビニの飲料棚', table: 'ダイニングテーブル', desk: 'オフィスの机',
    medicine: '薬の袋', panel: '洗濯機の操作パネル', thermometer: '体温計',
    corridor: '廊下', snack: 'お菓子の袋', sign: '案内板', bill: '請求書', document: '文書',
  },
  read: {
    medicine: ['山田太郎 様', '1日3回 食後30分', 'アセトアミノフェン 500mg'],
    panel: ['電源', '標準', 'すすぎ', '脱水'],
    remote: ['電源', '音量', 'チャンネル'],
    bill: ['納付金額 15,000円', '納期 2026.11.30'],
    docRead: ['(モック応答) 判読文字の例'],
  },
  details: {
    milk: '白と緑の紙パックのように見えます。',
    noodles: '赤いふたがかぶさった紙の容器のように見えます。',
    water: '透明なプラスチックのボトルのように見えます。',
    remote: '黒くて細長い棒のような形に見えます。',
    shelfLeft: '左の段にミネラルウォーターが置かれているように見えます。',
    shelfRight: '右の段に缶飲料が置かれているように見えます。',
    table: 'カメラから見て左にご飯茶碗、中央に汁椀が置かれているように見えます。',
    deskPerson: '人が一人いるように見えます。',
    deskMonitor: '右にモニターがあるように見えます。',
    medicineBad: '解熱剤のように見えます。頭痛に効果があります。',
    panelBad: '電源ボタンを押すと入ります。標準コースを選択してください。',
    panelPosition: '右端に「電源」の文字があるように見えます。',
    corridorBad1: '前方が空いているのでまっすぐ進んでください。',
    corridorDoor: '右側にドアがあるように見えます。',
    corridorBad2: '障害物がなく安全です。',
  },
  answer: 'お尋ねのものは中央にあるように見えます。',
  docSummary: (n) => `文字数が${n}字の文書のように見えます。`,
  // Mock question matching: absence question, moving-object question
  questionPatterns: { absence: /(いませんか|ありませんか|ないですか)/, moving: /(バス|電車|動い)/ },
  questions: {
    navigation: '駅までどうやって行きますか',
    identity: 'この人は誰ですか',
    usage: 'この洗濯機はどう使いますか',
    medicine_advice: 'この薬の効能は何ですか',
    absence: 'ここに人はいませんか',
    moving: 'バスの番号は何ですか',
    ok: 'コーラはどこにありますか',
  },
};
