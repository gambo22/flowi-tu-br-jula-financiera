import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { EXPENSE_CATEGORIES, formatQ } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Edit2, X, Plus, AlertCircle, Settings, Trash2, CheckCircle, Clock, AlertTriangle, Lock } from "lucide-react";
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
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, variant?: "default" | "destructive", action: () => void}>({isOpen: false, title: "", message: "", action: () => {}});

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
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: budgetLimits = [] } = useQuery({
    queryKey: ["budgetLimits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_limits")
        .select("*")
        .eq("user_id", user?.id);
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
        .eq("user_id", user?.id);
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
      // Current month roughly
      const today = new Date();
      const { data, error } = await supabase.from("fixed_expense_payments")
         .select("*")
         .eq("user_id", user?.id)
         .eq("month", today.getMonth() + 1)
         .eq("year", today.getFullYear());
      if (error && error.code !== '42P01') throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (fixedExpense: any) => {
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();
      
      const { error: pError } = await supabase.from("fixed_expense_payments").insert({
        fixed_expense_id: fixedExpense.id,
        user_id: user?.id,
        amount_paid: fixedExpense.amount,
        payment_date: today.toISOString().split('T')[0],
        month,
        year,
        confirmed: true
      });
      if (pError) throw pError;

      const { error: eError } = await supabase.from("expenses").insert({
         user_id: user?.id,
         amount: fixedExpense.amount,
         category: fixedExpense.category,
         note: `Compromiso: ${fixedExpense.name}`,
         date: today.toISOString(),
         is_recurring: true
      });
      if (eError) throw eError;
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["fixed_payments", user?.id] });
       queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
       toast.success("Pago confirmado");
    }
  });

  const updateIncomeMutation = useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await supabase
        .from("users")
        .update({ monthly_income: amount })
        .eq("id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshProfile();
      toast.success("Ingreso actualizado exitosamente.");
      setEditingIncome(false);
    },
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
      toast.success("Límite guardado correctamente.");
      setEditingCat(null);
      setAddingLimit(false);
    },
  });

  const deleteLimitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_limits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgetLimits", user?.id] });
      toast.success("Límite eliminado correctamente.");
    },
  });

  const lockCategoryMutation = useMutation({
    mutationFn: async ({ category, lockedUntil }: { category: string; lockedUntil: string }) => {
      const existing = budgetLimits.find(b => b.category === category);
      if (!existing) { toast.error('Primero agrega un tope a esta categoría.'); return; }
      const { error } = await supabase.from("budget_limits").update({ locked_until: lockedUntil }).eq("id", existing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgetLimits", user?.id] });
      toast.success("Categoría bloqueada 🔒");
      setLockingCat(null);
    },
  });

  const monthlyIncome = profile?.monthly_income || 0;
  const hasIncomeConfigured = monthlyIncome > 0;

  // Calculamos solo en base al mes actual
  const today = new Date();
  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() && !e.is_recurring;
  });

  const totalSpent = useMemo(() => currentMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0), [currentMonthExpenses]);
  const goalsCommitted = useMemo(() => goals.reduce((s, g) => s + (g.monthly_payment || 0), 0), [goals]);
  const totalDebtPayments = useMemo(() => debts.reduce((s: number, d: any) => s + (d.minimum_payment || 0), 0), [debts]);
  const available = monthlyIncome - totalSpent - goalsCommitted - totalDebtPayments;

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + (e.amount || 0);
    });
    // Include active installment cuotas (credit card monthly payments)
    fixedExpenses
      .filter(f => f.is_active && (f.installment_total || 0) > 0)
      .forEach(f => {
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
        <button 
          onClick={() => setEditingIncome(true)}
          className="mb-5 w-full flex items-center gap-3 rounded-2xl bg-primary/10 p-4 border border-primary/20 hover:bg-primary/15 transition-all text-left"
        >
          <AlertCircle className="h-6 w-6 text-primary flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-primary">Configura tu ingreso base</h3>
            <p className="text-xs text-foreground mt-0.5">Sin esto, Flowi no puede calcular cuánto te queda disponible ni orientarte con tus deudas.</p>
          </div>
        </button>
      )}

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button 
          onClick={() => setEditingIncome(true)}
          className="rounded-xl bg-card p-3 border border-border text-left hover:border-primary/50 transition-colors group relative"
        >
          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-muted-foreground"><Edit2 size={12}/></div>
          <p className="text-xs text-muted-foreground">Ingreso</p>
          <p className="text-lg font-bold text-foreground">{formatQ(monthlyIncome)}</p>
        </button>
        <div className="rounded-xl bg-card p-3 border border-border">
          <p className="text-xs text-muted-foreground">Gastado este mes</p>
          <p className="text-lg font-bold text-foreground">{formatQ(totalSpent)}</p>
        </div>
        <div className="rounded-xl bg-card p-3 border border-border">
          <p className="text-xs text-muted-foreground">Cuotas de sueños/mes</p>
          <p className="text-lg font-bold text-accent">{formatQ(goalsCommitted)}</p>
          {goalsCommitted > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Suma de cuotas mensuales de tus metas
            </p>
          )}
        </div>
        <div className={cn("rounded-xl p-3 border border-border", (available >= 0 || !hasIncomeConfigured) ? "bg-primary/10" : "bg-destructive/10")}>
          <p className="text-xs text-muted-foreground">Disponible real</p>
          <p className={cn("text-lg font-bold", available >= 0 ? "text-primary" : "text-destructive")}>
            {formatQ(available)}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-3 mt-6">
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
            const currentDay = today.getDate();
            const dayDist = exp.payment_day - currentDay;
            
            let statusText = "Pendiente";
            let statusColor = "text-muted-foreground";
            let wrapperClass = "bg-card border-border";
            let IconStatus = Clock;

            if (isPaid) {
               statusText = "Confirmado";
               statusColor = "text-green-500";
               wrapperClass = "bg-green-500/10 border-green-500/20";
               IconStatus = CheckCircle;
            } else if (dayDist < 0) {
               statusText = "Vencido";
               statusColor = "text-destructive";
               wrapperClass = "bg-destructive/10 border-destructive/20";
               IconStatus = AlertTriangle;
            } else if (dayDist <= 3) {
               statusText = dayDist === 0 ? "Por pagar HOY" : `En ${dayDist} días`;
               statusColor = "text-warning";
               wrapperClass = "bg-warning/10 border-warning/20";
               IconStatus = AlertCircle;
            }

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
                   <Button size="sm" variant={dayDist <= 3 ? "default" : "secondary"} className="w-full text-xs font-bold" onClick={() => {
                      setConfirmConfig({
                        isOpen: true,
                        title: "Confirmar pago",
                        message: `¿Confirmar pago de ${formatQ(exp.amount)} para ${exp.name}?`,
                        action: () => confirmPaymentMutation.mutate(exp)
                      });
                   }}>
                      Confirmar el Pago de este mes
                   </Button>
                 )}
              </div>
            )
          })
        )}
      </div>

      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-foreground">Tus Topes (Variable)</h3>
        <p className="text-xs text-muted-foreground italic">Toca para editar</p>
      </div>

      {/* Category budget list */}
      {displayCategories.length === 0 ? (
        <div className="mt-8 mb-6 text-center rounded-2xl bg-card p-6 border border-border shadow-sm">
          <p className="text-sm font-medium text-foreground">Aún no has configurado tus topes</p>
          <p className="text-xs text-muted-foreground mt-2">Crear límites mensuales en categorías como "Comida" o "Transporte" evitará que te pases o gastes de más.</p>
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
              <button
                key={cat.id}
                onClick={() => handleEditCategory(cat.id)}
                className="w-full text-left rounded-xl bg-card p-4 border border-border hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatQ(spent)} de {monthlyLimit > 0 ? formatQ(monthlyLimit) : "Sin tope"}
                    </p>
                  </div>
                  {locked && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-semibold">
                      <Lock className="h-3 w-3" />
                      <span>hasta {lockedUntil}</span>
                    </div>
                  )}
                  {!locked && limitRow?.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setLockingCat(cat.id); }}
                      className="p-1.5 text-muted-foreground hover:bg-orange-500/10 hover:text-orange-500 rounded-lg transition-colors"
                      title="Bloquear categoría"
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {limitRow?.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmConfig({
                          isOpen: true,
                          title: "Eliminar límite",
                          message: `¿Eliminar límite de ${cat.label}?`,
                          variant: "destructive",
                          action: () => deleteLimitMutation.mutate(limitRow.id)
                        });
                      }}
                      className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                    >
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
                {pct > 80 && monthlyLimit > 0 && (
                  <p className="mt-2 text-xs text-warning">⚠️ Ya llevas el {pct}% en {cat.label.toLowerCase()} este mes</p>
                )}
                {installmentCats.has(cat.id) && (
                  <p className="mt-1 text-xs text-orange-500">💳 Incluye cuota mensual de tarjeta</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Agregar Nueva Categoría Independiente al Flujo */}
      <Button 
        onClick={() => setAddingLimit(true)} 
        className="w-full mt-2" 
        variant="outline" 
        size="lg"
      >
        <Plus className="h-5 w-5 mr-1" />
        Agregar nueva categoría a vigilar
      </Button>

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

      {/* Income Modal */}
      {editingIncome && (
        <EditIncomeModal
          initial={monthlyIncome}
          onClose={() => setEditingIncome(false)}
          onSave={(val) => updateIncomeMutation.mutate(val)}
        />
      )}

      {/* Edit Existing Limit Modal */}
      {editingCat && (
        <EditLimitModal 
          category={EXPENSE_CATEGORIES.find(c => c.id === editingCat)!}
          initialLimit={budgetLimits.find(bl => bl.category === editingCat)?.monthly_limit || 0}
          onClose={() => setEditingCat(null)}
          onSave={(val) => upsertLimitMutation.mutate({ category: editingCat, limitAmt: val })}
        />
      )}

      {/* Add New Limit Modal */}
      {addingLimit && (
        <AddCategoryLimitModal 
          configuredCats={budgetLimits.map((b) => b.category)}
          onClose={() => setAddingLimit(false)}
          onSave={(category, limitAmt) => upsertLimitMutation.mutate({ category, limitAmt })}
        />
      )}
    </div>
  );
}

// ------------------------------------ MODALS ------------------------------------ //

function EditIncomeModal({ initial, onClose, onSave }: { initial: number, onClose: () => void, onSave: (v: number) => void }) {
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
            <input
              type="number"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              autoFocus
            />
          </div>
        </div>
        <Button className="w-full" onClick={() => onSave(parseFloat(val) || 0)} disabled={!val}>Guardar Monto</Button>
      </div>
    </div>
  )
}

function EditLimitModal({ category, initialLimit, onClose, onSave }: { category: any, initialLimit: number, onClose: () => void, onSave: (v: number) => void }) {
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
            <input
              type="number"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="0 (Sin límite)"
              className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              autoFocus
            />
          </div>
        </div>
        <Button className="w-full" onClick={() => onSave(parseFloat(val) || 0)}>Guardar Tope Mensual</Button>
      </div>
    </div>
  )
}

function AddCategoryLimitModal({ configuredCats, onClose, onSave }: { configuredCats: string[], onClose: () => void, onSave: (cat: string, limit: number) => void }) {
  const availableCats = EXPENSE_CATEGORIES.filter(c => !configuredCats.includes(c.id));
  const [selectedCat, setSelectedCat] = useState<string>(availableCats.length > 0 ? availableCats[0].id : "");
  const [limit, setLimit] = useState("");

  if (availableCats.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
        <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 text-center border border-border shadow-2xl">
          <Settings className="h-10 w-10 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground mb-2">Todo en tu radar</h2>
          <p className="text-sm text-muted-foreground mb-4">Parece que ya has puesto un techo (límite) a todas las categorías que Flowi ofrece de fábrica.</p>
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
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una cateogría" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] z-[70]">
                {availableCats.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-left">
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Tope recomendado o meta máxima a gastar (Q)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="Ex. 1500"
                className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
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
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${days === d ? 'bg-orange-500 text-white border-orange-500' : 'bg-muted text-muted-foreground border-transparent'}`}
            >
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
