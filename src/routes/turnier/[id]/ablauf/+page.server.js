import { fail, redirect } from '@sveltejs/kit';
import { updateTournament } from '#lib/server/db.js';
import { requireStep, mutationFailure } from '#lib/server/tournament-flow.js';
import { defaultSchedule, validateSchedule } from '#lib/schedule-rules.js';

export const load = (event) => requireStep(event.params.id, 'ablauf', event);

async function save(event, skip) {
	const { params, request, locals } = event;
	const { tournament } = await requireStep(params.id, 'ablauf', event);
	const data = await request.formData();
	const values = skip ? { ...defaultSchedule } : Object.fromEntries(
		['startTime', 'fields', 'matchDuration'].map((key) => [key, typeof data.get(key) === 'string' ? data.get(key) : ''])
	);
	const result = validateSchedule(values);
	if (!result.valid) return fail(400, { values, errors: result.errors });
	try { await updateTournament(params.id, result.values, locals.user); }
	catch (error) { return mutationFailure(error, { values }); }
	redirect(303, `/turnier/${params.id}${tournament.teamEntry === 'code' ? '/code' : '/spielplan/erstellen'}`);
}

export const actions = {
	save: (event) => save(event, false),
	skip: (event) => save(event, true)
};
