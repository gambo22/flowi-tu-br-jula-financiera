import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

serve(async (req) => {
  // Retornar siempre 200 si no es POST, o para evitar timeouts
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 })
  }

  try {
    const payload = await req.json()

    // 1 & 2. Parsear el body JSON y leer event_type
    // Asumimos estructura plana o anidada (dependiendo de cómo envíe Svix/Recurrente el webhook)
    const eventType = payload.type || payload.event_type
    const data = payload.data || payload

    // El payload tiene customer_email (string)
    const email = data.customer_email || payload.customer_email || data.email
    const subId = data.id || payload.id
    const customerId = data.customer_id || payload.customer_id || data.customer?.id

    if (!eventType || !email) {
      console.log('Skipping webhook: missing event_type or email', { eventType, email })
      return new Response('OK', { status: 200 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase env vars')
      return new Response('OK', { status: 200 })
    }

    // Inicializar cliente admin de Supabase
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Buscar al usuario en auth.users por email usando supabase admin client
    // Supabase js no trae un findUserByEmail, así que listamos y buscamos
    // (A futuro podría requerir paginación si crecen mucho los usuarios)
    const { data: usersData, error: userError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (userError) {
      console.error('Error fetching users from auth:', userError)
      return new Response('OK', { status: 200 })
    }

    const user = usersData.users.find((u: any) => u.email === email)
    
    if (!user) {
      console.error(`Webhook bypass: User not found in auth.users for email: ${email}`)
      return new Response('OK', { status: 200 })
    }

    // 4. Lógica de upsert en tabla "subscriptions"
    const now = new Date().toISOString()
    let plan = 'free'

    if (eventType === 'subscription.create') plan = 'premium'
    if (eventType === 'subscription.cancel') plan = 'free'
    if (eventType === 'subscription.past_due') plan = 'free'

    const upsertData: any = {
      user_id: user.id,
      plan: plan,
      updated_at: now
    }

    // Guardar detalles solo si es create
    if (eventType === 'subscription.create') {
      upsertData.recurrente_customer_id = customerId
      upsertData.recurrente_subscription_id = subId
    }

    const { error: upsertError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(upsertData, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('Error upserting subscription:', upsertError)
    } else {
      console.log(`[Success] Plan ${plan} set for user ${user.id} (${email})`)
    }

    // 5. Retornar 200 OK siempre
    return new Response('OK', { status: 200 })

  } catch (err: any) {
    console.error('Webhook processing error:', err.message)
    // Retornar 200 OK siempre para que Svix no reintente y bloquee la cola
    return new Response('OK', { status: 200 })
  }
})
