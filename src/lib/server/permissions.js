export function isOwner(user, tournament) {
	return !!user?.id && !!tournament?.ownerId && String(tournament.ownerId) === user.id;
}

export class PermissionError extends Error {
	constructor(status, message) { super(message); this.status = status; }
}

export function assertOwner(user, tournament) {
	if (!user?.id) throw new PermissionError(401, 'Bitte melde dich zuerst an.');
	if (!isOwner(user, tournament)) throw new PermissionError(403, 'Du darfst dieses Turnier nicht bearbeiten. Nur der Besitzer kann Änderungen vornehmen.');
}
