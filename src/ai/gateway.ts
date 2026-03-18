import { env } from '../config/env';

/**
 * Constructs the Cloudflare AI Gateway URL for a given provider.
 * 
 * @param provider - 'google-genai' for Gemini, 'anthropic' for Claude
 * @returns The gateway URL
 */
export function getGatewayUrl(provider: 'google-genai' | 'anthropic'): string {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_GATEWAY_ID) {
    throw new Error('Cloudflare Gateway credentials are not properly configured.');
  }

  return `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CLOUDFLARE_GATEWAY_ID}/${provider}`;
}
