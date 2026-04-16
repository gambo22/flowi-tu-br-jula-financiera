import { useState, useEffect } from "react";
import { X, Banknote, CreditCard, Landmark, Lightbulb } from "lucide-react";
import { EXPENSE_CATEGORIES, SAVING_TIPS, formatQ } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PaymentMethod = "efectivo" | "debito" | "credito";

interface SaveExpensePayload {
  id?: string;
  amount: number;
  category: string;
  date: string;
  note: string;
  is_recurring: boolean;
  payment_method: PaymentMethod;
}

interface SaveFixedPayload {
  name: string;
  category: string;
  installment_amount: number;
  installment_total: number;
  payment_day: number;
}

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: any;
  onSave: (expense: SaveExpensePayload) => void;
  onSaveFixed?: (fixed: SaveFixedPayload) => void;
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { id: "efectivo", label: "Efectivo", icon: Banknote },
  { id: "debito", label: "Débito", icon: Landmark },
  { id: "credito", label: "Crédito", icon: CreditCard },
];

function getSavingTip(category: string, amount: number) {
  // Café fantasma
  const cafeTip = SAVING_TIPS.find((t) => t.id === "cafe_fantasma");
  if (cafeTip && (cafeTip.triggerCategories as readonly string[]).includes(category)) return cafeTip;
  // Impulso 48h
  const impulsoTip = SAVING_TIPS.find((t) => t.id === "impulso_48h");
  if (
    impulsoTip &&
    (impulsoTip.triggerCategories as readonly string[]).includes(category) &&
    amount >= (impulsoTip.minAmount ?? 0)
  ) return impulsoTip;
  // Redondeo — siempre
  const roundTip = SAVING_TIPS.find((t) => t.id === "redondeo");
  if (roundTip) return roundTip;
  return null;
}

function getRoundingSuggestion(amount: number): number {
  const next100 = Math.ceil(amount / 100) * 100;
  return next100 - amount;
}

export default function AddExpenseModal({
  open,
  onClose,
  initialData,
  onSave,
  onSaveFixed,
}: AddExpenseModalProps) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentTotal, setInstallmentTotal] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [paymentDay, setPaymentDay] = useState("15");

  // Callout state
  const [showTip, setShowTip] = useState(false);
  const [activeTip, setActiveTip] = useState<(typeof SAVING_TIPS)[number] | null>(null);
  const [savedAmount, setSavedAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setAmount(initialData.amount ? initialData.amount.toString() : "");
        setCategory(initialData.category || "");
        setDate(
          initialData.date
            ? new Date(initialData.date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
        );
        setNote(initialData.note || "");
        setPaymentMethod((initialData.payment_method as PaymentMethod) || "efectivo");
        setIsInstallment(false);
        setInstallmentTotal("");
        setInstallmentAmount("");
        setPaymentDay("15");
      } else {
        setAmount("");
        setCategory("");
        setDate(new Date().toISOString().split("T")[0]);
        setNote("");
        setPaymentMethod("efectivo");
        setIsInstallment(false);
        setInstallmentTotal("");
        setInstallmentAmount("");
        setPaymentDay("15");
      }
      setShowTip(false);
      setActiveTip(null);
    }
  }, [open, initialData]);

  if (!open) return null;

  const isNewCreditInstallment = !initialData && paymentMethod === "credito" && isInstallment;
  const canSave = amount && category;
  const canSaveInstallment = amount && category && installmentTotal && installmentAmount && paymentDay;

  const handleSave = async () => {
    if (saving) return;
    if (isNewCreditInstallment) {
      if (!canSaveInstallment) return;
      setSaving(true);
      onSaveFixed?.({
        name: note || EXPENSE_CATEGORIES.find((c) => c.id === category)?.label || "Cuota crédito",
        category,
        installment_amount: parseFloat(installmentAmount),
        installment_total: parseInt(installmentTotal),
        payment_day: parseInt(paymentDay),
      });
      setSaving(false);
      onClose();
    } else {
      if (!canSave) return;
      setSaving(true);
      const numAmount = parseFloat(amount);
      onSave({
        id: initialData?.id,
        amount: numAmount,
        category,
        date,
        note,
        is_recurring: false,
        payment_method: paymentMethod,
      });
      const tip = getSavingTip(category, numAmount);
      if (!initialData && tip) {
        setSavedAmount(numAmount);
        setActiveTip(tip);
        setShowTip(true);
        setSaving(false);
        return;
      }
      setSaving(false);
      onClose();
    }
  };

  const totalCompra = parseFloat(installmentTotal) * parseFloat(installmentAmount) || 0;
  const roundingSave = activeTip?.id === "redondeo" ? getRoundingSuggestion(savedAmount) : 0;

  // ── Saving tip callout screen ──────────────────────────────────────────────
  if (showTip && activeTip) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
        <div className="animate-slide-up w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card p-6 max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">{activeTip.emoji}</div>
            <h2 className="text-lg font-bold text-foreground mb-1">{activeTip.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {activeTip.description}
            </p>
            {activeTip.id === "redondeo" && roundingSave > 0 && (
              <div className="mt-3 rounded-xl bg-primary/10 border border-primary/20 p-3">
                <p className="text-sm font-bold text-primary">
                  Redondeá {formatQ(savedAmount)} → mové {formatQ(roundingSave)} a tu fondo de ahorro
                </p>
              </div>
            )}
            {activeTip.id === "cafe_fantasma" && (
              <div className="mt-3 rounded-xl bg-accent/10 border border-accent/20 p-3">
                <p className="text-sm font-bold text-accent">
                  Intentá guardar {formatQ(savedAmount)} adicionales este mes ☕
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Omitir
            </Button>
            <Button className="flex-1" onClick={onClose}>
              ¡Entendido! 💪
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-3 opacity-60">
            Gasto guardado correctamente ✓
          </p>
        </div>
      </div>
    );
  }

  // ── Main modal ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">
            {initialData ? "Editar gasto" : "Nuevo gasto"}
          </h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Monto */}
        <div className="mb-6 text-center">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Monto</label>
          <div className="flex items-center justify-center gap-1">
            <span className="text-3xl font-bold text-foreground">Q</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-48 border-none bg-transparent text-center text-4xl font-bold text-foreground outline-none placeholder:text-muted-foreground/40"
              autoFocus
            />
          </div>
        </div>

        {/* Categoría — fix mobile overflow */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Categoría</label>
          <div className="grid grid-cols-4 gap-2">
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "flex flex-col items-center justify-start gap-1 rounded-xl p-2 text-xs transition-all min-h-[64px]",
                  category === cat.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <cat.icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2 text-center leading-tight">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Método de pago */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">
            ¿Cómo pagaste?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((pm) => {
              const Icon = pm.icon;
              return (
                <button
                  key={pm.id}
                  onClick={() => {
                    setPaymentMethod(pm.id);
                    if (pm.id !== "credito") setIsInstallment(false);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 text-xs font-semibold transition-all border-2",
                    paymentMethod === pm.id
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {pm.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cuotas */}
        {paymentMethod === "credito" && !initialData && (
          <div className="mb-5 rounded-xl bg-orange-500/10 border border-orange-500/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-orange-600 dark:text-orange-400">¿Es a cuotas?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsInstallment(true)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                    isInstallment ? "bg-orange-500 text-white shadow-sm" : "bg-muted text-muted-foreground")}
                >Sí</button>
                <button
                  onClick={() => setIsInstallment(false)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                    !isInstallment ? "bg-orange-500 text-white shadow-sm" : "bg-muted text-muted-foreground")}
                >No</button>
              </div>
            </div>
            {isInstallment && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-orange-600/80 dark:text-orange-400/80">
                  Se agregará a tus <strong>Compromisos Fijos</strong> automáticamente.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Número de cuotas</label>
                    <Input type="number" placeholder="Ej: 12" value={installmentTotal}
                      onChange={(e) => setInstallmentTotal(e.target.value)} className="mt-1" min={1} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Monto por cuota (Q)</label>
                    <Input type="number" placeholder="Ej: 350" value={installmentAmount}
                      onChange={(e) => setInstallmentAmount(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Día de débito (1–31)</label>
                  <Input type="number" placeholder="Ej: 15" value={paymentDay}
                    onChange={(e) => setPaymentDay(e.target.value)} className="mt-1" min={1} max={31} />
                </div>
                {installmentTotal && installmentAmount && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold bg-orange-500/10 rounded-lg p-2 text-center">
                    Total: Q{totalCompra.toFixed(2)} — {installmentTotal} cuotas de Q{installmentAmount}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Fecha */}
        {!isNewCreditInstallment && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Fecha</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}

        {/* Nota */}
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            {isNewCreditInstallment ? "Descripción del artículo" : "Nota (opcional)"}
          </label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isNewCreditInstallment ? "Ej: TV Samsung 55 pulgadas" : "Ej: Despensa semanal"}
          />
        </div>

        <Button
          onClick={handleSave}
          className="w-full"
          size="lg"
          disabled={(isNewCreditInstallment ? !canSaveInstallment : !canSave) || saving}
        >
          {saving
            ? <span className="flex items-center gap-2"><span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"/>{" "}Guardando...</span>
            : isNewCreditInstallment
              ? `Agregar ${installmentTotal || "?"} cuotas a Compromisos 💳`
              : initialData ? "Actualizar gasto ✨" : "Guardar gasto ✨"}
        </Button>
      </div>
    </div>
  );
}
