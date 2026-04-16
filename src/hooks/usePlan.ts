import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/context/AuthContext'

type Plan = 'free' | 'premium'

interface UsePlanReturn {
  plan: Plan
  isPremium: boolean
  loading: boolean
  refetch: () => void
}

export function usePlan(): UsePlanReturn {
  const { user } = useAuth()
  const [plan, setPlan] = useState<Plan>('free')
  const [loading, setLoading] = useState(true)

  const fetchPlan = async () => {
    if (!user) {
      setPlan('free')
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('subscriptions')
      .select('plan, current_period_end')
      .eq('user_id', user.id)
      .single()

    if (data) {
      const isActive =
        data.plan === 'premium' &&
        data.current_period_end &&
        new Date(data.current_period_end) > new Date()

      setPlan(isActive ? 'premium' : 'free')
    } else {
      setPlan('free')
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchPlan()
  }, [user])

  return {
    plan,
    isPremium: plan === 'premium',
    loading,
    refetch: fetchPlan,
  }
}
