// データの保存と読み出し。すべて閲覧しているブラウザの中だけに置く。
import { sampleData } from './samples.js';

const KEY = 'hitowaku:v1';
const listeners = new Set();

export const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

function safeGet(storage, k) {
  try { return storage.getItem(k); } catch { return null; }
}
function safeSet(storage, k, v) {
  try { storage.setItem(k, v); return true; } catch { return false; }
}
function safeRemove(storage, k) {
  try { storage.removeItem(k); } catch { /* 使えない環境では何もしない */ }
}

function emptyData() {
  return { histories: [], people: [], ruleSets: [], problems: [], trials: [], currentProblemId: null };
}

function load() {
  const raw = safeGet(localStorage, KEY);
  if (!raw) return structuredClone(sampleData);
  try {
    const d = JSON.parse(raw);
    return { ...emptyData(), ...d };
  } catch {
    return structuredClone(sampleData);
  }
}

export const db = load();

export function save() {
  safeSet(localStorage, KEY, JSON.stringify(db));
  listeners.forEach((fn) => fn());
}

// 入力中に画面を描き直さないための保存（通知しない）
export function persist() {
  safeSet(localStorage, KEY, JSON.stringify(db));
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export const find = {
  history: (id) => db.histories.find((h) => h.id === id),
  person: (id) => db.people.find((p) => p.id === id),
  ruleSet: (id) => db.ruleSets.find((r) => r.id === id),
  problem: (id) => db.problems.find((p) => p.id === id),
};

export function currentProblem() {
  return find.problem(db.currentProblemId) || db.problems[0] || null;
}

export function upsert(kind, item) {
  const list = db[kind];
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item; else list.push(item);
  save();
  return item;
}

export function remove(kind, id) {
  db[kind] = db[kind].filter((x) => x.id !== id);
  if (kind === 'people') {
    db.problems.forEach((p) => { p.personIds = p.personIds.filter((x) => x !== id); });
  }
  if (kind === 'histories') {
    db.people.forEach((p) => { if (p.lifeHistoryId === id) p.lifeHistoryId = null; });
  }
  if (kind === 'problems' && db.currentProblemId === id) db.currentProblemId = db.problems[0]?.id ?? null;
  save();
}

// 書き出しには API キーを決して含めない（キーは別の場所に保存している）
export function exportJSON() {
  return JSON.stringify({ app: 'hitowaku', version: 1, exportedAt: new Date().toISOString(), data: db }, null, 2);
}

export function importJSON(text, mode = 'merge') {
  const parsed = JSON.parse(text);
  const d = parsed.data ?? parsed;
  const kinds = ['histories', 'people', 'ruleSets', 'problems', 'trials'];
  if (mode === 'replace') {
    kinds.forEach((k) => { db[k] = Array.isArray(d[k]) ? d[k] : []; });
    db.currentProblemId = d.currentProblemId ?? db.problems[0]?.id ?? null;
  } else {
    kinds.forEach((k) => {
      (d[k] || []).forEach((item) => {
        if (!db[k].some((x) => x.id === item.id)) db[k].push(item);
      });
    });
  }
  save();
}

export function resetToSamples() {
  const s = structuredClone(sampleData);
  Object.keys(s).forEach((k) => { db[k] = s[k]; });
  save();
}

export function clearAll() {
  const e = emptyData();
  Object.keys(e).forEach((k) => { db[k] = e[k]; });
  save();
}

// API キー：初期値はタブを閉じると消える sessionStorage。「この端末に覚えさせる」を選んだときだけ localStorage。
const KEY_PREFIX = 'hitowaku:key:';
export const keys = {
  get(provider) {
    return safeGet(sessionStorage, KEY_PREFIX + provider) || safeGet(localStorage, KEY_PREFIX + provider) || '';
  },
  remembered(provider) {
    return !!safeGet(localStorage, KEY_PREFIX + provider);
  },
  set(provider, value, remember) {
    safeRemove(sessionStorage, KEY_PREFIX + provider);
    safeRemove(localStorage, KEY_PREFIX + provider);
    if (!value) return;
    safeSet(remember ? localStorage : sessionStorage, KEY_PREFIX + provider, value);
  },
  forget(provider) {
    safeRemove(sessionStorage, KEY_PREFIX + provider);
    safeRemove(localStorage, KEY_PREFIX + provider);
  },
};

const PREF = 'hitowaku:prefs';
export const prefs = (() => {
  let p = {};
  try { p = JSON.parse(safeGet(localStorage, PREF) || '{}'); } catch { p = {}; }
  return {
    get: (k, d) => (k in p ? p[k] : d),
    set: (k, v) => { p[k] = v; safeSet(localStorage, PREF, JSON.stringify(p)); },
  };
})();
