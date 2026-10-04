import { SAVE_KEY } from './save.js';

// Hold one writer for the document lifetime. Waiting tabs load only after acquiring it.
export async function runWorkshopSession(start: () => void, waiting: () => void): Promise<void> {
  // Cached pages must reload current data, including when locks are unavailable.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });
  if (!navigator.locks) {
    start();
    return;
  }
  const controller = new AbortController();
  let finish!: () => void;
  const ended = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const leave = (): void => {
    document.querySelector<HTMLElement>('#app')!.inert = true;
    controller.abort();
    finish();
  };
  window.addEventListener('pagehide', leave, { once: true });
  let acquired = false;
  const activate = async (): Promise<void> => {
    if (controller.signal.aborted) return;
    acquired = true;
    start();
    await ended;
  };
  try {
    await navigator.locks.request(SAVE_KEY + '.writer', { ifAvailable: true }, (lock) =>
      lock ? activate() : undefined,
    );
    if (!acquired && !controller.signal.aborted) {
      waiting();
      await navigator.locks.request(SAVE_KEY + '.writer', { signal: controller.signal }, activate);
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  } finally {
    window.removeEventListener('pagehide', leave);
  }
}
