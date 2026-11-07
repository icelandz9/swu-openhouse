'use client';

import { SCREEN_SYNC_CHANNEL, ScreenSyncEvent } from '../contracts';

/**
 * Broadcast Bus between Screen 1 (/kiosk) and Screen 2 (/display).
 * Both screens run in the same browser on one laptop, so BroadcastChannel
 * delivers events instantly and works fully offline.
 */
export function openScreenBus() {
  const channel = new BroadcastChannel(SCREEN_SYNC_CHANNEL);

  return {
    post(event: ScreenSyncEvent) {
      channel.postMessage(event);
    },
    subscribe(handler: (event: ScreenSyncEvent) => void) {
      const listener = (e: MessageEvent<ScreenSyncEvent>) => handler(e.data);
      channel.addEventListener('message', listener);
      return () => channel.removeEventListener('message', listener);
    },
    close() {
      channel.close();
    },
  };
}

export type ScreenBus = ReturnType<typeof openScreenBus>;
