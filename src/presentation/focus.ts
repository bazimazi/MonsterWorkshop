export interface FocusBookmark {
  selector: string;
  selection?: [number, number, 'forward' | 'backward' | 'none'];
}

function selectorFor(element: HTMLElement): string | undefined {
  if (element.id) return `#${CSS.escape(element.id)}`;
  if (element.tagName === 'SUMMARY') {
    const details = element.parentElement;
    return details?.dataset.detail
      ? `[data-detail="${CSS.escape(details.dataset.detail)}"] > summary`
      : undefined;
  }
  const attributes = element
    .getAttributeNames()
    .filter(
      (name) => name.startsWith('data-') || ['name', 'href', 'type', 'tabindex'].includes(name),
    );
  let selector =
    element.tagName.toLowerCase() +
    attributes.map((name) => `[${name}="${CSS.escape(element.getAttribute(name)!)}"]`).join('');
  const form = element.closest('form');
  if (form && form !== element) {
    const formSelector = selectorFor(form);
    if (!formSelector) return undefined;
    selector = `${formSelector} ${selector}`;
  } else if (!attributes.length) return undefined;
  return selector;
}

export function captureFocus(root: HTMLElement): FocusBookmark | undefined {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active)) return undefined;
  const selector = selectorFor(active);
  if (!selector || root.querySelectorAll(selector).length !== 1) return undefined;
  const bookmark: FocusBookmark = { selector };
  if (
    (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
    active.selectionStart !== null &&
    active.selectionEnd !== null
  )
    bookmark.selection = [
      active.selectionStart,
      active.selectionEnd,
      active.selectionDirection ?? 'none',
    ];
  return bookmark;
}

export function restoreFocus(
  root: HTMLElement,
  bookmark: FocusBookmark | undefined,
  scope: HTMLElement = root,
): boolean {
  if (!bookmark) return false;
  const target = root.querySelector<HTMLElement>(bookmark.selector);
  if (!target || !scope.contains(target) || target.matches(':disabled')) return false;
  target.focus({ preventScroll: true });
  if (document.activeElement !== target) return false;
  if (
    bookmark.selection &&
    (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
  )
    target.setSelectionRange(...bookmark.selection);
  return true;
}

export function containTabFocus(dialog: HTMLDialogElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const controls = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.matches(':disabled') && element.getClientRects().length > 0);
  const destination = event.shiftKey ? controls.at(-1) : controls[0];
  const boundary = event.shiftKey ? controls[0] : controls.at(-1);
  if (
    !controls.length ||
    !dialog.contains(document.activeElement) ||
    document.activeElement === boundary
  ) {
    event.preventDefault();
    (destination ?? dialog).focus();
  }
}
