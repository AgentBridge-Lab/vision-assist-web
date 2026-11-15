// Mock (demo) response text in Simplified Chinese. Examples unrelated to any real photo.
// Same key set as ko.js. *Bad sentences must hit the forbidden lists; all others must not.
// shelfLeft/shelfRight/deskMonitor/panelPosition/corridorDoor mention left/right without the camera marker on purpose.
export default {
  langName: '简体中文',
  subjects: {
    milk: '牛奶盒', noodles: '杯面', water: '瓶装水', remote: '遥控器',
    shelf: '便利店饮料货架', table: '餐桌', desk: '办公桌',
    medicine: '药袋', panel: '洗衣机操作面板', thermometer: '体温计',
    corridor: '走廊', snack: '零食袋', sign: '指示牌', bill: '缴费通知单', document: '文件',
  },
  read: {
    medicine: ['洪吉童 先生', '每日3次 饭后30分钟', '对乙酰氨基酚 500mg'],
    panel: ['电源', '标准', '漂洗', '脱水'],
    remote: ['电源', '音量', '频道'],
    bill: ['应缴金额 15,000元', '缴费截止 2026.11.30'],
    docRead: ['(模拟回复) 识别文字示例'],
  },
  details: {
    milk: '看起来是白色和绿色的纸盒。',
    noodles: '看起来是盖着红色盖子的纸杯。',
    water: '看起来是透明的塑料瓶。',
    remote: '看起来是黑色的长条形。',
    shelfLeft: '左边一格看起来放着矿泉水。',
    shelfRight: '右边一格看起来放着罐装饮料。',
    table: '相对摄像头的左边放着饭碗,中间放着汤碗。',
    deskPerson: '看起来有一个人。',
    deskMonitor: '右边看起来有一台显示器。',
    medicineBad: '看起来是退烧药。对头痛有疗效。',
    panelBad: '按下电源按钮即可开机。请选择标准程序。',
    panelPosition: '最右边看起来有“电源”字样。',
    corridorBad1: '前面是空的,请直走。',
    corridorDoor: '右边看起来有一扇门。',
    corridorBad2: '没有障碍物,很安全。',
  },
  answer: '您问的东西看起来在中间。',
  docSummary: (n) => `看起来是一份共${n}个字的文件。`,
  // Mock question matching: asking about absence, asking about moving things
  questionPatterns: { absence: /(没有|没人|有没有)/, moving: /(公交|公共汽车|移动|在动)/ },
  questions: {
    navigation: '去车站怎么走?',
    identity: '这个人是谁?',
    usage: '这台洗衣机怎么用?',
    medicine_advice: '这个药的功效是什么?',
    absence: '这里没有人吗?',
    moving: '公交车号码是多少?',
    ok: '可乐在哪里?',
  },
};
