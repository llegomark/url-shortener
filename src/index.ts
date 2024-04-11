import { Hono, Context, Next } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { nanoid } from 'nanoid'

type Env = {
  URL_MAPPINGS: KVNamespace
  URL_ANALYTICS: KVNamespace
  API_KEYS: KVNamespace
}

const app = new Hono<{ Bindings: Env }>()

// Middleware for API key authentication
const apiKeyAuth = async (c: Context, next: Next) => {
  const apiKey = c.req.header('X-API-Key') || c.req.query('api_key')
  if (!apiKey) {
    return c.json({ error: 'API key is missing' }, 401)
  }

  const storedApiKey = await c.env.API_KEYS.get(apiKey)
  if (!storedApiKey) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  await next()
}

// Schema for URL creation request
const createUrlSchema = z.object({
  url: z.string().url(),
})

// Generate a short code for a URL
const generateShortCode = () => nanoid(8)

// Create a new short URL
app.post(
  '/api/urls',
  apiKeyAuth,
  zValidator('json', createUrlSchema),
  async (c) => {
    const { url } = c.req.valid('json')

    // Check if the URL already exists in the KV store
    const { keys } = await c.env.URL_MAPPINGS.list()
    const existingShortCode = await Promise.all(
      keys.map(async (key) => {
        const value = await c.env.URL_MAPPINGS.get(key.name)
        return value === url ? key.name : null
      })
    ).then((results) => results.find((result) => result !== null))

    if (existingShortCode) {
      const shortUrl = `https://${c.req.header('host')}/${existingShortCode}`
      return c.json({ shortUrl, url }, 200)
    }

    const shortCode = generateShortCode()

    await c.env.URL_MAPPINGS.put(shortCode, url)

    const shortUrl = `https://${c.req.header('host')}/${shortCode}`

    return c.json({ shortUrl, url }, 201)
  }
)

// Redirect to the original URL
app.get('/:shortCode', async (c) => {
  const shortCode = c.req.param('shortCode')

  const url = await c.env.URL_MAPPINGS.get(shortCode)

  if (!url) {
    return c.notFound()
  }

  // Increment click count
  const clickCount = await c.env.URL_ANALYTICS.get(shortCode)
  await c.env.URL_ANALYTICS.put(shortCode, (parseInt(clickCount || '0') + 1).toString())

  return c.redirect(url)
})

// Get URL analytics
app.get('/api/analytics/:shortCode', apiKeyAuth, async (c) => {
  const shortCode = c.req.param('shortCode')
  const clickCount = await c.env.URL_ANALYTICS.get(shortCode)

  return c.json({ shortCode, clickCount: clickCount ? parseInt(clickCount) : 0 })
})

export default app