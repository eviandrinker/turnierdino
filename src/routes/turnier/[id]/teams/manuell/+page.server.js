import { fail, redirect } from '@sveltejs/kit';
import { addTeam, removeTeam } from '#lib/server/db.js';
import { requireStep, mutationFailure } from '#lib/server/tournament-flow.js';
import { validateTeam } from '#lib/team-rules.js';

export const load = ({ params }) => requireStep(params.id, 'teams/manuell');

export const actions = {
	add: async ({ params, request }) => {
		const { tournament, teams } = await requireStep(params.id, 'teams/manuell');
		const data = await request.formData();
		const name = typeof data.get('name') === 'string' ? data.get('name') : '';
		const result = validateTeam({ name }, teams, tournament.teamCount);
		if (!result.valid) return fail(400, { name, errors: result.errors });
		try { await addTeam(params.id, result.values); }
		catch (error) { return mutationFailure(error, { name }); }
		return { added: true };
	},
	confirmRemove: async ({ params, request }) => {
		const { teams } = await requireStep(params.id, 'teams/manuell');
		const id = (await request.formData()).get('teamId');
		if (!teams.some((team) => team.id === id)) return fail(400, { message: 'Dieses Team wurde nicht gefunden.' });
		return { removeId: id };
	},
	cancelRemove: async ({ params }) => {
		await requireStep(params.id, 'teams/manuell');
		return {};
	},
	remove: async ({ params, request }) => {
		await requireStep(params.id, 'teams/manuell');
		const data = await request.formData();
		if (data.get('confirmed') !== 'yes') return fail(400, { message: 'Bitte bestätige das Entfernen.' });
		try { await removeTeam(params.id, data.get('teamId')); }
		catch (error) { return mutationFailure(error); }
		return { removed: true };
	},
	next: async ({ params }) => {
		const { tournament, teams } = await requireStep(params.id, 'teams/manuell');
		if (teams.length !== tournament.teamCount) return fail(400, { message: 'Bitte erfasse zuerst alle Teams.' });
		redirect(303, `/turnier/${params.id}/ablauf`);
	}
};
