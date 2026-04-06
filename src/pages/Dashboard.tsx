import { useMemo, useState } from "react";
import { Plus, TrendingUp, Lightbulb, ArrowRight } from "lucide-react";
import { demoUser, demoExpenses, demoGoals } from "@/lib/demo-data";
import { EXPENSE_CATEGORIES, INSIGHTS, formatQ } from "@/lib/constants";
import AddExpenseModal from "@/components/AddExpenseModal";

export default function Dashboard() {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenses, setExpenses] = useState(demoExpenses);

  const user = demoUser;
  const goals = demoGoals;

  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const goalsCommitted = useMemo(() => goals.reduce((s, g) => s + (g.monthly_payment || 0), 0), [goals]);
  const available = user.monthly_income - totalSpent - goalsCommitted;

  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const budgetPercent = Math.round((totalSpent / user.monthly_income) * 100);
  const timePercent = Math.round((dayOfMonth / daysInMonth) * 100);

  const insight = INSIGHTS[today.getDate() % INSIGHTS.length];

  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  const activeGoal = goals[0];

  const dateStr = today.toLocaleDateString("es-GT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="animate-fade-in space-y-5 p-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hola, {user.name} 👋</h1>
        <p className="text-sm capitalize text-muted-foreground">{dateStr}</p>
      </div>

      {/* Available money card */}
      <div className={`rounded-2xl p-5 ${available >= 0 ? "bg-primary" : "bg-destructive"} text-primary-foreground`}>
        <p className="mb-1 text-sm font-medium opacity-90">Tu dinero disponible hoy</p>
        <p className="text-3xl font-bold">{formatQ(available)}</p>
        <div className="mt-3 flex items-center gap-2 text-xs opacity-80">
          <span>Ingreso: {formatQ(user.monthly_income)}</span>
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

      {/* Recent expenses */}
      <div className="rounded-2xl bg-card p-4 shadow-sm border border-border">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Últimos gastos</h3>
          <button className="text-xs font-medium text-primary">Ver todos →</button>
        </div>
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
                <span className="text-sm font-semibold text-foreground">{formatQ(exp.amount)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active goal */}
      {activeGoal && (
        <div className="rounded-2xl bg-card p-4 shadow-sm border border-border">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Meta activa</h3>
          </div>
          <p className="mb-1 font-medium text-foreground">{activeGoal.name}</p>
          <div className="mb-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent"
              style={{
                width: `${Math.round((activeGoal.saved_amount / (activeGoal.down_payment || activeGoal.total_amount)) * 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatQ(activeGoal.saved_amount)} de {formatQ(activeGoal.down_payment || activeGoal.total_amount)}
          </p>
        </div>
      )}

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
        onSave={(exp) => {
          setExpenses((prev) => [
            { ...exp, id: Date.now().toString(), date: exp.date || new Date().toISOString() },
            ...prev,
          ]);
        }}
      />
    </div>
  );
}
