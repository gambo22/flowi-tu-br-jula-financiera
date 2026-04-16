import {
  ShoppingCart, Fuel, UtensilsCrossed, Bus, GraduationCap, Home,
  Droplets, HeartPulse, Gamepad2, Tv, Shirt, Plane, Coffee, MoreHorizontal,
  Car, MapPin, Tablet, Smartphone, ShieldCheck, Star, Shield, Wrench
} from "lucide-react";

export const EXPENSE_CATEGORIES = [
  { id: "mercado", label: "Mercado", icon: ShoppingCart },
  { id: "gasolinera", label: "Gasolinera", icon: Fuel },
  { id: "restaurantes", label: "Restaurantes", icon: UtensilsCrossed },
  { id: "transporte", label: "Transporte", icon: Bus },
  { id: "colegiatura", label: "Colegiatura", icon: GraduationCap },
  { id: "empleada", label: "Empleada", icon: Home },
  { id: "servicios", label: "Agua/Luz/Internet", icon: Droplets },
  { id: "salud", label: "Salud/Farmacia", icon: HeartPulse },
  { id: "entretenimiento", label: "Entretenimiento", icon: Gamepad2 },
  { id: "suscripciones", label: "Suscripciones", icon: Tv },
  { id: "ropa", label: "Ropa", icon: Shirt },
  { id: "viajes", label: "Viajes", icon: Plane },
  { id: "hormiga", label: "Gastos hormiga", icon: Coffee },
  { id: "seguros", label: "Seguros", icon: Shield },
  { id: "mantenimiento", label: "Mantenimiento", icon: Wrench },
  { id: "otros", label: "Otros", icon: MoreHorizontal },
] as const;

export const GOAL_TYPES = [
  { id: "carro", label: "Carro", icon: Car },
  { id: "casa", label: "Casa", icon: Home },
  { id: "viaje", label: "Viaje", icon: MapPin },
  { id: "tablet", label: "iPad/Laptop", icon: Tablet },
  { id: "telefono", label: "Teléfono", icon: Smartphone },
  { id: "emergencia", label: "Fondo de emergencia", icon: ShieldCheck },
  { id: "otro", label: "Otro", icon: Star },
] as const;

export const DEBT_TYPES = [
  "Tarjeta de crédito",
  "Préstamo personal",
  "Visa cuotas",
  "Préstamo vehicular",
  "Hipoteca",
] as const;

export const INSIGHTS = [
  "El orden es el primer paso hacia la libertad financiera.",
  "Cada quetzal que registras es un quetzal que controlas.",
  "Saber a dónde va tu dinero es el superpoder que nadie te enseña.",
  "No se trata de cuánto ganas, sino de cuánto queda después de tus decisiones.",
  "Tu yo de dentro de 5 años te va a agradecer lo que haces hoy.",
  "Un gasto hormiga de Q20 al día son Q600 al mes — casi Q7,200 al año.",
  "La meta no es ser rico. La meta es que el dinero no te quite el sueño.",
  "Pequeños ajustes hoy = grandes diferencias mañana.",
  "En Guatemala, la mayoría no tiene problemas de ingresos, tiene problemas de orden.",
  "Flowi no te juzga. Te acompaña.",
];

export const formatQ = (amount: number): string => {
  return `Q${amount.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ─── Grupos de categorías para Análisis ───────────────────────────────────────
export const CATEGORY_GROUPS = [
  {
    id: "casa",
    label: "Casa",
    color: "#10B981",
    categories: ["mercado", "empleada", "servicios", "mantenimiento"],
  },
  {
    id: "transporte",
    label: "Transporte",
    color: "#3B82F6",
    categories: ["gasolinera", "transporte"],
  },
  {
    id: "educacion",
    label: "Educación",
    color: "#8B5CF6",
    categories: ["colegiatura"],
  },
  {
    id: "salud",
    label: "Salud",
    color: "#EF4444",
    categories: ["salud"],
  },
  {
    id: "entretenimiento",
    label: "Entretenimiento",
    color: "#F59E0B",
    categories: ["restaurantes", "entretenimiento", "suscripciones"],
  },
  {
    id: "estilo",
    label: "Estilo de vida",
    color: "#EC4899",
    categories: ["ropa", "viajes", "hormiga"],
  },
  {
    id: "proteccion",
    label: "Protección",
    color: "#64748B",
    categories: ["seguros"],
  },
  {
    id: "otros",
    label: "Otros",
    color: "#6B7280",
    categories: ["otros"],
  },
] as const;

// ─── Técnicas de ahorro ────────────────────────────────────────────────────────
export const SAVING_TIPS = [
  {
    id: "cafe_fantasma",
    emoji: "☕",
    title: "Café fantasma",
    description: "Por cada café o antojo, guardá la misma cantidad. Tu futuro vos te lo agradece.",
    triggerCategories: ["restaurantes", "hormiga"],
    triggerAlways: false,
  },
  {
    id: "impulso_48h",
    emoji: "⏱️",
    title: "Regla del impulso",
    description: "Esperá 48 horas antes de compras no esenciales. Si en 2 días lo seguís queriendo, es tuyo.",
    triggerCategories: ["ropa", "viajes", "entretenimiento"],
    minAmount: 200,
    triggerAlways: false,
  },
  {
    id: "redondeo",
    emoji: "🔄",
    title: "Redondeo invisible",
    description: "Redondeá este gasto al siguiente centenar y mové la diferencia a tu fondo de ahorro.",
    triggerCategories: [],
    triggerAlways: true,
  },
] as const;

export type SavingTip = (typeof SAVING_TIPS)[number];
