export type LumiHistoryTurn = {
  role: "user" | "bot";
  text: string;
  at: string;
};

const MAX_TURNS = 50;
const PREFIX = "rolesmith_lumi_history_";

function key(userId: string) {
  return `${PREFIX}${userId || "anon"}`;
}

export function loadLumiHistory(userId: string): LumiHistoryTurn[] {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LumiHistoryTurn[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_TURNS) : [];
  } catch {
    return [];
  }
}

export function appendLumiTurn(userId: string, role: "user" | "bot", text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const prev = loadLumiHistory(userId);
  const last = prev[prev.length - 1];
  // Replace streaming updates for the same role at the tail
  if (last && last.role === role) {
    prev[prev.length - 1] = { role, text: trimmed, at: new Date().toISOString() };
  } else {
    prev.push({ role, text: trimmed, at: new Date().toISOString() });
  }
  const next = prev.slice(-MAX_TURNS);
  try {
    localStorage.setItem(key(userId), JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function finalizeLumiTurn(userId: string, role: "user" | "bot", text: string) {
  appendLumiTurn(userId, role, text);
}

export function getLumiHistoryForTool(userId: string, limit = 20) {
  const turns = loadLumiHistory(userId);
  const n = Math.min(50, Math.max(1, Math.round(limit) || 20));
  return turns.slice(-n).map((t) => ({
    role: t.role,
    text: t.text.slice(0, 400),
    at: t.at,
  }));
}
