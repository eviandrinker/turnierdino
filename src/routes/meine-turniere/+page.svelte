<script>
	import { enhance } from '$app/forms';
	import { tournamentFilters } from '#lib/tournament-list.js';
	let { data, form } = $props();
	let dialog = $state();
	let candidate = $state(null);
	let deleting = $state(false);
	let deleteError = $state('');
	const modes = { liga: 'Liga', gruppen_ko: 'Gruppen + K.-o.', ko: 'Nur K.-o.' };
	const date = (value) => new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich' }).format(new Date(value));
	function confirmDelete(tournament) {
		candidate = tournament;
		deleteError = '';
		dialog.showModal();
	}
</script>

<svelte:head><title>Meine Turniere – Turnierdino</title></svelte:head>
<header class="my-tournaments-header">
	<h1>Meine Turniere</h1>
	<a class="button" href="/turnier/neu">Turnier erstellen</a>
</header>
<nav class="filters" aria-label="Turniere filtern">
	{#each tournamentFilters as filter (filter.key)}
		<a href={`?filter=${filter.key}`} class:active={data.selected === filter.key} aria-current={data.selected === filter.key ? 'page' : undefined}>{filter.label} ({data.counts[filter.key]})</a>
	{/each}
</nav>
{#if form?.deleted}<p role="status">{form.message}</p>{/if}
{#if data.counts.all === 0}
	<div class="empty">
		<h2>Du hast noch keine Turniere</h2>
		<a class="button" href="/turnier/neu">Turnier erstellen</a>
	</div>
{:else if data.items.length === 0}
	<p class="empty">Keine Turniere in dieser Ansicht.</p>
{:else}
	<div class="cards">
		{#each data.items as tournament (tournament.id)}
			<article class="card">
				<div class="card-heading">
					<h2><a class="card-link" href={tournament.href}>{tournament.name}</a></h2>
					<span class="badge">{tournament.status}</span>
				</div>
				<p>{modes[tournament.mode]} · {tournament.teamCount} Teams</p>
				<p class="created">Erstellt am {date(tournament.createdAt)}</p>
				<div class="card-actions">
					{#if tournament.status === 'Entwurf'}<a class="button" href={tournament.href}>Weiter bearbeiten</a>{/if}
					<button class="delete-button" type="button" aria-label={`Turnier löschen: ${tournament.name}`} onclick={() => confirmDelete(tournament)}>Löschen</button>
				</div>
			</article>
		{/each}
	</div>
{/if}

<dialog bind:this={dialog} aria-labelledby="delete-heading" oncancel={(event) => { if (deleting) event.preventDefault(); }}>
	<h2 id="delete-heading">Turnier löschen?</h2>
	<p>«{candidate?.name}» wird mit allen Teams und Spielen endgültig gelöscht.</p>
	{#if deleteError}<p role="alert">{deleteError}</p>{/if}
	<form method="POST" action="?/delete" use:enhance={({ cancel }) => {
		if (deleting) { cancel(); return; }
		deleting = true;
		deleteError = '';
		return async ({ result, update }) => {
			try {
				if (result.type === 'failure') deleteError = result.data.message ?? 'Das Turnier konnte nicht gelöscht werden.';
				await update({ reset: false });
				if (result.type === 'success' && result.data?.deleted) { dialog.close(); candidate = null; }
			} finally { deleting = false; }
		};
	}}>
		<input type="hidden" name="id" value={candidate?.id ?? ''} />
		<input type="hidden" name="confirmed" value="yes" />
		<div class="button-row">
			<button class="button button-secondary" type="button" disabled={deleting} onclick={() => dialog.close()}>Abbrechen</button>
			<button class="button" disabled={deleting}>{deleting ? 'Wird gelöscht …' : 'Endgültig löschen'}</button>
		</div>
	</form>
</dialog>

<style>
	:global(main:has(> .my-tournaments-header)) { padding-block: 40px; }
	.my-tournaments-header { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 32px; }
	h1 { margin: 0; font-size: clamp(28px, 4vw, 40px); }
	h2 { margin: 0; font-size: 22px; }
	.filters { display: flex; gap: 24px; overflow-x: auto; margin-bottom: 32px; }
	.filters a { flex-shrink: 0; padding: 12px 0; min-height: 44px; border-bottom: 3px solid transparent; text-decoration: none; }
	.filters a.active { border-color: var(--color-text); font-weight: 700; }
	.cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
	.card { position: relative; padding: 24px; border: 1px solid var(--color-text); }
	.card:hover { background: var(--color-surface); }
	.card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
	.card h2 { overflow-wrap: anywhere; min-width: 0; }
	.card-link { text-decoration: none; }
	.card-link::after { content: ''; position: absolute; inset: 0; }
	.card-link:focus-visible::after { outline: 3px solid var(--color-text); outline-offset: 4px; }
	.badge { padding: 4px 8px; background: var(--color-surface); font-size: 0.8125rem; white-space: nowrap; }
	.created { font-size: 0.8125rem; color: #666; }
	.card-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 24px; }
	.card-actions > * { position: relative; z-index: 1; }
	.delete-button { margin-left: auto; min-height: 44px; border: 0; background: transparent; color: var(--color-text); text-decoration: underline; cursor: pointer; }
	.empty { padding-block: 48px; }
	.empty h2 { margin-bottom: 24px; }
	dialog { width: min(520px, calc(100% - 32px)); padding: 28px; border: 1px solid var(--color-text); border-radius: 0; background: var(--color-background); color: var(--color-text); }
	dialog::backdrop { background: rgb(0 0 0 / 45%); }
	dialog p { line-height: 1.6; overflow-wrap: anywhere; margin-block: 20px 28px; }
	@media (max-width: 767px) {
		.my-tournaments-header { align-items: flex-start; flex-direction: column; }
		.cards { grid-template-columns: minmax(0, 1fr); }
		.card-heading { flex-wrap: wrap; }
	}
</style>
