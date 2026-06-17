// Module: src/telegram/messageQueue.ts
// Tujuan: Antrian FIFO sederhana agar perintah Telegram tidak dieksekusi secara bersamaan
//         di direktori proyek yang sama, mencegah konflik file dan race condition.
// Caller: src/telegram/telegramDaemon.ts
// Dependensi: -
// Main Functions: enqueue, startWorker
// Side Effects: Tidak ada I/O langsung. Mengontrol urutan eksekusi async.
// v1.7.0: Modul baru — Fase 3 dari Ceobe Enterprise Upgrade.

type Task = () => Promise<void>;

export class MessageQueue {
  private queue: Task[] = [];
  private isProcessing = false;

  /**
   * Adds a task to the queue. The task will be executed after all previous tasks complete.
   */
  enqueue(task: Task): void {
    this.queue.push(task);
    this.startWorker();
  }

  /** Returns true if there are tasks waiting or currently running. */
  get isBusy(): boolean {
    return this.isProcessing || this.queue.length > 0;
  }

  /**
   * Clears all pending tasks from the queue.
   * Note: The currently running task cannot be forcefully killed here.
   */
  clear(): number {
    const pendingCount = this.queue.length;
    this.queue = [];
    return pendingCount;
  }

  /**
   * Waits until all currently enqueued and running tasks are finished.
   */
  async waitUntilDrained(): Promise<void> {
    while (this.isBusy) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  private async startWorker(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await task();
      } catch (e: unknown) {
        // Individual task errors are handled inside the task itself, but we log it just in case
        console.error(`[MessageQueue] Background task failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    this.isProcessing = false;
  }
}
