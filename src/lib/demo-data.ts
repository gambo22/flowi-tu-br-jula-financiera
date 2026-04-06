// Demo data for the app before Supabase is connected
export const demoUser = {
  id: "demo",
  name: "María",
  email: "maria@demo.com",
  monthly_income: 12000,
};

export const demoExpenses = [
  { id: "1", category: "mercado", amount: 850, date: new Date().toISOString(), note: "Despensa semanal", is_recurring: false },
  { id: "2", category: "gasolinera", amount: 350, date: new Date(Date.now() - 86400000).toISOString(), note: "Tanque lleno", is_recurring: false },
  { id: "3", category: "restaurantes", amount: 180, date: new Date(Date.now() - 86400000 * 2).toISOString(), note: "Almuerzo con amigas", is_recurring: false },
  { id: "4", category: "servicios", amount: 450, date: new Date(Date.now() - 86400000 * 3).toISOString(), note: "Agua y luz", is_recurring: true },
  { id: "5", category: "suscripciones", amount: 120, date: new Date(Date.now() - 86400000 * 5).toISOString(), note: "Netflix + Spotify", is_recurring: true },
  { id: "6", category: "hormiga", amount: 45, date: new Date(Date.now() - 86400000 * 1).toISOString(), note: "Café y galletas", is_recurring: false },
];

export const demoBudgetLimits = [
  { id: "1", category: "mercado", monthly_limit: 3000 },
  { id: "2", category: "gasolinera", monthly_limit: 1500 },
  { id: "3", category: "restaurantes", monthly_limit: 800 },
  { id: "4", category: "transporte", monthly_limit: 500 },
  { id: "5", category: "servicios", monthly_limit: 600 },
  { id: "6", category: "entretenimiento", monthly_limit: 400 },
  { id: "7", category: "suscripciones", monthly_limit: 200 },
  { id: "8", category: "hormiga", monthly_limit: 300 },
];

export const demoGoals = [
  { id: "1", name: "Mi primer carro", type: "carro", total_amount: 85000, down_payment: 25000, monthly_payment: 2800, target_date: "2025-12-01", priority: 1, saved_amount: 8500 },
  { id: "2", name: "Viaje a Cancún", type: "viaje", total_amount: 8000, down_payment: 0, monthly_payment: 0, target_date: "2025-08-01", priority: 2, saved_amount: 3200 },
];

export const demoDebts = [
  { id: "1", name: "Visa BAM", type: "Tarjeta de crédito", current_balance: 15000, interest_rate: 48, minimum_payment: 750, payment_day: 15 },
  { id: "2", name: "Préstamo Banrural", type: "Préstamo personal", current_balance: 35000, interest_rate: 18, minimum_payment: 1200, payment_day: 5 },
];
