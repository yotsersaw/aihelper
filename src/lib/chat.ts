const LEAD_HINTS = ["запис", "price", "цена", "consult", "консульта", "человек", "менеджер", "позвон"];

export function shouldSuggestLead(text: string) {
  const input = text.toLowerCase();
  return LEAD_HINTS.some((hint) => input.includes(hint));
}

export function fallbackMessage() {
  return "Сейчас оператор свяжется с вами. Оставьте, пожалуйста, контакты, и мы ответим в ближайшее время.";
}

export function estimateCost(totalTokens: number, model: string) {
  const cheap = model.includes("mini") || model.includes("haiku");
  const per1k = cheap ? 0.0015 : 0.006;
  return Number(((totalTokens / 1000) * per1k).toFixed(6));
}

export function isOriginAllowed(allowedDomain: string, origin?: string | null, referer?: string | null) {
  if (allowedDomain === "*") return true;
  const values = [origin, referer].filter(Boolean) as string[];
  if (values.length === 0) return false;

  return values.some((raw) => {
    try {
      const host = new URL(raw).hostname;
      return host === allowedDomain || host.endsWith(`.${allowedDomain}`);
    } catch {
      return false;
    }
  });
}
