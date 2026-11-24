import { requireStep } from '#lib/server/tournament-flow.js';
export const load = (event) => requireStep(event.params.id, 'code', event);
