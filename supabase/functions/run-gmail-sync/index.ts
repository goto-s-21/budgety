const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const githubToken = Deno.env.get('GITHUB_TOKEN')
  const owner = Deno.env.get('GITHUB_OWNER')
  const repo = Deno.env.get('GITHUB_REPO')
  const workflow = Deno.env.get('GITHUB_WORKFLOW') || 'gmail-sync.yml'
  const ref = Deno.env.get('GITHUB_REF') || 'main'

  if (!githubToken || !owner || !repo) {
    return new Response(JSON.stringify({ error: 'GitHub settings are not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref }),
    },
  )

  if (!response.ok) {
    return new Response(
      JSON.stringify({
        error: 'GitHub workflow dispatch failed',
        detail: await response.text(),
      }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
