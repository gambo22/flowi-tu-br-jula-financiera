import { useState, useMemo } from "react";
import { Plus, Zap, Snowflake, X, Check, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { formatQ } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ConfirmModal from "@/components/ConfirmModal";

type Strategy = "snowball" | "avalanche";

export default function Deudas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [strategy, setStrategy] = useState<Strategy>("snowball");
  const [showForm, setShowForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState<any>(null);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: "", message: "", debtId: "" });

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const { data: debts = [] } = useQuery({
    queryKey: ["debts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts").select("*").eq("user_id", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: debtPayments = [] } = useQuery({
    queryKey: ["debt_payments", user?.id, currentMonth, currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debt_payments")
        .select("*")
        .eq("user_id", user?.id)
        .eq("month", currentMonth)
        .eq("year", currentYear);
      if (error && error.code !== '42P01') throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const addDebtMutation = useMutation({
    mutationFn: async (debt: any) => {
      const { error } = await supabase.from("debts").insert({
        user_id: user?.id,
        name: debt.name, type: debt.type,
        current_balance: debt.current_balance,
        interest_rate: debt.interest_rate,
        minimum_payment: debt.minimum_payment,
        payment_day: debt.payment_day,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts", user?.id] });
      toast.success("¡Deuda registrada!");
      setShowForm(false);
    },
  });

  const updateDebtMutation = useMutation({
    mutationFn: async (debt: any) => {
      const { error } = await supabase.from("debts").update({
        name: debt.name, type: debt.type,
        current_balance: debt.current_balance,
        interest_rate: debt.interest_rate,
        minimum_payment: debt.minimum_payment,
        payment_day: debt.payment_day,
      }).eq("id", debt.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts", user?.id] });
      toast.success("Deuda actualizada");
      setEditingDebt(null);
    },
  });

  const deleteDebtMutation = useMutation({
    mutationFn: async (debtId: string) => {
      const { error } = await supabase.from("debts").delete().eq("id", debtId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts", user?.id] });
      toast.success("Deuda eliminada");
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ debt, unpay }: { debt: any; unpay: boolean }) => {
      if (unpay) {
        const payment = debtPayments.find((p: any) => p.debt_id === debt.id);
        if (payment) {
          const { error } = await supabase.from("debt_payments").delete().eq("id", (payment as any).id);
          if (error) throw error;
          await supabase.from("debts").update({
            current_balance: (debt.current_balance || 0) + (debt.minimum_payment || 0)
          }).eq("id", debt.id);
        }
      } else {
        const { error } = await supabase.from("debt_payments").insert({
          user_id: user?.id,
          debt_id: debt.id,
          amount_paid: debt.minimum_payment,
          month: currentMonth,
          year: currentYear,
        });
        if (error) throw error;
        await supabase.from("debts").update({
          current_balance: Math.max(0, (debt.current_balance || 0) - (debt.minimum_payment || 0))
        }).eq("id", debt.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["debt_payments", user?.id, currentMonth, currentYear] });
      toast.success("¡Actualizado!");
    },
  });

  const sortedDebts = useMemo(() => {
    const sorted = [...debts];
    if (strategy === "snowball") sorted.sort((a, b) => (a.current_balance || 0) - (b.current_balance || 0));
    else sorted.sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0));
    return sorted;
  }, [debts, strategy]);

  const totalDebt = useMemo(() => debts.reduce((s: number, d: any) => s + (d.current_balance || 0), 0), [debts]);
  const totalMinPayments = useMemo(() => debts.reduce((s: number, d: any) => s + (d.minimum_payment || 0), 0), [debts]);

  const isPaid = (debtId: string) => debtPayments.some((p: any) => p.debt_id === debtId);

  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

  return (
    <div className="animate-fade-in p-4 pb-24">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Deudas</h1>

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

      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setStrategy("snowball")}
          className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl p-3 text-sm font-medium transition-all",
            strategy === "snowball" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
        >
          <Snowflake className="h-4 w-4" /> Bola de nieve
        </button>
        <button
          onClick={() => setStrategy("avalanche")}
          className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl p-3 text-sm font-medium transition-all",
            strategy === "avalanche" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}
        >
          <Zap className="h-4 w-4" /> Avalancha
        </button>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        {strategy === "snowball"
          ? "💡 Empieza por la deuda más pequeña. La motivación de liquidarla rápido te impulsa."
          : "💡 Empieza por la tasa más alta. A la larga ahorras más en intereses."}
      </p>

      <div className="space-y-3 mb-4">
        {sortedDebts.map((debt: any, index: number) => {
          const paid = isPaid(debt.id);
          const isLoading = markPaidMutation.isPending;
          return (
            <div
              key={debt.id}
              className={cn(
                "rounded-2xl bg-card p-4 border transition-all",
                index === 0 ? "border-primary shadow-sm" : "border-border",
                paid && "opacity-75"
              )}
            >
              {index === 0 && !paid && (
                <span className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  ← Atacar primero
                </span>
              )}
              {paid && (
                <span className="mb-2 inline-block rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-600">
                  ✓ Pagado {monthNames[currentMonth - 1]}
                </span>
              )}
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-foreground">{debt.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{debt.type}</span>
                  <button
                    onClick={() => setEditingDebt(debt)}
                    className="p-1 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setConfirmConfig({
                      isOpen: true,
                      title: "Eliminar deuda",
                      message: `¿Estás seguro de que deseas eliminar la deuda "${debt.name}"? Esta acción no se puede deshacer.`,
                      debtId: debt.id
                    })}
                    className="p-1 rounded-lg hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className="text-sm font-bold text-foreground">{formatQ(debt.current_balance || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tasa</p>
                  <p className="text-sm font-bold text-foreground">{debt.interest_rate}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pago mín.</p>
                  <p className="text-sm font-bold text-foreground">{formatQ(debt.minimum_payment || 0)}</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-muted/40 p-3 space-y-1.5 text-xs mb-3">
                {(() => {
                  const balance = debt.current_balance || 0;
                  const minPay = debt.minimum_payment || 0;
                  const annualRate = debt.interest_rate || 0;
                  const rate = annualRate / 100 / 12; // tasa mensual

                  if (balance <= 0 || minPay <= 0) return null;

                  // Meses pagando solo mínimo (amortización estándar)
                  let monthsMin = 0;
                  if (rate > 0 && minPay > balance * rate) {
                    monthsMin = Math.ceil(Math.log(minPay / (minPay - balance * rate)) / Math.log(1 + rate));
                  } else if (rate === 0) {
                    monthsMin = Math.ceil(balance / minPay);
                  } else {
                    monthsMin = 999; // cuota no cubre interés
                  }

                  const totalPaidMin = minPay * monthsMin;
                  const totalInterest = Math.max(totalPaidMin - balance, 0);

                  // Pagando 20% más
                  const extraPay = minPay * 1.2;
                  let monthsExtra = 0;
                  if (rate > 0 && extraPay > balance * rate) {
                    monthsExtra = Math.ceil(Math.log(extraPay / (extraPay - balance * rate)) / Math.log(1 + rate));
                  } else if (rate === 0) {
                    monthsExtra = Math.ceil(balance / extraPay);
                  }
                  const totalPaidExtra = extraPay * monthsExtra;
                  const interestSaved = Math.max(totalPaidMin - totalPaidExtra, 0);
                  const monthsSaved = Math.max(monthsMin - monthsExtra, 0);

                  // Punto de inflexión: antes/después de la mitad
                  const halfPoint = Math.ceil(monthsMin / 2);
                  const currentMonth = (debt.months_paid || 0);
                  const isBeforeHalf = currentMonth < halfPoint;

                  return (
                    <div className="mt-3 bg-muted/40 p-3 space-y-2 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Pagando solo mínimo:</span>
                        <span className="font-semibold text-foreground">
                          {monthsMin >= 999 ? "⚠️ Cuota no cubre interés" : `${monthsMin} meses`}
                        </span>
                      </div>
                      {totalInterest > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Pagarás en intereses:</span>
                          <span className="font-semibold text-destructive">{formatQ(totalInterest)}</span>
                        </div>
                      )}
                      {monthsSaved > 2 && interestSaved > 0 && (
                        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2 text-green-600">
                          💡 Pagando {formatQ(extraPay)}/mes ahorrarías <strong>{formatQ(interestSaved)}</strong> y {monthsSaved} meses
                        </div>
                      )}
                      <div className={cn(
                        "rounded-lg p-2 text-xs",
                        isBeforeHalf
                          ? "bg-primary/10 border border-primary/20 text-primary"
                          : "bg-muted/60 border border-border text-muted-foreground"
                      )}>
                        {isBeforeHalf
                          ? "⚡ Estás en la primera mitad del préstamo. Pagos extra aquí ahorran mucho en intereses."
                          : "📅 Pasaste la mitad del préstamo. Pagos extra ahora reducen tiempo, no tanto interés."}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <p className="text-xs text-muted-foreground mb-3">Día de pago: {debt.payment_day} de cada mes</p>
              <button
                onClick={() => markPaidMutation.mutate({ debt, unpay: paid })}
                disabled={isLoading}
                className={cn(
                  "w-full rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 transition-all",
                  paid
                    ? "bg-green-500/10 text-green-600 border border-green-500/20"
                    : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                )}
              >
                {isLoading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : paid ? (
                  <><Check className="h-4 w-4" /> Pagado este mes</>
                ) : (
                  <><Check className="h-4 w-4" /> Pagar cuota del mes</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {debts.length === 0 && (
        <div className="mt-6 mb-8 text-center rounded-2xl bg-primary/10 p-6 border border-primary/20">
          <p className="text-lg font-bold text-primary mb-1">¡Eres libre financieramente! 🎉</p>
          <p className="text-sm text-foreground">No tienes ni una sola deuda registrada.</p>
        </div>
      )}

      <Button onClick={() => setShowForm(true)} className="w-full" size="lg">
        <Plus className="h-5 w-5 mr-1" /> Agregar deuda
      </Button>

      {showForm && (
        <DebtModal onClose={() => setShowForm(false)} onSave={(d) => addDebtMutation.mutate(d)} />
      )}
      {editingDebt && (
        <DebtModal
          initial={editingDebt}
          onClose={() => setEditingDebt(null)}
          onSave={(d) => updateDebtMutation.mutate({ ...d, id: editingDebt.id })}
          isSaving={updateDebtMutation.isPending}
        />
      )}

      {confirmConfig.isOpen && (
        <ConfirmModal
          title={confirmConfig.title}
          message={confirmConfig.message}
          variant="destructive"
          onConfirm={() => {
            if (confirmConfig.debtId) {
              deleteDebtMutation.mutate(confirmConfig.debtId);
            }
            setConfirmConfig({ ...confirmConfig, isOpen: false });
          }}
          onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        />
      )}
    </div>
  );
}

function DebtModal({ onClose, onSave, initial, isSaving }: {
  onClose: () => void;
  onSave: (d: any) => void;
  initial?: any;
  isSaving?: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "");
  const [balance, setBalance] = useState(initial?.current_balance?.toString() || "");
  const [rate, setRate] = useState(initial?.interest_rate?.toString() || "");
  const [minPayment, setMinPayment] = useState(initial?.minimum_payment?.toString() || "");
  const [paymentDay, setPaymentDay] = useState(initial?.payment_day?.toString() || "");
  const [startMonth, setStartMonth] = useState(initial?.start_month?.toString() || new Date().getMonth().toString());
  const [startYear, setStartYear] = useState(initial?.start_year?.toString() || new Date().getFullYear().toString());
  const [totalInstallments, setTotalInstallments] = useState(initial?.total_installments?.toString() || "");
  const [monthsPaid, setMonthsPaid] = useState(initial?.months_paid?.toString() || "");

  const DEBT_TYPE_OPTIONS = [
    "Tarjeta de crédito",
    "Préstamo personal",
    "Visa cuotas",
    "Préstamo vehicular",
    "Hipoteca",
  ];

  const currentMonth = parseInt(startMonth) || 1;
  const currentYear = parseInt(startYear) || new Date().getFullYear();
  const paid = parseInt(monthsPaid) || 0;
  const total = parseInt(totalInstallments) || 0;
  const halfPoint = Math.ceil(total / 2);
  const isBeforeHalf = paid < halfPoint;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">{initial ? "Editar deuda" : "Nueva deuda"}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Visa BAM" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl bg-background border border-border py-3 px-4 text-foreground focus:border-primary outline-none text-sm"
            >
              <option value="">Seleccionar tipo</option>
              {DEBT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Saldo actual (Q)</label>
            <Input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Tasa anual (%)</label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Pago mínimo (Q/mes)</label>
              <Input type="number" value={minPayment} onChange={(e) => setMinPayment(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Día de pago (1–31)</label>
            <Input type="number" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} placeholder="15" />
          </div>

          <div className="rounded-xl bg-muted/40 p-3 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase">Cuotas / Plazo</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Total de cuotas</label>
                <Input type="number" value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)} placeholder="Ej: 60" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Cuotas ya pagadas</label>
                <Input type="number" value={monthsPaid} onChange={(e) => setMonthsPaid(e.target.value)} placeholder="Ej: 12" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Mes de inicio</label>
                <select value={startMonth} onChange={(e) => setStartMonth(e.target.value)}
                  className="w-full rounded-xl bg-background border border-border py-2.5 px-3 text-sm text-foreground outline-none">
                  {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Año de inicio</label>
                <Input type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)} placeholder="2023" />
              </div>
            </div>

            {total > 0 && paid > 0 && (
              <div className={cn(
                "rounded-lg p-2 text-xs text-center font-semibold",
                isBeforeHalf ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                Cuota {paid} de {total} · {isBeforeHalf ? "⚡ Primera mitad — pagos extra ahorran mucho en intereses" : "📅 Segunda mitad — pagos extra reducen tiempo"}
              </div>
            )}
          </div>

          <Button
            onClick={() => onSave({
              name, type,
              current_balance: parseFloat(balance) || 0,
              interest_rate: parseFloat(rate) || 0,
              minimum_payment: parseFloat(minPayment) || 0,
              payment_day: parseInt(paymentDay) || 1,
              total_installments: parseInt(totalInstallments) || 0,
              months_paid: parseInt(monthsPaid) || 0,
              start_month: parseInt(startMonth) || 1,
              start_year: parseInt(startYear) || new Date().getFullYear(),
            })}
            className="w-full" size="lg"
            disabled={!name || !type || !balance || isSaving}
          >
            {isSaving
              ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : initial ? "Guardar cambios" : "Guardar deuda"}
          </Button>
        </div>
      </div>
    </div>
  );
}
