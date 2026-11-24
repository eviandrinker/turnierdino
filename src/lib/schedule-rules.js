export const defaultSchedule = { startTime: '09:00', fields: 1, matchDuration: 15 };

export function validateSchedule(input = {}) {
	const errors = {};
	const startTime = typeof input.startTime === 'string' ? input.startTime : '';
	const number = (value) => typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
	const fields = number(input.fields);
	const matchDuration = number(input.matchDuration);
	if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) errors.startTime = 'Bitte gib eine gültige Startzeit ein (z. B. 09:30).';
	if (!Number.isInteger(fields) || fields < 1 || fields > 10) errors.fields = 'Bitte gib 1–10 Spielfelder als ganze Zahl ein.';
	if (!Number.isInteger(matchDuration) || matchDuration < 5 || matchDuration > 120) errors.matchDuration = 'Bitte gib eine Spieldauer von 5–120 Minuten als ganze Zahl ein.';
	return { valid: Object.keys(errors).length === 0, errors, values: { startTime, fields, matchDuration } };
}
