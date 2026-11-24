import { requireStep } from '#lib/server/tournament-flow.js';
export const load = ({ params }) => requireStep(params.id, '');
