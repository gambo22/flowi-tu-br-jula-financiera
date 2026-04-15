import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatQ, EXPENSE_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ChevronLeft, LogOut, ShieldCheck, Plus, Trash2, Edit2, Banknote, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function Perfil() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingField, setEditingField] = useState<string | null>(null);

  // Profile data forms
  const [name, setName] = useState(profile?.name || "");

  // Cash on hand forms
  const [editingCash, setEditingCash] = useState(false);
  const [cashAmount, setCashAmount] = useState(profile?.cash_on_hand?.toString() || "0");

  // Fixed expenses management
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);

  const { data: fixedExpenses = [] } = useQuery({
    queryKey: ["fixed_expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fixed_expenses")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error && error.code !== '42P01') throw error; // handle missing table gracefully
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
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      // Ignoring strictly created_at if non-existent, falling back to id sort via default
      if (error) {
        if (error.code === '42703') {
          const { data: fbData } = await supabase.from('accounts').select('*').eq('user_id', user?.id);
          return fbData || [];
        }
        throw error;
      }
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

  const totalDebt = debts.reduce((s: number, d: any) => s + (d.current_balance || 0), 0);
  const totalMinPayments = debts.reduce((s: number, d: any) => s + (d.minimum_payment || 0), 0);


  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from("users").update(updates).eq("id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshProfile();
      toast.success("Perfil actualizado");
      setEditingField(null);
      setEditingCash(false);
    },
  });

  const upsertFixedExpenseMutation = useMutation({
    mutationFn: async (expense: any) => {
      if (expense.id) {
        const { error } = await supabase.from("fixed_expenses").update({
          amount: expense.amount, category: expense.category, name: expense.name, payment_day: expense.payment_day, payment_day_type: "fixed"
        }).eq("id", expense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fixed_expenses").insert({
          user_id: user?.id, amount: expense.amount, category: expense.category, name: expense.name, payment_day: expense.payment_day, payment_day_type: "fixed"
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed_expenses", user?.id] });
      setShowAddFixed(false);
      setEditingExpense(null);
    },
  });

  const deleteFixedExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fixed_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixed_expenses", user?.id] });
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

  const getInitials = (str: string) => str ? str.trim().charAt(0).toUpperCase() : "U";

  // Dark mode inline
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark'));

  const toggleDarkMode = (val: boolean) => {
    setIsDark(val);
    if (val) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Translations and parsing logic
  const parseIncomeLabel = () => {
    if (profile?.income_frequency === 'monthly') return "Mensual";
    if (profile?.income_frequency === 'biweekly') return "Quincenal";
    if (profile?.income_frequency === 'weekly') return "Semanal";
    if (profile?.income_frequency === 'variable') return "Emprendedor/Variable";
    return profile?.income_type || "Fijo";
  };


  return (
    <div className="animate-fade-in p-4 pb-24 min-h-screen bg-background">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="p-2 -ml-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <span className="text-md font-semibold text-foreground">Ajustes</span>
        <div className="w-10"></div>
      </div>

      <div className="space-y-6">

        {/* MI PERFIL SECTION */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground mb-3 tracking-wide uppercase px-1">MI PERFIL</p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 flex flex-col items-center justify-center bg-primary/5 border-b border-border/50">
              <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-3xl font-bold text-primary-foreground mb-3 shadow-md">
                {getInitials(profile?.name || "")}
              </div>
              <p className="text-sm font-medium text-muted-foreground">{user?.email}</p>
            </div>

            <div className="divide-y divide-border/50">
              <div className="p-4 bg-transparent cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setEditingField("name")}>
                {editingField === "name" ? (
                  <div className="flex gap-2">
                    <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
                    <Button onClick={(e) => { e.stopPropagation(); updateProfileMutation.mutate({ name }); }}>✓</Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">Nombre Corto</p>
                      <p className="text-sm font-semibold text-foreground">{profile?.name || "Sin nombre"}</p>
                    </div>
                    <Edit2 className="h-4 w-4 text-muted-foreground opacity-50" />
                  </div>
                )}
              </div>

              {/* Ingreso Editable Complejo */}
              <div className="p-4 bg-transparent cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setEditingField("incomeModal")}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Tu Ingreso ({parseIncomeLabel()})</p>
                    <p className="text-lg font-bold text-primary">{formatQ(profile?.monthly_income || 0)}</p>
                    {profile?.income_this_month && <p className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded mt-1 inline-block">Mes Excepcional Modificado</p>}
                  </div>
                  <Edit2 className="h-4 w-4 text-muted-foreground opacity-50" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* EFECTIVO DISPONIBLE */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground mb-3 tracking-wide uppercase px-1">EFECTIVO DISPONIBLE</p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 bg-transparent cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => setEditingCash(true)}>
              {editingCash ? (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
                    <input type="number" autoFocus value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} className="w-full rounded-xl border border-border bg-background py-2.5 pl-8 pr-4 text-sm focus:border-primary outline-none" />
                  </div>
                  <Button onClick={(e) => {
                    e.stopPropagation();
                    updateProfileMutation.mutate({ cash_on_hand: parseFloat(cashAmount) || 0 });
                  }}>Guardar</Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-green-500/10 text-green-600 flex items-center justify-center rounded-xl"><Banknote className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">Efectivo a mano</p>
                    <p className="text-xs text-muted-foreground">Billetera, en casa o sobrecitos. Toca para actualizar.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{formatQ(profile?.cash_on_hand || 0)}</p>
                  </div>
                  <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
              )}
            </div>
          </div>
        </section>


        {/* VISUALIZADOR DE GASTOS FIJOS / COMPROMISOS */}
        <section>
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">TUS COMPROMISOS (GASTOS FIJOS)</p>
            {fixedExpenses.length > 0 && (
              <button onClick={() => setShowAddFixed(true)} className="text-xs text-primary font-bold hover:underline">+ Agregar fijo</button>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {fixedExpenses.length === 0 ? (
              <div className="p-6 text-center bg-card">
                <ShieldCheck className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">No tienes compromisos fijos registrados.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAddFixed(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Nuevo Compromiso
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {fixedExpenses.map(exp => {
                  const cat = EXPENSE_CATEGORIES.find((c) => c.id === exp.category);
                  const Icon = cat?.icon;
                  return (
                    <div key={exp.id} className="flex flex-row items-center p-3 hover:bg-muted/30 transition-colors group">
                      <button onClick={() => setEditingExpense({ ...exp })} className="flex flex-1 items-center gap-3 text-left">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted group-hover:bg-background">
                          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{exp.name || cat?.label}</p>
                          <p className="text-xs text-muted-foreground">Pago el día: {exp.payment_day}</p>
                        </div>
                        <span className="text-sm font-bold text-foreground mr-1">{formatQ(exp.amount || 0)}</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteFixedExpenseMutation.mutate(exp.id); }} className="p-2 ml-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* RESUMEN DEUDAS */}
        {debts.length > 0 && (
          <section className="mb-8">
            <p className="text-xs font-semibold text-muted-foreground mb-3 tracking-wide uppercase px-1">DEUDAS ACTIVAS</p>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">Total adeudado</p>
                  <p className="text-lg font-bold text-destructive">{formatQ(totalDebt)}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">Pagos mín/mes</p>
                  <p className="text-lg font-bold text-foreground">{formatQ(totalMinPayments)}</p>
                </div>
              </div>
              <div className="divide-y divide-border/50">
                {debts.map((d: any) => (
                  <div key={d.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.type} · {d.interest_rate}% anual</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-destructive">{formatQ(d.current_balance || 0)}</p>
                      <p className="text-xs text-muted-foreground">Mín: {formatQ(d.minimum_payment || 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CONFIGURACIONES */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground mb-3 tracking-wide uppercase px-1">CONFIGURACIONES</p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border/50">
            <div className="p-4 flex items-center justify-between bg-transparent">
              <div>
                <p className="text-sm font-medium text-foreground">Modo Oscuro</p>
                <p className="text-xs text-muted-foreground">Cuida tus ojos de noche</p>
              </div>
              <Switch checked={isDark} onCheckedChange={(val) => toggleDarkMode(val)} />
            </div>

            <div className="p-4 flex items-center justify-between text-left w-full hover:bg-muted/50 cursor-pointer text-destructive" onClick={handleSignOut}>
              <div>
                <p className="text-sm font-bold">Cerrar Sesión Segura</p>
                <p className="text-xs opacity-80">(Tus datos quedarán guardados en la nube)</p>
              </div>
              <LogOut className="h-5 w-5" />
            </div>
          </div>
          <p className="text-center text-xs font-mono text-muted-foreground/60 mt-4">Flowi v1.1.0 Latino</p>
        </section>

      </div>

      {(showAddFixed || !!editingExpense) && (
        <AddFixedExpenseModal
          initialData={editingExpense}
          onClose={() => { setShowAddFixed(false); setEditingExpense(null); }}
          onSave={(exp) => upsertFixedExpenseMutation.mutate(exp)}
        />
      )}

      {/* Re-using Income flow inside Profile */}
      {editingField === "incomeModal" && (
        <IncomeEditorModal profile={profile} onClose={() => setEditingField(null)} onUserUpdate={() => { refreshProfile(); setEditingField(null); }} />
      )}

    </div>
  );
}

// Subcomponente masivo aislado para evitar saturar Perfil
function IncomeEditorModal({ profile, onClose, onUserUpdate }: { profile: any; onClose: () => void; onUserUpdate: () => void }) {
  const [freq, setFreq] = useState(profile?.income_frequency || 'monthly');
  const [p1, setP1] = useState(profile?.income_period_1?.toString() || "");
  const [p2, setP2] = useState(profile?.income_period_2?.toString() || "");
  const [p3, setP3] = useState(profile?.income_period_3?.toString() || "");
  const [p4, setP4] = useState(profile?.income_period_4?.toString() || "");
  const [hasDiff, setHasDiff] = useState(profile?.income_this_month !== null && profile?.income_this_month !== undefined);
  const [thisMonth, setThisMonth] = useState(profile?.income_this_month?.toString() || "");
  const [payType, setPayType] = useState(profile?.payment_day_type || "last_business_day");
  const [d1, setD1] = useState(profile?.payment_day_1?.toString() || "");
  const [d2, setD2] = useState(profile?.payment_day_2?.toString() || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const calcMonthly = freq === 'variable' ? ((Number(p1) || 0) + (Number(p2) || 0)) / 2 : (Number(p1) || 0) + (Number(p2) || 0) + (Number(p3) || 0) + (Number(p4) || 0);
      const updates = {
        income_frequency: freq,
        income_period_1: Number(p1) || 0,
        income_period_2: Number(p2) || 0,
        income_period_3: Number(p3) || 0,
        income_period_4: Number(p4) || 0,
        monthly_income: calcMonthly,
        income_this_month: hasDiff ? Number(thisMonth) || 0 : null,
        payment_day_type: payType,
        payment_day_1: Number(d1) || null,
        payment_day_2: Number(d2) || null
      };
      const { error } = await supabase.from('users').update(updates).eq('id', profile?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Flujo de ingresos guardado");
      onUserUpdate();
    }
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 border border-border shadow-2xl my-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Ajustador Financiero</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm font-bold text-foreground">¿Cómo recibes el dinero?</label>
            <select value={freq} onChange={(e) => setFreq(e.target.value)} className="w-full rounded-xl bg-muted border border-border py-2 px-3 mt-1">
              <option value="monthly">1 vez al mes (Mensual)</option>
              <option value="biweekly">2 veces (Quincenal)</option>
              <option value="weekly">Semanal</option>
              <option value="variable">Variable / Negocio Propio</option>
            </select>
          </div>

          <div className="p-3 bg-muted/40 rounded-xl space-y-3">
            {freq === 'monthly' && (
              <>
                <Input type="number" placeholder="Sueldo Base Mensual Q" value={p1} onChange={(e) => setP1(e.target.value)} />
                <label className="text-xs font-semibold block pt-2">¿Cuándo depositan?</label>
                <select value={payType} onChange={(e) => setPayType(e.target.value)} className="w-full text-sm p-2 rounded border bg-card">
                  <option value="last_business_day">Fin de Mes (Hábil)</option>
                  <option value="fixed_day">Día fijo</option>
                </select>
                {payType === 'fixed_day' && <Input type="number" placeholder="Día" value={d1} onChange={e => setD1(e.target.value)} />}
              </>
            )}
            {freq === 'biweekly' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="1ra Q" value={p1} onChange={(e) => setP1(e.target.value)} />
                  <Input type="number" placeholder="2da Q" value={p2} onChange={(e) => setP2(e.target.value)} />
                </div>
                <label className="text-xs font-semibold block pt-2">Condiciones de Quincenas</label>
                <select value={payType} onChange={(e) => setPayType(e.target.value)} className="w-full text-sm p-2 rounded border bg-card">
                  <option value="last_business_day_15_30">Día 15 y Fin de mes</option>
                  <option value="fixed_days">Días Fijos Manuales</option>
                </select>
                {payType === 'fixed_days' && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Input type="number" placeholder="Día Q1" value={d1} onChange={e => setD1(e.target.value)} />
                    <Input type="number" placeholder="Día Q2" value={d2} onChange={e => setD2(e.target.value)} />
                  </div>
                )}
              </>
            )}
            {freq === 'weekly' && (
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="S1" value={p1} onChange={(e) => setP1(e.target.value)} />
                <Input type="number" placeholder="S2" value={p2} onChange={(e) => setP2(e.target.value)} />
                <Input type="number" placeholder="S3" value={p3} onChange={(e) => setP3(e.target.value)} />
                <Input type="number" placeholder="S4" value={p4} onChange={(e) => setP4(e.target.value)} />
              </div>
            )}
            {freq === 'variable' && (
              <div className="space-y-2">
                <Input type="number" placeholder="Mejor mes histórico Q" value={p1} onChange={(e) => setP1(e.target.value)} />
                <Input type="number" placeholder="Peor mes histórico Q" value={p2} onChange={(e) => setP2(e.target.value)} />
              </div>
            )}
          </div>

          <div className="p-3 bg-muted/40 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Excepciones este mes</p>
              <Switch checked={hasDiff} onCheckedChange={setHasDiff} />
            </div>
            {hasDiff && (
              <div className="mt-3">
                <Input type="number" placeholder="Ingreso TOTAL Real en este mes (Q)" value={thisMonth} onChange={e => setThisMonth(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">El dashboard usará este monto prioritariamente para calcular tus metas el mes presente.</p>
              </div>
            )}
          </div>

        </div>

        <Button className="w-full font-bold" onClick={() => updateMutation.mutate()}>Grabar Lógica</Button>
      </div>
    </div>
  )
}

function AddFixedExpenseModal({ initialData, onClose, onSave }: any) {
  const [amount, setAmount] = useState(initialData?.amount || "");
  const [category, setCategory] = useState(initialData?.category || "");
  const [name, setName] = useState(initialData?.name || "");
  const [paymentDay, setPaymentDay] = useState(initialData?.payment_day || 1);

  const handleSave = () => {
    if (!amount || !category || !paymentDay) return;
    onSave({
      id: initialData?.id,
      amount: parseFloat(amount),
      category,
      name,
      payment_day: parseInt(paymentDay)
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="animate-slide-up w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">{initialData ? "Editar Compromiso Fijo" : "Nuevo Compromiso Fijo"}</h2>
        </div>
        <div className="space-y-4 mb-6">
          <Input type="number" placeholder="Monto (Q)" value={amount} onChange={e => setAmount(e.target.value)} />
          <Input placeholder="Nombre (Ej: Colegiatura, Renta)" value={name} onChange={e => setName(e.target.value)} />
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Día de cobro en el mes (1 - 31)</label>
            <Input type="number" value={paymentDay} onChange={e => setPaymentDay(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-2">Icono de la Categoría</label>
            <div className="grid grid-cols-4 gap-2">
              {EXPENSE_CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => setCategory(cat.id)} className={cn("flex flex-col items-center gap-1 rounded-xl p-2.5 text-xs transition-all", category === cat.id ? "bg-primary text-white shadow-md" : "bg-muted hover:bg-muted/80")}>
                  <cat.icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="w-1/2" onClick={onClose}>Cancelar</Button>
          <Button className="w-1/2" disabled={!amount || !category} onClick={handleSave}>Guardar</Button>
        </div>
      </div>
    </div>
  );
}
