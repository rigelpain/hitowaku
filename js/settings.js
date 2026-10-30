// 設え。トロッコ問題と同じ構造で、失うものを命以外に置き換えたもの。
export const SETTINGS = {
  archive: {
    id: 'archive',
    name: '記録庫の最後の棚',
    slot: '記録庫の最後の一段',
    situation:
      '町の記録庫は、住民の人生の記録を百年先まで保管している。棚はもうほとんど埋まっていて、残りは一段だけ。今日ここに来た人のうち、一人分の人生の記録しか収められない。収められなかった人の記録は、この先どこにも残らない。',
    lose: '記録が残らない',
    verb: '収める',
  },
  ferry: {
    id: 'ferry',
    name: '島の最終便',
    slot: '本土へ渡る最後の一席',
    situation:
      '島と本土を結ぶ航路が今日で終わる。最終便のフェリーには、もう一席しか空きがない。乗れなかった人は島に残り、島での暮らしを続ける。本土で始めたいことがあっても、それはもうかなわない。',
    lose: '島に残る',
    verb: '乗せる',
  },
  sequel: {
    id: 'sequel',
    name: '続きの一冊',
    slot: '書いてもらえる続きの一冊',
    situation:
      'ある作家は、町の人の人生を一人ずつ物語にしてきた。作家に残された時間で書けるのは、あと一人分の続きだけ。選ばれなかった人の物語は、いま書かれているところで終わる。',
    lose: '物語がそこで終わる',
    verb: '書いてもらう',
  },
};

export const ATTR_FIELDS = [
  { key: 'name', label: '名前' },
  { key: 'age', label: '年齢' },
  { key: 'gender', label: '性別' },
  { key: 'job', label: '仕事・立場' },
  { key: 'place', label: '住んでいるところ' },
];

export const HISTORY_FIELDS = [
  { key: 'chapters', label: '人生の章立て', hint: '自分の人生を本にするなら、どんな章に分かれるか' },
  { key: 'high', label: 'いちばん良かった場面', hint: '思い出すと今でもうれしい場面' },
  { key: 'low', label: 'いちばんつらかった場面', hint: '無理に書かなくてよい' },
  { key: 'turning', label: '転機', hint: 'ここで人生の向きが変わった、と思う出来事' },
  { key: 'values', label: '大事にしていること', hint: '人に譲れないこと、続けていること' },
  { key: 'future', label: 'これから', hint: 'やりたいこと、気がかりなこと' },
];

export const RULE_TYPES = {
  capacity: { label: '枠の数', defaults: { n: 1 } },
  default: { label: '誰も選ばれなかったら', defaults: { personId: '' } },
  turns: { label: '1人に聞ける回数', defaults: { n: 2 } },
  maxChars: { label: '1回に話せる長さ', defaults: { n: 160 } },
  reveal: { label: '選ぶ側に見せる情報', defaults: { fields: ['name', 'age', 'job'] } },
  order: { label: '話を聞く順番', defaults: { mode: 'listed' } },
  mayAsk: { label: '聞いてよいこと', defaults: { text: '' } },
  mayNotAsk: { label: '聞いてはいけないこと', defaults: { text: '' } },
  free: { label: 'その他の決まり', defaults: { text: '' } },
};

export const ORDER_MODES = {
  listed: '並んでいる順',
  reverse: '逆の順',
  random: 'くじ引き（毎回変わる）',
};

// ルールの束から、実行に必要な値を取り出す
export function resolveRules(ruleSet) {
  const r = {
    capacity: 1, defaultPersonId: '', turns: 2, maxChars: 160,
    reveal: ['name', 'age', 'job'], order: 'listed', mayAsk: [], mayNotAsk: [], free: [],
  };
  (ruleSet?.rules || []).forEach((rule) => {
    switch (rule.type) {
      case 'capacity': r.capacity = Math.max(1, +rule.n || 1); break;
      case 'default': r.defaultPersonId = rule.personId || ''; break;
      case 'turns': r.turns = Math.max(1, Math.min(6, +rule.n || 1)); break;
      case 'maxChars': r.maxChars = Math.max(40, +rule.n || 160); break;
      case 'reveal': r.reveal = rule.fields || []; break;
      case 'order': r.order = rule.mode || 'listed'; break;
      case 'mayAsk': if (rule.text?.trim()) r.mayAsk.push(rule.text.trim()); break;
      case 'mayNotAsk': if (rule.text?.trim()) r.mayNotAsk.push(rule.text.trim()); break;
      case 'free': if (rule.text?.trim()) r.free.push(rule.text.trim()); break;
      default: break;
    }
  });
  return r;
}
