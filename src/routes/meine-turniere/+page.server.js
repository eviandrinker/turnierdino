import { requireUser } from '#lib/server/auth-http.js';
export const load = (event) => { requireUser(event); return {}; };
