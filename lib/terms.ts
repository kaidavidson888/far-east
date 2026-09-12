import geometry from './terms-geometry.json';
import { innerPageSpec } from './innerPage';

/** Terms of Service. One body block. */
export const TERMS_SPEC = innerPageSpec(geometry, { page: 'terms', bodyIds: ['body'], active: 'navTerms' });
