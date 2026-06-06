import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startTelegramDaemon } from './telegramDaemon';

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

vi.mock('../utils/keyManager', () => ({
  readAllKeys: vi.fn().mockReturnValue({ TELEGRAM_BOT_TOKEN: 'mock-token', TELEGRAM_ALLOWED_USERS: 'user1,user2' }),
}));

describe('telegramDaemon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start telegram daemon if token is provided', () => {
    // Tests that daemon initialization function can run without throwing errors
    expect(() => {
      startTelegramDaemon();
      // the actual implementation just starts the polling bot
    }).not.toThrow();
  });
});
