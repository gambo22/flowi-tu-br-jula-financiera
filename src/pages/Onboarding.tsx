import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowRight, ArrowLeft, CheckCircle2, ChevronRight, Calculator,
  Car, Home, MapPin, Tablet, Smartphone, ShieldCheck, Star, 
  Wallet, DollarSign, Target, Plus, X
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { EXPENSE_CATEGORIES, GOAL_TYPES, formatQ } from "@/lib/constants";

type IncomeType = "fixed" | "variable" | "mixed";

interface OnboardingState {
  name: string;
  incomeType: IncomeType;
  incomeFixed: string;
  incomeMin: string;
  incomeMax: string;
  incomeBase: string;
  incomeExtras: string;
  expenses: { id: string; categoryId: string; amount: string; name: string }[];
  goalType: string | null;
  goalName: string;
  goalAmount: string;
}

const COMMON_EXPENSES = [
  { id: "renta", label: "Renta/Hipoteca", cat: "vivienda" }, // Using "otros" or similar if missing, EXPENSE_CATEGORIES has "otros", "servicios", let's map loosely
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
    incomeType: "fixed",
    incomeFixed: "",
    incomeMin: "",
    incomeMax: "",
    incomeBase: "",
    incomeExtras: "",
    expenses: [],
    goalType: null,
    goalName: "",
    goalAmount: "",
  });

  const updateData = (updates: Partial<OnboardingState>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleFinish = async (skipGoal = false) => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Calcular el ingreso mensual estructurado
      let monthlyIncome = 0;
      let min = null;
      let max = null;

      if (data.incomeType === "fixed") {
        monthlyIncome = Number(data.incomeFixed) || 0;
      } else if (data.incomeType === "variable") {
        min = Number(data.incomeMin) || 0;
        max = Number(data.incomeMax) || 0;
        monthlyIncome = (min + max) / 2;
      } else if (data.incomeType === "mixed") {
        monthlyIncome = (Number(data.incomeBase) || 0) + (Number(data.incomeExtras) || 0);
      }

      // 2. Insertar configuración del perfil
      const { error: userError } = await supabase.from("users").upsert({
        id: user.id,
        name: data.name,
        monthly_income: monthlyIncome,
        income_type: data.incomeType,
        income_min: min,
        income_max: max,
        onboarding_complete: true,
      });

      if (userError) throw userError;

      // 3. Insertar gastos fijos
      if (data.expenses.length > 0) {
        const expensesToInsert = data.expenses.map((e) => ({
          user_id: user.id,
          category: e.categoryId,
          amount: Number(e.amount) || 0,
          note: e.name,
          date: new Date().toISOString(),
          is_recurring: true,
        }));
        // Insert expenses to db
        await supabase.from("expenses").insert(expensesToInsert);
      }

      // 4. Insertar meta
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

      // 5. Finalizar
      await refreshProfile();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Error saving onboarding state:", err);
      alert("Hubo un error al guardar tu configuración. Por favor intenta de nuevo.");
      setLoading(false);
    }
  };

  // Validación rápida para avanzar
  const isStep1Valid = data.name.trim().length > 0;
  let isStep2Valid = false;
  if (data.incomeType === "fixed") isStep2Valid = Number(data.incomeFixed) > 0;
  if (data.incomeType === "variable") isStep2Valid = Number(data.incomeMin) > 0 && Number(data.incomeMax) > 0;
  if (data.incomeType === "mixed") isStep2Valid = Number(data.incomeBase) > 0;

  const isStep4Valid = data.goalType && data.goalName && Number(data.goalAmount) > 0;

  // Render components
  return (
    <div className="flex min-h-screen flex-col bg-background p-6">
      {/* Progress Bar */}
      <div className="mb-8 mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors duration-500 ${
                step >= i ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-semibold text-muted-foreground ml-2">
          {step}/4
        </span>
      </div>

      <div className="flex-1 animate-fade-in relative">
        {/* STEP 1: Bienvenida */}
        {step === 1 && (
          <div className="animate-slide-up space-y-6">
            <div className="text-left">
              <h1 className="text-3xl font-extrabold text-foreground">
                Hola, soy Flowi 👋
              </h1>
              <p className="mt-2 text-base text-muted-foreground">
                Tu compañero de libertad financiera. Vamos a configurar tu espacio en menos de 2 minutos.
              </p>
            </div>

            <div className="space-y-4 pt-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  ¿Cómo te llamas?
                </label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => updateData({ name: e.target.value })}
                  placeholder="Ej. María"
                  className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
            </div>

            <div className="fixed bottom-6 left-6 right-6 max-w-lg mx-auto">
              <button
                onClick={nextStep}
                disabled={!isStep1Valid}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none"
              >
                Empecemos <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Ingresos */}
        {step === 2 && (
          <div className="animate-slide-up space-y-6 pb-24">
            <div className="text-left">
              <h1 className="text-2xl font-bold text-foreground">
                ¿Cómo es tu ingreso mensual?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Flowi se adapta a tu estilo de vida, ya sea fijo o emprendedor.
              </p>
            </div>

            {/* Income Type Selector */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => updateData({ incomeType: "fixed" })}
                className={`w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                  data.incomeType === "fixed" ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <div className={`p-3 rounded-xl ${data.incomeType === "fixed" ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Fijo</h3>
                  <p className="text-xs text-muted-foreground">Sueldo estable cada mes</p>
                </div>
              </button>

              <button
                onClick={() => updateData({ incomeType: "variable" })}
                className={`w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                  data.incomeType === "variable" ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <div className={`p-3 rounded-xl ${data.incomeType === "variable" ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                  <Calculator className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Variable</h3>
                  <p className="text-xs text-muted-foreground">Freelancer, negocio, comisiones</p>
                </div>
              </button>

              <button
                onClick={() => updateData({ incomeType: "mixed" })}
                className={`w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                  data.incomeType === "mixed" ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <div className={`p-3 rounded-xl ${data.incomeType === "mixed" ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Mixto</h3>
                  <p className="text-xs text-muted-foreground">Sueldo base + extras</p>
                </div>
              </button>
            </div>

            {/* Income Inputs based on type */}
            <div className="animate-fade-in bg-card border border-border rounded-2xl p-4 shadow-sm mt-4">
              {data.incomeType === "fixed" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">¿Cuánto recibes al mes?</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
                    <input
                      type="number"
                      value={data.incomeFixed}
                      onChange={(e) => updateData({ incomeFixed: e.target.value })}
                      placeholder="8000"
                      className="w-full rounded-xl bg-background border border-border py-3 pl-10 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              )}

              {data.incomeType === "variable" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">¿Cuánto recibes en un mes bueno?</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
                      <input
                        type="number"
                        value={data.incomeMax}
                        onChange={(e) => updateData({ incomeMax: e.target.value })}
                        placeholder="12000"
                        className="w-full rounded-xl bg-background border border-border py-3 pl-10 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">¿Cuánto recibes en un mes malo?</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
                      <input
                        type="number"
                        value={data.incomeMin}
                        onChange={(e) => updateData({ incomeMin: e.target.value })}
                        placeholder="4000"
                        className="w-full rounded-xl bg-background border border-border py-3 pl-10 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {data.incomeType === "mixed" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Tu sueldo base mensual</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
                      <input
                        type="number"
                        value={data.incomeBase}
                        onChange={(e) => updateData({ incomeBase: e.target.value })}
                        placeholder="5000"
                        className="w-full rounded-xl bg-background border border-border py-3 pl-10 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Promedio de extras al mes</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
                      <input
                        type="number"
                        value={data.incomeExtras}
                        onChange={(e) => updateData({ incomeExtras: e.target.value })}
                        placeholder="2500"
                        className="w-full rounded-xl bg-background border border-border py-3 pl-10 pr-4 text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="fixed bottom-6 left-6 right-6 max-w-lg mx-auto flex gap-3">
              <button
                onClick={prevStep}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-all hover:bg-muted/80"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                onClick={nextStep}
                disabled={!isStep2Valid}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-semibold text-white shadow-[0_8px_30px_rgb(16,185,129,0.3)] transition-all hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none"
              >
                Continuar <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Gastos Fijos */}
        {step === 3 && (
          <div className="animate-slide-up space-y-6 pb-28">
            <div className="text-left">
              <h1 className="text-2xl font-bold text-foreground">
                Tus gastos recurrentes
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                ¿Qué pagos haces cada mes sagradamente? Agrégalos para que Flowi te los descuente automáticamente.
              </p>
            </div>

            {/* Sugerencias Rápidas */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3 tracking-wide uppercase">Sugerencias rápidas</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_EXPENSES.map((preset) => {
                  const alreadyAdded = data.expenses.some(e => e.name === preset.label);
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        if (alreadyAdded) return;
                        updateData({
                          expenses: [
                            ...data.expenses,
                            { id: Date.now().toString(), categoryId: preset.cat, name: preset.label, amount: "" },
                          ],
                        });
                      }}
                      disabled={alreadyAdded}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        alreadyAdded ? "bg-muted text-muted-foreground/40" : "bg-card border border-border text-foreground hover:border-primary"
                      }`}
                    >
                      {preset.label} {alreadyAdded && "✓"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lista de gastos agregados */}
            <div className="space-y-3 pt-2">
              {data.expenses.map((expense, index) => (
                <div key={expense.id} className="animate-scale-in flex items-center gap-3 bg-card border border-border p-3 rounded-2xl">
                  <div className="flex-1 space-y-1">
                    <input 
                      type="text" 
                      value={expense.name} 
                      onChange={(e) => {
                        const newExps = [...data.expenses];
                        newExps[index].name = e.target.value;
                        updateData({ expenses: newExps });
                      }}
                      placeholder="Nombre del gasto"
                      className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/60"
                    />
                    <div className="flex text-xs text-muted-foreground items-center">
                      <span>Categoría: </span>
                      <select 
                        className="bg-transparent outline-none ml-1 text-primary cursor-pointer"
                        value={expense.categoryId}
                        onChange={(e) => {
                          const newExps = [...data.expenses];
                          newExps[index].categoryId = e.target.value;
                          updateData({ expenses: newExps });
                        }}
                      >
                        {EXPENSE_CATEGORIES.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">Q</span>
                    <input 
                      type="number"
                      value={expense.amount}
                      onChange={(e) => {
                        const newExps = [...data.expenses];
                        newExps[index].amount = e.target.value;
                        updateData({ expenses: newExps });
                      }}
                      placeholder="0.00"
                      className="w-full bg-background border border-border rounded-lg pl-6 pr-2 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      const newExps = [...data.expenses];
                      newExps.splice(index, 1);
                      updateData({ expenses: newExps });
                    }}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => updateData({
                  expenses: [
                    ...data.expenses,
                    { id: Date.now().toString(), categoryId: "otros", name: "", amount: "" }
                  ]
                })}
                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-border rounded-2xl text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-all"
              >
                <Plus className="h-4 w-4" /> Agregar otro gasto fijo
              </button>
            </div>

            <div className="fixed bottom-6 left-6 right-6 max-w-lg mx-auto flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-all hover:bg-muted/80"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={nextStep}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-semibold text-white shadow-[0_8px_30px_rgb(16,185,129,0.3)] transition-all hover:bg-primary/90"
                >
                  {data.expenses.length > 0 ? "Estos son mis fijos" : "No tengo fijos reales"} <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Primera meta */}
        {step === 4 && (
          <div className="animate-slide-up space-y-6 pb-32">
            <div className="text-left">
              <h1 className="text-2xl font-bold text-foreground">
                ¿Tienes algún sueño en mente? 🚀
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                No tiene que ser inmenso. Ponerle un nombre a tu ahorro cambia completamente cómo te sientes sobre guardar dinero.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              {GOAL_TYPES.slice(0, 6).map((goal) => {
                const Icon = goal.icon;
                const isSelected = data.goalType === goal.id;
                return (
                  <button
                    key={goal.id}
                    onClick={() => updateData({ goalType: goal.id, goalName: data.goalName || goal.label })}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${
                      isSelected ? "border-primary bg-primary/10 ring-2 ring-primary/20 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-8 w-8" />
                    <span className="text-xs font-semibold">{goal.label}</span>
                  </button>
                );
              })}
            </div>

            {data.goalType && (
              <div className="animate-scale-in bg-card border border-border p-4 rounded-2xl space-y-4 shadow-sm mt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">¿Cómo se llama tu sueño?</label>
                  <input
                    type="text"
                    value={data.goalName}
                    onChange={(e) => updateData({ goalName: e.target.value })}
                    placeholder="Escribelo aquí..."
                    className="w-full rounded-xl bg-background border border-border py-3 px-4 text-sm text-foreground focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">¿Cuánto calculas que cuesta?</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
                    <input
                      type="number"
                      value={data.goalAmount}
                      onChange={(e) => updateData({ goalAmount: e.target.value })}
                      placeholder="15000"
                      className="w-full rounded-xl bg-background border border-border py-3 pl-10 pr-4 text-sm text-foreground focus:border-primary outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="fixed bottom-6 left-6 right-6 max-w-lg mx-auto flex flex-col gap-3 bg-background/80 backdrop-blur-md pt-4">
              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  disabled={loading}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-all hover:bg-muted/80 disabled:opacity-50"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleFinish(false)}
                  disabled={!isStep4Valid || loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-semibold text-white shadow-[0_8px_30px_rgb(16,185,129,0.3)] transition-all hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none"
                >
                  {loading ? "Preparando..." : "¡Crear mi sueño!"} <Target className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={() => handleFinish(true)}
                disabled={loading}
                className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors py-2"
              >
                Lo agrego después (Saltar)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
