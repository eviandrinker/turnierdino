<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	const modes = { liga: 'Liga', gruppen_ko: 'Gruppen + K.-o.', ko: 'Nur K.-o.' };
	let submitting = $state(false);
	let withdrawDialog = $state();
	const nameError = $derived(form?.errors?.name ?? '');

	function enhanceSubmit({ cancel }) {
		if (submitting) { cancel(); return; }
		submitting = true;
		return async ({ result, update }) => {
			try {
				await update({ reset: false });
				if (result.type !== 'failure') withdrawDialog?.close();
			} finally { submitting = false; }
		};
	}
</script>

<svelte:head><title>{data.tournament.name} beitreten – Turnierdino</title></svelte:head>

<section class="registration">
	<h1>{data.tournament.name}</h1>
	<p class="meta">{modes[data.tournament.mode] ?? data.tournament.mode} · Start {data.tournament.startTime ?? 'noch offen'}{data.tournament.startTime ? ' Uhr' : ''}</p>
	<p class="count" aria-live="polite">{data.teams.length} von {data.tournament.teamCount} Teams angemeldet</p>

	{#if form?.withdrawn}<p class="notice" role="status">{form.message}</p>{/if}

	{#if data.ownTeam}
		<div class="own-team">
			<p>Du hast das Team <strong>{data.ownTeam.name}</strong> angemeldet.</p>
			{#if data.canWithdraw}
				<button class="button button-remove" type="button" onclick={() => withdrawDialog?.showModal()}>Team abmelden</button>
			{:else}
				<p>Der Spielplan ist erstellt. Eine Abmeldung ist nicht mehr möglich.</p>
			{/if}
			<p><a href={`/turnier/${data.tournament.id}`}>Zum Turnier</a></p>
		</div>
	{:else if data.closedMessage}
		<p class="closed" role="status">{data.closedMessage}</p>
		<p><a href={`/turnier/${data.tournament.id}`}>Zum Turnier</a></p>
	{:else}
		<form class="register-form" method="POST" action="?/register" use:enhance={enhanceSubmit}>
			<label for="team-name">Teamname</label>
			<input id="team-name" class="text-input" name="name" type="text" required minlength="2" maxlength="40" autocomplete="off"
				value={form?.name ?? ''} aria-invalid={nameError ? 'true' : undefined} aria-describedby={nameError ? 'team-name-error' : undefined} />
			{#if nameError}<p class="field-error" id="team-name-error">{nameError}</p>{/if}
			{#if form?.message && !nameError && !form?.withdrawn}<p class="field-error" role="alert">{form.message}</p>{/if}
			<button class="button" disabled={submitting}>{submitting ? 'Wird angemeldet …' : 'Team anmelden'}</button>
		</form>
	{/if}

	<h2>Angemeldete Teams</h2>
	{#if data.teams.length}
		<ul class="team-list">
			{#each data.teams as team (team.id)}<li>{team.name}</li>{/each}
		</ul>
	{:else}
		<p>Noch keine Teams angemeldet.</p>
	{/if}
</section>

{#if data.ownTeam && data.canWithdraw}
	<dialog class="confirm-dialog" bind:this={withdrawDialog} aria-labelledby="withdraw-heading" oncancel={(event) => { if (submitting) event.preventDefault(); }}>
		<h2 id="withdraw-heading">Team abmelden?</h2>
		<p>«{data.ownTeam.name}» wird aus dem Turnier «{data.tournament.name}» entfernt.</p>
		{#if form?.message && !form?.withdrawn}<p role="alert">{form.message}</p>{/if}
		<form method="POST" action="?/withdraw" use:enhance={enhanceSubmit}>
			<input type="hidden" name="confirmed" value="yes" />
			<div class="button-row">
				<button class="button button-secondary" type="button" disabled={submitting} onclick={() => withdrawDialog?.close()}>Abbrechen</button>
				<button class="button button-remove" disabled={submitting}>{submitting ? 'Wird abgemeldet …' : 'Team abmelden'}</button>
			</div>
		</form>
	</dialog>
{/if}

<style>
	:global(main:has(> .registration)) { padding-block: 40px; }
	.registration { max-width: 640px; }
	h1 { font-size: clamp(2rem, 5vw, 3.5rem); margin-bottom: 12px; overflow-wrap: anywhere; }
	h2 { margin: 48px 0 12px; font-size: 20px; }
	.meta { margin: 0 0 4px; }
	.count { margin: 0 0 32px; font-weight: 700; }
	.notice, .closed { padding: 12px 16px; background: var(--color-surface); font-weight: 600; }
	.own-team p { line-height: 1.6; overflow-wrap: anywhere; }
	.register-form label { display: block; margin-bottom: 8px; font-weight: 600; }
	.register-form .button { margin-top: 24px; }
	.team-list { list-style: none; padding: 0; margin: 0; }
	.team-list li { padding: 12px 0; border-bottom: 1px solid var(--color-secondary); overflow-wrap: anywhere; }
	.confirm-dialog { width: min(520px, calc(100% - 32px)); padding: 28px; border: 1px solid var(--color-text); border-radius: 0; background: var(--color-background); color: var(--color-text); }
	.confirm-dialog::backdrop { background: rgb(0 0 0 / 45%); }
	.confirm-dialog h2 { margin: 0; }
	.confirm-dialog p { line-height: 1.6; overflow-wrap: anywhere; margin-block: 20px 28px; }
</style>
