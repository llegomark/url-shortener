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
- OpenGraph metadata support for rich previews when sharing short URLs on social media platforms
- Fallback values for missing OpenGraph metadata
- Caching of OpenGraph metadata to improve performance
- Error handling for fetching and extracting OpenGraph metadata
- Validation of OpenGraph metadata to ensure valid formats
- Encoding of OpenGraph metadata values to prevent cross-site scripting (XSS) attacks

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
   - `OG_METADATA_CACHE`: Stores the cached OpenGraph metadata

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

## Frontend

The URL Shortener also comes with a user-friendly frontend built with React, TypeScript, Vite, and Tailwind CSS. The frontend provides an intuitive interface for users to interact with the URL shortening service.

### Frontend Features

- Shorten long URLs into compact, easy-to-share short URLs
- Update and delete short URLs
- View click analytics for each short URL
- Responsive design for optimal viewing on various devices
- API key authentication for secure access to the backend API
- Option to use environment variables for the API base URL and API key
- Input validation and error handling
- Copy short URLs to clipboard with a single click
- Loading states and error messages for better user experience
- Styled with Tailwind CSS for a modern and visually appealing interface

### Frontend Repository

The frontend code is maintained in a separate repository. You can find the frontend repository at:

[URL Shortener Frontend](https://github.com/llegomark/url-shortener-frontend)

Please refer to the frontend repository for detailed instructions on setting up and running the frontend application.

### Integration with Backend

The frontend communicates with the URL Shortener backend API to perform various operations such as creating short URLs, updating and deleting URLs, and retrieving click analytics. It sends requests to the backend API endpoints using the appropriate HTTP methods and headers.

Make sure to configure the frontend with the correct backend API URL and API key to establish a successful connection between the frontend and backend.

## OpenGraph Metadata Support

The URL shortener now supports OpenGraph metadata for rich previews when sharing short URLs on social media platforms. When creating a short URL, you can optionally provide the OpenGraph metadata (`ogTitle`, `ogDescription`, `ogImage`) in the request payload. If the metadata is not provided, the system will attempt to fetch it from the original URL.

The fetched OpenGraph metadata is cached for improved performance, and fallback values are used if the metadata is missing or invalid. The metadata values are properly encoded to prevent cross-site scripting (XSS) attacks.

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
