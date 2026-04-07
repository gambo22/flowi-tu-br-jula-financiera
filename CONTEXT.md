# Flowi — Fase 2: Auth, Onboarding, Motor de Análisis
## Contexto para Google Antigravity

---

## SITUACIÓN ACTUAL

El MVP visual está completo en React + Supabase con estas pantallas funcionales (datos demo):
- Dashboard, Gastos, Presupuesto, Mis Sueños, Deudas
- Bottom nav mobile-first, botón flotante (+), diseño verde esmeralda + morado
- Supabase configurado con tablas: users, expenses, budget_limits, goals, debts + RLS activo

**Lo que falta:** Auth real, onboarding, perfil, y el motor de cálculo/análisis.

---

## TAREA 1 — CONECTAR SUPABASE AUTH

Archivo `.env` necesita:
```
VITE_SUPABASE_URL=tu_url
VITE_SUPABASE_ANON_KEY=tu_key
```

Implementar:
- Login con email/password usando `supabase.auth.signInWithPassword()`
- Registro con email/password usando `supabase.auth.signUp()`
- Login con Google OAuth usando `supabase.auth.signInWithOAuth({ provider: 'google' })`
- `onAuthStateChange` listener para manejar sesión globalmente
- Redirigir a onboarding si es usuario nuevo, a dashboard si ya tiene perfil
- Logout en configuración

---

## TAREA 2 — ONBOARDING (pantalla nueva: /onboarding)

Flujo de 4 pasos con barra de progreso (paso 1 de 4, etc). 
Tono: cálido, conversacional, nunca frío ni bancario.

### Paso 1 — Bienvenida + nombre
```
Pantalla:
  Título: "Hola, soy Flowi 👋"
  Subtítulo: "Tu compañero de libertad financiera"
  Campo: "¿Cómo te llamas?" → guardar en users.name
  Botón: "Empecemos →"
```

### Paso 2 — Tipo de ingreso
```
Pregunta: "¿Cómo es tu ingreso mensual?"
Opciones (cards seleccionables):
  - "Fijo" → sueldo estable cada mes
    → Mostrar: campo "¿Cuánto recibes al mes? Q___"
  - "Variable" → freelance, negocio, comisiones
    → Mostrar: 
        "¿Cuánto recibes en un mes bueno? Q___"
        "¿Cuánto recibes en un mes malo? Q___"  
        → guardar promedio como monthly_income, guardar ambos en income_min / income_max
  - "Mixto" → sueldo base + extras
    → Mostrar:
        "Sueldo base fijo: Q___"
        "Extras promedio al mes: Q___"
        → guardar suma como monthly_income

Guardar en tabla users:
  monthly_income (número principal para cálculos)
  income_type: 'fixed' | 'variable' | 'mixed'
  income_min (opcional)
  income_max (opcional)
```

### Paso 3 — Gastos fijos del mes
```
Título: "¿Cuáles son tus gastos que se repiten cada mes?"
Subtítulo: "Agrégalos aquí para que Flowi los tome en cuenta siempre"

UI: Lista dinámica donde el usuario agrega items:
  [Categoría ▼] [Nombre: ej "Renta"] [Monto Q___] [+ Agregar]

Categorías disponibles: todas las del MVP
Ejemplos pre-sugeridos (chips opcionales que al tocar se agregan):
  "Renta/hipoteca", "Colegiatura", "Empleada", "Agua/Luz", "Internet", 
  "Netflix/Spotify", "Seguro médico", "Cuota de carro", "Gym"

Al guardar: insertar en expenses con is_recurring = true, 
y en budget_limits con el monto como límite sugerido.

Botón: "Estos son mis fijos →"
Botón secundario: "Por ahora no tengo fijos →" (skip)
```

### Paso 4 — Primera meta (opcional pero recomendado)
```
Título: "¿Tienes algún sueño en mente? ✨"
Subtítulo: "No tiene que ser grande. Puede ser un viaje, un gadget, o simplemente ahorrar."

Opciones rápidas (íconos grandes, tap para seleccionar):
  Carro | Casa | Viaje | iPad/Laptop | Teléfono | Fondo de emergencia | Otro

Si selecciona uno:
  - Campo: "¿Cómo se llama tu sueño?" (ej: "Mi primer carro")  
  - Campo: "¿Cuánto cuesta aproximadamente? Q___"
  - Insertar en goals con priority = 1

Botón: "¡Crear mi sueño! →"
Botón secundario: "Lo agrego después →" (skip)

Al finalizar paso 4:
  Marcar users.onboarding_complete = true
  Redirigir a dashboard con mensaje: "¡Todo listo! Bienvenido a Flowi 🌿"
```

---

## TAREA 3 — PERFIL Y CONFIGURACIÓN (pantalla nueva: /perfil)

Agregar ícono de perfil/config en el header del dashboard (esquina superior derecha).

Secciones:
```
MI PERFIL
  - Nombre (editable)
  - Email (solo lectura)
  - Ingreso mensual (editable) — con selector de tipo: fijo/variable/mixto
  - Si variable/mixto: mostrar campos ingreso mínimo e ingreso máximo

MIS GASTOS FIJOS
  - Lista de gastos recurrentes activos
  - Opción de editar monto o eliminar cada uno
  - Botón "Agregar gasto fijo"

CONFIGURACIÓN
  - Modo oscuro (toggle)
  - Cerrar sesión (botón)
  - Versión de la app
```

---

## TAREA 4 — MOTOR DE CÁLCULO (lógica central)

Crear archivo `src/lib/calculations.ts` con estas funciones puras:

```typescript
// Ingreso disponible real del mes
function getAvailableIncome(user: User): number {
  // Para ingreso variable: usar promedio (income_min + income_max) / 2
  // Para mixto: base + extras_promedio  
  return user.monthly_income
}

// Total gastado en el mes actual
function getMonthlySpent(expenses: Expense[]): number {
  const now = new Date()
  return expenses
    .filter(e => isSameMonth(e.date, now))
    .reduce((sum, e) => sum + e.amount, 0)
}

// Dinero comprometido en metas activas (suma de monthly_payment de goals)
function getCommittedToGoals(goals: Goal[]): number {
  return goals.reduce((sum, g) => sum + (g.monthly_payment || 0), 0)
}

// Dinero comprometido en deudas (suma de minimum_payment)
function getCommittedToDebts(debts: Debt[]): number {
  return debts.reduce((sum, d) => sum + (d.minimum_payment || 0), 0)
}

// Dinero realmente libre hoy
function getTrulyFree(user, expenses, goals, debts): number {
  return getAvailableIncome(user) 
    - getMonthlySpent(expenses) 
    - getCommittedToGoals(goals)
    - getCommittedToDebts(debts)
}

// Salud financiera general
function getFinancialHealth(user, expenses, goals, debts): 'green' | 'yellow' | 'red' {
  const ratio = (getMonthlySpent(expenses) + getCommittedToGoals(goals) + getCommittedToDebts(debts)) 
                / getAvailableIncome(user)
  if (ratio < 0.75) return 'green'
  if (ratio < 0.90) return 'yellow'
  return 'red'
}

// Análisis de meta: ¿cuántos meses para llegar?
function getGoalAnalysis(goal: Goal, monthlySavings: number): GoalAnalysis {
  const remaining = goal.total_amount - goal.current_saved
  const downPaymentRemaining = goal.down_payment - goal.current_saved
  const months = Math.ceil(downPaymentRemaining / monthlySavings)
  
  return {
    monthsToDownPayment: months,
    feasibility: months <= 12 ? 'green' : months <= 24 ? 'yellow' : 'red',
    message: getFeasibilityMessage(months, goal),
    postPurchaseBudget: monthlySavings - goal.monthly_payment
  }
}

// Estrategia de deuda: bola de nieve vs avalancha
function getDebtStrategy(debts: Debt[], strategy: 'snowball' | 'avalanche'): Debt[] {
  if (strategy === 'snowball') {
    return [...debts].sort((a, b) => a.current_balance - b.current_balance)
  }
  return [...debts].sort((a, b) => b.interest_rate - a.interest_rate)
}

// Proyección de libertad de deuda
function getDebtFreeDate(debts: Debt[], extraMonthlyPayment: number): Date {
  // Calcular mes a mes cuándo se liquida cada deuda en cascada
  // cuando se paga una, ese pago se suma a la siguiente
}
```

---

## TAREA 5 — INSIGHTS AUTOMÁTICOS

Crear `src/lib/insights.ts` — genera insights en tiempo real basados en los datos reales del usuario. Sin IA externa por ahora, pura lógica.

```typescript
function generateInsights(user, expenses, goals, debts): Insight[] {
  const insights: Insight[] = []

  // Insight 1: Gasto hormiga
  const hormigaTotal = expenses
    .filter(e => e.category === 'Gastos hormiga' && isSameMonth(e.date, new Date()))
    .reduce((sum, e) => sum + e.amount, 0)
  if (hormigaTotal > 200) {
    insights.push({
      type: 'warning',
      title: 'Gastos hormiga',
      message: `Llevas Q${hormigaTotal} en gastos pequeños este mes. Al año serían Q${hormigaTotal * 12}.`,
      action: '¿Qué pasaría si reduces la mitad?'
    })
  }

  // Insight 2: Categoría disparada
  // Si alguna categoría ya superó su límite antes del día 20
  
  // Insight 3: Buen ritmo
  // Si va por debajo del ritmo esperado (día 15 y solo gastó 40%)
  
  // Insight 4: Meta cerca
  // Si una meta está al 80%+
  
  // Insight 5: Deuda de alto interés
  // Si tiene tarjeta con tasa > 40% anual
  if (debts.some(d => d.interest_rate > 40)) {
    insights.push({
      type: 'urgent',
      title: 'Deuda cara',
      message: 'Tienes una deuda con tasa mayor al 40% anual. Atacarla primero te ahorra mucho dinero.',
      action: 'Ver estrategia de pago'
    })
  }

  // Insight 6: Ingreso variable — mes malo detectado
  // Si income_type = variable y el mes actual parece bajo

  // Insight 7: Sin fondo de emergencia
  if (!goals.some(g => g.type === 'emergency_fund')) {
    insights.push({
      type: 'tip',
      title: 'Fondo de emergencia',
      message: 'No tienes un fondo de emergencia. Tener 3 meses de gastos guardados cambia todo.',
      action: 'Crear esta meta'
    })
  }

  return insights.slice(0, 3) // Máximo 3 insights a la vez
}
```

Mostrar insights en el dashboard en una sección "Flowi dice:" — cards deslizables, cada una con ícono de tipo (verde=tip, amarillo=warning, rojo=urgente) y un botón de acción.

---

## TAREA 6 — ESTADOS VACÍOS

Cuando el usuario no tiene datos todavía, mostrar pantallas motivadoras (no pantallas en blanco):

```
Gastos vacíos:
  "Todavía no hay gastos este mes 🌱
   Registra tu primer gasto y empieza a tomar control."
  [+ Registrar gasto]

Metas vacías:
  "Tus sueños merecen un plan ✨
   Agrega tu primera meta y Flowi te dice cómo llegar."
  [+ Crear mi primer sueño]

Deudas vacías:
  "Sin deudas registradas 🎉
   Si tienes alguna, agrégala. Ordenarla es el primer paso para eliminarla."
  [+ Agregar deuda]
```

---

## ORDEN DE IMPLEMENTACIÓN SUGERIDO

1. `TAREA 1` — Auth real (desbloquea todo lo demás)
2. `TAREA 4` — Motor de cálculo (archivo puro, sin UI, testeable)
3. `TAREA 2` — Onboarding (usa auth + cálculos)
4. `TAREA 3` — Perfil (usa mismos datos del onboarding)
5. `TAREA 5` — Insights (usa motor de cálculo)
6. `TAREA 6` — Estados vacíos (polish final)

---

## NOTAS PARA ANTIGRAVITY

- El proyecto ya tiene todas las dependencias instaladas (React, Supabase client, Tailwind)
- Las tablas en Supabase ya existen con RLS activo
- Respetar la paleta: verde esmeralda (#10B981) primario, morado (#7C3AED) acento
- Mantener el tono empático en todos los textos — nunca frío, nunca culposo
- Mobile-first siempre
- Los cálculos deben funcionar con ingreso variable (no asumir que es fijo)

---

*Flowi · Fase 2 · Tu compañero de libertad financiera · Guatemala*