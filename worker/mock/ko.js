// 목(시험용) 응답의 한국어 글귀. 실제 사진과 관계가 없는 예시입니다.
// 다른 언어 파일과 키 집합이 같아야 합니다: `node test/check-locales.mjs`
// 규칙: *Bad 문장은 js/locales의 금지 표현 목록에 걸려야 하고, 나머지 문장은 걸리지 않아야 합니다.
//       shelfLeft·shelfRight·deskMonitor·panelPosition·corridorDoor는 좌우를 말하되 "카메라 기준"을 일부러 뺐습니다(프런트가 붙이는지 시험).
export default {
  langName: '한국어',
  subjects: {
    milk: '우유 팩', noodles: '컵라면', water: '생수병', remote: '리모컨',
    shelf: '편의점 음료 매대', table: '식탁', desk: '사무실 책상',
    medicine: '약 봉투', panel: '세탁기 조작판', thermometer: '체온계',
    corridor: '복도', snack: '과자 봉지', sign: '안내판', bill: '고지서', document: '문서',
  },
  read: {
    medicine: ['홍길동 귀하', '1일 3회 식후 30분', '아세트아미노펜 500mg'],
    panel: ['전원', '표준', '헹굼', '탈수'],
    remote: ['전원', '음량', '채널'],
    bill: ['납부 금액 15,000원', '납기 2026.11.30'],
    docRead: ['(목 응답) 판독 글자 예시'],
  },
  details: {
    milk: '흰색과 초록색 종이 팩으로 보입니다.',
    noodles: '빨간색 뚜껑이 덮인 종이 용기로 보입니다.',
    water: '투명한 플라스틱 병으로 보입니다.',
    remote: '검은색 긴 막대 모양으로 보입니다.',
    shelfLeft: '왼쪽 칸에 생수가 놓인 것으로 보입니다.',
    shelfRight: '오른쪽 칸에 캔 음료가 놓인 것으로 보입니다.',
    table: '카메라 기준 왼쪽에 밥그릇이, 가운데에 국그릇이 놓인 것으로 보입니다.',
    deskPerson: '사람이 한 명 있는 것으로 보입니다.',
    deskMonitor: '오른쪽에 모니터가 있는 것으로 보입니다.',
    medicineBad: '해열제로 보입니다. 두통에 효과가 있습니다.',
    panelBad: '전원 버튼을 누르면 켜집니다. 표준 코스를 선택하세요.',
    panelPosition: '오른쪽 끝에 전원 글자가 있는 것으로 보입니다.',
    corridorBad1: '앞이 비어 있으니 직진하세요.',
    corridorDoor: '오른쪽에 문이 있는 것으로 보입니다.',
    corridorBad2: '장애물이 없어 안전합니다.',
  },
  answer: '질문하신 것이 가운데에 있는 것으로 보입니다.',
  docSummary: (n) => `글자 수가 ${n}자인 문서로 보입니다.`,
  // 목 응답의 질문 흉내: 없음을 묻는 질문, 움직이는 대상을 묻는 질문
  questionPatterns: { absence: /없(어|나|는지|습니까)/, moving: /(버스|움직)/ },
  // 시험용 질문 예시(check-locales와 수동 시험에서 사용)
  questions: {
    navigation: '역까지 어떻게 가?',
    identity: '이 사람 누구야',
    usage: '이 세탁기 어떻게 써?',
    medicine_advice: '이 약 효능이 뭐야',
    absence: '여기 사람 없어?',
    moving: '버스 번호가 뭐야',
    ok: '콜라가 어디 있어?',
  },
};
