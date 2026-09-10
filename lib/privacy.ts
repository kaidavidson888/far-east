import geometry from './privacy-geometry.json';
import { innerPageSpec } from './innerPage';

/** Privacy Policy. One body block. */
export const PRIVACY_SPEC = innerPageSpec(geometry, { page: 'privacy', bodyIds: ['body'] });
