import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getGatewayUrl, loadEnv, reloadEnv, env } from './env';

describe('env utils', () => {
  const origAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  const origGateway = process.env.CLOUDFLARE_GATEWAY_ID;

  afterEach(() => {
    if (origAccount !== undefined) process.env.CLOUDFLARE_ACCOUNT_ID = origAccount;
    else delete process.env.CLOUDFLARE_ACCOUNT_ID;

    if (origGateway !== undefined) process.env.CLOUDFLARE_GATEWAY_ID = origGateway;
    else delete process.env.CLOUDFLARE_GATEWAY_ID;

    reloadEnv();
  });

  it('getGatewayUrl should return empty string if Cloudflare credentials are missing', () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_GATEWAY_ID;
    reloadEnv();

    const url = getGatewayUrl('anthropic');
    expect(url).toBe('');
  });

  it('getGatewayUrl should return gateway url when credentials are present', () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
    process.env.CLOUDFLARE_GATEWAY_ID = 'test-gateway-id';
    reloadEnv();

    const url = getGatewayUrl('@google/genai' as any);
    expect(url).toBe('https://gateway.ai.cloudflare.com/v1/test-account-id/test-gateway-id/google-genai');
  });

  it('loadEnv should return a valid config object with defaults', () => {
    const config = loadEnv();
    expect(config).toBeDefined();
    expect(config.CEOBE_SANDBOX).toMatch(/docker|none/);
    expect(config.CEOBE_MAX_BUDGET).toBeGreaterThanOrEqual(0);
  });
});
