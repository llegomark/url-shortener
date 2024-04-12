import { Hono, Context, Next } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { nanoid } from 'nanoid'
import { cache } from 'hono/cache'
import { cors } from 'hono/cors'
import { prettyJSON } from 'hono/pretty-json'
import { logger } from 'hono/logger'

type Env = {
  URL_MAPPINGS: KVNamespace
  URL_ANALYTICS: KVNamespace
  API_KEYS: KVNamespace
  CUSTOM_DOMAINS: KVNamespace
  REDIRECT_URL: string
  ALLOWED_CORS_ORIGINS: string
}

const app = new Hono<{ Bindings: Env }>()

// Enable CORS for specific origins based on environment variable
app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = c.env.ALLOWED_CORS_ORIGINS.split(',')
    return allowedOrigins.includes(origin)
  }
}))

// Enable logging for all routes
app.use('*', logger())

// Custom error handling
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

// Middleware for API key authentication
app.use('/api/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return c.json({ error: 'Missing Authorization header' }, 401)
  }
  const apiKey = await c.env.API_KEYS.get(token)
  if (!apiKey) {
    return c.json({ error: 'Invalid API key' }, 401)
  }
  await next()
})

// Custom rate limiting middleware
const rateLimiter = async (c: Context, next: Next) => {
  const ip = c.req.header('CF-Connecting-IP')
  const rateLimitKey = `rate_limit:${ip}`
  const limit = 100
  const window = 60
  let count = await c.env.URL_ANALYTICS.get(rateLimitKey)
  count = count ? parseInt(count) : 0
  if (count >= limit) {
    return c.json({ error: 'Too many requests' }, 429)
  }
  await c.env.URL_ANALYTICS.put(rateLimitKey, (count + 1).toString(), {
    expirationTtl: window,
  })
  await next()
}

// Apply rate limiting to the API routes
app.use('/api/*', rateLimiter)

// Schema for URL creation request
const createUrlSchema = z.object({
  url: z.string().url(),
  customCode: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
  expiresIn: z.number().min(60).max(31536000).optional(), // 1 minute to 1 year
})

// Schema for custom domain mapping
const customDomainSchema = z.object({
  domain: z.string().url(),
  target: z.string().url(),
})

// Schema for URL update request
const updateUrlSchema = z.object({
  url: z.string().url(),
})

// Generate a short code for a URL
const generateShortCode = () => nanoid(8)

// Create a new short URL
app.post(
  '/api/urls',
  zValidator('json', createUrlSchema),
  async (c) => {
    const { url, customCode, expiresIn } = c.req.valid('json')
    // Check if the URL already exists in the KV store
    const { keys } = await c.env.URL_MAPPINGS.list()
    const existingShortCode = await Promise.all(
      keys.map(async (key) => {
        const value = await c.env.URL_MAPPINGS.get(key.name)
        if (value) {
          try {
            const { url: storedUrl } = JSON.parse(value)
            return storedUrl === url ? key.name : null
          } catch (error) {
            console.error('Error parsing JSON value:', error)
            return null
          }
        }
        return null
      })
    ).then((results) => results.find((result) => result !== null))
    if (existingShortCode) {
      const shortUrl = `https://${c.req.header('host')}/${existingShortCode}`
      return c.json({ shortUrl, url }, 200)
    }
    // Check if the custom code is provided and unique
    if (customCode) {
      const existingUrl = await c.env.URL_MAPPINGS.get(customCode)
      if (existingUrl) {
        return c.json({ error: 'Custom code already exists' }, 409)
      }
    }
    const shortCode = customCode || generateShortCode()
    const expirationDate = expiresIn ? Date.now() + expiresIn * 1000 : null
    await c.env.URL_MAPPINGS.put(
      shortCode,
      JSON.stringify({ url, expirationDate })
    )
    const shortUrl = `https://${c.req.header('host')}/${shortCode}`
    return c.json({ shortUrl, url }, 201)
  }
)

// Update a short URL
app.put('/api/urls/:shortCode', zValidator('json', updateUrlSchema), async (c) => {
  const shortCode = c.req.param('shortCode')
  const { url } = c.req.valid('json')
  await c.env.URL_MAPPINGS.put(shortCode, JSON.stringify({ url }))
  return c.json({ message: 'URL updated successfully' }, 200)
})

// Delete a short URL
app.delete('/api/urls/:shortCode', async (c) => {
  const shortCode = c.req.param('shortCode')
  await c.env.URL_MAPPINGS.delete(shortCode)
  await c.env.URL_ANALYTICS.delete(shortCode)
  return c.json({ message: 'URL deleted successfully' }, 200)
})

// Create a new custom domain mapping
app.post('/api/domains', zValidator('json', customDomainSchema), async (c) => {
  const { domain, target } = c.req.valid('json')
  await c.env.CUSTOM_DOMAINS.put(domain, target)
  return c.json({ message: 'Custom domain added successfully' }, 201)
})

// Redirect the main domain to another domain
app.get('/', (c) => {
  const redirectUrl = c.env.REDIRECT_URL
  return c.redirect(redirectUrl)
})

// Cache URL mappings for faster access
app.use('/:shortCode', cache({ cacheName: 'url-mappings', cacheControl: 'max-age=3600' }))

// Redirect to the original URL with caching
app.get('/:shortCode', async (c) => {
  const shortCode = c.req.param('shortCode')
  const urlData = await c.env.URL_MAPPINGS.get(shortCode)
  if (!urlData) {
    // Check if the request is for a custom domain
    const customDomain = c.req.header('host')
    if (customDomain) {
      const targetUrl = await c.env.CUSTOM_DOMAINS.get(customDomain)
      if (targetUrl) {
        return c.redirect(targetUrl)
      }
    }
    return c.notFound()
  }
  try {
    const { url, expirationDate } = JSON.parse(urlData)
    if (expirationDate && Date.now() > expirationDate) {
      await c.env.URL_MAPPINGS.delete(shortCode)
      return c.notFound()
    }
    // Increment click count
    const clickCount = await c.env.URL_ANALYTICS.get(shortCode)
    await c.env.URL_ANALYTICS.put(
      shortCode,
      (parseInt(clickCount || '0') + 1).toString()
    )
    return c.redirect(url)
  } catch (error) {
    console.error('Error parsing JSON value:', error)
    return c.notFound()
  }
})

// Get URL analytics with pretty JSON formatting
app.get('/api/analytics/:shortCode', prettyJSON(), async (c) => {
  const shortCode = c.req.param('shortCode')
  const clickCount = await c.env.URL_ANALYTICS.get(shortCode)
  return c.json({ shortCode, clickCount: clickCount ? parseInt(clickCount) : 0 })
})

// Get overall analytics and metrics
app.get('/api/analytics', prettyJSON(), async (c) => {
  const totalClicks = await c.env.URL_ANALYTICS.get('total_clicks')
  const topUrls = await c.env.URL_ANALYTICS.list({ prefix: 'top_urls_' })
  // Implement logic to retrieve and format overall analytics data
  return c.json({ totalClicks, topUrls })
})

export default app