export async function suggestSeo(input: { title: string; bodyText: string }): Promise<{
  title: string
  description: string
}> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Write an SEO meta title (max 60 characters) and meta description (max 160 characters) for a page titled "${input.title}" with this content: ${input.bodyText}. Respond with ONLY JSON: {"title": "...", "description": "..."}`,
        },
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenRouter request failed: ${res.status}`)

  const data = await res.json()
  const content = data.choices[0].message.content as string
  return JSON.parse(content)
}
