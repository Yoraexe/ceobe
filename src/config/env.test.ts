import { describe, it, expect } from 'vitest';
import { getGatewayUrl, env, loadEnv } from './env';

describe('env utils', () => {
  it('getGatewayUrl should return empty if CF not configured', () => {
    const url = getGatewayUrl('anthropic');
    if (!env.CLOUDFLARE_ACCOUNT_ID) {
      expect(url).toBe('');
    } else {
      expect(url).toContain('gateway.ai.cloudflare.com');
    }
  });

  it('getGatewayUrl should handle provider names with slashes', () => {
    const url = getGatewayUrl('@google/genai' as any);
    if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_GATEWAY_ID) {
      expect(url).toContain('/genai');
      expect(url).not.toContain('@google');
    } else {
      expect(url).toBe('');
    }
  });

  it('getGatewayUrl should handle simple provider names', () => {
    const url = getGatewayUrl('anthropic');
    if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_GATEWAY_ID) {
      expect(url).toContain('/anthropic');
    } else {
      expect(url).toBe('');
    }
  });

  it('loadEnv should return a valid config object', () => {
    const config = loadEnv();
    expect(config).toBeDefined();
    expect(config.CEOBE_PLANNER_PROVIDER).toBeDefined();
  });
});
