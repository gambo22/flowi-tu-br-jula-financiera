import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { EXPENSE_CATEGORIES, formatQ } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function Presupuesto() {
  const { profile, user } = useAuth();
  
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

  return (
    <div className="animate-fade-in p-4 pb-24">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Presupuesto</h1>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card p-3 border border-border">
          <p className="text-xs text-muted-foreground">Ingreso</p>
          <p className="text-lg font-bold text-foreground">{formatQ(monthlyIncome)}</p>
        </div>
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

      {/* Category budget list */}
      {budgetLimits.length === 0 ? (
        <div className="mt-8 text-center rounded-2xl bg-card p-6 border border-border shadow-sm">
          <p className="text-sm font-medium text-foreground">Aún no has configurado tus topes</p>
          <p className="text-xs text-muted-foreground mt-2">Crear límites mensuales en categorías como "Comida" o "Transporte" evitará que te pases. Configúralo en la ventana de Ajustes pronto y retoma el control.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgetLimits.map((bl) => {
            const cat = EXPENSE_CATEGORIES.find((c) => c.id === bl.category);
            const Icon = cat?.icon;
            const spent = spentByCategory[bl.category] || 0;
            const pct = bl.monthly_limit > 0 ? Math.round((spent / bl.monthly_limit) * 100) : 0;
            const barColor = pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-primary";

            return (
              <div key={bl.id} className="rounded-xl bg-card p-4 border border-border">
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{cat?.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatQ(spent)} de {formatQ(bl.monthly_limit)}
                    </p>
                  </div>
                  <span className={cn("text-sm font-bold", pct > 90 ? "text-destructive" : pct > 70 ? "text-warning" : "text-primary")}>
                    {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                {pct > 80 && (
                  <p className="mt-2 text-xs text-warning">
                    ⚠️ Ya llevas el {pct}% en {cat?.label?.toLowerCase()} este mes
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
