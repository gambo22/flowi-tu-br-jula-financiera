import { X, Zap } from 'lucide-react'

interface PaywallModalProps {
  onClose: () => void
  feature?: string
}

export function PaywallModal({ onClose, feature }: PaywallModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-10">
        
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center mb-4">
            <Zap size={28} className="text-violet-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {feature ? `${feature} es Premium` : 'Función Premium'}
          </h2>
          <p className="text-gray-500 text-sm">
            Desbloqueá análisis, metas, deudas y más. Todo lo que necesitás para manejar tu plata en serio.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {[
            'Análisis mensual por categoría',
            'Estrategia de deudas (bola de nieve)',
            'Metas y sueños con cuotas',
            'Potes de ahorro diversificados',
            'Fondo de emergencia',
            'IA advisor personalizado',
          ].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                <span className="text-violet-600 text-xs">✓</span>
              </div>
              <span className="text-sm text-gray-700">{item}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <button 
            onClick={() => window.open('https://app.recurrente.com/s/promptboxgt/anual', '_blank')}
            className="w-full bg-violet-600 text-white py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform shadow-md border border-violet-500"
          >
            Premium Anual — Q600/año (2 meses gratis)
          </button>

          <button 
            onClick={() => window.open('https://app.recurrente.com/s/promptboxgt/mensual', '_blank')}
            className="w-full bg-violet-100 text-violet-700 py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
          >
            Premium Mensual — Q60/mes
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 mb-1">
          Pagá con tarjeta. Cancela cuando quieras.
        </p>

        <button onClick={onClose} className="w-full text-sm text-gray-400 font-medium py-2 hover:text-gray-600">
          Ahora no
        </button>
      </div>
    </div>
  )
}
