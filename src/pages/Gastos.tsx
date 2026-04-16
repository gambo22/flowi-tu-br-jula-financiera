import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { EXPENSE_CATEGORIES, formatQ } from "@/lib/constants";
import { cn } from "@/lib/utils";
import AddExpenseModal from "@/components/AddExpenseModal";
import { toast } from "sonner";

export default function Gastos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses").select("*").eq("user_id", user?.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
      toast.success("Gasto eliminado.");
    },
  });

  const upsertExpenseMutation = useMutation({
    mutationFn: async (expense: any) => {
      if (expense.id) {
        const { error } = await supabase.from("expenses").update({
          amount: expense.amount, category: expense.category,
          date: expense.date, note: expense.note,
          payment_method: expense.payment_method || 'efectivo',
        }).eq("id", expense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert({
          user_id: user?.id, amount: expense.amount, category: expense.category,
          date: expense.date, note: expense.note,
          payment_method: expense.payment_method || 'efectivo',
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
      setEditingExpense(null);
      toast.success(variables.id ? "Gasto actualizado." : "¡Gasto registrado!");
    },
  });

  const addFixedExpenseMutation = useMutation({
    mutationFn: async (exp: any) => {
      const { error } = await supabase.from("fixed_expenses").insert({
        user_id: user?.id, name: exp.name, category: exp.category,
        amount: exp.installment_amount, payment_day: exp.payment_day,
        payment_day_type: 'fixed', is_active: true,
        installment_total: exp.installment_total, installment_current: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed_expenses", user?.id] });
      toast.success("¡Cuota de tarjeta registrada! Aparece en Compromisos 💳");
    },
  });

  const filtered = useMemo(() => {
    const list = filter ? expenses.filter((e) => e.category === filter) : expenses;
    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, filter]);

  const totalAllMonth = useMemo(() => {
    const today = new Date();
    return expenses
      .filter(e => new Date(e.date).getMonth() === today.getMonth() && new Date(e.date).getFullYear() === today.getFullYear())
      .reduce((s, e) => s + (e.amount || 0), 0);
  }, [expenses]);

  const totalFiltered = useMemo(() => {
    const today = new Date();
    return filtered
      .filter(e => new Date(e.date).getMonth() === today.getMonth() && new Date(e.date).getFullYear() === today.getFullYear())
      .reduce((s, e) => s + (e.amount || 0), 0);
  }, [filtered]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: typeof filtered; total: number }>();
    filtered.forEach((exp) => {
      const d = new Date(exp.date);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });
      if (!map.has(key)) map.set(key, { key, label, items: [], total: 0 });
      const group = map.get(key)!;
      group.items.push(exp);
      group.total += exp.amount || 0;
    });
    return Array.from(map.values());
  }, [filtered]);

  const toggleDay = (key: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="animate-fade-in p-4 pb-24">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Gastos</h1>
        <button
          onClick={() => navigate("/analisis")}
          className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Ver análisis
        </button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {filter
          ? <>Filtrado: <span className="font-semibold text-foreground">{formatQ(totalFiltered)}</span> · Total mes: <span className="font-semibold">{formatQ(totalAllMonth)}</span></>
          : <>Total del mes: <span className="font-semibold text-foreground">{formatQ(totalAllMonth)}</span> <span className="text-xs opacity-60">(fijos + variables)</span></>
        }
      </p>

      {/* Category filters */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button
          onClick={() => setFilter(null)}
          className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
            !filter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          Todos
        </button>
        {EXPENSE_CATEGORIES.map((cat) => (
          <button key={cat.id}
            onClick={() => setFilter(filter === cat.id ? null : cat.id)}
            className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              filter === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {cat.label}
          </button>
        ))}
      </div>

      <p className="text-xs italic text-muted-foreground mb-3 font-medium">Pulsa sobre cualquier gasto para editar</p>

      {/* Expense list grouped by day — collapsible */}
      <div className="space-y-3">
        {grouped.map(({ key, label, items, total }) => {
          const isCollapsed = collapsedDays.has(key);
          return (
            <div key={key} className="rounded-2xl bg-card border border-border overflow-hidden">
              {/* Day header — tappable to collapse */}
              <button
                onClick={() => toggleDay(key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-xs font-semibold uppercase text-muted-foreground capitalize">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{formatQ(total)}</span>
                  {isCollapsed && (
                    <span className="text-xs text-muted-foreground">({items.length} gastos)</span>
                  )}
                </div>
              </button>

              {/* Items */}
              {!isCollapsed && (
                <div className="divide-y divide-border/50">
                  {items.map((exp) => {
                    const cat = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                    const Icon = cat?.icon;
                    return (
                      <div key={exp.id} className="relative">
                        <button
                          onClick={() => setEditingExpense(exp)}
                          className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors active:scale-[0.99]"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted flex-shrink-0">
                            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{exp.note || cat?.label}</p>
                            <p className="text-xs text-muted-foreground">{cat?.label}{exp.is_recurring ? " · Fijo" : ""}</p>
                          </div>
                          <span className="text-sm font-semibold text-foreground pr-8">{formatQ(exp.amount || 0)}</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteExpenseMutation.mutate(exp.id); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="mt-12 text-center rounded-2xl p-6 bg-primary/5">
          <p className="text-lg font-medium text-primary">¡Billetera reluciente!</p>
          <p className="text-sm text-muted-foreground mt-2">No hay gastos registrados con este filtro.</p>
        </div>
      )}

      <button
        onClick={() => { setEditingExpense(null); setShowAdd(true); }}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AddExpenseModal
        open={showAdd || !!editingExpense}
        initialData={editingExpense}
        onClose={() => { setShowAdd(false); setEditingExpense(null); }}
        onSave={(exp) => upsertExpenseMutation.mutate(exp)}
        onSaveFixed={(exp) => addFixedExpenseMutation.mutate(exp)}
      />
    </div>
  );
}
