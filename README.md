# URL Shortener

A simple and efficient URL shortener built with Cloudflare Workers, Hono, and TypeScript.

## Features

- Shorten long URLs into compact, easy-to-share short URLs
- Redirect short URLs to their original long URLs
- Track click analytics for each short URL
- API key authentication for secure access to the API endpoints
- Duplicate URL detection to prevent creating multiple short URLs for the same long URL

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

   Update the `wrangler.toml` file with the appropriate namespace bindings.

4. Generate an API key and store it in the `API_KEYS` KV namespace:

   ```bash
   wrangler kv:put --namespace-id=<API_KEYS_NAMESPACE_ID> "your-api-key" "true"
   ```

   Replace `<API_KEYS_NAMESPACE_ID>` with the actual namespace ID of `API_KEYS`.

## Usage

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Create a short URL:

   ```bash
   curl -X POST -H "Content-Type: application/json" -H "X-API-Key: your-api-key" -d '{"url": "https://example.com/long-url"}' http://localhost:8787/api/urls
   ```

   Replace `your-api-key` with your actual API key.

3. Access the short URL:

   ```bash
   curl -L http://localhost:8787/short-code
   ```

   Replace `short-code` with the generated short code.

4. Get URL analytics:

   ```bash
   curl -H "X-API-Key: your-api-key" http://localhost:8787/api/analytics/short-code
   ```

   Replace `your-api-key` with your actual API key and `short-code` with the short code you want to retrieve analytics for.

## Deployment

Deploy the URL shortener to Cloudflare Workers:

```bash
npm run deploy
```

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).