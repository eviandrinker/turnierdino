import { fail, redirect } from '@sveltejs/kit';
import { createTournament } from '#lib/server/db.js';
import { validateTournament } from '#lib/tournament-rules.js';

export const actions = {
	default: async ({ request }) => {
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
			id = await createTournament(result.values);
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
