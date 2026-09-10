import geometry from './about-geometry.json';
import { innerPageSpec } from './innerPage';

/** About Us. Its body is two boxes — the intro and Our Focus. */
export const ABOUT_SPEC = innerPageSpec(geometry, { page: 'about', bodyIds: ['intro', 'focus'], active: 'navAbout' });
