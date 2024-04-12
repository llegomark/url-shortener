# URL Shortener

A simple and efficient URL shortener built with Cloudflare Workers, Hono, and TypeScript.

## Features

- Shorten long URLs into compact, easy-to-share short URLs
- Redirect short URLs to their original long URLs
- Track click analytics for each short URL
- API key authentication for secure access to the API endpoints
- Duplicate URL detection to prevent creating multiple short URLs for the same long URL
- Support for custom short codes
- Expiration time for short URLs
- Rate limiting to prevent abuse
- Input validation and error handling
- Custom domain support
- Update and delete short URLs
- CORS support with configurable allowed origins
- Caching of URL mappings for faster access
- Logging for better debugging and monitoring
- Pretty JSON formatting for API responses

## Prerequisites

- [Node.js](https://nodejs.org/)
- [Cloudflare Workers](https://workers.cloudflare.com/) account
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/llegomark/url-shortener.git
   ```

2. Install the dependencies:

   ```bash
   cd url-shortener
   npm install
   ```

3. Set up the required Cloudflare Workers KV namespaces:

   - `URL_MAPPINGS`: Stores the mappings between short codes and original URLs
   - `URL_ANALYTICS`: Stores the click analytics for each short URL
   - `API_KEYS`: Stores the API keys for authentication
   - `CUSTOM_DOMAINS`: Stores the custom domain mappings

   Update the `wrangler.toml` file with the appropriate namespace bindings.

4. Generate an API key and store it in the `API_KEYS` KV namespace:

   ```bash
   wrangler kv:put --namespace-id=<API_KEYS_NAMESPACE_ID> "your-api-key" "true"
   ```

   Replace `<API_KEYS_NAMESPACE_ID>` with the actual namespace ID of `API_KEYS`.

5. Set the `ALLOWED_CORS_ORIGINS` environment variable to specify the allowed origins for CORS:

   ```bash
   wrangler secret put ALLOWED_CORS_ORIGINS
   ```

   Enter the comma-separated list of allowed origins when prompted.

## Usage

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Create a short URL:

   ```bash
   curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer your-api-key" -d '{"url": "https://example.com/long-url"}' http://localhost:8787/api/urls
   ```

   Replace `your-api-key` with your actual API key.

3. Create a short URL with a custom short code:

   ```bash
   curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer your-api-key" -d '{"url": "https://example.com/long-url", "customCode": "my-custom-code"}' http://localhost:8787/api/urls
   ```

   Replace `your-api-key` with your actual API key and `my-custom-code` with your desired custom short code.

4. Create a short URL with an expiration time:

   ```bash
   curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer your-api-key" -d '{"url": "https://example.com/long-url", "expiresIn": 3600}' http://localhost:8787/api/urls
   ```

   Replace `your-api-key` with your actual API key and `3600` with the desired expiration time in seconds (e.g., 3600 seconds = 1 hour).

5. Access the short URL:

   ```bash
   curl -L http://localhost:8787/short-code
   ```

   Replace `short-code` with the generated short code.

6. Update a short URL:

   ```bash
   curl -X PUT -H "Content-Type: application/json" -H "Authorization: Bearer your-api-key" -d '{"url": "https://example.com/new-long-url"}' http://localhost:8787/api/urls/short-code
   ```

   Replace `your-api-key` with your actual API key, `short-code` with the short code you want to update, and `https://example.com/new-long-url` with the new long URL.

7. Delete a short URL:

   ```bash
   curl -X DELETE -H "Authorization: Bearer your-api-key" http://localhost:8787/api/urls/short-code
   ```

   Replace `your-api-key` with your actual API key and `short-code` with the short code you want to delete.

8. Create a custom domain mapping:

   ```bash
   curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer your-api-key" -d '{"domain": "https://custom-domain.com", "target": "https://example.com"}' http://localhost:8787/api/domains
   ```

   Replace `your-api-key` with your actual API key, `https://custom-domain.com` with your custom domain, and `https://example.com` with the target URL.

9. Get URL analytics:

   ```bash
   curl -H "Authorization: Bearer your-api-key" http://localhost:8787/api/analytics/short-code
   ```

   Replace `your-api-key` with your actual API key and `short-code` with the short code you want to retrieve analytics for.

10. Get overall analytics:

    ```bash
    curl -H "Authorization: Bearer your-api-key" http://localhost:8787/api/analytics
    ```

    Replace `your-api-key` with your actual API key.

## Setting Expiration Time

To set an expiration time for a short URL, include the `expiresIn` parameter in the request payload when creating the short URL. The value should be in seconds.
For example, to create a short URL that expires in 1 hour (3600 seconds):

```bash
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer your-api-key" -d '{"url": "https://example.com/long-url", "expiresIn": 3600}' http://localhost:8787/api/urls
```

If the `expiresIn` parameter is not provided, the short URL will not have an expiration time and will remain valid indefinitely.
When a short URL with an expiration time is accessed after its expiration, a 404 (Not Found) error will be returned, and the short URL will be automatically deleted from the system.

## Deployment

Deploy the URL shortener to Cloudflare Workers:

```bash
npm run deploy
```

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).