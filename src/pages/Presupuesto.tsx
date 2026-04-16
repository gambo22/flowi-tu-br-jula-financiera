import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { EXPENSE_CATEGORIES, formatQ } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Edit2, X, Plus, AlertCircle, Settings, Trash2, CheckCircle,
  Clock, AlertTriangle, Lock, ShieldCheck, TrendingUp, ArrowDownCircle, ArrowUpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ConfirmModal from "@/components/ConfirmModal";

export default function Presupuesto() {
  const { profile, user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [lockingCat, setLockingCat] = useState<string | null>(null);
  const [addingLimit, setAddingLimit] = useState(false);
  const [editingIncome, setEditingIncome] = useState(false);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [showSavingsSetup, setShowSavingsSetup] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean; title: string; message: string;
    variant?: "default" | "destructive"; action: () => void;
  }>({ isOpen: false, title: "", message: "", action: () => {} });

  const today = new Date();

  const isLocked = (limitRow: any) => {
    if (!limitRow?.locked_until) return false;
    return new Date(limitRow.locked_until) > new Date();
  };

  const handleEditCategory = (catId: string) => {
    const limitRow = budgetLimits.find(bl => bl.category === catId);
    if (isLocked(limitRow)) {
      const until = new Date(limitRow.locked_until).toLocaleDateString('es-GT', { day: 'numeric', month: 'long' });
      toast.error(`🔒 Categoría bloqueada hasta el ${until}`);
      return;
    }
    setEditingCat(catId);
  };

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("user_id", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: budgetLimits = [] } = useQuery({
    queryKey: ["budgetLimits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("budget_limits").select("*").eq("user_id", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").eq("user_id", user?.id);
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

  const { data: fixedExpenses = [] } = useQuery({
    queryKey: ["fixed_expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("fixed_expenses").select("*").eq("user_id", user?.id).eq("is_active", true);
      if (error && error.code !== '42P01') throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: fixedPayments = [] } = useQuery({
    queryKey: ["fixed_payments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("fixed_expense_payments")
        .select("*").eq("user_id", user?.id)
        .eq("month", today.getMonth() + 1).eq("year", today.getFullYear());
      if (error && error.code !== '42P01') throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: savingsFund } = useQuery({
    queryKey: ["savings_fund", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("savings_fund").select("*").eq("user_id", user?.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: savingsMovements = [] } = useQuery({
    queryKey: ["savings_movements", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("savings_movements")
        .select("*").eq("user_id", user?.id)
        .order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // ---- Mutations ----
  const confirmPaymentMutation = useMutation({
    mutationFn: async (fixedExpense: any) => {
      const month = today.getMonth() + 1;
      const year = today.getFullYear();
      const { error: pError } = await supabase.from("fixed_expense_payments").insert({
        fixed_expense_id: fixedExpense.id, user_id: user?.id,
        amount_paid: fixedExpense.amount, payment_date: today.toISOString().split('T')[0],
        month, year, confirmed: true
      });
      if (pError) throw pError;
      const { error: eError } = await supabase.from("expenses").insert({
        user_id: user?.id, amount: fixedExpense.amount, category: fixedExpense.category,
        note: `Compromiso: ${fixedExpense.name}`, date: today.toISOString(), is_recurring: true
      });
      if (eError) throw eError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed_payments", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
      toast.success("Pago confirmado ✅");
    }
  });

  const updateIncomeMutation = useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await supabase.from("users").update({ monthly_income: amount }).eq("id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => { refreshProfile(); toast.success("Ingreso actualizado."); setEditingIncome(false); },
  });

  const upsertLimitMutation = useMutation({
    mutationFn: async ({ category, limitAmt }: { category: string; limitAmt: number }) => {
      const existing = budgetLimits.find(b => b.category === category);
      if (existing) {
        const { error } = await supabase.from("budget_limits").update({ monthly_limit: limitAmt }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budget_limits").insert({ user_id: user?.id, category, monthly_limit: limitAmt });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgetLimits", user?.id] });
      toast.success("Límite guardado.");
      setEditingCat(null); setAddingLimit(false);
    },
  });

  const deleteLimitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_limits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgetLimits", user?.id] });
      toast.success("Límite eliminado.");
    },
  });

  const lockCategoryMutation = useMutation({
    mutationFn: async ({ category, lockedUntil }: { category: string; lockedUntil: string }) => {
      const existing = budgetLimits.find(b => b.category === category);
      if (!existing) { toast.error('Primero agrega un tope.'); return; }
      const { error } = await supabase.from("budget_limits").update({ locked_until: lockedUntil }).eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgetLimits", user?.id] });
      toast.success("Categoría bloqueada 🔒"); setLockingCat(null);
    },
  });

  const savingsMovementMutation = useMutation({
    mutationFn: async ({ amount, type, note }: { amount: number; type: 'deposit' | 'withdrawal'; note?: string }) => {
      const newAmount = type === 'deposit'
        ? (savingsFund?.current_amount || 0) + amount
        : Math.max(0, (savingsFund?.current_amount || 0) - amount);

      if (savingsFund?.id) {
        const { error } = await supabase.from("savings_fund")
          .update({ current_amount: newAmount, updated_at: new Date().toISOString() })
          .eq("id", savingsFund.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("savings_fund")
          .insert({ user_id: user?.id, current_amount: newAmount, target_amount: 0, target_months: 3 });
        if (error) throw error;
      }
      const { error: mError } = await supabase.from("savings_movements").insert({
        user_id: user?.id, amount, type, note,
        month: today.getMonth() + 1, year: today.getFullYear()
      });
      if (mError) throw mError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_fund", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["savings_movements", user?.id] });
      toast.success("Movimiento registrado 💰");
      setShowSavingsModal(false);
    },
  });

  const savingsSetupMutation = useMutation({
    mutationFn: async ({ targetAmount, targetMonths }: { targetAmount: number; targetMonths: number }) => {
      if (savingsFund?.id) {
        const { error } = await supabase.from("savings_fund")
          .update({ target_amount: targetAmount, target_months: targetMonths, updated_at: new Date().toISOString() })
          .eq("id", savingsFund.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("savings_fund")
          .insert({ user_id: user?.id, current_amount: 0, target_amount: targetAmount, target_months: targetMonths });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_fund", user?.id] });
      toast.success("Meta de ahorro configurada ✅");
      setShowSavingsSetup(false);
    },
  });

  // ---- Calculations ----
  const monthlyIncome = profile?.monthly_income || 0;
  const hasIncomeConfigured = monthlyIncome > 0;

  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() && !e.is_recurring;
  });

  const totalSpent = useMemo(() => currentMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0), [currentMonthExpenses]);
  const goalsCommitted = useMemo(() => goals.filter((g: any) => g.phase !== 'completed').reduce((s: number, g: any) => s + (g.monthly_payment || 0), 0), [goals]);
  const totalDebtPayments = useMemo(() => debts.reduce((s: number, d: any) => s + (d.minimum_payment || 0), 0), [debts]);
  const totalFixed = fixedExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const available = monthlyIncome - totalFixed - goalsCommitted - totalDebtPayments - totalSpent;
  const freeToSpend = monthlyIncome - totalFixed - goalsCommitted - totalDebtPayments;

  // Savings fund calculations
  const savingsTarget = savingsFund?.target_amount || 0;
  const savingsCurrent = savingsFund?.current_amount || 0;
  const savingsMonths = savingsFund?.target_months || 3;
  const savingsPct = savingsTarget > 0 ? Math.min(Math.round((savingsCurrent / savingsTarget) * 100), 100) : 0;

  // Monthly target = remaining / months left
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const thisMonthDeposits = savingsMovements
    .filter((m: any) => m.type === 'deposit' && m.month === currentMonth && m.year === currentYear)
    .reduce((s: number, m: any) => s + (m.amount || 0), 0);

  // How much still needed for target
  const remaining = Math.max(savingsTarget - savingsCurrent, 0);
  // Months elapsed since fund created (approximate from movements)
  const monthlyTargetDeposit = savingsTarget > 0 && savingsMonths > 0
    ? Math.ceil(remaining / Math.max(savingsMonths - (savingsPct / 100 * savingsMonths), 1))
    : 0;

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + (e.amount || 0);
    });
    fixedExpenses.filter(f => f.is_active && (f.installment_total || 0) > 0).forEach(f => {
      map[f.category] = (map[f.category] || 0) + (f.amount || 0);
    });
    return map;
  }, [currentMonthExpenses, fixedExpenses]);

  const installmentCats = new Set(
    fixedExpenses.filter(f => f.is_active && (f.installment_total || 0) > 0).map(f => f.category)
  );

  const displayCategories = EXPENSE_CATEGORIES.filter(cat => {
    const hasLimit = budgetLimits.some(bl => bl.category === cat.id);
    const hasSpent = (spentByCategory[cat.id] || 0) > 0;
    const hasInstallment = installmentCats.has(cat.id);
    return hasLimit || hasSpent || hasInstallment;
  });

  return (
    <div className="animate-fade-in p-4 pb-24">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Presupuesto</h1>

      {!hasIncomeConfigured && (
        <button onClick={() => setEditingIncome(true)}
          className="mb-5 w-full flex items-center gap-3 rounded-2xl bg-primary/10 p-4 border border-primary/20 hover:bg-primary/15 transition-all text-left">
          <AlertCircle className="h-6 w-6 text-primary flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-primary">Configura tu ingreso base</h3>
            <p className="text-xs text-foreground mt-0.5">Sin esto, Flowi no puede calcular cuánto te queda disponible.</p>
          </div>
        </button>
      )}

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button onClick={() => setEditingIncome(true)}
          className="rounded-xl bg-card p-3 border border-border text-left hover:border-primary/50 transition-colors group relative">
          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-muted-foreground"><Edit2 size={12}/></div>
          <p className="text-xs text-muted-foreground">Ingreso</p>
          <p className="text-lg font-bold text-foreground">{formatQ(monthlyIncome)}</p>
        </button>
        <div className="rounded-xl bg-card p-3 border border-border">
          <p className="text-xs text-muted-foreground">Gastado este mes</p>
          <p className="text-lg font-bold text-foreground">{formatQ(totalSpent)}</p>
        </div>
        <div className="rounded-xl bg-card p-3 border border-border">
          <p className="text-xs text-muted-foreground">Cuotas sueños/mes</p>
          <p className="text-lg font-bold text-accent">{formatQ(goalsCommitted)}</p>
          {goalsCommitted > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">Suma de cuotas de tus metas</p>}
        </div>
        <div className={cn("rounded-xl p-3 border border-border", freeToSpend - totalSpent >= 0 ? "bg-primary/10" : "bg-destructive/10")}>
          <p className="text-xs text-muted-foreground">Para gastar aún</p>
          <p className={cn("text-lg font-bold", freeToSpend - totalSpent >= 0 ? "text-primary" : "text-destructive")}>
            {formatQ(Math.max(freeToSpend - totalSpent, 0))}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">de {formatQ(freeToSpend)} disponibles</p>
        </div>
      </div>

      {/* ---- FONDO DE EMERGENCIA ---- */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            Fondo de Emergencia / Ahorro
          </h3>
          <button onClick={() => setShowSavingsSetup(true)}
            className="text-xs text-primary font-bold hover:underline">
            {savingsFund ? "Editar meta" : "Configurar"}
          </button>
        </div>

        <div className="rounded-2xl bg-card border border-border p-4">
          {!savingsFund || savingsTarget === 0 ? (
            <div className="text-center py-3">
              <ShieldCheck className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">Sin meta configurada</p>
              <p className="text-xs text-muted-foreground mb-3">Configura cuánto quieres ahorrar y en cuánto tiempo. El hábito vale más que el monto.</p>
              <Button size="sm" variant="outline" onClick={() => setShowSavingsSetup(true)}>
                <Plus className="h-4 w-4 mr-1" /> Crear meta de ahorro
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Ahorrado</p>
                  <p className="text-2xl font-bold text-foreground">{formatQ(savingsCurrent)}</p>
                  {savingsTarget > 0 && (
                    <p className="text-xs text-muted-foreground">de {formatQ(savingsTarget)} · {savingsMonths} meses</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-green-500">{savingsPct}%</p>
                  {savingsPct >= 100 && <p className="text-xs text-green-500 font-semibold">¡Meta lograda! 🎉</p>}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-3 rounded-full bg-muted overflow-hidden mb-3">
                <div
                  className={cn("h-full rounded-full transition-all", savingsPct >= 100 ? "bg-green-500" : savingsPct >= 60 ? "bg-primary" : "bg-accent")}
                  style={{ width: `${savingsPct}%` }}
                />
              </div>

              {/* Monthly guidance */}
              {savingsTarget > savingsCurrent && monthlyTargetDeposit > 0 && (
                <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 mb-3 text-xs text-green-600">
                  <p className="font-semibold mb-0.5">
                    {thisMonthDeposits > 0
                      ? `✓ Este mes depositaste ${formatQ(thisMonthDeposits)}`
                      : `📅 Este mes, deposita aprox. ${formatQ(monthlyTargetDeposit)}`}
                  </p>
                  {remaining > 0 && (
                    <p className="opacity-80">
                      {thisMonthDeposits >= monthlyTargetDeposit
                        ? `¡Vas al día! Faltan ${formatQ(remaining)} para tu meta.`
                        : `Faltan ${formatQ(Math.max(monthlyTargetDeposit - thisMonthDeposits, 0))} para el objetivo de este mes.`}
                    </p>
                  )}
                </div>
              )}

              {/* Últimos movimientos */}
              {savingsMovements.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  <p className="text-xs font-semibold text-muted-foreground">Últimos movimientos</p>
                  {savingsMovements.slice(0, 3).map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        {m.type === 'deposit'
                          ? <ArrowDownCircle className="h-3.5 w-3.5 text-green-500" />
                          : <ArrowUpCircle className="h-3.5 w-3.5 text-destructive" />}
                        <span className="text-muted-foreground">{m.note || (m.type === 'deposit' ? 'Depósito' : 'Retiro')}</span>
                      </div>
                      <span className={cn("font-semibold", m.type === 'deposit' ? "text-green-500" : "text-destructive")}>
                        {m.type === 'deposit' ? '+' : '-'}{formatQ(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowSavingsModal(true)}
                  className="flex-1 rounded-xl bg-green-500/10 border border-green-500/20 py-2 text-xs font-semibold text-green-600 flex items-center justify-center gap-1.5 hover:bg-green-500/20 transition-colors">
                  <ArrowDownCircle className="h-3.5 w-3.5" /> Depositar
                </button>
                <button
                  onClick={() => setShowSavingsModal(true)}
                  className="flex-1 rounded-xl bg-destructive/10 border border-destructive/20 py-2 text-xs font-semibold text-destructive flex items-center justify-center gap-1.5 hover:bg-destructive/20 transition-colors"
                  data-type="withdrawal">
                  <ArrowUpCircle className="h-3.5 w-3.5" /> Retirar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Compromisos del Mes */}
      <div className="flex justify-between items-center mb-3 mt-2">
        <h3 className="text-sm font-semibold text-foreground">Compromisos del Mes ({fixedExpenses.length})</h3>
        <p className="text-xs text-muted-foreground italic">Gastos Fijos</p>
      </div>

      <div className="space-y-3 mb-8">
        {fixedExpenses.length === 0 ? (
          <div className="text-center rounded-2xl bg-card p-4 border border-border shadow-sm">
            <p className="text-xs text-muted-foreground">No tienes compromisos configurados.</p>
          </div>
        ) : (
          fixedExpenses.map(exp => {
            const isPaid = fixedPayments.some((p: any) => p.fixed_expense_id === exp.id && p.confirmed);
            const dayDist = exp.payment_day - today.getDate();
            let statusText = "Pendiente";
            let statusColor = "text-muted-foreground";
            let wrapperClass = "bg-card border-border";
            let IconStatus = Clock;
            if (isPaid) { statusText = "Confirmado"; statusColor = "text-green-500"; wrapperClass = "bg-green-500/10 border-green-500/20"; IconStatus = CheckCircle; }
            else if (dayDist < 0) { statusText = "Vencido"; statusColor = "text-destructive"; wrapperClass = "bg-destructive/10 border-destructive/20"; IconStatus = AlertTriangle; }
            else if (dayDist <= 3) { statusText = dayDist === 0 ? "Por pagar HOY" : `En ${dayDist} días`; statusColor = "text-warning"; wrapperClass = "bg-warning/10 border-warning/20"; IconStatus = AlertCircle; }

            return (
              <div key={exp.id} className={cn("rounded-xl p-4 border transition-all flex flex-col gap-3", wrapperClass)}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-foreground">{exp.name}</p>
                    <div className={cn("flex items-center gap-1 mt-1 text-xs font-semibold", statusColor)}>
                      <IconStatus className="h-3 w-3" />
                      <span>{statusText} (Día {exp.payment_day})</span>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-foreground">{formatQ(exp.amount)}</p>
                </div>
                {!isPaid && (
                  <Button size="sm" variant={dayDist <= 3 ? "default" : "secondary"} className="w-full text-xs font-bold"
                    onClick={() => setConfirmConfig({
                      isOpen: true,
                      title: `Pago: ${exp.name}`,
                      message: `¿Confirmar pago de ${formatQ(exp.amount)} para ${exp.name} este mes?`,
                      action: () => confirmPaymentMutation.mutate(exp)
                    })}>
                    Confirmar pago de este mes
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Tus Topes */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-foreground">Tus Topes (Variable)</h3>
        <p className="text-xs text-muted-foreground italic">Toca para editar</p>
      </div>

      {displayCategories.length === 0 ? (
        <div className="mt-8 mb-6 text-center rounded-2xl bg-card p-6 border border-border shadow-sm">
          <p className="text-sm font-medium text-foreground">Aún no has configurado tus topes</p>
          <p className="text-xs text-muted-foreground mt-2">Crear límites evitará que te pases en cada categoría.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {displayCategories.map((cat) => {
            const Icon = cat.icon;
            const limitRow = budgetLimits.find((bl) => bl.category === cat.id);
            const monthlyLimit = limitRow?.monthly_limit || 0;
            const spent = spentByCategory[cat.id] || 0;
            const pct = monthlyLimit > 0 ? Math.round((spent / monthlyLimit) * 100) : 0;
            const barColor = pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-primary";
            const locked = isLocked(limitRow);
            const lockedUntil = locked ? new Date(limitRow.locked_until).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' }) : null;

            return (
              <button key={cat.id} onClick={() => handleEditCategory(cat.id)}
                className="w-full text-left rounded-xl bg-card p-4 border border-border hover:shadow-md transition-all active:scale-[0.98]">
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">{formatQ(spent)} de {monthlyLimit > 0 ? formatQ(monthlyLimit) : "Sin tope"}</p>
                  </div>
                  {locked && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-semibold">
                      <Lock className="h-3 w-3" /><span>hasta {lockedUntil}</span>
                    </div>
                  )}
                  {!locked && limitRow?.id && (
                    <button onClick={(e) => { e.stopPropagation(); setLockingCat(cat.id); }}
                      className="p-1.5 text-muted-foreground hover:bg-orange-500/10 hover:text-orange-500 rounded-lg transition-colors">
                      <Lock className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {limitRow?.id && (
                    <button onClick={(e) => {
                      e.stopPropagation();
                      setConfirmConfig({ isOpen: true, title: "Eliminar límite", message: `¿Eliminar límite de ${cat.label}?`, variant: "destructive", action: () => deleteLimitMutation.mutate(limitRow.id) });
                    }} className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {monthlyLimit > 0 && (
                    <span className={cn("text-sm font-bold", pct > 90 ? "text-destructive" : pct > 70 ? "text-warning" : "text-primary")}>{pct}%</span>
                  )}
                </div>
                {monthlyLimit > 0 ? (
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                ) : (
                  <div className="h-2 rounded-full bg-muted/40 border border-dashed border-border" />
                )}
                {pct > 80 && monthlyLimit > 0 && <p className="mt-2 text-xs text-warning">⚠️ Ya llevas el {pct}% en {cat.label.toLowerCase()} este mes</p>}
                {installmentCats.has(cat.id) && <p className="mt-1 text-xs text-orange-500">💳 Incluye cuota mensual de tarjeta</p>}
              </button>
            );
          })}
        </div>
      )}

      <Button onClick={() => setAddingLimit(true)} className="w-full mt-2" variant="outline" size="lg">
        <Plus className="h-5 w-5 mr-1" /> Agregar nueva categoría a vigilar
      </Button>

      {/* Modals */}
      {lockingCat && (
        <LockCategoryModal
          categoryLabel={EXPENSE_CATEGORIES.find(c => c.id === lockingCat)?.label || lockingCat}
          onClose={() => setLockingCat(null)}
          onSave={(days) => {
            const until = new Date();
            until.setDate(until.getDate() + days);
            lockCategoryMutation.mutate({ category: lockingCat!, lockedUntil: until.toISOString() });
          }}
        />
      )}
      {editingIncome && (
        <EditIncomeModal initial={monthlyIncome} onClose={() => setEditingIncome(false)} onSave={(val) => updateIncomeMutation.mutate(val)} />
      )}
      {editingCat && (
        <EditLimitModal
          category={EXPENSE_CATEGORIES.find(c => c.id === editingCat)!}
          initialLimit={budgetLimits.find(bl => bl.category === editingCat)?.monthly_limit || 0}
          onClose={() => setEditingCat(null)}
          onSave={(val) => upsertLimitMutation.mutate({ category: editingCat, limitAmt: val })}
        />
      )}
      {addingLimit && (
        <AddCategoryLimitModal
          configuredCats={budgetLimits.map((b) => b.category)}
          onClose={() => setAddingLimit(false)}
          onSave={(category, limitAmt) => upsertLimitMutation.mutate({ category, limitAmt })}
        />
      )}
      {showSavingsSetup && (
        <SavingsSetupModal
          initial={savingsFund}
          monthlyIncome={monthlyIncome}
          fixedExpenses={fixedExpenses}
          onClose={() => setShowSavingsSetup(false)}
          onSave={(targetAmount, targetMonths) => savingsSetupMutation.mutate({ targetAmount, targetMonths })}
        />
      )}
      {showSavingsModal && (
        <SavingsMovementModal
          current={savingsCurrent}
          onClose={() => setShowSavingsModal(false)}
          onSave={(amount, type, note) => savingsMovementMutation.mutate({ amount, type, note })}
        />
      )}
      {confirmConfig.isOpen && (
        <ConfirmModal
          title={confirmConfig.title}
          message={confirmConfig.message}
          variant={confirmConfig.variant}
          onConfirm={() => { confirmConfig.action(); setConfirmConfig(c => ({ ...c, isOpen: false })); }}
          onCancel={() => setConfirmConfig(c => ({ ...c, isOpen: false }))}
        />
      )}
    </div>
  );
}

// ---- MODALS ----

function SavingsSetupModal({ initial, monthlyIncome, fixedExpenses, onClose, onSave }: {
  initial: any; monthlyIncome: number; fixedExpenses: any[];
  onClose: () => void; onSave: (target: number, months: number) => void;
}) {
  const totalFixed = fixedExpenses.reduce((s: number, f: any) => s + (f.amount || 0), 0);
  const suggested3x = totalFixed * 3;
  const [target, setTarget] = useState(initial?.target_amount ? initial.target_amount.toString() : suggested3x > 0 ? Math.round(suggested3x).toString() : "");
  const [months, setMonths] = useState(initial?.target_months ? initial.target_months.toString() : "3");

  const monthlyNeeded = target && months ? Math.ceil(parseFloat(target) / parseInt(months)) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" /> Meta de Emergencia
          </h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        {suggested3x > 0 && (
          <div className="mb-4 rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-600">
            <p className="font-semibold mb-0.5">💡 Sugerencia basada en tus gastos fijos</p>
            <p>3 meses de gastos fijos = <strong>{formatQ(suggested3x)}</strong> · Ideal para imprevistos.</p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Meta total (Q)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
              <input type="number" value={target} onChange={(e) => setTarget(e.target.value)}
                placeholder="Ej: 15000" autoFocus
                className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary outline-none" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">¿En cuántos meses?</label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 6, 12, 24].map(m => (
                <button key={m} onClick={() => setMonths(m.toString())}
                  className={cn("py-3 rounded-xl text-sm font-bold transition-all border-2",
                    months === m.toString() ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-transparent")}>
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {monthlyNeeded > 0 && (
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs text-primary">
              <p className="font-semibold">📅 Para lograr tu meta:</p>
              <p>Deposita aprox. <strong>{formatQ(monthlyNeeded)}/mes</strong></p>
              <p className="opacity-75 mt-0.5">Si un mes no llegas, no importa — el hábito ya es un logro.</p>
            </div>
          )}
        </div>

        <Button className="w-full" onClick={() => onSave(parseFloat(target) || 0, parseInt(months) || 3)}
          disabled={!target}>
          Guardar meta de ahorro ✅
        </Button>
      </div>
    </div>
  );
}

function SavingsMovementModal({ current, onClose, onSave }: {
  current: number;
  onClose: () => void;
  onSave: (amount: number, type: 'deposit' | 'withdrawal', note?: string) => void;
}) {
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Movimiento de ahorro</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">Saldo actual: <span className="font-bold text-foreground">{formatQ(current)}</span></p>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setType('deposit')}
            className={cn("flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
              type === 'deposit' ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
            <ArrowDownCircle className="h-4 w-4" /> Depositar
          </button>
          <button onClick={() => setType('withdrawal')}
            className={cn("flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
              type === 'withdrawal' ? "bg-destructive text-white" : "bg-muted text-muted-foreground")}>
            <ArrowUpCircle className="h-4 w-4" /> Retirar
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" autoFocus
              className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary outline-none" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={type === 'deposit' ? 'Nota (ej: Quincena de abril)' : 'Nota (ej: Emergencia médica)'}
            className="w-full rounded-xl bg-background border border-border py-3 px-4 text-sm text-foreground focus:border-primary outline-none" />
        </div>

        <Button className={cn("w-full", type === 'withdrawal' && "bg-destructive hover:bg-destructive/90")}
          onClick={() => onSave(parseFloat(amount) || 0, type, note || undefined)}
          disabled={!amount || parseFloat(amount) <= 0}>
          {type === 'deposit' ? 'Registrar depósito' : 'Registrar retiro'}
        </Button>
      </div>
    </div>
  );
}

function EditIncomeModal({ initial, onClose, onSave }: { initial: number; onClose: () => void; onSave: (v: number) => void }) {
  const [val, setVal] = useState(initial ? initial.toString() : "");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 border border-border shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Ingreso Promedio Mensual</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Tu salario neto o ingreso regular por mes</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
            <input type="number" value={val} onChange={(e) => setVal(e.target.value)} placeholder="0.00" autoFocus
              className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
          </div>
        </div>
        <Button className="w-full" onClick={() => onSave(parseFloat(val) || 0)} disabled={!val}>Guardar Monto</Button>
      </div>
    </div>
  );
}

function EditLimitModal({ category, initialLimit, onClose, onSave }: { category: any; initialLimit: number; onClose: () => void; onSave: (v: number) => void }) {
  const [val, setVal] = useState(initialLimit ? initialLimit.toString() : "");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 border border-border shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <category.icon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">{category.label}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="mb-6 text-left">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Límite mensual máximo permitido</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
            <input type="number" value={val} onChange={(e) => setVal(e.target.value)} placeholder="0 (Sin límite)" autoFocus
              className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
          </div>
        </div>
        <Button className="w-full" onClick={() => onSave(parseFloat(val) || 0)}>Guardar Tope Mensual</Button>
      </div>
    </div>
  );
}

function AddCategoryLimitModal({ configuredCats, onClose, onSave }: { configuredCats: string[]; onClose: () => void; onSave: (cat: string, limit: number) => void }) {
  const availableCats = EXPENSE_CATEGORIES.filter(c => !configuredCats.includes(c.id));
  const [selectedCat, setSelectedCat] = useState<string>(availableCats.length > 0 ? availableCats[0].id : "");
  const [limit, setLimit] = useState("");

  if (availableCats.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
        <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 text-center border border-border shadow-2xl">
          <Settings className="h-10 w-10 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground mb-2">Todo en tu radar</h2>
          <p className="text-sm text-muted-foreground mb-4">Ya configuraste límites en todas las categorías disponibles.</p>
          <Button className="w-full" onClick={onClose}>Volver</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 border border-border shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Agregar Límite</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-4 mb-6">
          <div className="text-left">
            <label className="mb-2 block text-sm font-medium text-muted-foreground">¿Qué rubro quieres limitar?</label>
            <Select value={selectedCat} onValueChange={setSelectedCat}>
              <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
              <SelectContent className="max-h-[300px] z-[70]">
                {availableCats.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-left">
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Tope máximo mensual (Q)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
              <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Ej. 1500"
                className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary outline-none" />
            </div>
          </div>
        </div>
        <Button className="w-full" onClick={() => onSave(selectedCat, parseFloat(limit) || 0)} disabled={!limit || !selectedCat}>Confirmar Límite</Button>
      </div>
    </div>
  );
}

function LockCategoryModal({ categoryLabel, onClose, onSave }: { categoryLabel: string; onClose: () => void; onSave: (days: number) => void }) {
  const [days, setDays] = useState(30);
  const until = new Date();
  until.setDate(until.getDate() + days);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 border border-border shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Lock className="h-5 w-5 text-orange-500" /> Bloquear categoría</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Bloquea <strong>{categoryLabel}</strong> para no poder modificar el límite durante un tiempo.</p>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${days === d ? 'bg-orange-500 text-white border-orange-500' : 'bg-muted text-muted-foreground border-transparent'}`}>
              {d} días
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mb-4">Bloqueada hasta el {until.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => onSave(days)}>🔒 Confirmar bloqueo</Button>
      </div>
    </div>
  );
}
