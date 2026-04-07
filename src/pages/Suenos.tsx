import { useState, useMemo } from "react";
import { Plus, TrendingUp, ArrowUp, ArrowDown, Wallet, X } from "lucide-react";
import { GOAL_TYPES, formatQ } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Suenos() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [addingToGoal, setAddingToGoal] = useState<any>(null); // For "Abonar" modal

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

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: debts = [] } = useQuery({
    queryKey: ["debts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .eq("user_id", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const addGoalMutation = useMutation({
    mutationFn: async (goal: any) => {
      const { data, error } = await supabase.from("goals").insert({
        user_id: user?.id,
        name: goal.name,
        type: goal.type,
        total_amount: goal.total_amount,
        priority: goals.length + 1,
        current_saved: 0,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", user?.id] });
      toast.success("¡Meta creada con éxito!");
      setShowForm(false);
    },
  });

  const depositGoalMutation = useMutation({
    mutationFn: async ({ id, amount, current }: { id: string; amount: number; current: number }) => {
      const newSaved = current + amount;
      const { error } = await supabase.from("goals").update({ current_saved: newSaved }).eq("id", id);
      if (error) throw error;
      return newSaved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", user?.id] });
      toast.success("¡Abono registrado! Estás más cerca.");
      setAddingToGoal(null);
    },
  });

  const reorderGoalMutation = useMutation({
    mutationFn: async (updatedGoals: any[]) => {
      const updates = updatedGoals.map((g, index) => ({
        id: g.id,
        priority: index + 1,
      }));
      await Promise.all(
        updates.map((u) => supabase.from("goals").update({ priority: u.priority }).eq("id", u.id))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", user?.id] });
    },
  });

  const monthlyIncome = profile?.monthly_income || 0;
  const fixedExpenses = useMemo(() => expenses.filter((e) => e.is_recurring).reduce((s, e) => s + (e.amount || 0), 0), [expenses]);
  const variableExpenses = useMemo(() => expenses.filter((e) => !e.is_recurring).reduce((s, e) => s + (e.amount || 0), 0), [expenses]);
  const debtPayments = useMemo(() => debts.reduce((s, d) => s + (d.minimum_payment || 0), 0), [debts]);
  const savingsCapacity = monthlyIncome - fixedExpenses - variableExpenses - debtPayments;

  const handleReorder = (index: number, direction: 'up' | 'down') => {
    const newGoals = [...goals];
    if (direction === 'up' && index > 0) {
      [newGoals[index - 1], newGoals[index]] = [newGoals[index], newGoals[index - 1]];
      queryClient.setQueryData(["goals", user?.id], newGoals);
      reorderGoalMutation.mutate(newGoals);
    } else if (direction === 'down' && index < goals.length - 1) {
      [newGoals[index], newGoals[index + 1]] = [newGoals[index + 1], newGoals[index]];
      queryClient.setQueryData(["goals", user?.id], newGoals);
      reorderGoalMutation.mutate(newGoals);
    }
  };

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
          const target = goal.down_payment || goal.total_amount || 1;
          const currentSaved = goal.current_saved || goal.saved_amount || 0;
          const pct = Math.round((currentSaved / target) * 100);
          const remaining = target - currentSaved;
          const monthsLeft = savingsCapacity > 0 && remaining > 0 ? Math.ceil(remaining / savingsCapacity) : 0;
          const viability = remaining <= 0 ? "green" : monthsLeft <= 12 ? "green" : monthsLeft <= 24 ? "yellow" : "red";

          return (
            <div key={goal.id} className="rounded-2xl bg-card p-4 border border-border shadow-sm transition-all">
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
                  <p className="font-semibold text-foreground leading-tight">{goal.name}</p>
                  <p className="text-xs text-muted-foreground">{goalType?.label} • Prioridad {goal.priority || index + 1}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => handleReorder(index, 'up')} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleReorder(index, 'down')} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mb-1 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-green-500" : "bg-accent")} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="mb-3 flex items-center justify-between text-xs font-semibold text-foreground">
                <span>{formatQ(currentSaved)} <span className="text-muted-foreground font-normal">de {formatQ(target)}</span></span>
                <span>{pct}%</span>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 mb-3">
                <button 
                  onClick={() => setAddingToGoal(goal)}
                  disabled={pct >= 100}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition-all active:scale-[0.98]",
                    pct >= 100 ? "bg-muted border-border text-muted-foreground" : "border-primary/20 text-primary bg-primary/5 hover:bg-primary/10"
                  )}
                >
                  <Wallet className="h-3.5 w-3.5" />
                  {pct >= 100 ? "Completado" : "Registrar Ahorro"}
                </button>
              </div>

              <div className={cn(
                "rounded-xl p-3 text-xs leading-relaxed",
                pct >= 100 ? "bg-green-500/10 text-green-600 font-medium" : 
                viability === "green" ? "bg-primary/10 text-primary" :
                viability === "yellow" ? "bg-warning/10 text-warning" :
                "bg-destructive/10 text-destructive"
              )}>
                {pct >= 100 ? "🎉 ¡Meta alcanzada! Felicidades, tienes el dinero completo." :
                 viability === "green" ? `Excelente ritmo. En ${monthsLeft} meses manteniéndote así lo logras.` :
                 viability === "yellow" ? `💪 Es posible. Con disciplina, en ${monthsLeft} meses llegas.` :
                 `🌱 Hoy parece lejos. Registra gastos y encuentra fugas para aumentar ahorro.`}
              </div>

              {goal.monthly_payment > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Cuota posterior a la meta: {formatQ(goal.monthly_payment)}/mes
                </p>
              )}
            </div>
          );
        })}
      </div>

      {goals.length === 0 && (
        <div className="mt-12 mb-8 text-center bg-accent/5 py-8 rounded-3xl border border-accent/20">
          <TrendingUp className="h-10 w-10 mx-auto text-accent mb-3 opacity-80" />
          <p className="text-lg font-medium text-foreground">¿Cuál es tu máximo sueño?</p>
          <p className="text-sm text-muted-foreground mt-2 px-6">Agrega tu primer objetivo y deja que Flowi calcule para cuándo podrías tenerlo 🚀.</p>
        </div>
      )}

      <Button onClick={() => setShowForm(true)} className="w-full" size="lg">
        <Plus className="h-5 w-5 mr-1" /> Nuevo Sueño
      </Button>

      {/* Deposit Modal */}
      {addingToGoal && (
        <DepositGoalModal
          goalName={addingToGoal.name}
          onClose={() => setAddingToGoal(null)}
          onSave={(amount) => depositGoalMutation.mutate({ 
            id: addingToGoal.id, 
            amount, 
            current: addingToGoal.current_saved || addingToGoal.saved_amount || 0 
          })}
        />
      )}

      {/* New goal modal */}
      {showForm && (
        <NewGoalModal onClose={() => setShowForm(false)} onSave={(g) => addGoalMutation.mutate(g)} />
      )}
    </div>
  );
}

function DepositGoalModal({ goalName, onClose, onSave }: { goalName: string, onClose: () => void, onSave: (a: number) => void }) {
  const [amount, setAmount] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 border border-border shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Abonar a tu meta</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">¿Cuánto has apartado recientemente para <strong>{goalName}</strong>?</p>
        <div className="mb-6">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              autoFocus
            />
          </div>
        </div>
        <Button className="w-full" onClick={() => onSave(parseFloat(amount) || 0)} disabled={!amount}>Sumar a mi ahorro ✨</Button>
      </div>
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
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Mi primer carro o Viaje" />
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
