import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ArrowLeft, CheckCircle2, Wallet, TrendingUp,
  ShieldCheck, CreditCard, BarChart3, Target, Zap, X
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { EXPENSE_CATEGORIES, GOAL_TYPES, formatQ } from "@/lib/constants";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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
  fixed_expenses: { id: string; categoryId: string; amount: string; name: string; payment_day: string }[];
  debts: { name: string; type: string; balance: string; minPayment: string; rate: string; paymentDay: string }[];
  goalType: string | null;
  goalName: string;
  goalAmount: string;
}

const COMMON_EXPENSES = [
  { id: "renta", label: "Renta/Hipoteca", cat: "otros" },
  { id: "luz", label: "Agua/Luz", cat: "servicios" },
  { id: "internet", label: "Internet", cat: "servicios" },
  { id: "celular", label: "Plan Celular", cat: "servicios" },
  { id: "colegio", label: "Colegiatura", cat: "colegiatura" },
  { id: "seguro_carro", label: "Seguro de Carro", cat: "seguros" },
  { id: "seguro_vida", label: "Seguro de Vida/Médico", cat: "seguros" },
  { id: "netflix", label: "Netflix/Spotify", cat: "suscripciones" },
  { id: "gym", label: "Gimnasio", cat: "salud" },
  { id: "cuota_carro", label: "Cuota de Carro", cat: "transporte" },
  { id: "empleada", label: "Empleada del Hogar", cat: "empleada" },
];

const DEBT_TYPES = [
  "Tarjeta de crédito", "Préstamo personal", "Visa cuotas",
  "Préstamo vehicular", "Hipoteca",
];

// Slides de introducción visual
const INTRO_SLIDES = [
  {
    emoji: "📊",
    color: "from-primary/20 to-primary/5",
    title: "Tu Dashboard",
    subtitle: "Todo de un vistazo",
    bullets: [
      "Ve cuánto tenés disponible real cada mes",
      "Rastrea tus compromisos fijos y gastos variables",
      "Recibe alertas antes de que caigas en rojo",
    ],
    visual: "dashboard",
  },
  {
    emoji: "💸",
    color: "from-accent/20 to-accent/5",
    title: "Registra Gastos",
    subtitle: "Rápido, sin excusas",
    bullets: [
      "Agrega cualquier gasto en menos de 10 segundos",
      "Clasifica por categoría automáticamente",
      "Gastos a crédito se convierten en cuotas automáticas",
    ],
    visual: "gastos",
  },
  {
    emoji: "🎯",
    color: "from-green-500/20 to-green-500/5",
    title: "Presupuesto Inteligente",
    subtitle: "Topes que te protegen",
    bullets: [
      "Fija límites por categoría y bloquéalos para no tentarte",
      "Fondo de emergencia con meta y seguimiento mensual",
      "Ve tus compromisos del mes y márcalos como pagados",
    ],
    visual: "presupuesto",
  },
  {
    emoji: "🏆",
    color: "from-orange-500/20 to-orange-500/5",
    title: "Sueños y Deudas",
    subtitle: "Tu camino a la libertad",
    bullets: [
      "Define metas con nombre, monto y plazo real",
      "Estrategia bola de nieve o avalancha para tus deudas",
      "Flowi te dice exactamente cuándo llegás",
    ],
    visual: "suenos",
  },
];

function IntroVisual({ type }: { type: string }) {
  if (type === "dashboard") return (
    <div className="mt-4 rounded-2xl bg-primary/10 border border-primary/20 p-4 space-y-2">
      <div className="h-16 rounded-xl bg-primary/20 flex items-center justify-center">
        <span className="text-2xl font-bold text-primary">Q4,360</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {["Ingresos", "Fijos", "Variable"].map((l, i) => (
          <div key={i} className="h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-primary">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
  if (type === "gastos") return (
    <div className="mt-4 rounded-2xl bg-accent/10 border border-accent/20 p-4 space-y-2">
      {["Mercado · Q850", "Gasolinera · Q750", "Coca en la tienda · Q20"].map((item, i) => (
        <div key={i} className="h-9 rounded-xl bg-accent/15 flex items-center px-3">
          <span className="text-xs font-medium text-accent">{item}</span>
        </div>
      ))}
    </div>
  );
  if (type === "presupuesto") return (
    <div className="mt-4 rounded-2xl bg-green-500/10 border border-green-500/20 p-4 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-green-600">Fondo de Emergencia</span>
        <span className="text-xs font-bold text-green-600">65%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-2/3 rounded-full bg-green-500" />
      </div>
      {["Mercado 57%", "Gasolinera 88% ⚠️"].map((item, i) => (
        <div key={i} className="h-8 rounded-xl bg-green-500/10 flex items-center px-3">
          <span className="text-xs text-green-600">{item}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="mt-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 p-4 space-y-2">
      <div className="h-9 rounded-xl bg-orange-500/20 flex items-center justify-between px-3">
        <span className="text-xs font-bold text-orange-500">Subaru 🚗</span>
        <span className="text-xs font-bold text-orange-500">54%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-orange-500" />
      </div>
      <div className="h-9 rounded-xl bg-orange-500/10 flex items-center px-3">
        <span className="text-xs text-orange-500">Deuda Visa · 82 meses pagando mínimo</span>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  // step 1 = nombre, 2-5 = slides intro, 6 = ingreso, 7 = gastos fijos, 8 = deudas, 9 = meta
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingState>({
    name: profile?.name || "",
    incomeFrequency: "biweekly",
    incomePeriod1: "", incomePeriod2: "", incomePeriod3: "", incomePeriod4: "",
    hasDifferentMonth: false, incomeThisMonth: "",
    paymentDayType: "last_business_day_15_30",
    paymentDay1: "", paymentDay2: "",
    fixed_expenses: [], debts: [],
    goalType: null, goalName: "", goalAmount: "",
  });

  const updateData = (updates: Partial<OnboardingState>) =>
    setData((prev) => ({ ...prev, ...updates }));

  const TOTAL_STEPS = 9;

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
      const calcMonthly = getCalculatedMonthlyIncome();
      const thisMonth = data.hasDifferentMonth && Number(data.incomeThisMonth) > 0 ? Number(data.incomeThisMonth) : null;

      await supabase.from("users").upsert({
        id: user.id, name: data.name,
        income_type: data.incomeFrequency === "variable" ? "variable" : "fixed",
        income_min: 0, income_max: 0,
        income_frequency: data.incomeFrequency,
        income_period_1: Number(data.incomePeriod1) || 0,
        income_period_2: Number(data.incomePeriod2) || 0,
        income_period_3: Number(data.incomePeriod3) || 0,
        income_period_4: Number(data.incomePeriod4) || 0,
        monthly_income: calcMonthly,
        income_this_month: thisMonth,
        payment_day_type: data.paymentDayType,
        payment_day_1: parseInt(data.paymentDay1) || null,
        payment_day_2: parseInt(data.paymentDay2) || null,
        onboarding_complete: true,
      });

      if (data.fixed_expenses.length > 0) {
        await supabase.from("fixed_expenses").insert(
          data.fixed_expenses.map((e) => ({
            user_id: user.id, category: e.categoryId,
            amount: Number(e.amount) || 0, name: e.name,
            payment_day: Number(e.payment_day) || 1,
            payment_day_type: 'fixed', is_active: true,
          }))
        );
      }

      if (data.debts.length > 0) {
        await supabase.from("debts").insert(
          data.debts.filter(d => d.name && d.balance).map((d) => ({
            user_id: user.id, name: d.name, type: d.type || "Préstamo personal",
            current_balance: parseFloat(d.balance) || 0,
            interest_rate: parseFloat(d.rate) || 0,
            minimum_payment: parseFloat(d.minPayment) || 0,
            payment_day: parseInt(d.paymentDay) || 1,
          }))
        );
      }

      if (!skipGoal && data.goalType && data.goalName && data.goalAmount) {
        await supabase.from("goals").insert({
          user_id: user.id, name: data.goalName, type: data.goalType,
          total_amount: Number(data.goalAmount) || 0, current_saved: 0, priority: 1,
        });
      }

      await refreshProfile();
      navigate("/", { replace: true });
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
      setLoading(false);
    }
  };

  const isStep1Valid = data.name.trim().length > 0;
  const isStep6Valid = (() => {
    if (data.incomeFrequency === "monthly") return Number(data.incomePeriod1) > 0;
    if (data.incomeFrequency === "biweekly") return Number(data.incomePeriod1) > 0 && Number(data.incomePeriod2) > 0;
    if (data.incomeFrequency === "weekly") return Number(data.incomePeriod1) > 0;
    return Number(data.incomePeriod1) > 0;
  })();

  const introSlideIndex = step >= 2 && step <= 5 ? step - 2 : -1;
  const slide = introSlideIndex >= 0 ? INTRO_SLIDES[introSlideIndex] : null;

  const canContinue = () => {
    if (step === 1) return isStep1Valid;
    if (step === 6) return isStep6Valid;
    return true;
  };

  const goNext = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Progress */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-2 mb-1">
          {step > 1 && (
            <button onClick={goBack} className="p-1 rounded-full hover:bg-muted mr-1">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
          <div className="flex flex-1 gap-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-all",
                step > i ? "bg-primary" : step === i + 1 ? "bg-primary/50" : "bg-muted")} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-1">{step}/{TOTAL_STEPS}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-32">

        {/* STEP 1 — Nombre */}
        {step === 1 && (
          <div className="animate-fade-in pt-6 space-y-6">
            <div className="text-center py-6">
              <div className="text-6xl mb-4">👋</div>
              <h1 className="text-3xl font-extrabold text-foreground">Hola, soy Flowi</h1>
              <p className="mt-2 text-base text-muted-foreground">Tu compañero financiero guatemalteco. ¿Cómo te llamas?</p>
            </div>
            <input
              type="text" value={data.name}
              onChange={(e) => updateData({ name: e.target.value })}
              placeholder="Ej. María" autoFocus
              className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-lg text-foreground focus:border-primary outline-none text-center font-semibold"
            />
            {data.name && (
              <p className="text-center text-sm text-muted-foreground animate-fade-in">
                ¡Hola <strong className="text-foreground">{data.name}</strong>! Antes de arrancar, te muestro cómo funciona Flowi 🚀
              </p>
            )}
          </div>
        )}

        {/* STEPS 2-5 — Slides de introducción */}
        {slide && (
          <div className={cn("animate-fade-in pt-4 rounded-3xl bg-gradient-to-b p-6 mt-4", slide.color)}>
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">{slide.emoji}</div>
              <h2 className="text-2xl font-extrabold text-foreground">{slide.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{slide.subtitle}</p>
            </div>

            <IntroVisual type={slide.visual} />

            <div className="mt-6 space-y-3">
              {slide.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">{b}</p>
                </div>
              ))}
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {INTRO_SLIDES.map((_, i) => (
                <div key={i} className={cn("h-2 rounded-full transition-all",
                  i === introSlideIndex ? "w-6 bg-primary" : "w-2 bg-muted")} />
              ))}
            </div>
          </div>
        )}

        {/* STEP 6 — Ingreso */}
        {step === 6 && (
          <div className="animate-fade-in pt-4 space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-foreground">¿Cómo recibís tus pagos?</h1>
              <p className="text-sm text-muted-foreground mt-1">Esto le permite a Flowi calcular tu disponible real.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'biweekly', l: 'Quincenal 💰', sub: 'Día 15 y fin de mes' },
                { id: 'monthly', l: 'Mensual 📅', sub: 'Una vez al mes' },
                { id: 'weekly', l: 'Semanal 📆', sub: 'Cada semana' },
                { id: 'variable', l: 'Variable 📈', sub: 'Negocio propio' },
              ].map(t => (
                <button key={t.id}
                  onClick={() => updateData({ incomeFrequency: t.id as IncomeFrequency, incomePeriod1: '', incomePeriod2: '', incomePeriod3: '', incomePeriod4: '' })}
                  className={cn("p-3 rounded-xl border text-left transition-all",
                    data.incomeFrequency === t.id ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border')}>
                  <p className="text-sm font-bold">{t.l}</p>
                  <p className={cn("text-xs mt-0.5", data.incomeFrequency === t.id ? "text-white/70" : "text-muted-foreground")}>{t.sub}</p>
                </button>
              ))}
            </div>

            <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-3">
              {data.incomeFrequency === "monthly" && (
                <>
                  <label className="text-sm font-medium text-foreground">¿Cuánto recibís al mes?</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted-foreground">Q</span>
                    <input type="number" value={data.incomePeriod1} onChange={(e) => updateData({ incomePeriod1: e.target.value })}
                      className="w-full rounded-xl bg-card border border-border py-3 pl-8 pr-4 text-foreground outline-none" />
                  </div>
                  <select value={data.paymentDayType} onChange={(e) => updateData({ paymentDayType: e.target.value })}
                    className="w-full rounded-xl bg-card border border-border py-3 px-3 text-foreground text-sm">
                    <option value="last_business_day">Último día hábil del mes</option>
                    <option value="fixed_day">Día fijo específico</option>
                  </select>
                  {data.paymentDayType === "fixed_day" && (
                    <input type="number" placeholder="Día (ej. 25)" value={data.paymentDay1} onChange={(e) => updateData({ paymentDay1: e.target.value })}
                      className="w-full rounded-xl bg-card border border-border py-3 px-3 text-foreground" />
                  )}
                </>
              )}
              {data.incomeFrequency === "biweekly" && (
                <>
                  <label className="text-sm font-medium text-foreground">¿Cuánto recibís en cada quincena?</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">1ra Q</span>
                      <input type="number" value={data.incomePeriod1} onChange={(e) => updateData({ incomePeriod1: e.target.value })}
                        className="w-full rounded-xl bg-card border border-border py-3 pl-12 pr-2 text-foreground outline-none" />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">2da Q</span>
                      <input type="number" value={data.incomePeriod2} onChange={(e) => updateData({ incomePeriod2: e.target.value })}
                        className="w-full rounded-xl bg-card border border-border py-3 pl-12 pr-2 text-foreground outline-none" />
                    </div>
                  </div>
                  {(Number(data.incomePeriod1) + Number(data.incomePeriod2)) > 0 && (
                    <p className="text-xs text-primary font-bold">Total proyectado: {formatQ((Number(data.incomePeriod1) || 0) + (Number(data.incomePeriod2) || 0))}/mes</p>
                  )}
                </>
              )}
              {data.incomeFrequency === "weekly" && (
                <>
                  <label className="text-sm font-medium text-foreground">Pagos por semana (4 al mes)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((s) => (
                      <input key={s} type="number" placeholder={`Semana ${s} (Q)`}
                        value={[data.incomePeriod1, data.incomePeriod2, data.incomePeriod3, data.incomePeriod4][s - 1]}
                        onChange={(e) => updateData({ [`incomePeriod${s}`]: e.target.value } as any)}
                        className="w-full bg-card rounded-xl border border-border p-3 text-foreground" />
                    ))}
                  </div>
                  <p className="text-xs text-primary font-bold">Total: {formatQ(getCalculatedMonthlyIncome())}/mes</p>
                </>
              )}
              {data.incomeFrequency === "variable" && (
                <>
                  <label className="text-sm font-medium text-foreground">Ingreso variable</label>
                  <input type="number" placeholder="Mejor mes histórico (Q)" value={data.incomePeriod1}
                    onChange={(e) => updateData({ incomePeriod1: e.target.value })}
                    className="w-full bg-card rounded-xl border border-border p-3 text-foreground" />
                  <input type="number" placeholder="Peor mes histórico (Q)" value={data.incomePeriod2}
                    onChange={(e) => updateData({ incomePeriod2: e.target.value })}
                    className="w-full bg-card rounded-xl border border-border p-3 text-foreground" />
                  {getCalculatedMonthlyIncome() > 0 && (
                    <p className="text-xs text-primary font-bold">Base segura para Flowi: {formatQ(getCalculatedMonthlyIncome())}/mes</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* STEP 7 — Gastos fijos */}
        {step === 7 && (
          <div className="animate-fade-in pt-4 space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">¿Tenés gastos fijos?</h1>
              <p className="text-sm text-muted-foreground mt-1">Flowi los descuenta automáticamente. Podés saltar esto y agregarlo después.</p>
            </div>
            {COMMON_EXPENSES.map((ce) => {
              const isSelected = data.fixed_expenses.some(e => e.id === ce.id);
              const expObj = data.fixed_expenses.find(e => e.id === ce.id);
              return (
                <div key={ce.id} className="rounded-2xl border border-border p-3 flex flex-col gap-2 bg-card">
                  <div className="flex justify-between items-center cursor-pointer"
                    onClick={() => {
                      if (isSelected) updateData({ fixed_expenses: data.fixed_expenses.filter(x => x.id !== ce.id) });
                      else updateData({ fixed_expenses: [...data.fixed_expenses, { id: ce.id, categoryId: ce.cat, amount: "", name: ce.label, payment_day: "" }] });
                    }}>
                    <span className="font-medium text-sm text-foreground">{ce.label}</span>
                    <Switch checked={isSelected} />
                  </div>
                  {isSelected && (
                    <div className="flex gap-2">
                      <input type="number" value={expObj?.amount || ""} placeholder="Monto (Q)"
                        onChange={(e) => updateData({ fixed_expenses: data.fixed_expenses.map(x => x.id === ce.id ? { ...x, amount: e.target.value } : x) })}
                        className="w-1/2 p-2 border border-border rounded-xl outline-none bg-background text-foreground text-sm" />
                      <input type="number" placeholder="Día de pago" value={expObj?.payment_day || ""}
                        onChange={(e) => updateData({ fixed_expenses: data.fixed_expenses.map(x => x.id === ce.id ? { ...x, payment_day: e.target.value } : x) })}
                        className="w-1/2 p-2 border border-border rounded-xl outline-none bg-background text-foreground text-sm" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* STEP 8 — Deudas (Premium teaser) */}
        {step === 8 && (
          <div className="animate-fade-in pt-4 space-y-5">
            <div className="text-center pt-4">
              <div className="text-5xl mb-3">💳</div>
              <h1 className="text-2xl font-extrabold text-foreground">Liquidá tus deudas más rápido</h1>
              <p className="text-sm text-muted-foreground mt-2">Con Flowi Premium sabés exactamente en cuánto tiempo quedás libre.</p>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-purple-600/20 to-purple-800/10 border border-purple-500/30 p-5 space-y-3">
              {[
                { icon: "🏔️", title: "Estrategia Avalancha", desc: "Pagás menos intereses en total" },
                { icon: "❄️", title: "Estrategia Bola de Nieve", desc: "Cerrás deudas pequeñas primero — más motivación" },
                { icon: "📅", title: "Proyección mes a mes", desc: "Flowi te dice exactamente cuándo quedás libre" },
                { icon: "⚡", title: "Pago extra inteligente", desc: "¿Cayó algo extra? Flowi te dice dónde ponerlo" },
              ].map((item) => (
                <div key={item.title} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-card border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Ejemplo real</p>
              <p className="text-sm font-bold text-foreground mt-1">Visa BAM · Q15,000 · 24% anual</p>
              <div className="flex justify-center gap-6 mt-3">
                <div>
                  <p className="text-xs text-muted-foreground">Pagando mínimo</p>
                  <p className="text-base font-extrabold text-destructive">82 meses</p>
                </div>
                <div className="w-px bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground">Con Flowi</p>
                  <p className="text-base font-extrabold text-primary">31 meses</p>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">Agregás tus deudas reales una vez dentro de la app ✌️</p>
          </div>
        )}
        {/* STEP 9 — Sueños (Premium teaser) + Finish */}
        {step === 9 && (
          <div className="animate-fade-in pt-4 space-y-5">
            <div className="text-center pt-4">
              <div className="text-5xl mb-3">✨</div>
              <h1 className="text-2xl font-extrabold text-foreground">Tus sueños tienen precio. Flowi te dice cómo llegar.</h1>
              <p className="text-sm text-muted-foreground mt-2">Desde un carro hasta un viaje o un fondo de emergencia.</p>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-700/10 border border-orange-500/30 p-5 space-y-3">
              {[
                { icon: "🚗", title: "Vehículo con enganche", desc: "Calculá cuota mensual y cuándo tener el enganche" },
                { icon: "✈️", title: "Viaje soñado", desc: "Ahorrá en potes separados sin mezclar plata" },
                { icon: "🏠", title: "Casa propia", desc: "Proyección realista con enganche y cuotas" },
                { icon: "🛡️", title: "Fondo de emergencia", desc: "3-6 meses de gastos — tu red de seguridad" },
              ].map((item) => (
                <div key={item.title} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-card border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">Todo esto te espera adentro 👇</p>
              <p className="text-sm font-bold text-foreground mt-1">Empezá gratis. Desbloqueá cuando quieras.</p>
            </div>

            <div className="pt-2 space-y-3">
              <button
                disabled={loading}
                onClick={() => handleFinish(true)}
                className="w-full bg-primary text-white font-bold p-4 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                {loading
                  ? <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  : <>Entrar a Flowi <Zap className="h-5 w-5" /></>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA — steps 1-8 */}
      {step < 9 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-6 py-4">
          <div className="max-w-lg mx-auto space-y-2">
            <button
              onClick={goNext}
              disabled={!canContinue()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-primary/90 disabled:opacity-40"
            >
              {step >= 2 && step <= 5
                ? introSlideIndex === 3 ? "¡Entendido, empecemos! 🚀" : "Siguiente →"
                : "Continuar"} <ArrowRight className="h-5 w-5" />
            </button>
            {(step === 7 || step === 8) && (
              <button onClick={goNext} className="w-full text-center text-sm text-muted-foreground py-1 font-medium">
                Saltar por ahora →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
