import { useState, useMemo } from "react";
import { Plus, TrendingUp, ArrowUp, ArrowDown, Wallet, X, Edit2, Trash2, CheckCircle } from "lucide-react";
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
  const [addingToGoal, setAddingToGoal] = useState<any>(null);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").eq("user_id", user?.id).order("priority", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("user_id", user?.id);
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

  const monthlyIncome = profile?.monthly_income || 0;

  // BLOQUE 4 — Capacidad de ahorro real (promedio 3 meses)
  const { savingsCapacity, dataMonthsCount } = useMemo(() => {
    const today = new Date();
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const recentExpenses = expenses.filter(e => new Date(e.date) >= threeMonthsAgo);
    if (recentExpenses.length === 0) {
      return { savingsCapacity: Math.max(monthlyIncome * 0.2, 0), dataMonthsCount: 0 };
    }
    const monthMap: Record<string, number> = {};
    recentExpenses.forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      monthMap[key] = (monthMap[key] || 0) + (e.amount || 0);
    });
    const values = Object.values(monthMap);
    const avgSpent = values.reduce((s, v) => s + v, 0) / values.length;
    const debtPayments = debts.reduce((s: number, d: any) => s + (d.minimum_payment || 0), 0);
    return { savingsCapacity: Math.max(monthlyIncome - avgSpent - debtPayments, 0), dataMonthsCount: values.length };
  }, [expenses, monthlyIncome, debts]);

  // Mutations
  const addGoalMutation = useMutation({
    mutationFn: async (goal: any) => {
      const startPhase = !goal.down_payment && goal.monthly_payment > 0 ? 'installments' : 'saving';
      const { data: newGoal, error } = await supabase.from("goals").insert({
        user_id: user?.id,
        name: goal.name,
        type: goal.type,
        total_amount: goal.total_amount || 0,
        down_payment: goal.down_payment || 0,
        monthly_payment: goal.monthly_payment || 0,
        installment_total: goal.installment_total || 0,
        payment_day: goal.payment_day || null,
        priority: goals.length + 1,
        current_saved: 0,
        installment_current: 0,
        phase: startPhase,
      }).select().single();
      if (error) throw error;
      if (startPhase === 'installments' && goal.monthly_payment > 0 && newGoal) {
        const { data: fe } = await supabase.from("fixed_expenses").insert({
          user_id: user?.id,
          name: `Cuotas: ${goal.name}`,
          category: goal.type || 'other',
          amount: goal.monthly_payment,
          payment_day: goal.payment_day || 1,
          payment_day_type: 'fixed',
          is_active: true,
          installment_total: goal.installment_total || 0,
          installment_current: 0,
          goal_id: newGoal.id,
        }).select().single();
        if (fe?.id) {
          await supabase.from("goals").update({ fixed_expense_id: fe.id }).eq("id", newGoal.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["fixed_expenses", user?.id] });
      toast.success("¡Sueño creado! 🌟");
      setShowForm(false);
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async (goal: any) => {
      const { error } = await supabase.from("goals").update({
        name: goal.name,
        type: goal.type,
        total_amount: goal.total_amount || 0,
        down_payment: goal.down_payment || 0,
        monthly_payment: goal.monthly_payment || 0,
        installment_total: goal.installment_total || 0,
        payment_day: goal.payment_day || null,
      }).eq("id", goal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", user?.id] });
      toast.success("Sueño actualizado.");
      setEditingGoal(null);
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async ({ goalId, fixedExpenseId }: { goalId: string; fixedExpenseId?: string }) => {
      if (fixedExpenseId) {
        await supabase.from("fixed_expenses").update({ is_active: false }).eq("id", fixedExpenseId);
      }
      const { error } = await supabase.from("goals").delete().eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["fixed_expenses", user?.id] });
      toast.success("Sueño eliminado.");
      setConfirmDelete(null);
    },
  });

  const depositGoalMutation = useMutation({
    mutationFn: async ({ goal, amount }: { goal: any; amount: number }) => {
      const newSaved = (goal.current_saved || 0) + amount;
      await supabase.from("goals").update({ current_saved: newSaved }).eq("id", goal.id);
      try {
        await (supabase.from as any)("goal_payments").insert({ goal_id: goal.id, user_id: user?.id, amount });
      } catch { /* table may not exist yet */ }
      // Auto-transition: saving → installments
      const downPayment = goal.down_payment || 0;
      const installmentTotal = goal.installment_total || 0;
      const currentPhase = goal.phase || 'saving';
      if (downPayment > 0 && newSaved >= downPayment && installmentTotal > 0 && currentPhase === 'saving') {
        const { data: fe } = await supabase.from("fixed_expenses").insert({
          user_id: user?.id,
          name: `Cuotas: ${goal.name}`,
          category: goal.type || 'other',
          amount: goal.monthly_payment || 0,
          payment_day: goal.payment_day || 1,
          payment_day_type: 'fixed',
          is_active: true,
          installment_total: installmentTotal,
          installment_current: 0,
          goal_id: goal.id,
        }).select().single();
        await supabase.from("goals").update({
          phase: 'installments',
          installment_current: 0,
          fixed_expense_id: (fe as any)?.id || null,
        }).eq("id", goal.id);
        return { transitioned: true, name: goal.name };
      }
      return { transitioned: false };
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["goals", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["fixed_expenses", user?.id] });
      if (result?.transitioned) {
        toast.success(`🎉 ¡Enganche listo! Las cuotas de "${result.name}" ya están en tus compromisos.`);
      } else {
        toast.success("¡Abono registrado! Seguís avanzando 💪");
      }
      setAddingToGoal(null);
    },
  });

  const payInstallmentMutation = useMutation({
    mutationFn: async (goal: any) => {
      const today = new Date();
      const newCurrent = (goal.installment_current || 0) + 1;
      const isComplete = newCurrent >= (goal.installment_total || 1);
      if (goal.fixed_expense_id) {
        await supabase.from("fixed_expense_payments").insert({
          fixed_expense_id: goal.fixed_expense_id,
          user_id: user?.id,
          amount_paid: goal.monthly_payment || 0,
          payment_date: today.toISOString().split('T')[0],
          month: today.getMonth() + 1,
          year: today.getFullYear(),
          confirmed: true,
        });
        await supabase.from("fixed_expenses").update({ installment_current: newCurrent, is_active: !isComplete }).eq("id", goal.fixed_expense_id);
      }
      await supabase.from("goals").update({ installment_current: newCurrent, phase: isComplete ? 'completed' : 'installments' }).eq("id", goal.id);
      return { newCurrent, total: goal.installment_total || 1, isComplete };
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["goals", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["fixed_expenses", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["fixed_payments", user?.id] });
      if (result.isComplete) {
        toast.success("🏆 ¡Sueño completado! Todas las cuotas pagadas. ¡Felicidades!");
      } else {
        const pct = Math.round((result.newCurrent / result.total) * 100);
        if (pct >= 75) toast.success(`✨ Cuota ${result.newCurrent}/${result.total} · ¡Ya vas al ${pct}%!`);
        else if (pct >= 50) toast.success(`💪 Cuota ${result.newCurrent}/${result.total} · ¡Mitad del camino!`);
        else toast.success(`✓ Cuota ${result.newCurrent} de ${result.total} pagada.`);
      }
    },
  });

  const reorderGoalMutation = useMutation({
    mutationFn: async (updatedGoals: any[]) => {
      await Promise.all(updatedGoals.map((g, i) => supabase.from("goals").update({ priority: i + 1 }).eq("id", g.id)));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals", user?.id] }),
  });

  const handleReorder = (index: number, direction: 'up' | 'down') => {
    const newGoals = [...goals];
    if (direction === 'up' && index > 0) {
      [newGoals[index - 1], newGoals[index]] = [newGoals[index], newGoals[index - 1]];
    } else if (direction === 'down' && index < goals.length - 1) {
      [newGoals[index], newGoals[index + 1]] = [newGoals[index + 1], newGoals[index]];
    } else return;
    queryClient.setQueryData(["goals", user?.id], newGoals);
    reorderGoalMutation.mutate(newGoals);
  };

  return (
    <div className="animate-fade-in p-4 pb-24">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mis Sueños ✨</h1>
          <p className="text-sm text-muted-foreground">
            Capacidad de ahorro: <span className="font-semibold text-primary">{formatQ(Math.max(savingsCapacity, 0))}/mes</span>
            {dataMonthsCount > 0 && <span className="text-xs opacity-60"> · {dataMonthsCount} mes{dataMonthsCount !== 1 ? 'es' : ''} de historial</span>}
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {goals.map((goal: any, index: number) => {
          const goalType = GOAL_TYPES.find((t) => t.id === goal.type);
          const Icon = goalType?.icon || TrendingUp;
          const computedPhase = goal.phase || (
            (goal.installment_total || 0) > 0 && (goal.installment_current || 0) >= (goal.installment_total || 1)
              ? 'completed'
              : (goal.down_payment || 0) > 0 && (goal.current_saved || 0) >= (goal.down_payment || 0) && (goal.installment_total || 0) > 0
                ? 'installments'
                : 'saving'
          );

          // Progress values depend on phase
          const isInstallmentPhase = computedPhase === 'installments';
          const isCompleted = computedPhase === 'completed';
          const pct = isInstallmentPhase
            ? Math.round(((goal.installment_current || 0) / Math.max(goal.installment_total || 1, 1)) * 100)
            : Math.round(((goal.current_saved || 0) / Math.max(goal.down_payment || goal.total_amount || 1, 1)) * 100);

          const remaining = isInstallmentPhase
            ? (goal.installment_total || 0) - (goal.installment_current || 0)
            : Math.max((goal.down_payment || goal.total_amount || 0) - (goal.current_saved || 0), 0);

          const monthsLeft = !isInstallmentPhase && savingsCapacity > 0 && remaining > 0
            ? Math.ceil(remaining / savingsCapacity) : 0;

          const viability = isCompleted || pct >= 100 ? 'green'
            : isInstallmentPhase ? 'green'
            : savingsCapacity <= 0 ? 'red'
            : monthsLeft <= 12 ? 'green'
            : monthsLeft <= 24 ? 'yellow' : 'red';

          // BLOQUE 1D — Mensaje correcto según tipo y fase
          const message = isCompleted
            ? "🏆 ¡Sueño cumplido! Todas las cuotas pagadas."
            : pct >= 100 && computedPhase === "saving" && (goal.installment_total || 0) > 0
            ? "🎉 ¡Enganche listo! Iniciando fase de cuotas..."
            : pct >= 100
            ? "🎉 ¡Meta alcanzada! Tenés el dinero completo."
            : isInstallmentPhase
            ? `💳 Cuota ${goal.installment_current || 0} de ${goal.installment_total || 0} · Próximo pago: día ${goal.payment_day || "?"}`
            : (goal.down_payment || 0) > 0
            ? `🏠 Juntando enganche · Faltan ${formatQ(remaining)}`
            : savingsCapacity <= 0
            ? "📊 Registrá tus gastos para calcular cuándo llegás."
            : monthsLeft <= 0
            ? "🎉 ¡Ya casi estás!"
            : viability === "green"
            ? `✨ Ahorrando ${formatQ(savingsCapacity)}/mes, llegás en ${monthsLeft} mes${monthsLeft !== 1 ? "es" : ""}.`
            : viability === "yellow"
            ? `💪 Con disciplina ahorrando ${formatQ(savingsCapacity)}/mes, en ${monthsLeft} meses llegás.`
            : `🌱 Encontrá fugas en tus gastos para acelerar.`;

          return (
            <div key={goal.id} className={cn(
              "rounded-2xl bg-card p-4 border shadow-sm transition-all",
              isCompleted ? "border-green-500/30 bg-green-500/5" : "border-border"
            )}>
              <div className="mb-3 flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  viability === "green" ? "bg-primary/15 text-primary" :
                  viability === "yellow" ? "bg-warning/15 text-warning" :
                  "bg-destructive/15 text-destructive"
                )}>
                  {isCompleted ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground leading-tight">{goal.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {goalType?.label} · Prioridad {goal.priority || index + 1}
                    {isInstallmentPhase && ` · ${goal.installment_current || 0}/${goal.installment_total || 0} cuotas`}
                  </p>
                </div>
                {/* Edit/Delete buttons */}
                <button onClick={() => setEditingGoal(goal)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setConfirmDelete(goal)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                {/* Reorder */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => handleReorder(index, 'up')} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleReorder(index, 'down')} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-1 h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", isCompleted || pct >= 100 ? "bg-green-500" : isInstallmentPhase ? "bg-accent" : "bg-primary")}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="mb-3 flex items-center justify-between text-xs font-semibold text-foreground">
                {isInstallmentPhase
                  ? <span>{goal.installment_current || 0} <span className="text-muted-foreground font-normal">de {goal.installment_total || 0} cuotas</span></span>
                  : <span>{formatQ(goal.current_saved || 0)} <span className="text-muted-foreground font-normal">de {formatQ(goal.down_payment || goal.total_amount || 0)}</span></span>
                }
                <span>{Math.min(pct, 100)}%</span>
              </div>

              {/* Action buttons */}
              {!isCompleted && (
                <div className="flex gap-2 mb-3">
                  {isInstallmentPhase ? (
                    <button
                      onClick={() => payInstallmentMutation.mutate(goal)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-accent/20 bg-accent/5 py-2 text-xs font-semibold text-accent hover:bg-accent/10 transition-all active:scale-[0.98]"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Pagar cuota de {goal.payment_day ? `día ${goal.payment_day}` : 'este mes'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setAddingToGoal(goal)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-all active:scale-[0.98]"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      {(goal.down_payment || 0) > 0 ? 'Abonar al enganche' : 'Registrar Ahorro'}
                    </button>
                  )}
                </div>
              )}

              {/* Message */}
              <div className={cn(
                "rounded-xl p-3 text-xs leading-relaxed",
                isCompleted ? "bg-green-500/10 text-green-600" :
                viability === "green" ? "bg-primary/10 text-primary" :
                viability === "yellow" ? "bg-warning/10 text-warning" :
                "bg-destructive/10 text-destructive"
              )}>
                {message}
              </div>
            </div>
          );
        })}
      </div>

      {goals.length === 0 && (
        <div className="mt-12 mb-8 text-center bg-accent/5 py-8 rounded-3xl border border-accent/20">
          <TrendingUp className="h-10 w-10 mx-auto text-accent mb-3 opacity-80" />
          <p className="text-lg font-medium text-foreground">¿Cuál es tu máximo sueño?</p>
          <p className="text-sm text-muted-foreground mt-2 px-6">Agregá tu primer objetivo y Flowi calcula para cuándo podés tenerlo 🚀</p>
        </div>
      )}

      <Button onClick={() => setShowForm(true)} className="w-full" size="lg">
        <Plus className="h-5 w-5 mr-1" /> Nuevo Sueño
      </Button>

      {/* Deposit/Abono Modal */}
      {addingToGoal && (
        <DepositModal
          goal={addingToGoal}
          onClose={() => setAddingToGoal(null)}
          onSave={(amount) => depositGoalMutation.mutate({ goal: addingToGoal, amount })}
        />
      )}

      {/* New Goal Modal */}
      {showForm && (
        <GoalFormModal
          onClose={() => setShowForm(false)}
          onSave={(g) => addGoalMutation.mutate(g)}
        />
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <GoalFormModal
          initialData={editingGoal}
          onClose={() => setEditingGoal(null)}
          onSave={(g) => updateGoalMutation.mutate({ ...g, id: editingGoal.id })}
        />
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 border border-border shadow-2xl">
            <h2 className="text-lg font-bold text-foreground mb-2">¿Eliminar este sueño?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Vas a eliminar <strong>{confirmDelete.name}</strong>.
              {confirmDelete.fixed_expense_id && " También se desactivará la cuota mensual asociada."}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={() => deleteGoalMutation.mutate({ goalId: confirmDelete.id, fixedExpenseId: confirmDelete.fixed_expense_id })}>
                Sí, eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- MODALS ----

function DepositModal({ goal, onClose, onSave }: { goal: any; onClose: () => void; onSave: (a: number) => void }) {
  const [amount, setAmount] = useState("");
  const isEnganche = (goal.down_payment || 0) > 0;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 border border-border shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{isEnganche ? 'Abonar al enganche' : 'Abonar a tu meta'}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">¿Cuánto has apartado para <strong>{goal.name}</strong>?</p>
        <div className="relative mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00" autoFocus
            className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <Button className="w-full" onClick={() => onSave(parseFloat(amount) || 0)} disabled={!amount}>
          Sumar a mi ahorro ✨
        </Button>
      </div>
    </div>
  );
}

function GoalFormModal({ onClose, onSave, initialData }: { onClose: () => void; onSave: (g: any) => void; initialData?: any }) {
  const [name, setName] = useState(initialData?.name || "");
  const [type, setType] = useState(initialData?.type || "");
  const [totalAmount, setTotalAmount] = useState(initialData?.total_amount ? initialData.total_amount.toString() : "");
  const [hasDownPayment, setHasDownPayment] = useState(!!(initialData?.down_payment));
  const [downPayment, setDownPayment] = useState(initialData?.down_payment ? initialData.down_payment.toString() : "");
  const [hasMonthly, setHasMonthly] = useState(!!(initialData?.monthly_payment));
  const [monthlyPayment, setMonthlyPayment] = useState(initialData?.monthly_payment ? initialData.monthly_payment.toString() : "");
  const [installmentTotal, setInstallmentTotal] = useState(initialData?.installment_total ? initialData.installment_total.toString() : "");
  const [paymentDay, setPaymentDay] = useState(initialData?.payment_day ? initialData.payment_day.toString() : "");

  const isEdit = !!initialData;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">{isEdit ? 'Editar sueño' : 'Nuevo sueño'}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Nombre de tu meta</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Mi primer carro o Viaje a Europa" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Tipo</label>
            <div className="grid grid-cols-4 gap-2">
              {GOAL_TYPES.map((t) => (
                <button
                  key={t.id} onClick={() => setType(t.id)}
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
            <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="Ej: 85000" />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted p-3">
            <span className="text-sm font-medium text-foreground">¿Requiere enganche?</span>
            <Switch checked={hasDownPayment} onCheckedChange={setHasDownPayment} />
          </div>
          {hasDownPayment && <Input type="number" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} placeholder="Monto del enganche (Q)" />}

          <div className="flex items-center justify-between rounded-xl bg-muted p-3">
            <span className="text-sm font-medium text-foreground">¿Cuota mensual posterior?</span>
            <Switch checked={hasMonthly} onCheckedChange={setHasMonthly} />
          </div>
          {hasMonthly && (
            <div className="space-y-3 p-3 bg-accent/5 rounded-xl border border-accent/20">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Monto de la cuota (Q/mes)</label>
                <Input type="number" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} placeholder="Ej: 1200" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Número de cuotas</label>
                  <Input type="number" value={installmentTotal} onChange={(e) => setInstallmentTotal(e.target.value)} placeholder="Ej: 36" className="mt-1" min={1} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Día de pago (1-31)</label>
                  <Input type="number" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} placeholder="Ej: 15" className="mt-1" min={1} max={31} />
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={() => onSave({
              name, type,
              total_amount: parseFloat(totalAmount) || 0,
              down_payment: hasDownPayment ? parseFloat(downPayment) || 0 : 0,
              monthly_payment: hasMonthly ? parseFloat(monthlyPayment) || 0 : 0,
              installment_total: hasMonthly ? parseInt(installmentTotal) || 0 : 0,
              payment_day: hasMonthly ? parseInt(paymentDay) || null : null,
            })}
            className="w-full" size="lg"
            disabled={!name || !type || !totalAmount}
          >
            {isEdit ? 'Guardar cambios ✨' : 'Crear mi sueño ✨'}
          </Button>
        </div>
      </div>
    </div>
  );
}
