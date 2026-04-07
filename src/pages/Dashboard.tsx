import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, TrendingUp, Lightbulb, Landmark, CreditCard, Banknote } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EXPENSE_CATEGORIES, INSIGHTS, formatQ } from "@/lib/constants";
import AddExpenseModal from "@/components/AddExpenseModal";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calculatePaymentDate, getPaymentDistanceText } from "@/lib/dateUtils";

export default function Dashboard() {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  const userName = profile?.name ?? "Tú";
  const monthlyIncome = profile?.income_this_month !== null && profile?.income_this_month !== undefined 
                           ? profile?.income_this_month 
                           : profile?.monthly_income ?? 0;
  
  const rawCash = profile?.cash_on_hand || 0;

  // Real data fetching
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

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user?.id);
      // Suppress error if table isn't fully read early, though it should be assuming user ran SQL
      if (error) {
        if(error.code === '42703') return []; // Fallback silently for dev stages
        throw error;
      }
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Derived calculations
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  const currentMonthExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date);
    return expenseDate.getMonth() === today.getMonth() && expenseDate.getFullYear() === today.getFullYear();
  });

  const totalSpent = currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const accountsTotal = accounts.reduce((sum: number, acc: any) => sum + (Number(acc.balance) || 0), 0);

  // Patrimonio total líquido (Accounts + Cash) (Without assuming future salary actually in hands)
  // But user stated: "Cuentas registradas + Efectivo + lo que viene de nómina" for available money maybe? 
  // Wait, let's keep it safe: Liquid = Cash + Banco.
  const liquidWealth = rawCash + accountsTotal;
  // Available budget this month = Total Liquid + Income - Spent.
  const available = (monthlyIncome + liquidWealth) - totalSpent; 

  const budgetPercent = monthlyIncome > 0 ? Math.round((totalSpent / monthlyIncome) * 100) : 0;
  const timePercent = Math.round((dayOfMonth / daysInMonth) * 100);

  const insight = INSIGHTS[today.getDate() % INSIGHTS.length];
  const recentExpenses = expenses.slice(0, 3);
  const activeGoal = goals.length > 0 ? goals[0] : null;

  const dateStr = today.toLocaleDateString("es-GT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (expense: any) => {
      const { data, error } = await supabase.from("expenses").insert({
        user_id: user?.id,
        amount: expense.amount, category: expense.category, date: expense.date, note: expense.note, is_recurring: expense.is_recurring,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.id] });
    },
  });

  // Payday Logic
  let paymentText = "";
  if (profile?.income_frequency === 'monthly') {
     const pDate = calculatePaymentDate(profile?.payment_day_type || 'last_business_day', today, profile?.payment_day_1);
     paymentText = getPaymentDistanceText(pDate);
  } else if (profile?.income_frequency === 'biweekly') {
     // Check which payday is next. If today is <= 15, then use 15. If > 15, then use end of month.
     const rule = profile?.payment_day_type || 'last_business_day_15_30';
     let target1; let target2;
     if (rule === 'fixed_days') {
        target1 = calculatePaymentDate('fixed_day', today, profile?.payment_day_1);
        target2 = calculatePaymentDate('fixed_day', today, profile?.payment_day_2);
     } else {
        target1 = calculatePaymentDate('last_business_day_15', today);
        target2 = calculatePaymentDate('last_business_day_of_month', today);
     }

     if (today.getTime() <= target1.getTime()) {
         paymentText = getPaymentDistanceText(target1);
     } else if (today.getTime() <= target2.getTime()) {
         paymentText = getPaymentDistanceText(target2);
     } else {
         // Next month's 1st payment
         const nextM = new Date(today.getFullYear(), today.getMonth()+1, 1);
         const n1 = rule === 'fixed_days' ? calculatePaymentDate('fixed_day', nextM, profile?.payment_day_1) : calculatePaymentDate('last_business_day_15', nextM);
         paymentText = getPaymentDistanceText(n1);
     }
  }

  return (
    <div className="animate-fade-in space-y-5 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hola, {userName} 👋</h1>
          <p className="text-sm capitalize text-muted-foreground">{dateStr}</p>
        </div>
        <Link to="/perfil" className="h-12 w-12 flex items-center justify-center rounded-full bg-primary/10 text-primary transition-transform hover:scale-105 border border-primary/20 shadow-sm relative">
           <span className="font-bold text-lg">{userName.charAt(0).toUpperCase()}</span>
           {liquidWealth === 0 && <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 animate-pulse border-2 border-background"></span>}
        </Link>
      </div>

      {paymentText && (
        <div className="bg-accent/15 text-accent font-semibold px-3 py-1.5 rounded-full text-xs flex items-center gap-2 border border-accent/20 w-fit">
           <Landmark className="h-3.5 w-3.5" />
           {paymentText}
        </div>
      )}

      {/* Available money card (Patrimonio) */}
      <div className={`rounded-3xl p-6 relative overflow-hidden ${available >= 0 ? "bg-primary" : "bg-destructive"} text-primary-foreground`}>
        <div className="absolute right-[-10%] top-[-10%] opacity-10">
           <Banknote className="h-32 w-32" />
        </div>
        <div className="relative z-10">
          <p className="mb-1 text-sm font-medium opacity-90">Patrimonio Líquido Total</p>
          <p className="text-3xl font-bold tracking-tight">{formatQ(available)}</p>
          <div className="mt-4 flex bg-primary-foreground/10 rounded-xl p-3 items-center justify-between text-xs font-medium">
            <div className="flex flex-col">
               <span className="opacity-75">Bancos + Efectivo</span>
               <span>{formatQ(liquidWealth)}</span>
            </div>
            <div className="flex flex-col text-right">
               <span className="opacity-75">Ingreso Flujo</span>
               <span>{formatQ(monthlyIncome)}</span>
            </div>
          </div>
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
        <div className="flex justify-between items-center mt-1">
           <p className="text-xs text-muted-foreground">
             Gastado: <span className="font-semibold text-foreground">{formatQ(totalSpent)}</span>
           </p>
           <p className="text-xs font-bold">{budgetPercent}%</p>
        </div>
      </div>

      {/* Recent expenses */}
      <div className="rounded-2xl bg-card p-4 shadow-sm border border-border">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Últimos gastos</h3>
        </div>
        
        {recentExpenses.length === 0 ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <TrendingUp className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">¡Todo en orden, jefe!</p>
            <p className="text-xs text-muted-foreground mt-1">Aún no has registrado gastos recientemente.</p>
          </div>
        ) : (
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
                  <span className="text-sm font-semibold text-foreground">{formatQ(exp.amount || 0)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
        onSave={async (exp) => {
          await addExpenseMutation.mutateAsync(exp);
        }}
      />
    </div>
  );
}
