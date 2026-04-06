import { useState, useMemo } from "react";
import { Plus, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { demoGoals, demoUser, demoExpenses, demoDebts } from "@/lib/demo-data";
import { GOAL_TYPES, formatQ } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";

export default function Suenos() {
  const [goals, setGoals] = useState(demoGoals);
  const [showForm, setShowForm] = useState(false);

  const user = demoUser;
  const expenses = demoExpenses;
  const debts = demoDebts;

  const fixedExpenses = useMemo(() => expenses.filter((e) => e.is_recurring).reduce((s, e) => s + e.amount, 0), []);
  const variableExpenses = useMemo(() => expenses.filter((e) => !e.is_recurring).reduce((s, e) => s + e.amount, 0), []);
  const debtPayments = useMemo(() => debts.reduce((s, d) => s + d.minimum_payment, 0), []);
  const savingsCapacity = user.monthly_income - fixedExpenses - variableExpenses - debtPayments;

  return (
    <div className="animate-fade-in p-4 pb-24">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mis Sueños ✨</h1>
          <p className="text-sm text-muted-foreground">Capacidad de ahorro: <span className="font-semibold text-primary">{formatQ(Math.max(savingsCapacity, 0))}/mes</span></p>
        </div>
      </div>

      {/* Goals list */}
      <div className="space-y-3 mb-4">
        {goals.map((goal, index) => {
          const goalType = GOAL_TYPES.find((t) => t.id === goal.type);
          const Icon = goalType?.icon || TrendingUp;
          const target = goal.down_payment || goal.total_amount;
          const pct = Math.round((goal.saved_amount / target) * 100);
          const remaining = target - goal.saved_amount;
          const monthsLeft = savingsCapacity > 0 ? Math.ceil(remaining / savingsCapacity) : Infinity;

          const viability = monthsLeft <= 12 ? "green" : monthsLeft <= 24 ? "yellow" : "red";

          return (
            <div key={goal.id} className="rounded-2xl bg-card p-4 border border-border">
              <div className="mb-3 flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  viability === "green" ? "bg-primary/15 text-primary" :
                  viability === "yellow" ? "bg-warning/15 text-warning" :
                  "bg-destructive/15 text-destructive"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{goal.name}</p>
                  <p className="text-xs text-muted-foreground">{goalType?.label} • Prioridad {goal.priority}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      if (index > 0) {
                        const newGoals = [...goals];
                        [newGoals[index - 1], newGoals[index]] = [newGoals[index], newGoals[index - 1]];
                        setGoals(newGoals);
                      }
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (index < goals.length - 1) {
                        const newGoals = [...goals];
                        [newGoals[index], newGoals[index + 1]] = [newGoals[index + 1], newGoals[index]];
                        setGoals(newGoals);
                      }
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mb-1 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatQ(goal.saved_amount)} de {formatQ(target)}</span>
                <span>{pct}%</span>
              </div>

              {/* Viability message */}
              <div className={cn(
                "rounded-xl p-3 text-xs",
                viability === "green" ? "bg-primary/10 text-primary" :
                viability === "yellow" ? "bg-warning/10 text-warning" :
                "bg-destructive/10 text-destructive"
              )}>
                {viability === "green" && `🎉 ¡Ya puedes darte ese gusto! En ${monthsLeft} meses lo tienes.`}
                {viability === "yellow" && `💪 Es posible. Con disciplina, en ${monthsLeft} meses llegas.`}
                {viability === "red" && `🌱 Hoy no es el momento ideal, pero si aumentas tus ahorros, se puede lograr.`}
              </div>

              {goal.monthly_payment > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Cuota post-compra: {formatQ(goal.monthly_payment)}/mes
                </p>
              )}
            </div>
          );
        })}
      </div>

      {goals.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-foreground">¿Cuál es tu sueño?</p>
          <p className="text-sm text-muted-foreground mt-1">Agrega tu primera meta y Flowi te ayuda a llegar</p>
        </div>
      )}

      <Button onClick={() => setShowForm(true)} className="w-full" size="lg">
        <Plus className="h-5 w-5 mr-1" /> Nueva meta
      </Button>

      {/* New goal modal */}
      {showForm && <NewGoalModal onClose={() => setShowForm(false)} onSave={(goal) => {
        setGoals((prev) => [...prev, { ...goal, id: Date.now().toString(), priority: prev.length + 1, saved_amount: 0 }]);
        setShowForm(false);
      }} />}
    </div>
  );
}

function NewGoalModal({ onClose, onSave }: { onClose: () => void; onSave: (g: any) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [hasDownPayment, setHasDownPayment] = useState(false);
  const [downPayment, setDownPayment] = useState("");
  const [hasMonthly, setHasMonthly] = useState(false);
  const [monthlyPayment, setMonthlyPayment] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Nuevo sueño</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Nombre de tu meta</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Mi primer carro" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Tipo</label>
            <div className="grid grid-cols-4 gap-2">
              {GOAL_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl p-2.5 text-xs transition-all",
                    type === t.id ? "bg-accent text-accent-foreground shadow-md" : "bg-muted text-muted-foreground"
                  )}
                >
                  <t.icon className="h-5 w-5" />
                  <span className="line-clamp-1">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Costo total (Q)</label>
            <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="85000" />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted p-3">
            <span className="text-sm font-medium text-foreground">¿Requiere enganche?</span>
            <Switch checked={hasDownPayment} onCheckedChange={setHasDownPayment} />
          </div>
          {hasDownPayment && (
            <Input type="number" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} placeholder="Monto del enganche (Q)" />
          )}

          <div className="flex items-center justify-between rounded-xl bg-muted p-3">
            <span className="text-sm font-medium text-foreground">¿Cuota mensual después?</span>
            <Switch checked={hasMonthly} onCheckedChange={setHasMonthly} />
          </div>
          {hasMonthly && (
            <Input type="number" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} placeholder="Cuota mensual estimada (Q)" />
          )}

          <Button
            onClick={() => onSave({
              name,
              type,
              total_amount: parseFloat(totalAmount) || 0,
              down_payment: hasDownPayment ? parseFloat(downPayment) || 0 : 0,
              monthly_payment: hasMonthly ? parseFloat(monthlyPayment) || 0 : 0,
              target_date: null,
            })}
            className="w-full"
            size="lg"
            disabled={!name || !type || !totalAmount}
          >
            Crear mi sueño ✨
          </Button>
        </div>
      </div>
    </div>
  );
}
