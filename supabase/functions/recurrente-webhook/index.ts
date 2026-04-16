import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Ignorar JWT completamente (usaremos --no-verify-jwt). 
  // Manejador OPTIONS por si las dudas en CORS:
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 3. Parsear body directamente
    const body = await req.json()
    
    // 4. Log exacto
    console.log('evento:', body.event_type, body.customer_email)

    const eventType = body.event_type || body.type
    const email = body.customer_email
    
    // Fallbacks opcionales para recurente (dependiendo si viene anidado en 'data')
    const finalEvent = eventType || body.data?.type
    const finalEmail = email || body.data?.customer?.email || body.data?.customer_email

    if (!finalEvent || !finalEmail) {
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // 2. Usar solo service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 6. Buscar user por email
    const { data: usersData, error: userError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (userError) {
      console.error('Error fetching users:', userError)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    const user = usersData.users.find((u: any) => u.email === finalEmail)
    
    if (!user) {
      console.error(`User not found for email: ${finalEmail}`)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // 5. Lógica de plan según event_type
    const now = new Date().toISOString()
    let plan = 'free'

    if (finalEvent === 'subscription.create') plan = 'premium'
    if (finalEvent === 'subscription.cancel') plan = 'free'
    if (finalEvent === 'subscription.past_due') plan = 'free'

    const upsertData: any = {
      user_id: user.id,
      plan: plan,
      updated_at: now
    }

    if (finalEvent === 'subscription.create') {
      upsertData.recurrente_customer_id = body.customer_id || body.data?.customer_id || body.data?.customer?.id
      upsertData.recurrente_subscription_id = body.id || body.data?.id
    }

    // 7. Upsert en subscriptions
    const { error: upsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(upsertData, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('Error upserting:', upsertError)
    }

    // 8. Return 200 siempre
    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (err: any) {
    console.error('Error:', err.message)
    return new Response('OK', { status: 200, headers: corsHeaders })
  }
})
