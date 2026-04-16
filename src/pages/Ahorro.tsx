import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, ArrowDownCircle, ArrowUpCircle, X, Landmark, TrendingUp, Wallet, Coins, Home } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { formatQ } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const POT_TYPES = [
  { id: "banco",     label: "Cuenta banco",  icon: Landmark },
  { id: "inversion", label: "Inversión",      icon: TrendingUp },
  { id: "asset",     label: "Asset/Bien",     icon: Home },
  { id: "efectivo",  label: "Efectivo",       icon: Coins },
] as const;

const MONTHS_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ─── helpers ──────────────────────────────────────────────────────────────────
function getPotIcon(type: string) {
  return POT_TYPES.find(p => p.id === type)?.icon || Wallet;
}

function getPotColor(type: string) {
  switch (type) {
    case "banco":     return "#10B981";
    case "inversion": return "#3B82F6";
    case "asset":     return "#8B5CF6";
    case "efectivo":  return "#F59E0B";
    default:          return "#6B7280";
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Ahorro() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showNewPot, setShowNewPot]           = useState(false);
  const [movementPot, setMovementPot]         = useState<any>(null);
  const [movementType, setMovementType]       = useState<"deposit"|"withdrawal">("deposit");

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: pots = [] } = useQuery({
    queryKey: ["savings_pots", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_pots").select("*").eq("user_id", user?.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["savings_pot_movements", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_pot_movements").select("*").eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const addPotMutation = useMutation({
    mutationFn: async ({ name, type, balance }: { name: string; type: string; balance: number }) => {
      const { error } = await supabase.from("savings_pots").insert({
        user_id: user?.id, name, type, balance,
      });
      if (error) throw error;
      // Si saldo inicial > 0, registrar movimiento
      if (balance > 0) {
        const { data: pot } = await supabase
          .from("savings_pots").select("id").eq("user_id", user?.id)
          .order("created_at", { ascending: false }).limit(1).single();
        if (pot) {
          const today = new Date();
          await supabase.from("savings_pot_movements").insert({
            user_id: user?.id, pot_id: pot.id, amount: balance,
            type: "deposit", note: "Saldo inicial",
            month: today.getMonth() + 1, year: today.getFullYear(),
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_pots", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["savings_pot_movements", user?.id] });
      toast.success("¡Pote de ahorro creado! 💰");
      setShowNewPot(false);
    },
  });

  const movementMutation = useMutation({
    mutationFn: async ({ pot, amount, type, note }: { pot: any; amount: number; type: "deposit"|"withdrawal"; note: string }) => {
      const newBalance = type === "deposit"
        ? (pot.balance || 0) + amount
        : Math.max((pot.balance || 0) - amount, 0);
      const { error: be } = await supabase.from("savings_pots")
        .update({ balance: newBalance }).eq("id", pot.id);
      if (be) throw be;
      const today = new Date();
      const { error: me } = await supabase.from("savings_pot_movements").insert({
        user_id: user?.id, pot_id: pot.id, amount, type, note: note || null,
        month: today.getMonth() + 1, year: today.getFullYear(),
      });
      if (me) throw me;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_pots", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["savings_pot_movements", user?.id] });
      toast.success("Movimiento registrado ✅");
      setMovementPot(null);
    },
  });

  const deletePotMutation = useMutation({
    mutationFn: async (potId: string) => {
      await supabase.from("savings_pot_movements").delete().eq("pot_id", potId);
      const { error } = await supabase.from("savings_pots").delete().eq("id", potId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_pots", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["savings_pot_movements", user?.id] });
      toast.success("Pote eliminado.");
    },
  });

  // ── Calculations ───────────────────────────────────────────────────────────
  const totalSaved = pots.reduce((s: number, p: any) => s + (p.balance || 0), 0);

  // Crecimiento por mes (últimos 6 meses) — acumulado
  const growthData = useMemo(() => {
    const today = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
      return { month: d.getMonth() + 1, year: d.getFullYear(), label: MONTHS_SHORT[d.getMonth()] };
    });
    // Para cada mes, calcular saldo acumulado hasta ese mes
    return months.map(({ month, year, label }) => {
      const deposited = movements
        .filter((m: any) => {
          const my = m.year * 12 + m.month;
          const limit = year * 12 + month;
          return my <= limit && m.type === "deposit";
        })
        .reduce((s: number, m: any) => s + (m.amount || 0), 0);
      const withdrawn = movements
        .filter((m: any) => {
          const my = m.year * 12 + m.month;
          const limit = year * 12 + month;
          return my <= limit && m.type === "withdrawal";
        })
        .reduce((s: number, m: any) => s + (m.amount || 0), 0);
      return { label, total: Math.max(deposited - withdrawn, 0) };
    });
  }, [movements]);

  const maxGrowth = Math.max(...growthData.map(g => g.total), 1);

  // Distribución por tipo
  const byType = useMemo(() => {
    return POT_TYPES.map(pt => ({
      ...pt,
      total: pots.filter((p: any) => p.type === pt.id).reduce((s: number, p: any) => s + (p.balance || 0), 0),
    })).filter(pt => pt.total > 0);
  }, [pots]);

  const recentMovements = movements.slice(0, 8);

  return (
    <div className="animate-fade-in p-4 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/suenos")}
          className="rounded-xl p-2 hover:bg-muted transition-colors">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Mi Ahorro</h1>
          <p className="text-xs text-muted-foreground">Tus fondos diversificados</p>
        </div>
      </div>

      {/* Total */}
      <div className="rounded-2xl bg-primary p-5 text-primary-foreground mb-4 relative overflow-hidden">
        <div className="absolute right-[-5%] top-[-10%] opacity-10">
          <TrendingUp className="h-28 w-28" />
        </div>
        <p className="text-xs font-medium opacity-80 mb-0.5">Total ahorrado</p>
        <p className="text-4xl font-bold tracking-tight">{formatQ(totalSaved)}</p>
        <p className="text-xs opacity-70 mt-1">{pots.length} pote{pots.length !== 1 ? "s" : ""} de ahorro</p>
      </div>

      {/* Distribución por tipo */}
      {byType.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4 mb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Distribución</p>
          <div className="space-y-2.5">
            {byType.map(pt => {
              const pct = totalSaved > 0 ? Math.round((pt.total / totalSaved) * 100) : 0;
              const Icon = pt.icon;
              return (
                <div key={pt.id} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 flex-shrink-0" style={{ color: getPotColor(pt.id) }} />
                  <span className="text-xs text-muted-foreground w-24">{pt.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: getPotColor(pt.id) }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-20 text-right">{formatQ(pt.total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gráfica crecimiento */}
      {movements.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4 mb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Crecimiento últimos 6 meses</p>
          <div className="flex items-end gap-2 h-20">
            {growthData.map((g, i) => {
              const pct = Math.round((g.total / maxGrowth) * 100);
              const isLast = i === growthData.length - 1;
              return (
                <div key={g.label} className="flex-1 flex flex-col items-center gap-1">
                  {g.total > 0 && (
                    <span className="text-[9px] text-muted-foreground font-medium">{formatQ(g.total)}</span>
                  )}
                  <div className="w-full rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${Math.max(pct, 4)}%`,
                      backgroundColor: isLast ? "#10B981" : "#10B98160",
                      minHeight: "4px",
                    }} />
                  <span className="text-[9px] text-muted-foreground">{g.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Potes */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-foreground">Mis potes</p>
        <button onClick={() => setShowNewPot(true)}
          className="flex items-center gap-1 text-xs text-primary font-bold hover:underline">
          <Plus className="h-3.5 w-3.5" /> Nuevo pote
        </button>
      </div>

      {pots.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-6 text-center mb-4">
          <Wallet className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">Sin potes de ahorro</p>
          <p className="text-xs text-muted-foreground mb-3">Creá tu primer pote para empezar a diversificar.</p>
          <Button size="sm" variant="outline" onClick={() => setShowNewPot(true)}>
            <Plus className="h-4 w-4 mr-1" /> Crear pote
          </Button>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {pots.map((pot: any) => {
            const Icon = getPotIcon(pot.type);
            const color = getPotColor(pot.type);
            const pct = totalSaved > 0 ? Math.round((pot.balance / totalSaved) * 100) : 0;
            return (
              <div key={pot.id} className="rounded-2xl bg-card border border-border p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${color}20` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{pot.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {POT_TYPES.find(p => p.id === pot.type)?.label} · {pct}% del total
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-foreground">{formatQ(pot.balance || 0)}</p>
                  </div>
                </div>
                {/* Balance bar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setMovementPot(pot); setMovementType("deposit"); }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-green-500/10 text-green-600 border border-green-500/20 hover:bg-green-500/20 transition-colors">
                    <ArrowDownCircle className="h-3.5 w-3.5" /> Depositar
                  </button>
                  <button
                    onClick={() => { setMovementPot(pot); setMovementType("withdrawal"); }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors">
                    <ArrowUpCircle className="h-3.5 w-3.5" /> Retirar
                  </button>
                  <button
                    onClick={() => { if (confirm(`¿Eliminar "${pot.name}"?`)) deletePotMutation.mutate(pot.id); }}
                    className="rounded-xl px-3 py-2 text-xs text-muted-foreground bg-muted hover:bg-destructive/10 hover:text-destructive transition-colors">
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Movimientos recientes */}
      {recentMovements.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Movimientos recientes</p>
          <div className="space-y-2.5">
            {recentMovements.map((m: any) => {
              const pot = pots.find((p: any) => p.id === m.pot_id);
              const color = getPotColor(pot?.type || "");
              return (
                <div key={m.id} className="flex items-center gap-2.5">
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0",
                    m.type === "deposit" ? "bg-green-500/15" : "bg-destructive/15"
                  )}>
                    {m.type === "deposit"
                      ? <ArrowDownCircle className="h-3.5 w-3.5 text-green-500" />
                      : <ArrowUpCircle className="h-3.5 w-3.5 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {m.note || (m.type === "deposit" ? "Depósito" : "Retiro")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {pot?.name || "Pote"} · {MONTHS_SHORT[(m.month || 1) - 1]} {m.year}
                    </p>
                  </div>
                  <span className={cn("text-xs font-bold",
                    m.type === "deposit" ? "text-green-500" : "text-destructive")}>
                    {m.type === "deposit" ? "+" : "-"}{formatQ(m.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewPot && (
        <NewPotModal
          onClose={() => setShowNewPot(false)}
          onSave={(name, type, balance) => addPotMutation.mutate({ name, type, balance })}
        />
      )}
      {movementPot && (
        <MovementModal
          pot={movementPot}
          initialType={movementType}
          onClose={() => setMovementPot(null)}
          onSave={(amount, type, note) => movementMutation.mutate({ pot: movementPot, amount, type, note })}
        />
      )}
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function NewPotModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (name: string, type: string, balance: number) => void;
}) {
  const [name, setName]       = useState("");
  const [type, setType]       = useState("banco");
  const [balance, setBalance] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Nuevo pote de ahorro</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Nombre</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Cuenta BAC, Bitcoin, Terreno"
              autoFocus
              className="w-full rounded-xl bg-background border border-border py-3 px-4 text-foreground focus:border-primary outline-none text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {POT_TYPES.map(pt => {
                const Icon = pt.icon;
                const color = getPotColor(pt.id);
                return (
                  <button key={pt.id} onClick={() => setType(pt.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl p-3 text-sm font-medium transition-all border-2",
                      type === pt.id ? "border-primary bg-primary/10 text-foreground" : "border-transparent bg-muted text-muted-foreground"
                    )}>
                    <Icon className="h-4 w-4" style={{ color: type === pt.id ? color : undefined }} />
                    {pt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Saldo actual (Q)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
              <input
                type="number" value={balance} onChange={e => setBalance(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary outline-none"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Si ya tenés algo ahorrado ahí, ponelo acá.</p>
          </div>
        </div>

        <Button className="w-full" onClick={() => onSave(name, type, parseFloat(balance) || 0)}
          disabled={!name || !type}>
          Crear pote 💰
        </Button>
      </div>
    </div>
  );
}

function MovementModal({ pot, initialType, onClose, onSave }: {
  pot: any;
  initialType: "deposit" | "withdrawal";
  onClose: () => void;
  onSave: (amount: number, type: "deposit" | "withdrawal", note: string) => void;
}) {
  const [type, setType]     = useState<"deposit"|"withdrawal">(initialType);
  const [amount, setAmount] = useState("");
  const [note, setNote]     = useState("");
  const Icon = getPotIcon(pot.type);
  const color = getPotColor(pot.type);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${color}20` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <h2 className="text-lg font-bold text-foreground">{pot.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Saldo actual: <span className="font-bold text-foreground">{formatQ(pot.balance || 0)}</span>
        </p>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setType("deposit")}
            className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
              type === "deposit" ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
            <ArrowDownCircle className="h-4 w-4" /> Depositar
          </button>
          <button onClick={() => setType("withdrawal")}
            className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
              type === "withdrawal" ? "bg-destructive text-white" : "bg-muted text-muted-foreground")}>
            <ArrowUpCircle className="h-4 w-4" /> Retirar
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Q</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" autoFocus
              className="w-full rounded-xl bg-background border border-border py-3 pl-8 pr-4 text-foreground focus:border-primary outline-none" />
          </div>
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder={type === "deposit" ? "Nota (ej: Depósito quincena)" : "Nota (ej: Gastos imprevistos)"}
            className="w-full rounded-xl bg-background border border-border py-3 px-4 text-sm text-foreground focus:border-primary outline-none" />
        </div>

        <Button
          className={cn("w-full", type === "withdrawal" && "bg-destructive hover:bg-destructive/90")}
          onClick={() => onSave(parseFloat(amount) || 0, type, note)}
          disabled={!amount || parseFloat(amount) <= 0}>
          {type === "deposit" ? "Registrar depósito" : "Registrar retiro"}
        </Button>
      </div>
    </div>
  );
}
