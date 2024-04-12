import { Hono, Context, Next } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { nanoid } from 'nanoid'
import { cache } from 'hono/cache'
import { cors } from 'hono/cors'
import { prettyJSON } from 'hono/pretty-json'
import { logger } from 'hono/logger'
import { escape } from 'html-escaper'

type Env = {
  URL_MAPPINGS: KVNamespace
  URL_ANALYTICS: KVNamespace
  API_KEYS: KVNamespace
  CUSTOM_DOMAINS: KVNamespace
  REDIRECT_URL: string
  ALLOWED_CORS_ORIGINS: string
  OG_METADATA_CACHE: KVNamespace
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = c.env.ALLOWED_CORS_ORIGINS.split(',')
    return allowedOrigins.includes(origin)
  }
}))

app.use('*', logger())

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

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

app.use('/api/*', rateLimiter)

const createUrlSchema = z.object({
  url: z.string().url(),
  customCode: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
  expiresIn: z.number().min(60).max(31536000).optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().url().optional(),
})

const customDomainSchema = z.object({
  domain: z.string().url(),
  target: z.string().url(),
})

const updateUrlSchema = z.object({
  url: z.string().url(),
})

const generateShortCode = () => nanoid(8)

const fetchOpenGraphMetadata = async (url: string, c: Context): Promise<{
  ogTitle: string
  ogDescription: string
  ogImage: string
}> => {
  const cacheKey = `og_metadata:${url}`
  const cachedMetadata = await c.env.OG_METADATA_CACHE.get(cacheKey)

  if (cachedMetadata) {
    return JSON.parse(cachedMetadata)
  }

  let ogTitle = ''
  let ogDescription = ''
  let ogImage = ''
  let titleText = ''

  const rewriter = new HTMLRewriter()
    .on('meta[property="og:title"]', {
      element(element) {
        ogTitle = element.getAttribute('content') || ''
      },
    })
    .on('meta[property="og:description"]', {
      element(element) {
        ogDescription = element.getAttribute('content') || ''
      },
    })
    .on('meta[property="og:image"]', {
      element(element) {
        ogImage = element.getAttribute('content') || ''
      },
    })
    .on('title', {
      text(text) {
        titleText += text.text
      }
    })

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenGraph metadata: ${response.status}`)
    }
    await rewriter.transform(response).arrayBuffer()
  } catch (error) {
    console.error('Error fetching OpenGraph metadata:', error)
    // Fallback values
    ogTitle = titleText || 'Untitled'
    ogDescription = 'No description available'
    ogImage = 'https://via.placeholder.com/1200x630?text=No+Image'
  }

  // Validate OpenGraph metadata
  const isValidUrl = (str: string) => {
    try {
      new URL(str)
      return true
    } catch (error) {
      return false
    }
  }

  if (!isValidUrl(ogImage)) {
    ogImage = 'https://via.placeholder.com/1200x630?text=No+Image'
  }

  const metadata = {
    ogTitle,
    ogDescription,
    ogImage
  }

  await c.env.OG_METADATA_CACHE.put(cacheKey, JSON.stringify(metadata), {
    expirationTtl: 3600 // Cache for 1 hour
  })

  return metadata
}

app.post('/api/urls', zValidator('json', createUrlSchema), async (c) => {
  const { url, customCode, expiresIn, ogTitle, ogDescription, ogImage } = c.req.valid('json')

  const { ogTitle: finalOgTitle, ogDescription: finalOgDescription, ogImage: finalOgImage } = ogTitle && ogDescription && ogImage
    ? { ogTitle, ogDescription, ogImage }
    : await fetchOpenGraphMetadata(url, c)

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
    JSON.stringify({ url, expirationDate, ogTitle: finalOgTitle, ogDescription: finalOgDescription, ogImage: finalOgImage })
  )
  const shortUrl = `https://${c.req.header('host')}/${shortCode}`
  return c.json({ shortUrl, url }, 201)
})

app.put('/api/urls/:shortCode', zValidator('json', updateUrlSchema), async (c) => {
  const shortCode = c.req.param('shortCode')
  const { url } = c.req.valid('json')
  await c.env.URL_MAPPINGS.put(shortCode, JSON.stringify({ url }))
  return c.json({ message: 'URL updated successfully' }, 200)
})

app.delete('/api/urls/:shortCode', async (c) => {
  const shortCode = c.req.param('shortCode')
  await c.env.URL_MAPPINGS.delete(shortCode)
  await c.env.URL_ANALYTICS.delete(shortCode)
  return c.json({ message: 'URL deleted successfully' }, 200)
})

app.post('/api/domains', zValidator('json', customDomainSchema), async (c) => {
  const { domain, target } = c.req.valid('json')
  await c.env.CUSTOM_DOMAINS.put(domain, target)
  return c.json({ message: 'Custom domain added successfully' }, 201)
})

app.get('/', (c) => {
  const redirectUrl = c.env.REDIRECT_URL
  return c.redirect(redirectUrl)
})

app.use('/:shortCode', cache({ cacheName: 'url-mappings', cacheControl: 'max-age=3600' }))

app.get('/:shortCode/og', async (c) => {
  const shortCode = c.req.param('shortCode')
  const urlData = await c.env.URL_MAPPINGS.get(shortCode)
  if (!urlData) {
    return c.notFound()
  }
  try {
    const { url, ogTitle, ogDescription, ogImage } = JSON.parse(urlData)
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${escape(ogTitle || 'Untitled')}</title>
          <meta property="og:title" content="${escape(ogTitle || 'Untitled')}" />
          <meta property="og:description" content="${escape(ogDescription || '')}" />
          <meta property="og:image" content="${escape(ogImage || '')}" />
          <meta property="og:url" content="${escape(url)}" />
          <meta property="og:type" content="website" />
        </head>
        <body>
          <script>
            window.location.href = '${escape(url)}';
          </script>
        </body>
      </html>
    `
    return c.html(html)
  } catch (error) {
    console.error('Error parsing JSON value:', error)
    return c.notFound()
  }
})

app.get('/:shortCode', async (c) => {
  const shortCode = c.req.param('shortCode')
  const userAgent = c.req.header('user-agent') || ''
  if (userAgent.includes('facebookexternalhit') || userAgent.includes('twitterbot')) {
    return c.redirect(`/${shortCode}/og`)
  }
  const urlData = await c.env.URL_MAPPINGS.get(shortCode)
  if (!urlData) {
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

app.get('/api/analytics/:shortCode', prettyJSON(), async (c) => {
  const shortCode = c.req.param('shortCode')
  const clickCount = await c.env.URL_ANALYTICS.get(shortCode)
  return c.json({ shortCode, clickCount: clickCount ? parseInt(clickCount) : 0 })
})

app.get('/api/analytics', prettyJSON(), async (c) => {
  const totalClicks = await c.env.URL_ANALYTICS.get('total_clicks')
  const topUrls = await c.env.URL_ANALYTICS.list({ prefix: 'top_urls_' })
  return c.json({ totalClicks, topUrls })
})

export default app