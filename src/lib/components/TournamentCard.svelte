<script>
	import { categoryLabels, modeLabels } from '../tournament-search.js';
	let { tournament } = $props();
	const category = $derived(tournament.category ?? 'offen');
</script>

<article class="tournament-card">
	<div class="card-heading">
		<h3>{tournament.name}</h3>
		<span class="badge" class:badge-live={category === 'laufend'}>{categoryLabels[category]}</span>
	</div>
	<p class="meta">{modeLabels[tournament.mode] ?? tournament.mode} · Start {tournament.startTime ? `${tournament.startTime} Uhr` : 'noch offen'}</p>
	{#if category === 'offen'}
		<p class="detail">{tournament.registeredCount} von {tournament.teamCount} Teams</p>
		<a class="button" href={`/beitreten/${tournament.id}`} aria-label={`Beitreten: ${tournament.name}`}>Beitreten</a>
	{:else if category === 'laufend'}
		<p class="detail"><span class="live-dot" aria-hidden="true"></span>Live</p>
		<a class="card-link" href={`/turnier/${tournament.id}`} aria-label={`Zur Live-Tabelle: ${tournament.name}`}>Zur Live-Tabelle</a>
	{:else}
		<p class="detail">Sieger: <strong>{tournament.winner ?? 'nicht ermittelt'}</strong></p>
		<a class="card-link" href={`/turnier/${tournament.id}`} aria-label={`Resultate ansehen: ${tournament.name}`}>Resultate ansehen</a>
	{/if}
</article>

<style>
	.tournament-card { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 20px; border: 1px solid var(--color-text); background: var(--color-background); }
	.card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
	h3 { margin: 0; font-size: 1.125rem; line-height: 1.3; overflow-wrap: anywhere; min-width: 0; }
	.badge { flex-shrink: 0; padding: 4px 8px; background: var(--color-surface); font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
	.badge-live { background: var(--color-text); color: var(--color-background); }
	p { margin: 0; font-size: 0.875rem; line-height: 1.5; overflow-wrap: anywhere; }
	.meta { color: #555; }
	.live-dot { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: var(--color-remove); vertical-align: middle; }
	.button, .card-link { align-self: flex-start; margin-top: auto; }
	.card-link { display: inline-flex; align-items: center; min-height: 44px; font-size: 0.875rem; font-weight: 600; text-underline-offset: 4px; }
	@media (max-width: 767px) {
		.button { align-self: stretch; }
	}
</style>
