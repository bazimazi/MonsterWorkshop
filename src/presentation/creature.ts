import type { ContentIndex } from '../domain/catalog.js';
import type { Creature, Slot } from '../domain/model.js';
import { clamp } from '../domain/random.js';
import { escape } from './html.js';
const anchors: Record<Slot, [number, number]> = { body:[200,190], head:[200,119], legs:[200,218], armor:[200,179], organ:[200,188], wings:[200,170] };
export const MESH_KEYS = ['wolf','dragon','spider','crystal','lightning','storm'];
export function blend(a: string, b: string, ratio: number): string {
  const channels = [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16)*(1-ratio)+parseInt(b.slice(i,i+2),16)*ratio).toString(16).padStart(2,'0'));
  return '#'+channels.join('');
}
function mesh(key: string, color: string, glow: string, hasLegs: boolean): string {
  const dark=blend(color,'#29203e',0.35), light=blend(color,'#ffffff',0.27);
  const line='stroke="#302741" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';
  switch(key) {
    case 'wolf': return `<g ${line}>
      <path d="M51 7Q99 -4 91 -29Q114 -12 101 19Q80 42 45 29" fill="${dark}"/>
      ${hasLegs?'':`<path d="M-50 19 -52 63Q-36 74 -19 62L-12 21M17 22 18 64Q37 74 54 62L50 17" fill="${dark}"/>`}
      <path d="M-62 8Q-74 -60 -30 -67Q0 -89 36 -67Q80 -52 65 12Q60 59 0 61Q-59 57 -62 8Z" fill="${color}"/>
      <path d="M-48 -11Q-38 44 0 46Q42 44 50 -8Q34 4 20 -10Q0 6 -20 -10Q-32 6 -48 -11Z" fill="${light}" stroke="none"/>
      <path d="M-52 9 -43 16M47 6 39 14" stroke="${dark}"/>
    </g>`;
    case 'dragon': return `<g ${line}>
      <path d="M-41 -25Q-64 -55 -43 -70L-23 -37M23 -37 43 -70Q64 -56 42 -25" fill="${glow}"/>
      <path d="M-50 -12 -70 -25 -59 2 -72 15 -51 21M50 -12 70 -25 59 2 72 15 51 21" fill="${dark}"/>
      <path d="M-54 6Q-66 -41 -24 -43Q0 -57 28 -42Q66 -36 55 11L48 37Q0 65 -48 37Z" fill="${color}"/>
      <path d="M-46 23Q-21 10 0 22Q23 9 47 22L45 40Q0 65 -45 40Z" fill="${light}"/>
      <ellipse cx="-25" cy="0" rx="13" ry="17" fill="#302741"/><ellipse cx="25" cy="0" rx="13" ry="17" fill="#302741"/>
      <ellipse cx="-25" cy="-1" rx="7" ry="11" fill="${glow}" stroke="none"/><ellipse cx="25" cy="-1" rx="7" ry="11" fill="${glow}" stroke="none"/>
      <circle cx="-29" cy="-7" r="3.5" fill="#fff" stroke="none"/><circle cx="21" cy="-7" r="3.5" fill="#fff" stroke="none"/>
      <path d="M-10 34Q0 41 10 34M-17 26 -13 25M13 25 17 26" fill="none"/>
      <path d="M-36 28 -33 34 -29 28M29 28 33 34 36 28" fill="#fff" stroke="none"/>
      <path d="M-12 -35 0 -43 12 -35 0 -27Z" fill="${glow}" stroke="none"/>
    </g>`;
    case 'spider': return `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-34 -20 -85 -27 -119 18M-43 -4 -97 4 -122 43M-39 18 -83 32 -95 67M34 -20 85 -27 119 18M43 -4 97 4 122 43M39 18 83 32 95 67" stroke="#302741" stroke-width="16"/>
      <path d="M-34 -20 -85 -27 -119 18M-43 -4 -97 4 -122 43M-39 18 -83 32 -95 67M34 -20 85 -27 119 18M43 -4 97 4 122 43M39 18 83 32 95 67" stroke="${color}" stroke-width="10"/>
    </g>`;
    case 'crystal': return `<g ${line}><path d="M-61 -12 -45 -32 -20 -13 -37 17 -65 11ZM61 -12 45 -32 20 -13 37 17 65 11Z" fill="${color}"/><path d="M-45 -32 -44 -5 -65 11M45 -32 44 -5 65 11" stroke="${light}"/><path d="M-46 15 -28 22 -38 44 -59 30ZM46 15 28 22 38 44 59 30Z" fill="${dark}"/></g>`;
    case 'lightning': return `<g ${line}><ellipse cy="3" rx="21" ry="28" fill="#403b5c"/><ellipse cy="3" rx="16" ry="22" fill="${color}"/><path d="M3 -14 -9 5 0 5 -4 21 11 0 2 0Z" fill="#fff6ce" stroke="none"/><path d="M-21 0 -31 -4M21 0 31 -4" stroke="${glow}"/><circle cy="-23" r="4" fill="${light}"/></g>`;
    case 'storm': return `<g ${line}><path d="M-36 12Q-102 -1 -155 -86L-145 -20 -111 -29 -104 8 -73 -1 -56 32ZM36 12Q102 -1 155 -86L145 -20 111 -29 104 8 73 -1 56 32Z" fill="${color}"/><path d="M-36 12 -145 -69M36 12 145 -69M-88 -27 -104 8M88 -27 104 8" fill="none" stroke="${light}"/></g>`;
    default: throw new Error(`Missing creature visual: ${key}`);
  }
}
export function validateVisuals(content: ContentIndex): void {
  for(const component of content.components.values()) if(!MESH_KEYS.includes(component.visual.mesh)) throw new Error(`Missing visual for ${component.name}`);
}
export function renderCreature(creature: Creature, content: ContentIndex, animate = true): string {
  const parts=creature.componentIds.map(id=>content.component(id)).sort((a,b)=>a.visual.layer-b.visual.layer);
  const anatomy=parts.map(part=>{
    const v=part.visual, [x,y]=anchors[part.slot];
    const factor=part.slot==='head'?creature.phenotype.headScale:1;
    const scale=clamp(v.scale*factor,v.allowedScale[0],v.allowedScale[1]);
    const rotation=clamp(v.rotation,v.allowedRotation[0],v.allowedRotation[1]);
    const color=blend(v.color,creature.phenotype.primaryColor,v.inheritColor);
    return `<g data-slot="${part.slot}" data-component="${escape(part.id)}" transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale.toFixed(3)})">${mesh(v.mesh,color,creature.phenotype.glowColor,!!creature.anatomy.legs)}</g>`;
  }).join('');
  const mutations=creature.phenotype.features.includes('electric-spines')?`<g data-feature="electric-spines" fill="${creature.phenotype.glowColor}" stroke="#302741" stroke-width="3"><path d="M129 169 118 137 144 153ZM272 171 285 139 258 155ZM166 85 156 58 177 78ZM234 85 246 58 223 78Z"/><path d="M83 173 69 159 75 185M317 173 331 159 325 185" fill="none" stroke="${creature.phenotype.glowColor}"/></g>`:'';
  return `<svg class="creature-svg ${animate?'idle':''}" viewBox="0 0 400 320" role="img" aria-label="${escape(creature.name)} — ${escape(creature.element)} creature${creature.mutationIds.length?', mutated':''}"><ellipse class="creature-shadow" cx="200" cy="282" rx="99" ry="13" fill="#070b1d" opacity=".28"/><g class="anatomy" style="--glow:${creature.phenotype.glowColor}" transform="translate(200 170) scale(${creature.phenotype.bodyScale.toFixed(3)}) translate(-200 -170)">${anatomy}${mutations}</g></svg>`;
}
