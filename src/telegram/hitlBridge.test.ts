import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramHITLBridge } from './hitlBridge';


vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'mockuuid-1234-5678')
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
    it('should resolve with boolean', async () => {
      const askPromise = bridge.requestConfirmation('Test permission');
      
      // Wait for sendMessage to resolve
      await new Promise(r => setImmediate(r));
      
      const onCall = mockBot.on.mock.calls.find((call: any) => call[0] === 'callback_query');
      expect(onCall).toBeDefined();
      
      const onCallback = onCall[1];
      onCallback({
        id: 'callback_id_123',
        message: { message_id: 123, chat: { id: 456 } },
        data: 'hitl_yes_mockuuid'
      });

      const result = await askPromise;
      expect(result).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(456, expect.any(String), expect.any(Object));
      expect(mockBot.editMessageReplyMarkup).toHaveBeenCalledWith({ inline_keyboard: [] }, { chat_id: 456, message_id: 123 });
    });
  });
});
