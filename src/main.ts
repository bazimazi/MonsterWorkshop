import { LocalAnalytics, logger } from './platform/services.js';
import { loadJson } from './platform/content.js';
import { decodeCatalog, ContentIndex } from './domain/catalog.js';
import { validateVisuals } from './presentation/creature.js';
import { downloadSave, GameUI } from './presentation/app.js';
import { escape } from './presentation/html.js';
import { SaveConflictError, SaveRepository } from './platform/save.js';
import { showSaveChanged } from './presentation/recovery.js';
import { initialState, stateCodec } from './application/state.js';
import { Workshop } from './application/workshop.js';
import { runWorkshopSession } from './platform/session.js';
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
try {
  const content = new ContentIndex(decodeCatalog(await loadJson('./content/catalog.json')));
  validateVisuals(content);
  const saves = new SaveRepository(localStorage, stateCodec(content)),
    analytics = new LocalAnalytics();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  const reloadLatest = (): void => {
    showSaveChanged(root);
    root
      .querySelector('[data-action="reload-save"]')!
      .addEventListener('click', () => location.reload());
  };
  const start = (): void => {
    try {
      new GameUI(root, new Workshop(content, saves, analytics, seed), content);
      logger.info('Workshop initialized');
      if ('serviceWorker' in navigator)
        void navigator.serviceWorker
          .register('./service-worker.js')
          .catch((error) => logger.info(`Offline cache unavailable: ${String(error)}`));
    } catch (error) {
      logger.error(error);
      if (error instanceof SaveConflictError) {
        reloadLatest();
        return;
      }
      root.innerHTML = `<main class="shell"><section class="panel"><p class="eyebrow">SAVE RECOVERY</p><h1>Your workshop needs attention.</h1><p>${escape(error instanceof Error ? error.message : 'Save could not load')}</p><p class="muted">Your current save has been preserved. Export it before starting over.</p><div class="save-actions"><button class="secondary" id="export-damaged">Export current save</button><button class="secondary" id="restore">Restore backup</button><button class="quiet" id="restart">Start a new workshop</button></div><p id="recovery-error" role="alert"></p></section></main>`;
      const recover = (action: () => void, reload = true): void => {
        try {
          root.querySelector('#recovery-error')!.textContent = '';
          action();
          if (reload) location.reload();
        } catch (recoveryError) {
          if (recoveryError instanceof SaveConflictError) {
            reloadLatest();
            return;
          }
          root.querySelector('#recovery-error')!.textContent =
            recoveryError instanceof Error ? recoveryError.message : 'Recovery failed';
        }
      };
      root
        .querySelector('#export-damaged')!
        .addEventListener('click', () => recover(() => downloadSave(saves.export()), false));
      root.querySelector('#restore')!.addEventListener('click', () =>
        recover(() => {
          saves.restoreBackup();
        }),
      );
      root.querySelector('#restart')!.addEventListener('click', () => {
        if (confirm('Replace this saved workshop? Export it first if you want to keep it.'))
          recover(() => saves.write(initialState(content, seed)));
      });
    }
  };
  void runWorkshopSession(start, () => {
    root.innerHTML =
      '<main class="shell"><section class="panel" role="status"><p class="eyebrow">WORKSHOP IN USE</p><h1>Your workshop is open in another tab.</h1><p>Close the other workshop tab or window to continue here. This page will open your latest save automatically.</p><p class="muted">Waiting here does not advance expeditions or parent recovery.</p></section></main>';
  }).catch((error: unknown) => {
    logger.error(error);
    root.innerHTML =
      '<main class="shell"><section class="panel" role="alert"><h1>The workshop could not open.</h1><p>Your browser could not coordinate workshop tabs. Reload to retry.</p><button class="secondary" id="retry-session">Reload workshop</button></section></main>';
    root.querySelector('#retry-session')!.addEventListener('click', () => location.reload());
  });
} catch (error) {
  logger.error(error);
  root.textContent = 'The workshop could not start. Reload to retry.';
}
