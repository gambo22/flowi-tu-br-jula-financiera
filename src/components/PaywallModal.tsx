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

        <button className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-base active:scale-95 transition-transform">
          Ver planes — desde Q39/mes
        </button>

        <button onClick={onClose} className="w-full mt-3 text-sm text-gray-400 py-2">
          Ahora no
        </button>
      </div>
    </div>
  )
}
