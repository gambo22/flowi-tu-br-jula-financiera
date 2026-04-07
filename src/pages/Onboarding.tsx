import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowRight, CheckCircle2, ChevronRight, Calculator,
  Car, Home, MapPin, Tablet, Smartphone, ShieldCheck, Star, 
  Wallet, DollarSign, Target, Plus, X
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { EXPENSE_CATEGORIES, GOAL_TYPES, formatQ } from "@/lib/constants";
import { Switch } from "@/components/ui/switch";

type IncomeFrequency = "monthly" | "biweekly" | "weekly" | "variable";

interface OnboardingState {
  name: string;
  incomeFrequency: IncomeFrequency;
  incomePeriod1: string;
  incomePeriod2: string;
  incomePeriod3: string;
  incomePeriod4: string;
  hasDifferentMonth: boolean;
  incomeThisMonth: string;
  paymentDayType: string;
  paymentDay1: string;
  paymentDay2: string;

  expenses: { id: string; categoryId: string; amount: string; name: string }[];
  goalType: string | null;
  goalName: string;
  goalAmount: string;
}

const COMMON_EXPENSES = [
  { id: "renta", label: "Renta/Hipoteca", cat: "vivienda" },
  { id: "luz", label: "Agua/Luz", cat: "servicios" },
  { id: "internet", label: "Internet", cat: "servicios" },
  { id: "celular", label: "Plan Celular", cat: "servicios" },
  { id: "colegio", label: "Colegiatura", cat: "colegiatura" },
  { id: "seguro", label: "Seguro", cat: "salud" },
  { id: "cable", label: "Netflix/Spotify", cat: "suscripciones" },
  { id: "gym", label: "Gimnasio", cat: "salud" },
  { id: "carro", label: "Cuota de carro", cat: "transporte" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingState>({
    name: profile?.name || "",
    incomeFrequency: "monthly",
    incomePeriod1: "",
    incomePeriod2: "",
    incomePeriod3: "",
    incomePeriod4: "",
    hasDifferentMonth: false,
    incomeThisMonth: "",
    paymentDayType: "last_business_day",
    paymentDay1: "",
    paymentDay2: "",
    expenses: [],
    goalType: null,
    goalName: "",
    goalAmount: "",
  });

  const updateData = (updates: Partial<OnboardingState>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));

  const getCalculatedMonthlyIncome = () => {
    const p1 = Number(data.incomePeriod1) || 0;
    const p2 = Number(data.incomePeriod2) || 0;
    const p3 = Number(data.incomePeriod3) || 0;
    const p4 = Number(data.incomePeriod4) || 0;
    if (data.incomeFrequency === "variable") return (p1 + p2) / 2;
    return p1 + p2 + p3 + p4;
  };

  const handleFinish = async (skipGoal = false) => {
    if (!user) return;
    setLoading(true);

    try {
      const p1 = Number(data.incomePeriod1) || 0;
      const p2 = Number(data.incomePeriod2) || 0;
      const p3 = Number(data.incomePeriod3) || 0;
      const p4 = Number(data.incomePeriod4) || 0;
      const calcMonthly = getCalculatedMonthlyIncome();
      const thisMonth = data.hasDifferentMonth && Number(data.incomeThisMonth) > 0 ? Number(data.incomeThisMonth) : null;

      // Ensure day parsing
      const d1 = parseInt(data.paymentDay1) || null;
      const d2 = parseInt(data.paymentDay2) || null;

      const { error: userError } = await supabase.from("users").upsert({
        id: user.id,
        name: data.name,
        income_frequency: data.incomeFrequency,
        income_period_1: p1,
        income_period_2: p2,
        income_period_3: p3,
        income_period_4: p4,
        monthly_income: calcMonthly,
        income_this_month: thisMonth,
        payment_day_type: data.paymentDayType,
        payment_day_1: d1,
        payment_day_2: d2,
        onboarding_complete: true,
      });

      if (userError) throw userError;

      // Gastos
      if (data.expenses.length > 0) {
        const expensesToInsert = data.expenses.map((e) => ({
          user_id: user.id,
          category: e.categoryId,
          amount: Number(e.amount) || 0,
          note: e.name,
          date: new Date().toISOString(),
          is_recurring: true,
        }));
        await supabase.from("expenses").insert(expensesToInsert);
      }

      // Meta
      if (!skipGoal && data.goalType && data.goalName && data.goalAmount) {
        await supabase.from("goals").insert({
          user_id: user.id,
          name: data.goalName,
          type: data.goalType,
          total_amount: Number(data.goalAmount) || 0,
          current_saved: 0,
          priority: 1,
        });
      }

      await refreshProfile();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Error saving onboarding state:", err);
      alert("Hubo un error al guardar tu configuración. Por favor intenta de nuevo.");
      setLoading(false);
    }
  };

  const isStep1Valid = data.name.trim().length > 0;
  let isStep2Valid = false;
  if (data.incomeFrequency === "monthly") isStep2Valid = Number(data.incomePeriod1) > 0;
  if (data.incomeFrequency === "biweekly") isStep2Valid = Number(data.incomePeriod1) > 0 && Number(data.incomePeriod2) > 0;
  if (data.incomeFrequency === "weekly") isStep2Valid = Number(data.incomePeriod1) > 0;
  if (data.incomeFrequency === "variable") isStep2Valid = Number(data.incomePeriod1) > 0; // At least best month

  return (
    <div className="flex min-h-screen flex-col bg-background p-6">
      {/* Progress Bar */}
      <div className="mb-8 mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${step >= i ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <span className="text-xs font-semibold text-muted-foreground ml-2">{step}/4</span>
      </div>

      <div className="flex-1 animate-fade-in relative pb-32">
        {step === 1 && (
          <div className="animate-slide-up space-y-6">
            <div>
              <h1 className="text-3xl font-extrabold text-foreground">Hola, soy Flowi 👋</h1>
              <p className="mt-2 text-base text-muted-foreground">Tu compañero financiero. ¿Cómo te llamas?</p>
            </div>
            <input
              type="text"
              value={data.name}
              onChange={(e) => updateData({ name: e.target.value })}
              placeholder="Ej. María"
              className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-base focus:border-primary outline-none"
              autoFocus
            />
          </div>
        )}

        {step === 2 && (
          <div className="animate-slide-up space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">¿Cómo recibes tus pagos?</h1>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[{id:'monthly', l:'Mensual'}, {id:'biweekly', l:'Quincenal'}, {id:'weekly', l:'Semanal'}, {id:'variable', l:'Variable'}].map(t => (
                <button
                  key={t.id}
                  onClick={() => updateData({ incomeFrequency: t.id as IncomeFrequency, incomePeriod1:'', incomePeriod2:'', incomePeriod3:'', incomePeriod4:'' })}
                  className={`p-3 rounded-xl border text-sm font-semibold transition-all ${data.incomeFrequency === t.id ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border'}`}
                >
                  {t.l}
                </button>
              ))}
            </div>

            <div className="space-y-4 bg-muted/30 p-4 rounded-xl border border-border">
              {data.incomeFrequency === "monthly" && (
                <>
                  <label className="text-sm font-medium">¿Cuánto recibes al mes?</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Q</span>
                    <input type="number" value={data.incomePeriod1} onChange={(e) => updateData({incomePeriod1: e.target.value})} className="w-full rounded-xl bg-card border border-border py-3 pl-8 pr-4 outline-none focus:border-primary" />
                  </div>
                  <label className="text-sm font-medium mt-3 block">¿Cuándo te pagan?</label>
                  <select value={data.paymentDayType} onChange={(e) => updateData({ paymentDayType: e.target.value })} className="w-full rounded-xl bg-card border border-border py-3 px-3">
                    <option value="last_business_day">Último día hábil del mes</option>
                    <option value="fixed_day">Un día fijo específico</option>
                  </select>
                  {data.paymentDayType === "fixed_day" && (
                    <input type="number" placeholder="Día (ej. 25)" value={data.paymentDay1} onChange={(e) => updateData({paymentDay1: e.target.value})} className="w-full rounded-xl mt-2 bg-card border border-border py-3 px-3" />
                  )}
                </>
              )}

              {data.incomeFrequency === "biweekly" && (
                <>
                  <label className="text-sm font-medium">¿Cuánto recibes en cada quincena?</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">1ra Q</span>
                      <input type="number" value={data.incomePeriod1} onChange={(e) => updateData({incomePeriod1: e.target.value})} className="w-full rounded-xl bg-card border border-border py-3 pl-11 pr-2 outline-none" />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">2da Q</span>
                      <input type="number" value={data.incomePeriod2} onChange={(e) => updateData({incomePeriod2: e.target.value})} className="w-full rounded-xl bg-card border border-border py-3 pl-11 pr-2 outline-none" />
                    </div>
                  </div>
                  <p className="text-xs text-primary font-bold">Total proyectado: Q{(Number(data.incomePeriod1)||0) + (Number(data.incomePeriod2)||0)} / mes</p>
                  
                  <label className="text-sm font-medium mt-3 block">¿Fechas de tus quincenas?</label>
                  <select value={data.paymentDayType} onChange={(e) => updateData({ paymentDayType: e.target.value })} className="w-full rounded-xl bg-card border border-border py-3 px-3">
                    <option value="last_business_day_15_30">Días 15 y último hábil del mes</option>
                    <option value="fixed_days">Días fijos manuales</option>
                  </select>
                  {data.paymentDayType === "fixed_days" && (
                    <div className="flex gap-2 mt-2">
                       <input type="number" placeholder="Día 1" value={data.paymentDay1} onChange={(e) => updateData({paymentDay1: e.target.value})} className="w-1/2 rounded-xl bg-card border py-2 px-3" />
                       <input type="number" placeholder="Día 2" value={data.paymentDay2} onChange={(e) => updateData({paymentDay2: e.target.value})} className="w-1/2 rounded-xl bg-card border py-2 px-3" />
                    </div>
                  )}
                </>
              )}

              {data.incomeFrequency === "weekly" && (
                <>
                  <label className="text-sm font-medium">Pagos aproximados por semana (4 al mes)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="S1 (Q)" value={data.incomePeriod1} onChange={(e) => updateData({incomePeriod1: e.target.value})} className="w-full rounded-xl border p-3" />
                    <input type="number" placeholder="S2 (Q)" value={data.incomePeriod2} onChange={(e) => updateData({incomePeriod2: e.target.value})} className="w-full rounded-xl border p-3" />
                    <input type="number" placeholder="S3 (Q)" value={data.incomePeriod3} onChange={(e) => updateData({incomePeriod3: e.target.value})} className="w-full rounded-xl border p-3" />
                    <input type="number" placeholder="S4 (Q)" value={data.incomePeriod4} onChange={(e) => updateData({incomePeriod4: e.target.value})} className="w-full rounded-xl border p-3" />
                  </div>
                  <p className="text-xs text-primary font-bold">Total proyectado: Q{getCalculatedMonthlyIncome()} / mes</p>
                </>
              )}

              {data.incomeFrequency === "variable" && (
                <>
                  <label className="text-sm font-medium">Calculadora Emprendedor/Variable</label>
                  <div className="space-y-2">
                    <input type="number" placeholder="¿Cuánto ganas en tu MEJOR mes? (Q)" value={data.incomePeriod1} onChange={(e) => updateData({incomePeriod1: e.target.value})} className="w-full rounded-xl border p-3" />
                    <input type="number" placeholder="¿Cuánto ganas en tu PEOR mes? (Q)" value={data.incomePeriod2} onChange={(e) => updateData({incomePeriod2: e.target.value})} className="w-full rounded-xl border p-3" />
                  </div>
                  <p className="text-xs text-primary font-bold">Base segura para Flowi: Q{getCalculatedMonthlyIncome()} / mes</p>
                </>
              )}
            </div>

            <div className="bg-muted p-4 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">¿Este mes ganas diferente a la regla?</span>
                <Switch checked={data.hasDifferentMonth} onCheckedChange={(val) => updateData({hasDifferentMonth: val})} />
              </div>
              {data.hasDifferentMonth && (
                <div>
                   <input type="number" placeholder="Ingreso exacto real de ESTE mes (Q)" value={data.incomeThisMonth} onChange={(e) => updateData({incomeThisMonth: e.target.value})} className="w-full rounded-xl border p-3" />
                   <p className="text-xs text-muted-foreground mt-1">Útil si tuviste descuento, bono catorce o aguinaldo temporalmente.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3 and 4 (Expenses and Goals, mostly unchanged visual wrapper but abbreviated logic to save space) */}
        {step === 3 && (
          <div className="animate-slide-up space-y-4">
            <h1 className="text-2xl font-bold">¿Tienes Gastos Fijos? (Se descontarán auto)</h1>
            {COMMON_EXPENSES.map((ce) => {
              const isSelected = data.expenses.some(e => e.id === ce.id);
              const expObj = data.expenses.find(e => e.id === ce.id);
              return (
                <div key={ce.id} className="rounded-2xl border p-3 flex flex-col gap-2 bg-card">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => {
                    if (isSelected) updateData({ expenses: data.expenses.filter(x => x.id !== ce.id) });
                    else updateData({ expenses: [...data.expenses, { id: ce.id, categoryId: ce.cat, amount: "", name: ce.label }] });
                  }}>
                    <span className="font-medium text-sm">{ce.label}</span>
                    <Switch checked={isSelected} />
                  </div>
                  {isSelected && (
                    <input type="number" value={expObj?.amount || ""} onChange={(e) => {
                      updateData({ expenses: data.expenses.map(x => x.id === ce.id ? { ...x, amount: e.target.value } : x) })
                    }} placeholder="Monto (Q)" className="p-2 border rounded-xl outline-none" autoFocus />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {step === 4 && (
          <div className="animate-slide-up space-y-5">
            <h1 className="text-2xl font-bold">Tu Gran Sueño</h1>
            <p className="text-xs text-muted-foreground">Flowi calculará cómo pagar esto (Puedes saltarlo)</p>
            
            <div className="grid grid-cols-3 gap-2">
              {GOAL_TYPES.map(g => (
                <button key={g.id} onClick={() => updateData({goalType: g.id})} className={`p-3 border rounded-xl flex flex-col items-center gap-1 text-xs ${data.goalType === g.id ? 'bg-primary text-white border-primary' : 'bg-card'}`}>
                   <g.icon className="h-5 w-5" />
                   {g.label}
                </button>
              ))}
            </div>

            {data.goalType && (
              <div className="space-y-3 mt-4">
                <input placeholder="Nombre de tu sueño" value={data.goalName} onChange={e => updateData({goalName: e.target.value})} className="w-full p-3 border rounded-xl" />
                <input type="number" placeholder="Monto Total (Q)" value={data.goalAmount} onChange={e => updateData({goalAmount: e.target.value})} className="w-full p-3 border rounded-xl" />
              </div>
            )}
            
            <div className="pt-8">
              <button disabled={loading} onClick={() => handleFinish(true)} className="w-full text-muted-foreground font-semibold text-sm py-4">Saltar Meta / Hacerlo luego</button>
              <button disabled={loading || !data.goalType || !data.goalName || !data.goalAmount} onClick={() => handleFinish(false)} className="w-full bg-primary text-white font-bold p-4 rounded-xl mt-2">Finalizar y Entrar ✨</button>
            </div>
          </div>
        )}

      </div>

      {step < 4 && (
        <div className="fixed bottom-6 left-6 right-6 max-w-lg mx-auto">
          <button
            onClick={nextStep}
            disabled={step === 1 ? !isStep1Valid : step === 2 ? !isStep2Valid : false}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none"
           >
            Continuar <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
