// AI との通信。キーは利用者が持ち込み、ブラウザから直接 API に送る（このサイトのサーバーは経由しない）。
import { keys } from './store.js';

export const PROVIDERS = {
  anthropic: { label: 'Anthropic（Claude）', defaultModel: 'claude-haiku-5-5', keyHint: 'sk-ant-…' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-4o-mini', keyHint: 'sk-…' },
};

export class LLMError extends Error {}

async function callAnthropic({ key, model, system, messages, temperature, maxTokens }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, system, messages, temperature, max_tokens: maxTokens }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new LLMError(data?.error?.message || `Anthropic API が ${res.status} を返しました`);
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function callOpenAI({ key, model, system, messages, temperature, maxTokens }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new LLMError(data?.error?.message || `OpenAI API が ${res.status} を返しました`);
  return data.choices?.[0]?.message?.content || '';
}

export async function chat({ provider, model, system, messages, temperature = 0.7, maxTokens = 600 }) {
  const key = keys.get(provider);
  if (!key) throw new LLMError('API キーが入っていません。「AI の設定」でキーを入れてください。');
  const fn = provider === 'openai' ? callOpenAI : callAnthropic;
  // 同じ役が続くと API に断られるので、続いた発言はまとめる
  const merged = [];
  messages.forEach((m) => {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else merged.push({ ...m });
  });
  if (!merged.length || merged[0].role !== 'user') merged.unshift({ role: 'user', content: '始めてください。' });
  return fn({ key, model: model || PROVIDERS[provider].defaultModel, system, messages: merged, temperature, maxTokens });
}

// 文章の中から最初の JSON オブジェクトを取り出す
export function extractJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}
