import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { EXPENSE_CATEGORIES, formatQ } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Edit2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Presupuesto() {
  const { profile, user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingIncome, setEditingIncome] = useState(false);

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
      toast.success("Salario actualizado exitosamente.");
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
      toast.success("Límite actualizado.");
      setEditingCat(null);
    },
  });

  const monthlyIncome = profile?.monthly_income || 0;

  // Calculamos solo base al mes actual
  const today = new Date();
  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  const totalSpent = useMemo(() => currentMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0), [currentMonthExpenses]);
  const goalsCommitted = useMemo(() => goals.reduce((s, g) => s + (g.monthly_payment || 0), 0), [goals]);
  const available = monthlyIncome - totalSpent - goalsCommitted;

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + (e.amount || 0);
    });
    return map;
  }, [currentMonthExpenses]);

  // Active limits mixed with all available categories to allow user picking
  const displayCategories = EXPENSE_CATEGORIES.filter(cat => {
    const hasLimit = budgetLimits.some(bl => bl.category === cat.id);
    const hasSpent = (spentByCategory[cat.id] || 0) > 0;
    return hasLimit || hasSpent;
  });

  return (
    <div className="animate-fade-in p-4 pb-24">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Presupuesto</h1>

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
          <p className="text-xs text-muted-foreground">En metas a futuro</p>
          <p className="text-lg font-bold text-accent">{formatQ(goalsCommitted)}</p>
        </div>
        <div className={cn("rounded-xl p-3 border border-border", available >= 0 ? "bg-primary/10" : "bg-destructive/10")}>
          <p className="text-xs text-muted-foreground">Disponible hoy</p>
          <p className={cn("text-lg font-bold", available >= 0 ? "text-primary" : "text-destructive")}>
            {formatQ(available)}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-foreground">Topes Categorizados</h3>
        <p className="text-xs text-muted-foreground italic">Toca una categoría para editarla</p>
      </div>

      {/* Category budget list */}
      {displayCategories.length === 0 ? (
        <div className="mt-8 text-center rounded-2xl bg-card p-6 border border-border shadow-sm">
          <p className="text-sm font-medium text-foreground">Aún no has configurado tus topes</p>
          <p className="text-xs text-muted-foreground mt-2">Crear límites mensuales en categorías como "Comida" o "Transporte" evitará que te pases. Registra un gasto o toca "Añadir Categoría" pronto y retoma el control.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayCategories.map((cat) => {
            const Icon = cat.icon;
            const limitRow = budgetLimits.find((bl) => bl.category === cat.id);
            const monthlyLimit = limitRow?.monthly_limit || 0;
            const spent = spentByCategory[cat.id] || 0;
            const pct = monthlyLimit > 0 ? Math.round((spent / monthlyLimit) * 100) : 0;
            const barColor = pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-primary";

            return (
              <button 
                key={cat.id} 
                onClick={() => setEditingCat(cat.id)}
                className="w-full text-left rounded-xl bg-card p-4 border border-border hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatQ(spent)} de {monthlyLimit > 0 ? formatQ(monthlyLimit) : "Ilimitado"}
                    </p>
                  </div>
                  {monthlyLimit > 0 && (
                    <span className={cn("text-sm font-bold", pct > 90 ? "text-destructive" : pct > 70 ? "text-warning" : "text-primary")}>
                      {pct}%
                    </span>
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
                  <p className="mt-2 text-xs text-warning">
                    ⚠️ Ya llevas el {pct}% en {cat.label.toLowerCase()} este mes
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Income Modal */}
      {editingIncome && (
        <EditIncomeModal 
          initial={monthlyIncome} 
          onClose={() => setEditingIncome(false)} 
          onSave={(val) => updateIncomeMutation.mutate(val)} 
        />
      )}

      {/* Limit Modal */}
      {editingCat && (
        <EditLimitModal 
          category={EXPENSE_CATEGORIES.find(c => c.id === editingCat)!}
          initialLimit={budgetLimits.find(bl => bl.category === editingCat)?.monthly_limit || 0}
          onClose={() => setEditingCat(null)}
          onSave={(val) => upsertLimitMutation.mutate({ category: editingCat, limitAmt: val })}
        />
      )}
    </div>
  );
}

function EditIncomeModal({ initial, onClose, onSave }: { initial: number, onClose: () => void, onSave: (v: number) => void }) {
  const [val, setVal] = useState(initial.toString());
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 border border-border shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Editar Ingreso Promedio</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Tu salario o ingreso esperado mensual</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
            <input
              type="number"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              autoFocus
            />
          </div>
        </div>
        <Button className="w-full" onClick={() => onSave(parseFloat(val) || 0)} disabled={!val}>Guardar Ingreso</Button>
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
        <div className="mb-6">
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
