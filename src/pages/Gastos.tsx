import { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  const [filter, setFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

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

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
      toast.success("Gasto eliminado exitosamente.");
    },
  });

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
      toast.success("¡Gasto registrado con éxito!");
    },
  });

  const filtered = useMemo(() => {
    const list = filter ? expenses.filter((e) => e.category === filter) : expenses;
    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, filter]);

  // Use the current month's total for the "Total del mes" text
  const total = useMemo(() => {
    const today = new Date();
    return filtered
      .filter(e => new Date(e.date).getMonth() === today.getMonth() && new Date(e.date).getFullYear() === today.getFullYear())
      .reduce((s, e) => s + (e.amount || 0), 0);
  }, [filtered]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((exp) => {
      const key = new Date(exp.date).toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(exp);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="animate-fade-in p-4 pb-24">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Gastos</h1>
      <p className="mb-4 text-sm text-muted-foreground">Total del mes: <span className="font-semibold text-foreground">{formatQ(total)}</span></p>

      {/* Category filters */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button
          onClick={() => setFilter(null)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
            !filter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          Todos
        </button>
        {EXPENSE_CATEGORIES.slice(0, 8).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilter(filter === cat.id ? null : cat.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              filter === cat.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Expense list grouped by day */}
      <div className="space-y-5">
        {grouped.map(([day, items]) => (
          <div key={day}>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground capitalize">{day}</p>
            <div className="space-y-2">
              {items.map((exp) => {
                const cat = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                const Icon = cat?.icon;
                return (
                  <div key={exp.id} className="flex items-center gap-3 rounded-xl bg-card p-3 border border-border">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{exp.note || cat?.label}</p>
                      <p className="text-xs text-muted-foreground">{cat?.label}{exp.is_recurring ? " • Fijo" : ""}</p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{formatQ(exp.amount || 0)}</span>
                    <button
                      onClick={() => deleteExpenseMutation.mutate(exp.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-12 text-center rounded-2xl p-6 bg-primary/5">
          <p className="text-lg font-medium text-foreground text-primary">¡Billetera reluciente!</p>
          <p className="text-sm text-muted-foreground mt-2">No hay gastos registrados con este filtro.</p>
          <p className="text-sm text-muted-foreground mt-1">Lleva el control total de tus fugas de dinero registrando todos tus movimientos diarios de Flowi. 💪</p>
        </div>
      )}

      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AddExpenseModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={(exp) => addExpenseMutation.mutate(exp)}
      />
    </div>
  );
}
