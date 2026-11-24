import { defineEnvVars } from '@sveltejs/kit/env';

// static: false → Werte werden beim Start der App aus der Umgebung gelesen und nicht beim Build eingebaut.
// So können sie in Netlify unter «Environment variables» gesetzt werden.
const required = (name) => (value) => {
	if (!value?.trim()) throw new Error(`${name} ist nicht gesetzt.`);
	return value.trim();
};

export const variables = defineEnvVars({
	DB_URI: { static: false, schema: required('DB_URI'), description: 'MongoDB-Verbindungs-URI (Replica Set, z. B. Atlas)' },
	DB_NAME: { static: false, schema: required('DB_NAME'), description: 'Name der MongoDB-Datenbank' }
});
