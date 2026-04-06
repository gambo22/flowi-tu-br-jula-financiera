import { useState, useMemo } from "react";
import { Plus, Zap, Snowflake, X } from "lucide-react";
import { demoDebts } from "@/lib/demo-data";
import { DEBT_TYPES, formatQ } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Strategy = "snowball" | "avalanche";

export default function Deudas() {
  const [debts, setDebts] = useState(demoDebts);
  const [strategy, setStrategy] = useState<Strategy>("snowball");
  const [showForm, setShowForm] = useState(false);

  const sortedDebts = useMemo(() => {
    const sorted = [...debts];
    if (strategy === "snowball") {
      sorted.sort((a, b) => a.current_balance - b.current_balance);
    } else {
      sorted.sort((a, b) => b.interest_rate - a.interest_rate);
    }
    return sorted;
  }, [debts, strategy]);

  const totalDebt = useMemo(() => debts.reduce((s, d) => s + d.current_balance, 0), [debts]);
  const totalMinPayments = useMemo(() => debts.reduce((s, d) => s + d.minimum_payment, 0), [debts]);

  return (
    <div className="animate-fade-in p-4 pb-24">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Deudas</h1>

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card p-3 border border-border">
          <p className="text-xs text-muted-foreground">Total adeudado</p>
          <p className="text-lg font-bold text-destructive">{formatQ(totalDebt)}</p>
        </div>
        <div className="rounded-xl bg-card p-3 border border-border">
          <p className="text-xs text-muted-foreground">Pagos mínimos/mes</p>
          <p className="text-lg font-bold text-foreground">{formatQ(totalMinPayments)}</p>
        </div>
      </div>

      {/* Strategy selector */}
      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setStrategy("snowball")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl p-3 text-sm font-medium transition-all",
            strategy === "snowball" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <Snowflake className="h-4 w-4" /> Bola de nieve
        </button>
        <button
          onClick={() => setStrategy("avalanche")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl p-3 text-sm font-medium transition-all",
            strategy === "avalanche" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <Zap className="h-4 w-4" /> Avalancha
        </button>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        {strategy === "snowball"
          ? "💡 Empieza por la deuda más pequeña. La motivación de liquidarla rápido te impulsa."
          : "💡 Empieza por la tasa más alta. A la larga ahorras más en intereses."}
      </p>

      {/* Debt cards */}
      <div className="space-y-3 mb-4">
        {sortedDebts.map((debt, index) => (
          <div key={debt.id} className={cn(
            "rounded-2xl bg-card p-4 border transition-all",
            index === 0 ? "border-primary shadow-sm" : "border-border"
          )}>
            {index === 0 && (
              <span className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                ← Atacar primero
              </span>
            )}
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-foreground">{debt.name}</p>
              <span className="text-xs text-muted-foreground">{debt.type}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className="text-sm font-bold text-foreground">{formatQ(debt.current_balance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tasa</p>
                <p className="text-sm font-bold text-foreground">{debt.interest_rate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pago mín.</p>
                <p className="text-sm font-bold text-foreground">{formatQ(debt.minimum_payment)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Día de pago: {debt.payment_day} de cada mes</p>
          </div>
        ))}
      </div>

      {debts.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-foreground">¡Sin deudas! 🎉</p>
          <p className="text-sm text-muted-foreground mt-1">Eres libre financieramente</p>
        </div>
      )}

      <Button onClick={() => setShowForm(true)} className="w-full" size="lg">
        <Plus className="h-5 w-5 mr-1" /> Agregar deuda
      </Button>

      {showForm && <NewDebtModal onClose={() => setShowForm(false)} onSave={(debt) => {
        setDebts((prev) => [...prev, { ...debt, id: Date.now().toString() }]);
        setShowForm(false);
      }} />}
    </div>
  );
}

function NewDebtModal({ onClose, onSave }: { onClose: () => void; onSave: (d: any) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [balance, setBalance] = useState("");
  const [rate, setRate] = useState("");
  const [minPayment, setMinPayment] = useState("");
  const [paymentDay, setPaymentDay] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Nueva deuda</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Ej: Visa BAM' />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Tipo</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>
                {DEBT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Saldo actual (Q)</label>
            <Input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Tasa de interés anual (%)</label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Pago mínimo mensual (Q)</label>
            <Input type="number" value={minPayment} onChange={(e) => setMinPayment(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Día de pago/corte</label>
            <Input type="number" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} placeholder="15" />
          </div>
          <Button
            onClick={() => onSave({
              name, type,
              current_balance: parseFloat(balance) || 0,
              interest_rate: parseFloat(rate) || 0,
              minimum_payment: parseFloat(minPayment) || 0,
              payment_day: parseInt(paymentDay) || 1,
            })}
            className="w-full" size="lg"
            disabled={!name || !type || !balance}
          >
            Guardar deuda
          </Button>
        </div>
      </div>
    </div>
  );
}
