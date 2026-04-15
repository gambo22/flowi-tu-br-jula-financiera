export interface FlowiInsight {
  type: 'success' | 'warning' | 'urgent' | 'tip';
  title: string;
  message: string;
  action?: string;
}

const CACHE_KEY = 'flowi_insights_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

function getCategoryBreakdown(expenses: any[]): string {
  const by: Record<string, number> = {};
  expenses.forEach(e => { by[e.category] = (by[e.category] || 0) + (e.amount || 0); });
  return Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => `${cat}: Q${amt.toFixed(0)}`)
    .join(', ') || 'Sin gastos registrados';
}

export async function getFlowiInsights(context: {
  user: any;
  thisMonthExpenses: any[];
  lastMonthExpenses: any[];
  fixedExpenses: any[];
  goals: any[];
  debts: any[];
}): Promise<FlowiInsight[]> {
  // Check localStorage cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp, userId } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL && userId === context.user?.id) {
        return data;
      }
    }
  } catch { /* ignore */ }

  const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const thisTotal = context.thisMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const lastTotal = context.lastMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const fixedTotal = context.fixedExpenses.filter((f: any) => f.is_active).reduce((s: number, f: any) => s + (f.amount || 0), 0);
  const income = context.user?.monthly_income || 0;
  const changePct = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal * 100).toFixed(1) : '0';

  const systemPrompt = `Eres Flowi, un asesor financiero empático para Guatemala. Analizá los datos del usuario y dá máximo 3 insights en español guatemalteco informal (usá "vos", "plata", "bicho", etc.), concisos (máx 2 oraciones), sin juicio, motivadores. Respondé SOLO en JSON válido sin texto adicional: [{"type":"success|warning|urgent|tip","title":"corto máx 5 palabras","message":"...","action":"frase corta de acción"}]`;

  const userContext = `Usuario: ${context.user?.name || 'amigo'}
Ingreso mensual: Q${income}
Gastos este mes: Q${thisTotal.toFixed(0)} | Mes anterior: Q${lastTotal.toFixed(0)} | Cambio: ${changePct}%
Top categorías este mes: ${getCategoryBreakdown(context.thisMonthExpenses)}
Compromisos fijos: Q${fixedTotal.toFixed(0)}/mes (${context.fixedExpenses.filter((f: any) => f.is_active).length} activos)
Metas activas: ${context.goals.length} | Deudas: ${context.debts.length}
Disponible estimado: Q${Math.max(income - thisTotal - fixedTotal, 0).toFixed(0)}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContext }],
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    const text = data.content?.[0]?.text?.trim() || '[]';
    const insights: FlowiInsight[] = JSON.parse(text);

    // Cache result
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: insights,
      timestamp: Date.now(),
      userId: context.user?.id,
    }));

    return Array.isArray(insights) ? insights.slice(0, 3) : [];
  } catch {
    return [];
  }
}

export function clearInsightsCache() {
  localStorage.removeItem(CACHE_KEY);
}
