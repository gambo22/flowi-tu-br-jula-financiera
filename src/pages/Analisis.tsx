import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { CATEGORY_GROUPS, formatQ } from "@/lib/constants";

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const RANGE_OPTIONS = [3, 6, 12] as const;

function getMonthRange(monthsBack: number) {
  const today = new Date();
  const result = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    result.push({ month: d.getMonth(), year: d.getFullYear(), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return result;
}

export default function Analisis() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [range, setRange] = useState<3 | 6 | 12>(3);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses").select("*").eq("user_id", user?.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const months = useMemo(() => getMonthRange(range), [range]);

  // Total por grupo por mes
  const matrix = useMemo(() => {
    return CATEGORY_GROUPS.map((g) => {
      const byMonth = months.map(({ month, year }) => {
        const total = expenses
          .filter((e: any) => {
            const d = new Date(e.date);
            return (
              d.getMonth() === month &&
              d.getFullYear() === year &&
              (g.categories as readonly string[]).includes(e.category)
            );
          })
          .reduce((s: number, e: any) => s + (e.amount || 0), 0);
        return total;
      });
      const avg = byMonth.reduce((s, v) => s + v, 0) / byMonth.filter((v) => v > 0).length || 0;
      const hasData = byMonth.some((v) => v > 0);
      return { ...g, byMonth, avg, hasData };
    }).filter((g) => g.hasData);
  }, [expenses, months]);

  // Totales generales por mes
  const monthTotals = useMemo(() =>
    months.map((_, mi) => matrix.reduce((s, g) => s + g.byMonth[mi], 0)),
    [matrix, months]
  );

  const maxTotal = Math.max(...monthTotals, 1);

  // Detalle por categoría dentro del grupo
  const groupDetail = useMemo(() => {
    if (!selectedGroup) return null;
    const group = CATEGORY_GROUPS.find((g) => g.id === selectedGroup);
    if (!group) return null;
    return (group.categories as readonly string[]).map((catId) => {
      const byMonth = months.map(({ month, year }) =>
        expenses
          .filter((e: any) => {
            const d = new Date(e.date);
            return d.getMonth() === month && d.getFullYear() === year && e.category === catId;
          })
          .reduce((s: number, e: any) => s + (e.amount || 0), 0)
      );
      const hasData = byMonth.some((v) => v > 0);
      return { catId, byMonth, hasData };
    }).filter((c) => c.hasData);
  }, [selectedGroup, expenses, months]);

  function getTrend(byMonth: number[]) {
    const last = byMonth[byMonth.length - 1];
    const prev = byMonth[byMonth.length - 2];
    if (!prev || prev === 0) return "neutral";
    const diff = ((last - prev) / prev) * 100;
    if (diff > 10) return "up";
    if (diff < -10) return "down";
    return "neutral";
  }

  function TrendIcon({ trend }: { trend: string }) {
    if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-red-400" />;
    if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-green-400" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }

  return (
    <div className="animate-fade-in p-4 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate("/gastos")}
          className="rounded-xl p-2 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Análisis de gastos</h1>
          <p className="text-xs text-muted-foreground">Compará tus hábitos mes a mes</p>
        </div>
      </div>

      {/* Range selector */}
      <div className="flex gap-2 mb-5">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              range === r
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {r} meses
          </button>
        ))}
      </div>

      {/* Totales por mes — scroll horizontal cuando > 6 meses */}
      <div className="rounded-2xl bg-card border border-border p-4 mb-4">
        <p className="text-xs font-semibold text-muted-foreground mb-3">Total gastado por mes</p>
        <div className="overflow-x-auto -mx-1 px-1">
          <div
            className="flex items-end gap-2 h-20"
            style={{ minWidth: range > 6 ? `${range * 44}px` : "100%" }}
          >
            {months.map(({ label }, mi) => {
              const val = monthTotals[mi];
              const pct = Math.round((val / maxTotal) * 100);
              const isLast = mi === months.length - 1;
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1 min-w-[36px]">
                  {val > 0 && (
                    <span className="text-[9px] text-muted-foreground font-medium whitespace-nowrap">
                      {formatQ(val)}
                    </span>
                  )}
                  <div
                    className="w-full rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${Math.max(pct, 4)}%`,
                      backgroundColor: isLast ? "#10B981" : "#10B98160",
                      minHeight: "4px",
                    }}
                  />
                  <span className="text-[9px] text-muted-foreground">{MONTHS[months[mi].month]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Por grupo */}
      <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Por categoría</p>
      <div className="space-y-3">
        {matrix.map((g) => {
          const trend = getTrend(g.byMonth);
          const isOpen = selectedGroup === g.id;
          const lastVal = g.byMonth[g.byMonth.length - 1];
          const maxGroupVal = Math.max(...g.byMonth, 1);

          return (
            <div key={g.id} className="rounded-2xl bg-card border border-border overflow-hidden">
              {/* Group header */}
              <button
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
                onClick={() => setSelectedGroup(isOpen ? null : g.id)}
              >
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                  <span className="text-sm font-semibold text-foreground">{g.label}</span>
                  <TrendIcon trend={trend} />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{formatQ(lastVal)}</p>
                  <p className="text-[10px] text-muted-foreground">prom. {formatQ(g.avg)}/mes</p>
                </div>
              </button>

              {/* Mini sparkline */}
              <div className="px-4 pb-3 flex items-end gap-1.5 h-10">
                {g.byMonth.map((val, mi) => {
                  const pct = Math.max(Math.round((val / maxGroupVal) * 100), 4);
                  const isLast = mi === g.byMonth.length - 1;
                  return (
                    <div key={mi} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div
                        className="w-full rounded-sm transition-all duration-500"
                        style={{
                          height: `${pct}%`,
                          backgroundColor: isLast ? g.color : `${g.color}60`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Detalle expandible por subcategoría */}
              {isOpen && groupDetail && (
                <div className="border-t border-border divide-y divide-border/50 px-4">
                  {groupDetail.map(({ catId, byMonth }) => (
                    <div key={catId} className="py-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-muted-foreground capitalize">{catId}</span>
                        <span className="text-xs font-bold text-foreground">{formatQ(byMonth[byMonth.length - 1])}</span>
                      </div>
                      <div className="flex items-end gap-1 h-5">
                        {byMonth.map((val, mi) => {
                          const maxCat = Math.max(...byMonth, 1);
                          const pct = Math.max(Math.round((val / maxCat) * 100), 4);
                          const isLast = mi === byMonth.length - 1;
                          return (
                            <div key={mi} className="flex-1 rounded-sm"
                              style={{
                                height: `${pct}%`,
                                backgroundColor: isLast ? g.color : `${g.color}50`,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {matrix.length === 0 && (
        <div className="mt-12 text-center rounded-2xl p-6 bg-primary/5">
          <p className="text-lg font-medium text-primary">Sin datos aún</p>
          <p className="text-sm text-muted-foreground mt-2">Registrá gastos este mes para ver tu análisis.</p>
        </div>
      )}
    </div>
  );
}
