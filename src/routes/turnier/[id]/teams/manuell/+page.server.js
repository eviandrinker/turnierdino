import { fail, redirect } from '@sveltejs/kit';
import { addTeam, removeTeam } from '#lib/server/db.js';
import { requireStep, mutationFailure } from '#lib/server/tournament-flow.js';
import { validateTeam } from '#lib/team-rules.js';

export const load = (event) => requireStep(event.params.id, 'teams/manuell', event);

export const actions = {
	add: async (event) => {
		const { params, request, locals } = event;
		const { tournament, teams } = await requireStep(params.id, 'teams/manuell', event);
		const data = await request.formData();
		const name = typeof data.get('name') === 'string' ? data.get('name') : '';
		const result = validateTeam({ name }, teams, tournament.teamCount);
		if (!result.valid) return fail(400, { name, errors: result.errors });
		try { await addTeam(params.id, result.values, locals.user); }
		catch (error) { return mutationFailure(error, { name }); }
		return { added: true };
	},
	confirmRemove: async (event) => {
		const { params, request, locals } = event;
		const { teams } = await requireStep(params.id, 'teams/manuell', event);
		const id = (await request.formData()).get('teamId');
		if (!teams.some((team) => team.id === id)) return fail(400, { message: 'Dieses Team wurde nicht gefunden.' });
		return { removeId: id };
	},
	cancelRemove: async (event) => {
		const { params, locals } = event;
		await requireStep(params.id, 'teams/manuell', event);
		return {};
	},
	remove: async (event) => {
		const { params, request, locals } = event;
		await requireStep(params.id, 'teams/manuell', event);
		const data = await request.formData();
		if (data.get('confirmed') !== 'yes') return fail(400, { message: 'Bitte bestätige das Entfernen.' });
		try { await removeTeam(params.id, data.get('teamId'), locals.user); }
		catch (error) { return mutationFailure(error); }
		return { removed: true };
	},
	next: async (event) => {
		const { params, locals } = event;
		const { tournament, teams } = await requireStep(params.id, 'teams/manuell', event);
		if (teams.length !== tournament.teamCount) return fail(400, { message: 'Bitte erfasse zuerst alle Teams.' });
		redirect(303, `/turnier/${params.id}/ablauf`);
	}
};
