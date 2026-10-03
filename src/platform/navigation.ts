export type Screen = 'workshop' | 'creatures' | 'battle' | 'explore' | 'journal' | 'settings';
const screens: Screen[] = ['workshop', 'creatures', 'battle', 'explore', 'journal', 'settings'];
export class Navigation {
  constructor(private render: (screen: Screen) => void) {
    window.addEventListener('hashchange', () => this.render(this.current));
  }
  get current(): Screen {
    const hash = location.hash.slice(1);
    return screens.includes(hash as Screen) ? (hash as Screen) : 'workshop';
  }
  go(screen: Screen): void {
    if (this.current === screen) this.render(screen);
    else location.hash = screen;
  }
}
