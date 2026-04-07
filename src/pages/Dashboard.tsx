import { useMemo, useState } from "react";
import { Plus, TrendingUp, Lightbulb } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EXPENSE_CATEGORIES, INSIGHTS, formatQ } from "@/lib/constants";
import AddExpenseModal from "@/components/AddExpenseModal";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  const userName = profile?.name ?? "tú";
  const monthlyIncome = profile?.monthly_income ?? 0;

  // Real data fetching
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user?.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user?.id)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Derived calculations
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  // Solamente sumar los gastos del último mes actual para el layout principal
  const currentMonthExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date);
    return expenseDate.getMonth() === today.getMonth() && expenseDate.getFullYear() === today.getFullYear();
  });

  const totalSpent = currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const goalsCommitted = goals.reduce((sum, g) => sum + (g.current_saved || 0), 0); // No ideal logic for committed monthly, using simple safe sum
  const available = monthlyIncome > 0 ? (monthlyIncome - totalSpent) : 0;

  const budgetPercent = monthlyIncome > 0 ? Math.round((totalSpent / monthlyIncome) * 100) : 0;
  const timePercent = Math.round((dayOfMonth / daysInMonth) * 100);

  const insight = INSIGHTS[today.getDate() % INSIGHTS.length];

  const recentExpenses = expenses.slice(0, 3);
  const activeGoal = goals.length > 0 ? goals[0] : null;

  const dateStr = today.toLocaleDateString("es-GT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Mutación para agregar gasto nuevo directamente
  const addExpenseMutation = useMutation({
    mutationFn: async (expense: any) => {
      const { data, error } = await supabase.from("expenses").insert({
        user_id: user?.id,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        note: expense.note,
        is_recurring: expense.is_recurring,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
    },
  });

  return (
    <div className="animate-fade-in space-y-5 p-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hola, {userName} 👋</h1>
        <p className="text-sm capitalize text-muted-foreground">{dateStr}</p>
      </div>

      {/* Available money card */}
      <div className={`rounded-2xl p-5 ${available >= 0 ? "bg-primary" : "bg-destructive"} text-primary-foreground`}>
        <p className="mb-1 text-sm font-medium opacity-90">Tu dinero disponible restante</p>
        <p className="text-3xl font-bold">{formatQ(available)}</p>
        <div className="mt-3 flex items-center gap-2 text-xs opacity-80">
          <span>Ingreso: {formatQ(monthlyIncome)}</span>
          <span>•</span>
          <span>Gastado: {formatQ(totalSpent)}</span>
        </div>
      </div>

      {/* Budget progress */}
      <div className="rounded-2xl bg-card p-4 shadow-sm border border-border">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Progreso del mes</span>
          <span className="text-xs text-muted-foreground">Día {dayOfMonth} de {daysInMonth}</span>
        </div>
        <div className="mb-1 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              budgetPercent > timePercent ? "bg-destructive" : "bg-primary"
            }`}
            style={{ width: `${Math.min(budgetPercent, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Has usado el <span className="font-semibold text-foreground">{budgetPercent}%</span> de tu presupuesto
          {budgetPercent > timePercent && " — vas un poco por encima del ritmo ideal"}
        </p>
      </div>

      {/* Recent expenses o Empty State */}
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
            {recentExpenses.map((exp) => {
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

      {/* Active goal o Empty State */}
      <div className="rounded-2xl bg-card p-4 shadow-sm border border-border">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Tu gran Meta</h3>
        </div>
        {activeGoal ? (
          <>
            <p className="mb-1 font-medium text-foreground">{activeGoal.name}</p>
            <div className="mb-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent"
                style={{
                  width: `${Math.min(Math.round(((activeGoal.current_saved || 0) / (activeGoal.total_amount || 1)) * 100), 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatQ(activeGoal.current_saved || 0)} de {formatQ(activeGoal.total_amount || 0)}
            </p>
          </>
        ) : (
          <div className="py-2 text-left">
            <p className="text-xs text-muted-foreground">Darle un propósito a tus ahorros cambia tu forma de verlo. Agrega tu primer sueño en la pestaña respectiva.</p>
          </div>
        )}
      </div>

      {/* Insight */}
      <div className="rounded-2xl bg-accent/10 p-4">
        <div className="mb-1 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-accent" />
          <span className="text-xs font-semibold text-accent">Reflexión del día</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground italic">"{insight}"</p>
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
        onSave={async (exp) => {
          await addExpenseMutation.mutateAsync(exp);
        }}
      />
    </div>
  );
}
