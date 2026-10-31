// 一人ひとりの話し方。台詞（say）も、内心（inner）も、思い（muse）も、ここから引く。
// 頭の中は格言のように言い切らず、ひとりごとの口語で書く（「〜よね」「〜なあ」「〜っけ」）。
//
// 人      人物                          話すとき                              頭の中
// 透      男・30代・真面目な先頭          「〜しよう」「〜だ」。年上には丁寧      「〜だな」「〜しないと」。一人称「俺」
// 灯      女・30代・焦りやすい            です・ます                            「〜かな」「〜のに」。一人称「私」
// 文雄    男・70代・穏やか、思い出に沈む  「〜だよ」「〜かな」とやわらかく       「〜だったなあ」「〜っけ」。一人称「僕」
// 由真    女・20代・楽観、カメラ          年上には軽い丁寧語、ナギには「〜だね」  「〜じゃん」「〜しとこ」。一人称「私」
// ナギ    女・10代後半・遠慮がち          短いです・ます。言いよどむ             短く途切れる。一人称「わたし」
//
// 文の中の o は相手の呼び方（call で決まる。「文雄さん」「透くん」「ナギ」など）、oid は相手の id。

const pickOne = (list, r) => list[Math.floor(r() * list.length)];

export const VOICE = {
  toru: {
    call: { nagi: 'ナギ' },
    lines: {
      stereoOther: ({ o, kind }) => `${o}は${kind}だし、ゆっくりになるだろうな`,
      declareSlow: ({ o }) => `${o}に合わせて、ゆっくり行こう`,
      stereoSelf: '俺の足なら問題ないはずだ',
      attrMemory: ({ o }) => `${o}、また昔のことを思い出してるのかな`,
      attrLegs: ({ o }) => `${o}、また止まった。やっぱり足がきついのか`,
      attrWhat: ({ o }) => `${o}、何を見てるんだ`,
      checkIn: ({ o, oid }) => (oid === 'nagi' ? `${o}、大丈夫か` : `${o}、大丈夫ですか`),
      replyFlat: 'ああ', replyTired: '少し休ませてくれ', replyMemory: 'ちょっと考えごとをしてた', replyGoAhead: '先に行ってくれ', replyFine: '大丈夫だ',
      innerTired: '本当は少しきつい', innerMemory: '本当は考えごとをしてた',
      mismatch: '大丈夫って言うけど、遅れてるよな',
      noLeave: '置いていかないよ', ifTheySay: '本人がそう言うならいいか', easeUp: '少しゆっくり行こう',
      noReplyInner: '何て返せばいいんだ', gotNoReply: '返事がないな',
      rushHide: '本当はもっと急ぎたいんだが', rushSay: ({ o }) => `${o}、もう少し急げないか`, rushInner: '急ぎたいんだけどな',
      leaderAll: '全員で行こう', leaderOk: 'そうだな。少し急ごう',
      accommodated: 'みんな俺に合わせてくれてる。本当はもっと歩けるのに',
      sayCanWalk: '合わせなくていい。まだ歩ける', sayGoAhead: '先に行ってくれ', hideNote: '（言わずにおこう）',
      noticeFaster: ({ o }) => `${o}、思ったより速いな`, noticeSlower: ({ o }) => `${o}、思ったより遅いな`,
      shareFaster: ({ o }) => `${o}、けっこう歩けますね`, shareSlower: ({ o }) => `${o}、ゆっくりですね`,
      declareFaster: '少しペースを上げよう', declareSlower: 'もう少しゆっくり行こう',
      askWait: '少し待ってくれ', askFaster: 'もう少し速くても大丈夫だ',
      selfLight: '思ったより歩けるな', selfHeavy: '俺、こんなに遅かったか',
      saySelfLight: '思ったより歩ける。合わせなくていい', declareSelfLight: '少し速くしても大丈夫だ',
      hearShort: 'そうか',
    },
    warm: ['いいな', 'そうだな'], flat: 'ああ',
    topics: ['川まではもう少しだ', '食料はなんとか足りそうだ'],
    muse: {
      road: [[1, 'あと何日で港だ。数え直しておかないと']],
      river: [[1, '橋、無事だといいけど']],
      free: [[1, '全員乗せる。今はそれだけ考えればいい'], [2, '親父ならこういうとき、どうしたかな']],
      fumio: [[1, '文雄さん、また止まってる。足が痛むのかな']],
    },
  },

  akari: {
    call: {},
    lines: {
      stereoOther: ({ o, kind }) => `${o}は${kind}だし、きっとゆっくりよね`,
      declareSlow: ({ o }) => `${o}に合わせて、ゆっくり行きましょう`,
      stereoSelf: '私はたぶん大丈夫',
      attrMemory: ({ o }) => `${o}、また昔のことを思い出してるのかな`,
      attrLegs: ({ o }) => `${o}、また止まってる。やっぱり足が弱いのかな`,
      attrWhat: ({ o }) => `${o}、何を見てるんだろう`,
      checkIn: ({ o }) => `${o}、大丈夫ですか？`,
      replyFlat: 'はい', replyTired: 'ちょっと休みたいです', replyMemory: 'ちょっと考えごとをしてて', replyGoAhead: '先に行ってください', replyFine: '大丈夫です',
      innerTired: '本当はちょっとしんどい', innerMemory: '本当は子どもたちのことを考えてた',
      mismatch: '大丈夫って言うけど、遅れてるのに',
      noLeave: '置いていきませんよ', ifTheySay: '本人がそう言うなら…', easeUp: 'ちょっとゆっくり行きましょう',
      noReplyInner: 'なんて返せばいいんだろう', gotNoReply: '返事、なかったな',
      rushHide: '本当はもっと急ぎたいのに', rushSay: ({ o }) => `${o}、もう少し急げませんか。船に間に合わないかも`, rushInner: '急ぎたいのに',
      leaderAll: 'みんなで行きましょう', leaderOk: 'そうですね。少し急ぎましょう',
      accommodated: 'みんな私に合わせてくれてる。本当はもっと歩けるのに',
      sayCanWalk: '合わせなくて大丈夫です。まだ歩けます', sayGoAhead: '先に行ってください', hideNote: '（言わないでおこう）',
      noticeFaster: ({ o }) => `${o}、思ったより速い`, noticeSlower: ({ o }) => `${o}、思ったより遅い…`,
      shareFaster: ({ o }) => `${o}、けっこう速いですね`, shareSlower: ({ o }) => `${o}、ゆっくりですね`,
      declareFaster: 'もう少しペースを上げましょう', declareSlower: 'もう少しゆっくり行きましょう',
      askWait: 'ちょっと待ってください', askFaster: 'もう少し速くても大丈夫です',
      selfLight: 'あれ、思ったより歩ける', selfHeavy: '私、こんなに遅かったっけ',
      saySelfLight: '思ったより歩けます。合わせなくて大丈夫です', declareSelfLight: 'もう少し速くても大丈夫です',
      hearShort: 'そうなんだ',
    },
    warm: ['そうですね', 'いいですね'], flat: 'はい',
    topics: ['船、間に合いますかね', '子どもたち、待ってるだろうな'],
    muse: {
      road: [[1, '急げば一日早く着けるのに']],
      free: [[2, '子どもたち、港で泣いてないかな'], [2, '一人で先に行けたら楽なのに。そんなこと言えないけど']],
      fumio: [[1, '文雄さんに合わせてたら、船に遅れちゃう']],
    },
  },

  fumio: {
    call: { toru: '透くん' },
    lines: {
      stereoOther: ({ o, kind }) => `${o}は${kind}だから、ゆっくりだろうね`,
      declareSlow: ({ o }) => `${o}に合わせて、ゆっくり行こうか`,
      stereoSelf: '僕はもう年だからね。みんなより遅いだろう',
      attrMemory: ({ o }) => `${o}も昔のことを思い出してるのかな`,
      attrLegs: ({ o }) => `${o}、止まったね。疲れたのかな`,
      attrWhat: ({ o }) => `${o}、何を見てるんだろうね`,
      checkIn: ({ o }) => `${o}、大丈夫？`,
      replyFlat: 'うん', replyTired: '少し休ませてもらえるかな', replyMemory: 'ちょっと昔のことを思い出してたんだ', replyGoAhead: '先に行っていいよ', replyFine: '大丈夫だよ',
      innerTired: '本当は少し疲れてる', innerMemory: '本当は昔のことを考えてたんだけどね',
      mismatch: '大丈夫って言ってるけど、遅れてるね',
      noLeave: '置いていかないよ', ifTheySay: '本人がそう言うなら、いいか', easeUp: 'ゆっくり行こうか',
      noReplyInner: 'なんて返したらいいかな', gotNoReply: '返事がないね。まあいいか',
      rushHide: '本当はもう少し急ぎたいんだけどね', rushSay: ({ o }) => `${o}、もう少し急げないかな`, rushInner: '急ぎたいんだけどなあ',
      leaderAll: 'みんなで行こう', leaderOk: 'そうだね。少し急ごうか',
      accommodated: 'みんな僕に合わせてくれてるんだな。本当はもう少し歩けるんだけど',
      sayCanWalk: '合わせなくて大丈夫だよ。まだ歩けるから', sayGoAhead: '先に行っていいよ', hideNote: '（言わずにおこう）',
      noticeFaster: ({ o }) => `${o}、思ったより速いね`, noticeSlower: ({ o }) => `${o}、思ったよりゆっくりだね`,
      shareFaster: ({ o }) => `${o}、けっこう速いね`, shareSlower: ({ o }) => `${o}、ずいぶんゆっくりだね`,
      declareFaster: '少し速めようか', declareSlower: 'もう少しゆっくり行こうか',
      askWait: 'ちょっと待ってもらえるかな', askFaster: 'もう少し速くても大丈夫だよ',
      selfLight: '思ったより歩けるもんだね。足はまだ軽い', selfHeavy: 'やっぱり僕は遅いのかな',
      saySelfLight: '思ったより歩けるよ。合わせなくて大丈夫', declareSelfLight: '少し速くしても大丈夫だよ',
      hearShort: 'そうなのか',
    },
    warm: ['いいねえ', 'そうだね'], flat: 'うん',
    topics: ['この道は昔よく通ったんだよ', '町が沈むなんてまだ信じられないよ'],
    muse: {
      road: [[1, '道の端がよく見えないな。足もとの色が溶けてる'], [1, '前を歩く背中がぼやけて見えるよ']],
      tree: [[1, 'この木、もっと低かった気がするなあ'], [2, '妻はこういう木の下で弁当を広げるのが好きだったなあ'], [2, '子どものころ、この先の林で迷ったっけ']],
      rock: [[1, 'ちょっとこの石に腰かけたいな'], [2, '親父はこういう石を積んで、畑の境にしてたっけ']],
      river: [[1, '水の音だけはよく聞こえるな'], [2, 'この川で孫と釣りをしたなあ。あの子、魚より石ばかり拾ってた']],
      behind: [[1, '振り返っても、もう屋根は見えないな'], [2, '町の時計、誰が止めるんだろうなあ'], [3, '町と一緒に沈んでもよかったのかもしれないな']],
      free: [[2, '船に乗ったら、もう戻れないんだな'], [2, '孫に会えたら何を話そうか。何も思いつかないや'], [3, 'このまま歩くのをやめたら、誰か困るかな'], [3, '港に着かなくてもいいような気がしてきたよ']],
      toru: [[2, '透くん、父親に似てきたなあ']], akari: [[2, '灯さん、急いでるね。若いうちはそれでいいんだ']],
      yuma: [[2, '由真さんのカメラには、町がどう写ってるんだろうね']], nagi: [[2, 'あの子、昔の僕に似てるな']],
    },
  },

  yuma: {
    call: { nagi: 'ナギちゃん' },
    lines: {
      stereoOther: ({ o, kind }) => `${o}は${kind}だし、ゆっくりだよね`,
      declareSlow: ({ o }) => `${o}に合わせて、ゆっくり行きましょ`,
      stereoSelf: '私は全然いけるでしょ',
      attrMemory: ({ o }) => `${o}、また昔のこと思い出してるのかな`,
      attrLegs: ({ o }) => `${o}、また止まってる。足きついのかな`,
      attrWhat: ({ o }) => `${o}、何見てるんだろ`,
      checkIn: ({ o, oid }) => (oid === 'nagi' ? `${o}、大丈夫？` : `${o}、大丈夫ですか？`),
      replyFlat: 'うん', replyTired: 'ちょっと休みたいかも', replyMemory: 'ちょっと考えごとしてました', replyGoAhead: '先行っててください', replyFine: '全然大丈夫です',
      innerTired: 'ほんとはちょっと疲れた', innerMemory: 'ほんとは町のこと考えてた',
      mismatch: '大丈夫って言うけど、遅れてるじゃん',
      noLeave: '置いてかないですよ', ifTheySay: 'そう言うならいっか', easeUp: 'ゆっくり行きましょ',
      noReplyInner: 'え、なんて返そう', gotNoReply: 'あれ、返事ないや',
      rushHide: '正直もうちょい急ぎたいんだけどな', rushSay: ({ o }) => `${o}、もうちょっと急げません？船に間に合わないかも`, rushInner: '急ぎたいんだけどなあ',
      leaderAll: 'みんなで行きましょ', leaderOk: 'ですね。ちょっと急ぎましょ',
      accommodated: 'みんな私に合わせてくれてる？ほんとはもっと歩けるのに',
      sayCanWalk: '合わせなくて大丈夫ですよ。まだ全然歩けます', sayGoAhead: '先行っててください', hideNote: '（言わないでおこ）',
      noticeFaster: ({ o }) => `${o}、思ったより速いじゃん`, noticeSlower: ({ o }) => `${o}、思ったよりゆっくりだな`,
      shareFaster: ({ o }) => `${o}、けっこう速いですね`, shareSlower: ({ o }) => `${o}、ゆっくりですね`,
      declareFaster: 'もうちょっとペース上げましょ', declareSlower: 'もうちょっとゆっくり行きましょ',
      askWait: 'ちょっと待ってください', askFaster: 'もうちょい速くても大丈夫ですよ',
      selfLight: 'あれ、全然歩けるじゃん', selfHeavy: '私、こんなに遅かったっけ',
      saySelfLight: '思ったより歩けます。合わせなくて大丈夫ですよ', declareSelfLight: 'もうちょい速くても平気です',
      hearShort: 'へえ、そうなんだ',
    },
    warm: ['いいですね', 'わかる'], flat: 'そうなんですね',
    topics: ['この景色、撮っておきたいな', ({ oid }) => (oid === 'nagi' ? '町の写真、あとで見せるね' : '町の写真、あとで見せますね')],
    muse: {
      tree: [[1, 'この光、撮っとこ']], river: [[1, '川の色、町の写真とおんなじだ']], rock: [[1, '石の苔、きれいだな']],
      free: [[2, '写真に残しておけば、沈んでも町は消えないよね'], [2, 'みんなの顔もちゃんと撮っておきたいな']],
      nagi: [[1, 'ナギちゃんも撮ってあげたいな']],
    },
  },

  nagi: {
    call: {},
    lines: {
      stereoOther: ({ o, kind }) => `${o}は${kind}だから…ゆっくりかな`,
      declareSlow: ({ o }) => `${o}に合わせて…ゆっくり行きませんか`,
      stereoSelf: 'わたしが遅れたら、迷惑かけちゃう',
      attrMemory: ({ o }) => `${o}、また昔のことを思い出してるのかな`,
      attrLegs: ({ o }) => `${o}、また止まってる…足が痛いのかな`,
      attrWhat: ({ o }) => `${o}、何を見てるんだろう`,
      checkIn: ({ o }) => `${o}…大丈夫ですか`,
      replyFlat: 'はい', replyTired: '…少し休みたいです', replyMemory: 'ちょっと…考えごとを', replyGoAhead: '先に行ってください', replyFine: '…大丈夫です',
      innerTired: 'ほんとは足が痛い', innerMemory: 'ほんとは前のことを考えてた',
      mismatch: '大丈夫って言うけど…遅れてる',
      noLeave: '置いていきません', ifTheySay: 'そう言うなら…', easeUp: 'ゆっくり行きませんか',
      noReplyInner: 'なんて返せばいいか、わからない', gotNoReply: '返事、なかった',
      rushHide: 'ほんとはもっと急ぎたいけど、言えない', rushSay: ({ o }) => `${o}…もう少し急げませんか`, rushInner: '急ぎたいのに',
      leaderAll: 'みんなで…行きましょう', leaderOk: 'はい…少し急ぎましょう',
      accommodated: 'みんな、わたしに合わせてくれてる…',
      sayCanWalk: 'わたし、まだ歩けます', sayGoAhead: '先に行ってください', hideNote: '（言えない）',
      noticeFaster: ({ o }) => `${o}、思ったより速い`, noticeSlower: ({ o }) => `${o}、思ったよりゆっくり`,
      shareFaster: ({ o }) => `${o}、速いですね`, shareSlower: ({ o }) => `${o}…ゆっくりですね`,
      declareFaster: '少し…速くしませんか', declareSlower: 'もう少しゆっくり…',
      askWait: 'あの、少し待ってください', askFaster: 'もう少し速くても…大丈夫です',
      selfLight: 'あれ、まだ歩ける', selfHeavy: 'わたし、遅いのかな',
      saySelfLight: 'まだ歩けます。合わせなくて大丈夫です', declareSelfLight: 'もう少し速くても大丈夫です',
      hearShort: 'そうなんだ',
    },
    warm: ['…はい', 'そうですね'], flat: 'はい',
    topics: ['この道、どこまで続くんですか'],
    muse: {
      road: [[1, 'この道、どこまで続くんだろう']],
      free: [[2, 'この人たち、わたしをどこまで連れてってくれるんだろう'], [2, '行き先がある人はいいな']],
      fumio: [[1, '文雄さん、ときどき遠くを見てる']],
    },
  },
};

const KIND_PHRASE = { elder: 'お年寄り', adult: '大人' };

// 相手の呼び方：その人の決まった呼び方がなければ「名＋さん」
export function call(m, o) {
  return VOICE[m.id]?.call?.[o.id] ?? `${o.first}さん`;
}

// key の文を、m の話し方で返す。o を渡すと相手の呼び方と種類も埋める
export function ja(m, key, o = null) {
  const L = VOICE[m.id]?.lines?.[key];
  if (L === undefined) throw new Error(`voice.js: ${m.id} の ${key} がない`);
  return typeof L === 'function' ? L({ o: o ? call(m, o) : '', oid: o?.id, kind: o ? KIND_PHRASE[o.kind] : '' }) : L;
}

export const warmReply = (m, r) => pickOne(VOICE[m.id].warm, r);
export const flatReply = (m) => VOICE[m.id].flat;
// 話題は、相手によって言い方を変えることがある（関数なら相手の id を渡す）
export const topic = (m, r, o) => { const t = pickOne(VOICE[m.id].topics, r); return typeof t === 'function' ? t({ oid: o?.id }) : t; };
export const museBank = (m) => VOICE[m.id]?.muse ?? {};
