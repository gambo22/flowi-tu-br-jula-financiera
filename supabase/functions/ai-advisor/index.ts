import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const context = await req.json()
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('Missing API key')

    const thisTotal = context.thisMonthExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0)
    const lastTotal = context.lastMonthExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0)
    const fixedTotal = context.fixedExpenses.filter((f: any) => f.is_active).reduce((s: number, f: any) => s + (f.amount || 0), 0)
    const income = context.user?.monthly_income || 0
    const changePct = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal * 100).toFixed(1) : '0'

    const by: Record<string, number> = {}
    context.thisMonthExpenses.forEach((e: any) => { by[e.category] = (by[e.category] || 0) + (e.amount || 0) })
    const breakdown = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, amt]) => `${cat}: Q${(amt as number).toFixed(0)}`).join(', ') || 'Sin gastos'

    const systemPrompt = `Eres Flowi, un asesor financiero empático para Guatemala. Analizá los datos del usuario y dá máximo 3 insights en español guatemalteco informal (usá "vos", "plata", "bicho", etc.), concisos (máx 2 oraciones), sin juicio, motivadores. Respondé SOLO en JSON válido sin texto adicional: [{"type":"success|warning|urgent|tip","title":"corto máx 5 palabras","message":"...","action":"frase corta de acción"}]`

    const userContext = `Usuario: ${context.user?.name || 'amigo'}
Ingreso mensual: Q${income}
Gastos este mes: Q${thisTotal.toFixed(0)} | Mes anterior: Q${lastTotal.toFixed(0)} | Cambio: ${changePct}%
Top categorías este mes: ${breakdown}
Compromisos fijos: Q${fixedTotal.toFixed(0)}/mes (${context.fixedExpenses.filter((f: any) => f.is_active).length} activos)
Metas activas: ${context.goals.length} | Deudas: ${context.debts.length}
Disponible estimado: Q${Math.max(income - thisTotal - fixedTotal, 0).toFixed(0)}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620', // or whatever anthropic model is registered
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContext }]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic error:', errText)
      throw new Error('Failed generating insights via Anthropic API')
    }

    const data = await response.json()
    const text = data.content?.[0]?.text?.trim() || '[]'
    
    // Attempt parse
    const insights = JSON.parse(text)

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('Error in ai-advisor function:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
