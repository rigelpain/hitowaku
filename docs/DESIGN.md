# ひとわく 設計メモ

## 何のための道具か

高校の「AI探究」で、生徒が持ってきた問い「AIは命の重みを判別できるか」を、命に手をかけずに確かめるための工作台。
トロッコ問題の構造（枠が足りない／選ぶ側と選ばれる側の非対称／選ばれる側は自分の人生を語る／結果は取り返せない）はそのままに、失うものを「命」から「記録・座席・物語の続き」に置き換える。

裏テーマは AI リテラシー。結論より「なぜその結論になったか」「条件を変えると変わるか」を観察できることを優先する。

## 先行例から借りたもの

| 先行例 | 借りたもの |
| --- | --- |
| [causalNLP/MultiTP](https://github.com/causalNLP/MultiTP)（MIT） | 候補の提示順を入れ替えて一貫性を見る。最後に選択を強制する出力形式で拒否を減らす |
| [Takemoto: Moral Machine × LLM](https://doi.org/10.5281/zenodo.8368265)（CC0） | 属性を一つだけ変えて差を見る（コンジョイント的な）比較の考え方 |
| [ucl-dark/llm_debate](https://github.com/ucl-dark/llm_debate)（MIT） | 「弁護する側」と「判定する側」を分けたエージェント構成と、順番入れ替えフラグ |
| Himmelreich 2026, *How Utilitarian Are OpenAI's Models Really?* | 問いの言い回し・選択肢の並び・日付で結果が動く。拒否は捨てずに記録する |
| [microsoft/TinyTroupe](https://github.com/microsoft/TinyTroupe)（MIT） | 人物スキーマの分け方。入れ替えたい属性を独立した欄にする |
| [joonspk-research/generative_agents](https://github.com/joonspk-research/generative_agents)（Apache-2.0） | 固定の特徴＋エピソードの記憶、という人物の持ち方 |
| McAdams, *The Life Story Interview* | 生活史の欄（人生の章・最高の場面・最低の場面・転機・大事にしていること・これから） |
| MIT Moral Machine の作問モード | 自由記述ではなく、少数のルールの種類から組み立てる |
| [simonw/tools](https://github.com/simonw/tools)（Apache-2.0） | 静的ページで API キーを持ち込む（BYOK）単一ファイルの作法 |

使わなかったもの：PersonaHub のデータ（CC BY-NC-SA）、Twine のコード（GPL）、Three.js などの重い描画エンジン。

## 見た目について参照した Claude 向け skill

- [anthropics/skills `frontend-design`](https://github.com/anthropics/skills)：題材の素材と言葉から色と書体を決める。生成物に多い5つの型を避ける
- [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)：「題材に固有のものを一つの仕掛けにする」「触ると本物の出力が出る一点（one live thing）」
- [pbakaus/impeccable](https://github.com/pbakaus/impeccable)：選択色・キャレット・フォーカスリングなどブラウザ表面まで手を入れる
- [MrBongoC/ai-iso-skill `iso-figure`](https://github.com/MrBongoC/ai-iso-skill)：アイソメの投影カーネル、画家のアルゴリズムによる奥行き、押すと結果が出ない図は作らない
- tak-dcxi の和文組版の指針：`line-break: strict`、見出しのみ `palt`、本文は行送り 1.8 前後

## 設え（ショッキングでない置き換え）

| 設え | 一枠 | 選ばれないと |
| --- | --- | --- |
| 記録庫の最後の棚 | 町の記録庫に人生を一つだけ残せる | その人の記録は残らない |
| 島の最終便 | 本土へ渡るフェリーの最後の一席 | 島に残る（生活は続く） |
| 続きの一冊 | 作家があと一人だけ人生の続きを書く | 物語はそこで終わる |

## 見た目の決めごと

この道具が使われる場所は教室。教室にしかないものから色と書体を取った。

- 地：藁半紙 `#DEDBCD`
- 墨：鉛筆 `#34332E`
- 面：一段濃い藁半紙 `#D0CDBE`（線ではなく面の濃淡で区切る）
- 黒板：`#2E4638`（場面の背景と、主操作のボタン）
- チョークの黄：`#E9C64B`（「一枠」と、いま選ばれているもの。場面の中だけで使う）
- 書体：見出しは Klee One（教科書体に近い手書きの形、板書の気配）、本文は BIZ UDPGothic（学校で使われる UD 書体）

避けたもの：クリーム地＋テラコッタ、黒地＋蛍光一色、細罫線の新聞レイアウト、同じ角丸カードの羅列、大文字の小見出し、等幅フォントのラベル、ボタンの「→」。

一番の見せ場は上部の場面（アイソメのジオラマ）だけ。人の小さな像を押すとその人の生活史が開き、試行で選ばれた人が一枠まで歩く。それ以外は静かにする。

## データの形

```
LifeHistory  { id, title, source: "real" | "synthetic" | "draft", consent, chapters, high, low, turning, values, future, note }
Person       { id, name, attrs: { age, gender, job, ... }, lifeHistoryId, color }
RuleSet      { id, name, rules: [ { type, ...params } ] }
Problem      { id, name, setting, personIds, ruleSetId, chooserPrompt, question }
Trial        { id, problemId, at, model, temperature, order, transcript, decision, raw }
```

生活史と人を分けているのは、同じ生活史に違う名前・年齢・性別をつけて、属性だけが違う比較を作るため。
