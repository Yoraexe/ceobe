import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startTelegramDaemon, getAllowedIds, escapeHtml } from './telegramDaemon';

vi.mock('node-telegram-bot-api', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        onText: vi.fn(),
        on: vi.fn(),
        sendMessage: vi.fn(),
        getMe: vi.fn().mockResolvedValue({ username: 'testbot' })
      };
    })
  };
});

let mockKeys = { TELEGRAM_BOT_TOKEN: 'mock-token', TELEGRAM_ALLOWED_USERS: '12345,67890' };
vi.mock('../utils/keyManager', () => ({
  readAllKeys: vi.fn().mockImplementation(() => mockKeys),
  getKey: vi.fn().mockImplementation((k) => mockKeys[k as keyof typeof mockKeys] || ''),
}));

describe('telegramDaemon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllowedIds', () => {
    it('should return Set of allowed IDs', () => {
      const ids = getAllowedIds('12345, 67890');
      expect(ids.has(12345)).toBe(true);
      expect(ids.has(67890)).toBe(true);
      expect(ids.has(99999)).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML tags to prevent XSS in Telegram', () => {
      const input = '<script>alert("xss")</script> & "test"';
      const output = escapeHtml(input);
      expect(output).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;test&quot;');
    });
  });

  it('should start telegram daemon if token is provided', () => {
    expect(() => {
      startTelegramDaemon();
    }).not.toThrow();
  });
});
