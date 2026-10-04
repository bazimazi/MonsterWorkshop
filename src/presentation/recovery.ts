export function showSaveChanged(root: HTMLElement): void {
  root.innerHTML =
    '<main class="shell"><section class="panel" role="alert"><p class="eyebrow">SAVE UPDATED</p><h1 tabindex="-1">Your saved workshop changed.</h1><p>Reload the latest workshop to continue with the progress saved elsewhere.</p><p class="muted">Expeditions and parent recovery are paused here.</p><button class="secondary" data-action="reload-save">Reload latest workshop</button></section></main>';
  root.querySelector<HTMLElement>('h1')!.focus();
}
