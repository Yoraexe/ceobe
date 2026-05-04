import { env } from '../config/env';

/**
 * Constructs the Cloudflare AI Gateway URL for a given provider.
 * Returns an empty string if Cloudflare credentials are not configured,
 * allowing provider adapters to fall back to their direct API endpoints.
 *
 * @param provider - e.g. 'google-genai', 'anthropic'
 * @returns Cloudflare gateway URL or empty string if CF not configured
 */
export function getGatewayUrl(provider: 'google-genai' | 'anthropic'): string {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_GATEWAY_ID) {
    return ''; // No CF gateway; callers should use the provider's native base URL
  }
  return `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/${provider}`;
}
