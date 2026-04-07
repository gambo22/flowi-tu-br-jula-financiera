import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatQ, EXPENSE_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChevronLeft, LogOut, Wallet, ShieldCheck, User2, Plus, Trash2, Edit2, Calculator, DollarSign } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import AddExpenseModal from "@/components/AddExpenseModal"; // Usaré este componente híbrido que hicimos

export default function Perfil() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingField, setEditingField] = useState<string | null>(null);

  // Profile data forms
  const [name, setName] = useState(profile?.name || "");
  const [incomeType, setIncomeType] = useState(profile?.income_type || "fixed");
  const [monthlyIncome, setMonthlyIncome] = useState(profile?.monthly_income?.toString() || "0");

  // Expenses management (Fijos / Recurring)
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  // Queries for Recurring Expenses
  const { data: recurringExpenses = [] } = useQuery({
    queryKey: ["recurring_expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user?.id)
        .eq("is_recurring", true)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from("users").update(updates).eq("id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshProfile();
      toast.success("Perfil actualizado");
      setEditingField(null);
    },
  });

  const upsertExpenseMutation = useMutation({
    mutationFn: async (expense: any) => {
      if (expense.id) {
        const { error } = await supabase.from("expenses").update({
          amount: expense.amount, category: expense.category, note: expense.note, date: expense.date, is_recurring: true
        }).eq("id", expense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert({
          user_id: user?.id, amount: expense.amount, category: expense.category, note: expense.note, date: expense.date, is_recurring: true
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_expenses", user?.id] });
      toast.success("Gasto fijo guardado");
      setShowAddFixed(false);
      setEditingExpense(null);
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_expenses", user?.id] });
      toast.success("Gasto eliminado exitosamente");
    },
  });

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (e) {
      toast.error("Error intentando salir.");
    }
  };

  const getInitials = (str: string) => {
    return str ? str.trim().charAt(0).toUpperCase() : "U";
  };

  const saveProfile = () => {
    updateProfileMutation.mutate({
      name,
      income_type: incomeType,
      monthly_income: parseFloat(monthlyIncome) || 0,
    });
  };

  return (
    <div className="animate-fade-in p-4 pb-24 min-h-screen bg-background">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="p-2 -ml-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <span className="text-md font-semibold text-foreground">Ajustes</span>
        <div className="w-10"></div> {/* Spacer balance */}
      </div>

      {/* Secciones de Perfil */}
      <div className="space-y-6">
        
        {/* MI PERFIL SECTION */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground mb-3 tracking-wide uppercase px-1">MI PERFIL</p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Cabecera bonita del usuario */}
            <div className="p-5 flex flex-col items-center justify-center bg-primary/5 border-b border-border/50">
              <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-3xl font-bold text-primary-foreground mb-3 shadow-md">
                {getInitials(profile?.name || "")}
              </div>
              <p className="text-sm font-medium text-muted-foreground">{user?.email}</p>
            </div>

            {/* Campos de Nombre y Dinero */}
            <div className="divide-y divide-border/50">
              {/* Nombre Editable */}
              <div className="p-4 bg-transparent cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setEditingField("name")}>
                {editingField === "name" ? (
                  <div className="flex gap-2">
                    <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
                    <Button onClick={(e) => { e.stopPropagation(); saveProfile() }}>✓</Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">Nombre Corto</p>
                      <p className="text-sm font-semibold text-foreground">{profile?.name || "Sin nombre configurado"}</p>
                    </div>
                    <Edit2 className="h-4 w-4 text-muted-foreground opacity-50" />
                  </div>
                )}
              </div>

              {/* Ingreso Editable */}
              <div className="p-4 bg-transparent cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setEditingField("income")}>
                {editingField === "income" ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {[{ id: "fixed", label: "Fijo", icon: Wallet }, { id: "variable", label: "Var.", icon: Calculator }, { id: "mixed", label: "Mixto", icon: DollarSign }].map(t => (
                        <button key={t.id} onClick={(e) => { e.stopPropagation(); setIncomeType(t.id); }} className={cn("p-2 rounded-lg text-xs font-semibold border text-center transition-all flex flex-col items-center gap-1", incomeType === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}>  
                          <t.icon className="h-4 w-4" />
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
                        <input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} className="w-full rounded-xl border border-border bg-background py-2.5 pl-8 pr-4 text-sm focus:border-primary outline-none" />
                      </div>
                      <Button onClick={(e) => { e.stopPropagation(); saveProfile() }}>Guardar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">Tu Ingreso {profile?.income_type === "fixed" ? "(Mensual Fijo)" : profile?.income_type === "variable" ? "(Variable Promedio)" : "(Mixto)"}</p>
                      <p className="text-lg font-bold text-primary">{formatQ(profile?.monthly_income || 0)}</p>
                    </div>
                    <Edit2 className="h-4 w-4 text-muted-foreground opacity-50" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* MIS GASTOS FIJOS SECTION */}
        <section>
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">MIS GASTOS FIJOS</p>
            {recurringExpenses.length > 0 && (
              <button onClick={() => setShowAddFixed(true)} className="text-xs text-primary font-bold hover:underline">+ Agregar otro</button>
            )}
          </div>
          
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {recurringExpenses.length === 0 ? (
              <div className="p-6 text-center bg-card">
                <ShieldCheck className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">No tienes pagos fijos registrados.</p>
                <p className="text-xs text-muted-foreground mb-4">La renta, gimnasio o teléfono deberían ir aquí para auto-cobrarse en tu presupuesto.</p>
                <Button variant="outline" size="sm" onClick={() => setShowAddFixed(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Configurar Primer Fijo
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recurringExpenses.map(exp => {
                  const cat = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                  const Icon = cat?.icon;
                  return (
                    <div key={exp.id} className="flex flex-row items-center p-3 hover:bg-muted/30 transition-colors group">
                       <button onClick={() => setEditingExpense({ ...exp, is_recurring: true })} className="flex flex-1 items-center gap-3 text-left">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted group-hover:bg-background">
                            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{exp.note || cat?.label}</p>
                            <p className="text-xs text-muted-foreground">Repite mensualmente</p>
                          </div>
                          <span className="text-sm font-bold text-foreground mr-1">{formatQ(exp.amount || 0)}</span>
                       </button>
                       <button onClick={(e) => { e.stopPropagation(); deleteExpenseMutation.mutate(exp.id); }} className="p-2 ml-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors">
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* CONFIGURACIÓN SECTION */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground mb-3 tracking-wide uppercase px-1">APLICACIÓN</p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border/50">
            <div className="p-4 flex items-center justify-between bg-transparent">
              <div>
                <p className="text-sm font-medium text-foreground">Modo Oscuro</p>
                <p className="text-xs text-muted-foreground">Tu tema visual actual</p>
              </div>
              {/* Dummy switch for now just matching UI aesthetics */}
              <Switch checked={true} onCheckedChange={(val) => {
                if(!val) toast("El modo claro llegará pronto a Flowi");
              }} />
            </div>
            
            <div className="p-4 flex items-center justify-between text-left w-full hover:bg-muted/50 cursor-pointer text-destructive" onClick={handleSignOut}>
              <div>
                <p className="text-sm font-bold">Cerrar Sesión Segura</p>
                <p className="text-xs opacity-80">(Tus datos quedarán guardados en la nube)</p>
              </div>
              <LogOut className="h-5 w-5" />
            </div>
          </div>
          <p className="text-center text-xs font-mono text-muted-foreground/60 mt-4">Flowi v1.0.0 (Build 50C)</p>
        </section>

      </div>

      {/* El Reusable AddExpenseModal modificado por mí antes */}
      <AddExpenseModal
        open={showAddFixed || !!editingExpense}
        initialData={editingExpense || { is_recurring: true }}  // Forzamos "recurrente" cuando es nuevo aquí
        onClose={() => { setShowAddFixed(false); setEditingExpense(null) }}
        onSave={(exp) => upsertExpenseMutation.mutate(exp)}
      />

    </div>
  );
}
