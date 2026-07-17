import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramHITLBridge } from './hitlBridge';

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mockuuid-1234-5678')
}));

vi.mock('../utils/keyManager', () => ({
  readAllKeys: vi.fn().mockReturnValue({ TELEGRAM_ALLOWED_USERS: '456,789' })
}));

describe('hitlBridge', () => {
  let mockBot: any;
  let bridge: TelegramHITLBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBot = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
      on: vi.fn(),
      removeListener: vi.fn(),
      editMessageReplyMarkup: vi.fn().mockResolvedValue({}),
      answerCallbackQuery: vi.fn(),
      editMessageText: vi.fn().mockResolvedValue({}),
    };
    bridge = new TelegramHITLBridge(mockBot, 456);
  });

  describe('requestConfirmation', () => {
    it('should resolve with boolean and secure uuid', async () => {
      const askPromise = bridge.requestConfirmation('Test permission');
      
      await new Promise(r => setImmediate(r));
      
      const onCall = mockBot.on.mock.calls.find((call: any) => call[0] === 'callback_query');
      expect(onCall).toBeDefined();
      
      const onCallback = onCall[1];
      onCallback({
        id: 'callback_id_123',
        from: { id: 456 },
        message: { message_id: 123, chat: { id: 456 } },
        data: 'hitl_yes_mockuuid'
      });

      const result = await askPromise;
      expect(result).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(456, expect.any(String), expect.objectContaining({
         reply_markup: expect.objectContaining({
           inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                 expect.objectContaining({ callback_data: 'hitl_yes_mockuuid' })
              ])
           ])
         })
      }));
    });

    it('should reject unauthorized cross-chat attempts', async () => {
      const askPromise = bridge.requestConfirmation('Test permission');
      await new Promise(r => setImmediate(r));
      const onCall = mockBot.on.mock.calls.find((call: any) => call[0] === 'callback_query');
      const onCallback = onCall[1];
      
      // Attempting to answer from a different chat ID
      onCallback({
        id: 'callback_id_123',
        from: { id: 999 },
        message: { message_id: 123, chat: { id: 999 } },
        data: 'hitl_yes_mockuuid'
      });
      // Should not resolve yet
      let resolved = false;
      askPromise.then(() => resolved = true);
      await new Promise(r => setTimeout(r, 10));
      expect(resolved).toBe(false);

      // Now send the correct one
      onCallback({
        id: 'callback_id_123',
        from: { id: 456 },
        message: { message_id: 123, chat: { id: 456 } },
        data: 'hitl_no_mockuuid'
      });

      const result = await askPromise;
      expect(result).toBe(false);
    });
  });
});
