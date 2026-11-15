// Thai mock (demo) responses. Examples unrelated to any real photo.
// Rules: *Bad sentences must hit js/locales/th.js forbidden lists; all others must not.
//        shelfLeft/shelfRight/deskMonitor/panelPosition/corridorDoor mention left/right without the camera marker on purpose.
export default {
  langName: 'ภาษาไทย',
  subjects: {
    milk: 'กล่องนม', noodles: 'บะหมี่กึ่งสำเร็จรูปแบบถ้วย', water: 'ขวดน้ำดื่ม', remote: 'รีโมตคอนโทรล',
    shelf: 'ชั้นวางเครื่องดื่มในร้านสะดวกซื้อ', table: 'โต๊ะอาหาร', desk: 'โต๊ะทำงานในออฟฟิศ',
    medicine: 'ซองยา', panel: 'แผงควบคุมเครื่องซักผ้า', thermometer: 'เทอร์โมมิเตอร์',
    corridor: 'ทางเดินในอาคาร', snack: 'ถุงขนม', sign: 'ป้ายประกาศ', bill: 'ใบแจ้งหนี้', document: 'เอกสาร',
  },
  read: {
    medicine: ['คุณสมชาย ใจดี', 'วันละ 3 ครั้ง หลังอาหาร 30 นาที', 'พาราเซตามอล 500 mg'],
    panel: ['เปิด/ปิด', 'มาตรฐาน', 'ล้างน้ำ', 'ปั่นแห้ง'],
    remote: ['เปิด/ปิด', 'ระดับเสียง', 'ช่อง'],
    bill: ['ยอดชำระ 15,000 บาท', 'ครบกำหนด 2026.11.30'],
    docRead: ['(ตัวอย่างจำลอง) ตัวอย่างข้อความที่อ่านได้'],
  },
  details: {
    milk: 'ดูเหมือนเป็นกล่องกระดาษสีขาวและสีเขียว',
    noodles: 'ดูเหมือนเป็นถ้วยกระดาษที่มีฝาสีแดงปิดอยู่',
    water: 'ดูเหมือนเป็นขวดพลาสติกใส',
    remote: 'ดูเหมือนเป็นแท่งยาวสีดำ',
    shelfLeft: 'ช่องด้านซ้ายดูเหมือนมีน้ำดื่มวางอยู่',
    shelfRight: 'ช่องด้านขวาดูเหมือนมีเครื่องดื่มกระป๋องวางอยู่',
    table: 'เมื่อมองจากกล้อง ด้านซ้ายดูเหมือนมีชามข้าว ตรงกลางมีชามซุปวางอยู่',
    deskPerson: 'ดูเหมือนมีคนอยู่หนึ่งคน',
    deskMonitor: 'ด้านขวาดูเหมือนมีจอมอนิเตอร์',
    medicineBad: 'ดูเหมือนเป็นยาลดไข้ที่ช่วยบรรเทาอาการปวดหัวได้',
    panelBad: 'กดปุ่มเปิดปิดเพื่อเปิดเครื่อง แล้วเลือกโปรแกรมมาตรฐานได้',
    panelPosition: 'ที่ปลายด้านขวาดูเหมือนมีตัวอักษรคำว่า เปิด/ปิด',
    corridorBad1: 'ข้างหน้าโล่ง เดินตรงไปได้เลย',
    corridorDoor: 'ด้านขวาดูเหมือนมีประตู',
    corridorBad2: 'ไม่มีสิ่งกีดขวางจึงปลอดภัย',
  },
  answer: 'สิ่งที่ถามดูเหมือนอยู่ตรงกลาง',
  docSummary: (n) => `ดูเหมือนเป็นเอกสารที่มี ${n} ตัวอักษร`,
  // Mock question mimicry: asking about absence, asking about a moving target
  questionPatterns: { absence: /(ไม่มี|ไม่เห็น)/, moving: /(รถเมล์|รถบัส|เคลื่อนที่|ขยับ)/ },
  // Sample questions (used by check-locales and manual tests)
  questions: {
    navigation: 'ไปสถานีรถไฟยังไง',
    identity: 'คนนี้เป็นใคร',
    usage: 'เครื่องซักผ้านี้ใช้ยังไง',
    medicine_advice: 'ยานี้สรรพคุณอะไร',
    absence: 'ตรงนี้ไม่มีคนใช่ไหม',
    moving: 'รถเมล์หมายเลขอะไร',
    ok: 'โคล่าอยู่ตรงไหน',
  },
};
