import { requireUser } from '#lib/server/auth-http.js';
import { fail, redirect } from '@sveltejs/kit';
import { createTournament } from '#lib/server/db.js';
import { validateTournament } from '#lib/tournament-rules.js';

export const load = (event) => { requireUser(event); return {}; };

export const actions = {
	default: async (event) => {
		const user = requireUser(event);
		const { request } = event;
		const data = await request.formData();
		const values = Object.fromEntries(
			['name', 'mode', 'teamCount', 'groupCount', 'qualifiersPerGroup'].map((key) => {
				const value = data.get(key);
				return [key, typeof value === 'string' ? value : ''];
			})
		);
		const result = validateTournament(values);
		if (!result.valid) return fail(400, { values, errors: result.errors });

		let id;
		try {
			id = await createTournament(result.values, user);
		} catch {
			return fail(503, {
				values,
				errors: {},
				message: 'Das Turnier konnte nicht gespeichert werden. Bitte versuche es erneut.'
			});
		}
		redirect(303, `/turnier/${id}/teams`);
	}
};
