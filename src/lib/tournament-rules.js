const knockoutSizes = [2, 4, 8, 16];

function integer(value) {
	if (typeof value !== 'number' && typeof value !== 'string') return NaN;
	if (typeof value === 'string' && !value.trim()) return NaN;
	const number = Number(value);
	return Number.isSafeInteger(number) ? number : NaN;
}

/** Prüft Formulardaten ohne Seiteneffekte und liefert normalisierte Werte. */
export function validateTournament(input = {}) {
	const errors = {};
	const name = typeof input.name === 'string' ? input.name.trim() : '';
	const mode = input.mode;
	const teamCount = integer(input.teamCount);
	const groupCount = mode === 'gruppen_ko' ? integer(input.groupCount) : null;
	const qualifiersPerGroup = mode === 'gruppen_ko' ? integer(input.qualifiersPerGroup) : null;

	if (name.length < 3 || name.length > 60) {
		errors.name = 'Bitte gib einen Namen mit 3–60 Zeichen ein.';
	}
	if (!['liga', 'gruppen_ko', 'ko'].includes(mode)) {
		errors.mode = 'Bitte wähle einen gültigen Modus.';
	}
	if (!Number.isSafeInteger(teamCount) || teamCount < 2) {
		errors.teamCount = 'Bitte gib eine ganze Zahl mit mindestens 2 Teams ein.';
	} else if (mode === 'ko' && ![4, 8, 16].includes(teamCount)) {
		errors.teamCount = 'Für Nur K.-o. sind 4, 8 oder 16 Teams möglich.';
	}
	if (mode === 'gruppen_ko') {
		if (!Number.isSafeInteger(groupCount) || groupCount < 2) {
			errors.groupCount = 'Bitte gib mindestens 2 Gruppen als ganze Zahl ein.';
		} else if (!errors.teamCount && Math.floor(teamCount / groupCount) < 3) {
			errors.teamCount = 'Jede Gruppe braucht mindestens 3 Teams.';
		}
		if (!Number.isSafeInteger(qualifiersPerGroup) || qualifiersPerGroup < 1) {
			errors.qualifiersPerGroup = 'Bitte gib mindestens 1 qualifiziertes Team pro Gruppe ein.';
		} else if (!errors.groupCount) {
			if (!knockoutSizes.includes(groupCount * qualifiersPerGroup)) {
				errors.qualifiersPerGroup = 'Gruppen × Qualifizierte muss 2, 4, 8 oder 16 ergeben.';
			} else if (!errors.teamCount && qualifiersPerGroup > Math.floor(teamCount / groupCount)) {
				errors.qualifiersPerGroup = 'Es können nicht mehr Teams weiterkommen, als in der kleinsten Gruppe spielen.';
			}
		}
	}

	return {
		valid: Object.keys(errors).length === 0,
		errors,
		values: { name, mode, teamCount, groupCount, qualifiersPerGroup }
	};
}

/** Vorschau: einfache Liga bzw. Gruppenphase, danach K.-o. ohne Spiel um Platz 3. */
export function tournamentPreview(input) {
	const result = validateTournament({ ...input, name: 'Vorschau' });
	if (!result.valid) return '';
	const { mode, teamCount, groupCount, qualifiersPerGroup } = result.values;
	const rounds = (count) => ['Achtelfinal', 'Viertelfinal', 'Halbfinal', 'Final'].slice(4 - Math.log2(count)).join(', ');
	if (mode === 'liga') return `${teamCount} Teams → ${teamCount * (teamCount - 1) / 2} Spiele`;
	if (mode === 'ko') return `${teamCount} Teams → ${rounds(teamCount)}`;
	return `${teamCount} Teams → ${groupCount} Gruppen → ${rounds(groupCount * qualifiersPerGroup)}`;
}
