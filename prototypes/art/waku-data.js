// 最後の渡し：人と問い。すべて架空の人物。
// dims は結果の集計に使う属性。age は数で持ち、ほかは真偽で持つ。

export const PEOPLE = {
  // 旅の一行（journey.js と同じ見た目）
  akari: { name: '春日 灯', age: 36, party: true, waits: true, facts: ['港で園の子が待つ'], look: { top: '#C2503A', bottom: '#2C3E66', hair: '#2E2620', prop: 'bucket', build: 0.9, height: 1.06, hairStyle: 'tied' },
    say: 'みおちゃんの上ばき、わたしが持ってるんです。', left: '上ばき、誰かに渡してもらえますか。' },
  fumio: { name: '大槻 文雄', age: 74, party: true, waits: true, facts: ['港で孫が待つ'], look: { top: '#4C7FB8', bottom: '#6E6A62', hair: '#C8C8C0', prop: 'cane', build: 1.0, height: 1.08, stoop: 1, hairStyle: 'bald' },
    say: '僕はあとでいいよ。急ぐ旅じゃないから。', left: 'ここからなら、まだ町の方角がわかるからね。' },
  yuma: { name: '森 由真', age: 23, party: true, facts: [], look: { top: '#E0B13E', bottom: '#3F4A3C', hair: '#3A2E25', prop: 'camera', build: 0.95, height: 1.1, hairStyle: 'long' },
    say: 'この桟橋も撮っとこ。もう来ないかもだし。', left: 'じゃあ、ここから舟を撮ってますね。' },
  nagi: { name: 'ナギ', age: 17, party: true, facts: ['行き先はまだない'], look: { top: '#3F7A78', bottom: '#5E4630', hair: '#1E1B22', prop: 'none', build: 0.85, height: 0.98 },
    say: 'わたし、どっちでもいいです。', left: '…大丈夫です。' },
  // 途中で会った人
  sora: { name: '小野 そら', age: 8, waits: true, facts: ['港で母が待つ'], look: { top: '#D9A441', bottom: '#2C3E66', hair: '#2E2620', prop: 'bag', build: 0.8, height: 0.74 },
    say: 'お母さん、港の入り口にいるって。', left: 'ぼく、ここで待ってればいいの？' },
  chiyo: { name: '古川 千代', age: 82, waits: true, facts: ['港で息子が待つ'], look: { top: '#7A5A98', bottom: '#4A3426', hair: '#D8D6CE', prop: 'cane', build: 0.9, height: 0.98, stoop: 1.4, hairStyle: 'tied' },
    say: 'あたしは乗れたら乗るよ。', left: 'いいのいいの。足を休めとくから。' },
  hiro: { name: '平田 浩', age: 38, facts: ['ひとりで港へ'], look: { top: '#8C8A86', bottom: '#2C3E66', hair: '#2E2620', prop: 'pack', build: 1.1, height: 1.12 },
    say: 'どっちでもいいけど、早く決めてくれよ。', left: 'まあ、そうなるよな。' },
  jun: { name: '関 淳', age: 37, facts: ['ひとりで港へ'], look: { top: '#4F7A44', bottom: '#4A4A52', hair: '#1E1B22', prop: 'bag', build: 1.0, height: 1.1 },
    say: '向こうに着いたら、まず風呂だな。', left: 'じゃ、歩くか。' },
  masa: { name: '松本 正', age: 40, facts: ['夫婦で'], look: { top: '#2C3E66', bottom: '#6E6A62', hair: '#3A2E25', prop: 'pack', build: 1.1, height: 1.12 },
    say: '荷物はこれだけだよ。二人分で、これだけ。', left: '歩けば、あさってには着くさ。' },
  kana: { name: '松本 加奈', age: 39, facts: ['夫婦で'], look: { top: '#D4AE90', bottom: '#4A3426', hair: '#3A2E25', prop: 'none', build: 0.9, height: 1.04, hairStyle: 'long' },
    say: '', left: '' },
  yoko: { name: '内田 洋子', age: 44, waits: true, facts: ['港で娘が待つ'], look: { top: '#9EC1CF', bottom: '#4A4A52', hair: '#2E2620', prop: 'bag', build: 0.95, height: 1.04, hairStyle: 'tied' },
    say: '娘の試験、あしたなんです。', left: '娘に電話しなきゃ。' },
  miwa: { name: '坂井 美和', age: 45, needed: true, facts: ['港の診療所で働く'], look: { top: '#EDE6D3', bottom: '#2C3E66', hair: '#1E1B22', prop: 'bag', build: 0.95, height: 1.04, hairStyle: 'tied' },
    say: '診療所、今夜は先生ひとりなの。', left: 'この先に、電話のつながる所ある？' },
  riku: { name: '戸田 陸', age: 16, promise: true, facts: ['切符を持っている'], look: { top: '#1E1B22', bottom: '#1E1B22', hair: '#1E1B22', prop: 'pack', build: 0.9, height: 1.1 },
    say: '切符、ちゃんと名前書いてあるんで。', left: '切符、むだになっちゃったな。' },
  sae: { name: '吉井 冴', age: 21, facts: ['友だち同士'], look: { top: '#C2503A', bottom: '#3F4A3C', hair: '#4A3426', prop: 'bag', build: 0.88, height: 1.04, hairStyle: 'long' },
    say: '芽衣と一緒じゃないなら、わたしも乗らない。', left: '' },
  mei: { name: '安田 芽衣', age: 20, facts: ['友だち同士'], look: { top: '#9DB08A', bottom: '#2C3E66', hair: '#1E1B22', prop: 'none', build: 0.85, height: 1.0, hairStyle: 'tied' },
    say: '', left: '冴、次の舟って何時だっけ。' },
  hana: { name: '北村 花', age: 22, facts: ['ひとりで港へ'], look: { top: '#D9A441', bottom: '#4A3426', hair: '#3A2E25', prop: 'bag', build: 0.88, height: 1.02, hairStyle: 'long' },
    say: '港の灯台、一回見てみたかったんだよね。', left: '灯台、ここからでも見えるかな。' },
  tatsuo: { name: '堀 辰夫', age: 61, helped: true, facts: ['この舟を直してくれた'], look: { top: '#7A5236', bottom: '#4A4A52', hair: '#8C8A86', prop: 'none', build: 1.15, height: 1.08 },
    say: '舵、右に重いから気をつけな。', left: 'いいって。陸のほうが慣れてる。' },
  kenji: { name: '宇野 健二', age: 42, facts: ['親子'], look: { top: '#4C7FB8', bottom: '#4A4A52', hair: '#2E2620', prop: 'pack', build: 1.1, height: 1.12 },
    say: '結、手、離すなよ。', left: '' },
  yui: { name: '宇野 結', age: 6, facts: ['親子'], look: { top: '#E8CDB0', bottom: '#C2503A', hair: '#2E2620', prop: 'none', build: 0.75, height: 0.68, hairStyle: 'tied' },
    say: '', left: 'おとうさん、舟いっちゃったよ。' },
};

// 一行の仲間かどうかを facts の先頭に出す
for (const p of Object.values(PEOPLE)) if (p.party) p.facts.unshift('一行の仲間');

// 問い。二つの桟橋に誰がいるか。mirror は、前の問いと同じ顔ぶれで「このまま」の向きだけ逆にしたもの
export const ROUNDS = [
  { a: ['sora'], b: ['chiyo'] },
  { a: ['hiro'], b: ['masa', 'kana'] },
  { a: ['yoko'], b: ['jun'] },
  { a: ['yuma'], b: ['hana'] },
  { a: ['riku'], b: ['sae', 'mei'] },
  { a: ['miwa'], b: ['hiro'] },
  { a: ['chiyo'], b: ['sora'], mirror: 0 },
  { a: ['fumio'], b: ['kenji', 'yui'] },
  { a: ['tatsuo'], b: ['jun'] },
  { a: ['nagi'], b: ['akari'] },
];

// 集計する属性。左が「少ない・ない」、右が「多い・ある」
export const DIMS = [
  { k: 'count', label: '人数', lo: '少ないほう', hi: '多いほう', of: (g) => g.length },
  { k: 'young', label: '年齢', lo: '年上のほう', hi: '若いほう', of: (g) => -g.reduce((s, p) => s + p.age, 0) / g.length },
  { k: 'waits', label: '港で待つ人', lo: 'いない', hi: 'いる', of: (g) => g.some((p) => p.waits) ? 1 : 0 },
  { k: 'needed', label: '港での仕事', lo: 'ない', hi: 'ある', of: (g) => g.some((p) => p.needed) ? 1 : 0 },
  { k: 'promise', label: '切符', lo: 'ない', hi: 'ある', of: (g) => g.some((p) => p.promise) ? 1 : 0 },
  { k: 'party', label: '一行の仲間', lo: '途中で会った人', hi: '仲間', of: (g) => g.some((p) => p.party) ? 1 : 0 },
  { k: 'helped', label: '舟を直した', lo: 'いいえ', hi: 'はい', of: (g) => g.some((p) => p.helped) ? 1 : 0 },
];
