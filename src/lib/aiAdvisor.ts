import { supabase } from '@/integrations/supabase/client'

export interface FlowiInsight {
  type: 'success' | 'warning' | 'urgent' | 'tip';
  title: string;
  message: string;
  action?: string;
}

const CACHE_KEY = 'flowi_insights_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas

export async function getFlowiInsights(context: {
  user: any;
  thisMonthExpenses: any[];
  lastMonthExpenses: any[];
  fixedExpenses: any[];
  goals: any[];
  debts: any[];
}): Promise<FlowiInsight[]> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp, userId } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL && userId === context.user?.id) {
        return data;
      }
    }
  } catch { /* ignore */ }

  try {
    const { data, error } = await supabase.functions.invoke('ai-advisor', {
      body: context,
    })

    if (error) return []

    const insights: FlowiInsight[] = Array.isArray(data) ? data.slice(0, 3) : []

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: insights,
      timestamp: Date.now(),
      userId: context.user?.id,
    }))

    return insights
  } catch {
    return []
  }
}

export function clearInsightsCache() {
  localStorage.removeItem(CACHE_KEY)
}
