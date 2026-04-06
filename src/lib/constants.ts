import {
  ShoppingCart, Fuel, UtensilsCrossed, Bus, GraduationCap, Home,
  Droplets, HeartPulse, Gamepad2, Tv, Shirt, Plane, Coffee, MoreHorizontal,
  Car, MapPin, Tablet, Smartphone, ShieldCheck, Star
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
