/**
 * Funciones de utilidad para manejar fechas, días hábiles 
 * y calendarios financieros guatemaltecos.
 */

// Si el día cae Sábado (6) o Domingo (0), regresar al Viernes previo
export function getPreviousBusinessDay(date: Date): Date {
  const dayOfWeek = date.getDay();
  const adjustedDate = new Date(date);
  
  if (dayOfWeek === 6) { // Sábado
    adjustedDate.setDate(adjustedDate.getDate() - 1); // Viernes
  } else if (dayOfWeek === 0) { // Domingo
    adjustedDate.setDate(adjustedDate.getDate() - 2); // Viernes
  }
  
  return adjustedDate;
}

/**
 * Calcula el día exacto de pago para una fecha dada asumiendo reglas de pago
 * "Último día hábil" si aplica.
 * 
 * paymentRule:
 * - 'last_business_day_of_month': Último día hábil del mes.
 * - 'last_business_day_15': 15 del mes o el hábil anterior.
 * - 'fixed_day': Toma targetDate y ajusta al hábil anterior si es finde.
 * - 'specific_weekday': (Ej: Cada viernes).
 */
export function calculatePaymentDate(rule: string, relativeToDate: Date = new Date(), fixedDayNumber?: number): Date {
  const currentYear = relativeToDate.getFullYear();
  const currentMonth = relativeToDate.getMonth();
  
  let targetDate = new Date(currentYear, currentMonth, relativeToDate.getDate());

  if (rule === 'last_business_day_of_month') {
    // Día 0 del siguiente mes es el último día del mes actual
    targetDate = new Date(currentYear, currentMonth + 1, 0);
    return getPreviousBusinessDay(targetDate);
  } 
  
  if (rule === 'last_business_day_15') {
    targetDate = new Date(currentYear, currentMonth, 15);
    return getPreviousBusinessDay(targetDate);
  }

  if (rule === 'fixed_day' && fixedDayNumber) {
    // Intentar asignar el día, si el mes no los tiene (ej febrero 30), js lo arregla al final
    targetDate = new Date(currentYear, currentMonth, fixedDayNumber);
    return getPreviousBusinessDay(targetDate);
  }

  return targetDate; // Fallback
}

/**
 * Función útil para notificar si el pago es "hoy", "mañana" o "en X días"
 */
export function getPaymentDistanceText(paymentDate: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(paymentDate);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "¡Día de Pago! Hoy";
  if (diffDays === 1) return "Pagan mañana";
  if (diffDays === 2) return "Pagan pasado mañana";
  if (diffDays > 2 && diffDays <= 7) return `Pagan en ${diffDays} días (${target.toLocaleDateString('es-GT', { weekday: 'long' })})`;
  
  if (diffDays < 0) return "Pago ya recibido";
  
  return `Pago el ${target.getDate()} de ${target.toLocaleDateString('es-GT', { month: 'short' })}`;
}
