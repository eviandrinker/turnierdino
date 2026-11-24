<script>
	let { tournament, status, winnerName = null, canEdit = false } = $props();
	const modes = { liga: 'Liga', gruppen_ko: 'Gruppen + K.-o.', ko: 'Nur K.-o.' };
	const createdDate = $derived(new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich' }).format(new Date(tournament.createdAt)));
</script>

<header class="tournament-header">
	<h1>{tournament.name}</h1>
	<div class="tournament-meta">
		<p>{modes[tournament.mode]} · Erstellt am {createdDate} · Start {tournament.startTime ?? 'noch offen'}{tournament.startTime ? ' Uhr' : ''}</p>
		<span class="status" aria-live="polite">{status}</span>
	</div>
	{#if winnerName !== null}
		<div class="winner" role="status">
			<span class="winner-label">Turniersieger</span>
			<strong>{winnerName}</strong>
		</div>
	{/if}
	{#if canEdit && tournament.teamEntry === 'code'}<a href={`/turnier/${tournament.id}/code`}>Code zum Teilen</a>{/if}
</header>

<style>
	.tournament-header { margin-bottom: 32px; }
	h1 { font-size: 36px; line-height: 1.15; margin: 0 0 8px; overflow-wrap: anywhere; }
	.tournament-meta { display: flex; align-items: center; gap: 12px; font-size: 0.875rem; }
	.tournament-meta p { margin: 0; }
	.status { flex-shrink: 0; padding: 4px 8px; background: var(--color-surface); font-weight: 700; }
	.winner { margin-top: 16px; padding: 16px 20px; border: 1px solid var(--color-text); max-width: 640px; }
	.winner-label { display: block; margin-bottom: 6px; font-size: 0.75rem; }
	.winner strong { display: block; font-size: 28px; line-height: 1.2; font-weight: 800; overflow-wrap: anywhere; }
	.tournament-header > a { display: inline-block; margin-top: 8px; font-size: 0.875rem; }
	@media (max-width: 767px) {
		h1 { font-size: 28px; }
		.tournament-meta { flex-wrap: wrap; gap: 6px 10px; }
		.winner strong { font-size: 24px; }
	}
</style>
