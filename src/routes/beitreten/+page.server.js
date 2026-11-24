import { fail, redirect } from '@sveltejs/kit';
import { findTournamentByCode, getRegistrationDetails } from '#lib/server/db.js';
export const actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const digits = Array.from({ length: 6 }, (_, i) => form.get(`digit${i}`));
		const code = digits.every((digit) => typeof digit === 'string' && /^\d$/.test(digit)) ? digits.join('') : '';
		const values = digits.map((digit) => typeof digit === 'string' ? digit.slice(0, 1) : '');
		const tournament = await findTournamentByCode(code);
		if (!tournament) return fail(400, { digits: values, message: 'Kein Turnier mit diesem Code gefunden' });
		const details = await getRegistrationDetails(tournament._id.toHexString());
		if (!details) return fail(400, { digits: values, message: 'Kein Turnier mit diesem Code gefunden' });
		if (details.closedMessage) return fail(400, { digits: values, message: details.closedMessage });
		redirect(303, `/beitreten/${details.tournament.id}`);
	}
};
