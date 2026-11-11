'use client';

import { SCREEN_SYNC_CHANNEL, ScreenSyncEvent } from '../contracts';

export { SCREEN_SYNC_CHANNEL };

/**
 * Broadcast Bus between Screen 1 (/kiosk), Screen 2 (/display), and Screen 3 (/admin).
 * All screens run in the browser on the laptop / extended display setup,
 * so BroadcastChannel delivers events instantly with 0ms network overhead and works 100% offline.
 */
export function openScreenBus() {
  const channel = new BroadcastChannel(SCREEN_SYNC_CHANNEL);

  return {
    post(event: ScreenSyncEvent) {
      try {
        channel.postMessage(event);
      } catch {
        // Channel may be closed or page unmounted
      }
    },
    subscribe(handler: (event: ScreenSyncEvent) => void) {
      const listener = (e: MessageEvent<ScreenSyncEvent>) => handler(e.data);
      channel.addEventListener('message', listener);
      return () => {
        try {
          channel.removeEventListener('message', listener);
        } catch {}
      };
    },
    close() {
      try {
        channel.close();
      } catch {}
    },
  };
}

export type ScreenBus = ReturnType<typeof openScreenBus>;
