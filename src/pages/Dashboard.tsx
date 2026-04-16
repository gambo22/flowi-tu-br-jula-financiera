import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, TrendingUp, Lightbulb, Landmark, Banknote, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EXPENSE_CATEGORIES, CATEGORY_GROUPS, SAVING_TIPS, INSIGHTS, formatQ } from "@/lib/constants";
import AddExpenseModal from "@/components/AddExpenseModal";
import { useAuth } from "@/context/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import { PaywallModal } from "@/components/PaywallModal";
import { supabase } from "@/integrations/supabase/client";
import { calculatePaymentDate, getPaymentDistanceText } from "@/lib/dateUtils";
import { getFlowiInsights, type FlowiInsight } from "@/lib/aiAdvisor";

// Tip rotativo — mezcla insights + saving tips, cambia cada 8h
function getRotatingTip() {
  const allTips = [
    ...INSIGHTS.map((text, i) => ({ type: "insight" as const, text, id: `insight-${i}` })),
    ...SAVING_TIPS.map((t) => ({ type: "saving" as const, text: `${t.emoji} ${t.title}: ${t.description}`, id: t.id })),
  ];
  const idx = Math.floor(Date.now() / (1000 * 60 * 60 * 8)) % allTips.length;
  return allTips[idx];
}

// Mini bar chart por grupo de categorías
function CategoryMiniChart({ expenses }: { expenses: any[] }) {
  const today = new Date();
  const monthExp = expenses.filter((e: any) => {
    const d = new Date(e.date);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  const grouped = CATEGORY_GROUPS.map((g) => {
    const total = monthExp
      .filter((e: any) => (g.categories as readonly string[]).includes(e.category))
      .reduce((s: number, e: any) => s + (e.amount || 0), 0);
    return { ...g, total };
  }).filter((g) => g.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

  if (grouped.length === 0) return null;

  const max = Math.max(...grouped.map((g) => g.total));

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm border border-border">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Gastos del mes</h3>
        <span className="text-xs text-muted-foreground">por categoría</span>
      </div>
      <div className="space-y-2.5">
        {grouped.map((g) => (
          <div key={g.id} className="flex items-center gap-2">
            <span className="w-20 text-xs text-muted-foreground truncate">{g.label}</span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((g.total / max) * 100)}%`,
                  backgroundColor: g.color,
                }}
              />
            </div>
            <span className="text-xs font-semibold text-foreground w-20 text-right">{formatQ(g.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isPremium } = usePlan();
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [aiInsights, setAiInsights] = useState<FlowiInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  const userName = profile?.name ?? "Tú";
  const monthlyIncome =
    profile?.income_this_month !== null && profile?.income_this_month !== undefined
      ? profile?.income_this_month
      : profile?.monthly_income ?? 0;
  const rawCash = profile?.cash_on_hand || 0;

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses").select("*").eq("user_id", user?.id)
        .order("date", { ascending: false });
      if (error && error.code !== "42P01") throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: fixedExpenses = [] } = useQuery({
    queryKey: ["fixed_expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_expenses").select("*").eq("user_id", user?.id).eq("is_active", true);
      if (error && error.code !== "42P01") throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").eq("user_id", user?.id).order("priority", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: debts = [] } = useQuery({
    queryKey: ["debts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("debts").select("*").eq("user_id", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").eq("user_id", user?.id);
      if (error) { if (error.code === "42703") return []; throw error; }
      return data || [];
    },
    enabled: !!user?.id,
  });

  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const currentMonthExpenses = expenses.filter((e: any) => {
    const d = new Date(e.date);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() && !e.is_recurring;
  });

  const totalSpentVariable = currentMonthExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const totalSpentFixed = fixedExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const totalDebtPayments = debts.reduce((sum: number, d: any) => sum + (d.minimum_payment || 0), 0);

  const available = monthlyIncome - totalSpentFixed - totalSpentVariable - totalDebtPayments;
  const totalCommitted = totalSpentFixed + totalSpentVariable + totalDebtPayments;
  const budgetPercent = monthlyIncome > 0 ? Math.round((totalCommitted / monthlyIncome) * 100) : 0;
  const timePercent = Math.round((dayOfMonth / daysInMonth) * 100);

  const accountsTotal = accounts.reduce((sum: number, acc: any) => sum + (Number(acc.balance) || 0), 0);
  const liquidWealth = rawCash + accountsTotal;

  const rotatingTip = useMemo(() => getRotatingTip(), []);
  const recentExpenses = expenses.slice(0, 3);

  const dateStr = today.toLocaleDateString("es-GT", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (expense: any) => {
      const { data, error } = await supabase.from("expenses").insert({
        user_id: user?.id,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        note: expense.note,
        payment_method: expense.payment_method || "efectivo",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] }),
  });

  const addFixedExpenseMutation = useMutation({
    mutationFn: async (exp: any) => {
      const { error } = await supabase.from("fixed_expenses").insert({
        user_id: user?.id,
        name: exp.name,
        category: exp.category,
        amount: exp.installment_amount,
        payment_day: exp.payment_day,
        payment_day_type: "fixed",
        is_active: true,
        installment_total: exp.installment_total,
        installment_current: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fixed_expenses", user?.id] }),
  });

  useEffect(() => {
    if (!profile?.id || expenses.length < 3) { setInsightsLoading(false); return; }
    const today2 = new Date();
    const thisMonthExp = expenses.filter((e: any) => {
      const d = new Date(e.date);
      return d.getMonth() === today2.getMonth() && d.getFullYear() === today2.getFullYear();
    });
    const lastMonth = new Date(today2.getFullYear(), today2.getMonth() - 1, 1);
    const lastMonthExp = expenses.filter((e: any) => {
      const d = new Date(e.date);
      return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
    });
    getFlowiInsights({ user: profile, thisMonthExpenses: thisMonthExp, lastMonthExpenses: lastMonthExp, fixedExpenses, goals, debts })
      .then((res) => { setAiInsights(res); setInsightsLoading(false); })
      .catch(() => setInsightsLoading(false));
  }, [profile?.id, expenses.length]);

  // Payday logic
  let paymentText = "";
  let paymentDaysUntil = 99;
  if (profile?.income_frequency === "monthly") {
    const pDate = calculatePaymentDate(profile?.payment_day_type || "last_business_day", today, profile?.payment_day_1);
    paymentDaysUntil = Math.round((pDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (paymentDaysUntil <= 3) paymentText = getPaymentDistanceText(pDate);
  } else if (profile?.income_frequency === "biweekly") {
    const rule = profile?.payment_day_type || "last_business_day_15_30";
    let target1, target2;
    if (rule === "fixed_days") {
      target1 = calculatePaymentDate("fixed_day", today, profile?.payment_day_1);
      target2 = calculatePaymentDate("fixed_day", today, profile?.payment_day_2);
    } else {
      target1 = calculatePaymentDate("last_business_day_15", today);
      target2 = calculatePaymentDate("last_business_day_of_month", today);
    }
    let nextPay: Date;
    if (today.getTime() <= target1.getTime()) nextPay = target1;
    else if (today.getTime() <= target2.getTime()) nextPay = target2;
    else {
      const nextM = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      nextPay = rule === "fixed_days"
        ? calculatePaymentDate("fixed_day", nextM, profile?.payment_day_1)
        : calculatePaymentDate("last_business_day_15", nextM);
    }
    paymentDaysUntil = Math.round((nextPay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (paymentDaysUntil <= 3) paymentText = getPaymentDistanceText(nextPay);
  }

  const getPaymentBadge = () => {
    if (!paymentText) return null;
    if (paymentDaysUntil === 0) return { text: "¡Hoy es día de pago, bicho! 💸🎉 ¡A darle con todo!", color: "bg-green-500/20 text-green-400 border-green-500/30 animate-pulse" };
    if (paymentDaysUntil === 1) return { text: "¡Mañana cae el pago! Aguantá un día más 💪", color: "bg-accent/20 text-accent border-accent/30" };
    if (paymentDaysUntil === 2) return { text: "En 2 días cae el pago, ya merito 🗓️", color: "bg-accent/15 text-accent border-accent/20" };
    if (paymentDaysUntil === 3) return { text: "En 3 días cae el pago 🗓️", color: "bg-accent/15 text-accent border-accent/20" };
    return null;
  };
  const paymentBadge = getPaymentBadge();

  return (
    <div className="animate-fade-in space-y-5 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hola, {userName} 👋</h1>
          <p className="text-sm capitalize text-muted-foreground">{dateStr}</p>
        </div>
        <Link to="/perfil" className="h-12 w-12 flex items-center justify-center rounded-full bg-primary/10 text-primary transition-transform hover:scale-105 border border-primary/20 shadow-sm relative">
          <span className="font-bold text-lg">{userName.charAt(0).toUpperCase()}</span>
          {liquidWealth === 0 && <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 animate-pulse border-2 border-background"></span>}
        </Link>
      </div>

      {/* Badge pago */}
      {paymentBadge && (
        <div className={`font-semibold px-3 py-1.5 rounded-full text-xs flex items-center gap-2 border w-fit ${paymentBadge.color}`}>
          <Landmark className="h-3.5 w-3.5" />
          {paymentBadge.text}
        </div>
      )}

      {/* ── Disponible card — compacta ── */}
      <div className={`rounded-2xl p-4 relative overflow-hidden ${available >= 0 ? "bg-primary" : "bg-destructive"} text-primary-foreground`}>
        <div className="absolute right-[-8%] top-[-10%] opacity-10">
          <Banknote className="h-24 w-24" />
        </div>
        <div className="relative z-10">
          <p className="text-xs font-medium opacity-80 mb-0.5">Disponible Real (fin de mes)</p>
          <p className="text-4xl font-bold tracking-tight">{formatQ(available)}</p>
          <div className="mt-3 flex flex-col gap-1 text-xs font-medium opacity-90">
            <div className="flex justify-between">
              <span className="opacity-70">Ingreso</span>
              <span>{formatQ(monthlyIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Compromisos fijos</span>
              <span style={{ color: "#FF2020" }}>- {formatQ(totalSpentFixed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Gastado variable</span>
              <span style={{ color: "#FF2020" }}>- {formatQ(totalSpentVariable)}</span>
            </div>
            {totalDebtPayments > 0 && (
              <div className="flex justify-between">
                <span className="opacity-70">Pagos de deudas</span>
                <span style={{ color: "#FF2020" }}>- {formatQ(totalDebtPayments)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progreso del mes */}
      <div className="rounded-2xl bg-card p-4 shadow-sm border border-border">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Progreso del mes</span>
          <span className="text-xs text-muted-foreground">Día {dayOfMonth} de {daysInMonth}</span>
        </div>
        <div className="mb-1 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${budgetPercent > timePercent ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${Math.min(budgetPercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-muted-foreground">
            Comprometido: <span className="font-semibold text-foreground">{formatQ(totalCommitted)}</span>
          </p>
          <p className="text-xs font-bold">{budgetPercent}%</p>
        </div>
      </div>

      {/* Mini gráfica por categoría */}
      <CategoryMiniChart expenses={expenses} />

      {/* Últimos gastos */}
      <div className="rounded-2xl bg-card p-4 shadow-sm border border-border">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Últimos gastos</h3>
        </div>
        {recentExpenses.length === 0 ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <TrendingUp className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">¡Todo en orden, jefe!</p>
            <p className="text-xs text-muted-foreground mt-1">Aún no has registrado gastos recientemente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentExpenses.map((exp: any) => {
              const cat = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
              const Icon = cat?.icon;
              return (
                <div key={exp.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{exp.note || cat?.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(exp.date).toLocaleDateString("es-GT", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{formatQ(exp.amount || 0)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Flowi dice — IA */}
      {isPremium ? (
        (insightsLoading || aiInsights.length > 0) && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-accent" />
              <span className="text-xs font-bold text-accent">Flowi dice</span>
              <span className="text-xs text-muted-foreground opacity-60">· IA</span>
            </div>
            {insightsLoading ? (
              <div className="space-y-2">
                <div className="h-14 rounded-xl bg-muted/50 animate-pulse" />
                <div className="h-14 rounded-xl bg-muted/40 animate-pulse" />
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {aiInsights.map((ins, i) => (
                  <div key={i} className={`flex-shrink-0 w-68 rounded-xl p-3 border ${
                    ins.type === "urgent" ? "bg-destructive/10 border-destructive/20 text-destructive" :
                    ins.type === "warning" ? "bg-warning/10 border-warning/20 text-warning" :
                    ins.type === "success" ? "bg-green-500/10 border-green-500/20 text-green-600" :
                    "bg-accent/10 border-accent/20 text-accent"
                  }`}>
                    <p className="text-xs font-bold mb-1">{ins.title}</p>
                    <p className="text-xs leading-relaxed opacity-90">{ins.message}</p>
                    {ins.action && <p className="text-xs font-semibold mt-1.5 opacity-75">👉 {ins.action}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      ) : (
        <button
          onClick={() => setShowPaywall(true)}
          className="w-full flex items-center justify-between p-4 bg-violet-50 rounded-2xl border border-violet-100"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">✨</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-violet-700">Consejo IA personalizado</p>
              <p className="text-xs text-violet-400">Desbloqueá con Premium</p>
            </div>
          </div>
          <span className="text-violet-400 text-xs font-medium">Premium →</span>
        </button>
      )}

      {showPaywall && (
        <PaywallModal
          feature="IA Advisor"
          onClose={() => setShowPaywall(false)}
        />
      )}

      {/* Tip rotativo — Reflexión / Técnica de ahorro */}
      <div className="rounded-2xl bg-accent/10 p-4">
        <div className="mb-1 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-accent" />
          <span className="text-xs font-semibold text-accent">
            {rotatingTip.type === "saving" ? "Técnica de ahorro" : "Reflexión del día"}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-foreground italic">"{rotatingTip.text}"</p>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddExpense(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AddExpenseModal
        open={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        onSave={async (exp) => { await addExpenseMutation.mutateAsync(exp); }}
        onSaveFixed={(exp) => addFixedExpenseMutation.mutate(exp)}
      />
    </div>
  );
}
