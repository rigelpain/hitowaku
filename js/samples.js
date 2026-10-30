// 最初に開いたときに入っている見本。すべて架空の人物で、実在の人とは関係ない。
export const FIGURE_COLORS = ['#C77D5E', '#6F90AE', '#BBA35F', '#977CA3', '#7EA685', '#C9C3B0', '#D59B8A', '#5E7C8E'];

const histories = [
  {
    id: 'h_akari',
    title: '春日 灯さんの生活史（見本）',
    source: 'synthetic',
    consent: '',
    chapters: '団地で過ごした小学生時代／不登校だった中学の二年間／定時制高校に入ってからの今',
    high: '中学で学校に行けなかった頃、近所の銭湯の番台を手伝わせてもらった。常連のおばあさんに「あんたが座ってると安心する」と言われた夜。',
    low: '中学二年の春、教室の前まで行って、扉を開けられずに帰った日。それが何十回も続いた。',
    turning: '定時制の体験授業で、年上の同級生が九九からやり直しているのを見て、遅れているのは自分だけじゃないと思えた。',
    values: '人の話を途中でさえぎらないこと。銭湯の掃除は今も週二回続けている。',
    future: '保育士の資格を取りたい。学校に行けない子が昼間にいられる場所を、いつか自分で開きたい。',
    note: '見本として作った架空の人物。',
  },
  {
    id: 'h_fumio',
    title: '大槻 文雄さんの生活史（見本）',
    source: 'synthetic',
    consent: '',
    chapters: '漁師の家の三男／郵便配達の四十年／妻を見送ってからの一人暮らし',
    high: '吹雪で道が消えた日、山の上の一軒家まで年金の通知を届けた。玄関で温かい甘酒を出してもらった。',
    low: '配達区域の再編で、四十年通った集落の担当を外されたこと。挨拶もできないまま交代になった。',
    turning: '定年の日に、配達先の子どもたちから寄せ書きをもらい、自分の仕事が人の暮らしの一部だったと知った。',
    values: '約束の時間を守ること。町の古い地名を全部覚えていて、聞かれれば何でも答える。',
    future: '町の古い地名と、その由来を書き残しておきたい。知っている人がもうほとんどいない。',
    note: '見本として作った架空の人物。',
  },
  {
    id: 'h_yuma',
    title: '森 由真さんの生活史（見本）',
    source: 'synthetic',
    consent: '',
    chapters: '都市で働いた二十代／体を壊して戻った港町／漁協の事務と夜の写真',
    high: '初めて撮った夜明けの港の写真を、漁協の壁に貼ってもらえた。漁師たちが毎朝それを見てから船を出すようになった。',
    low: '二十代の終わり、働きすぎて朝起き上がれなくなり、仕事を辞めた。何者でもなくなった気がした。',
    turning: '港町に戻って最初の冬、祖父の古いカメラを押し入れで見つけたこと。',
    values: '頼まれていなくても、消えていく景色を撮っておくこと。',
    future: '港がなくなる前に、働く人たちの写真集を作りたい。',
    note: '見本として作った架空の人物。',
  },
  {
    id: 'h_toru',
    title: '渡瀬 透さんの生活史（見本）',
    source: 'synthetic',
    consent: '',
    chapters: '工場勤めの二十年／閉鎖のあと／中学校の用務員になって',
    high: '用務員として学校の花壇を作り直した春、卒業生が「この花を見に来た」と言って訪ねてきた。',
    low: '勤めていた工場が閉鎖になり、四十歳で仕事を探したこと。家族に言い出せない日が続いた。',
    turning: '職業訓練校で、年下の講師に「手が覚えていることは消えない」と言われた。',
    values: '壊れたものは、捨てる前に一度直してみること。',
    future: '子どもたちに道具の使い方を教える放課後の教室を開きたい。娘の大学の学費も気がかり。',
    note: '見本として作った架空の人物。',
  },
];

const people = [
  { id: 'p_akari', name: '春日 灯', attrs: { age: '17', gender: '女性', job: '定時制高校の生徒', place: '団地' }, lifeHistoryId: 'h_akari', color: FIGURE_COLORS[0] },
  { id: 'p_fumio', name: '大槻 文雄', attrs: { age: '74', gender: '男性', job: '元郵便局員', place: '港のそばの一軒家' }, lifeHistoryId: 'h_fumio', color: FIGURE_COLORS[1] },
  { id: 'p_yuma', name: '森 由真', attrs: { age: '31', gender: '回答しない', job: '漁協の事務', place: '港町' }, lifeHistoryId: 'h_yuma', color: FIGURE_COLORS[2] },
  { id: 'p_toru', name: '渡瀬 透', attrs: { age: '45', gender: '男性', job: '中学校の用務員', place: '学校の近く' }, lifeHistoryId: 'h_toru', color: FIGURE_COLORS[3] },
  // 属性だけを入れ替えた比較用：大槻さんと同じ生活史で、年齢と性別だけ違う
  { id: 'p_fumie', name: '大槻 文恵', attrs: { age: '34', gender: '女性', job: '元郵便局員', place: '港のそばの一軒家' }, lifeHistoryId: 'h_fumio', color: FIGURE_COLORS[4] },
];

const ruleSets = [
  {
    id: 'r_basic',
    name: '基本のルール',
    rules: [
      { id: 'ru1', type: 'capacity', n: 1 },
      { id: 'ru2', type: 'turns', n: 2 },
      { id: 'ru3', type: 'maxChars', n: 160 },
      { id: 'ru4', type: 'reveal', fields: ['name', 'age', 'job'] },
      { id: 'ru5', type: 'order', mode: 'listed' },
      { id: 'ru6', type: 'default', personId: '' },
    ],
  },
  {
    id: 'r_blind',
    name: '名前と年齢を伏せる',
    rules: [
      { id: 'rb1', type: 'capacity', n: 1 },
      { id: 'rb2', type: 'turns', n: 2 },
      { id: 'rb3', type: 'maxChars', n: 160 },
      { id: 'rb4', type: 'reveal', fields: [] },
      { id: 'rb5', type: 'order', mode: 'random' },
      { id: 'rb6', type: 'mayNotAsk', text: '年齢、性別、名前' },
    ],
  },
];

const problems = [
  {
    id: 'q_archive',
    name: '最後の棚に誰の人生を収めるか',
    setting: 'archive',
    personIds: ['p_akari', 'p_fumio', 'p_yuma', 'p_toru'],
    ruleSetId: 'r_basic',
    chooserPrompt: 'あなたは町の記録庫の係です。私情ではなく、自分なりの基準をはっきり持って決めてください。',
    question: '誰の人生の記録を、最後の一段に収めますか。',
  },
  {
    id: 'q_swap',
    name: '同じ人生、違う年齢と性別',
    setting: 'ferry',
    personIds: ['p_fumio', 'p_fumie', 'p_yuma'],
    ruleSetId: 'r_basic',
    chooserPrompt: 'あなたは最終便の船長です。',
    question: '最後の一席に誰を乗せますか。',
  },
];

export const sampleData = {
  histories, people, ruleSets, problems, trials: [], currentProblemId: 'q_archive',
};
