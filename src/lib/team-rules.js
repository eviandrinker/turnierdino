export function normalizeTeamName(name) {
	return name.trim().normalize('NFC').toLocaleLowerCase('de');
}

export function validateTeam(input, teams = [], teamCount = 0) {
	const name = typeof input?.name === 'string' ? input.name.trim().normalize('NFC') : '';
	const errors = {};
	if (name.length < 2 || name.length > 40) {
		errors.name = 'Bitte gib einen Team-Namen mit 2–40 Zeichen ein.';
	} else if (teams.some((team) => normalizeTeamName(team.name) === normalizeTeamName(name))) {
		errors.name = 'Ein Team mit diesem Namen ist bereits erfasst.';
	} else if (teams.length >= teamCount) {
		errors.name = 'Alle Teams sind bereits erfasst.';
	}
	return { valid: Object.keys(errors).length === 0, errors, values: { name } };
}
