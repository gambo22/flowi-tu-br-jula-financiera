import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: any;
  onSave: (expense: {
    id?: string;
    amount: number;
    category: string;
    date: string;
    note: string;
    is_recurring: boolean;
  }) => void;
}

export default function AddExpenseModal({ open, onClose, initialData, onSave }: AddExpenseModalProps) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setAmount(initialData.amount ? initialData.amount.toString() : "");
        setCategory(initialData.category || "");
        setDate(initialData.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
        setNote(initialData.note || "");
        setIsRecurring(!!initialData.is_recurring);
      } else {
        setAmount("");
        setCategory("");
        setDate(new Date().toISOString().split("T")[0]);
        setNote("");
        setIsRecurring(false);
      }
    }
  }, [open, initialData]);

  if (!open) return null;

  const handleSave = () => {
    if (!amount || !category) return;
    onSave({
      id: initialData?.id,
      amount: parseFloat(amount),
      category,
      date,
      note,
      is_recurring: isRecurring,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">{initialData ? "Editar gasto" : "Nuevo gasto"}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Amount */}
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

        {/* Category grid */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Categoría</label>
          <div className="grid grid-cols-4 gap-2">
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl p-2.5 text-xs transition-all",
                  category === cat.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <cat.icon className="h-5 w-5" />
                <span className="line-clamp-1">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Fecha</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {/* Note */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Nota (opcional)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Despensa semanal" />
        </div>

        {/* Recurring */}
        <div className="mb-6 flex items-center justify-between rounded-xl bg-muted p-3">
          <span className="text-sm font-medium text-foreground">¿Es gasto fijo mensual?</span>
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
        </div>

        <Button onClick={handleSave} className="w-full" size="lg" disabled={!amount || !category}>
          {initialData ? "Actualizar gasto ✨" : "Guardar gasto ✨"}
        </Button>
      </div>
    </div>
  );
}
