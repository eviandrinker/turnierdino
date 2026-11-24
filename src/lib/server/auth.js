import { getDb } from './db.js';
import { createAuthService } from './auth-service.js';

export { SESSION_SECONDS, RegistrationError } from './auth-service.js';
export const { register, login, checkSession, logout } = createAuthService(getDb);
