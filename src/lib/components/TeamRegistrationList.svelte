<script>
	import { enhance } from '$app/forms';
	/**
	 * Angemeldete Teams vor dem Spielplan. canRemove: Organisator darf Teams entfernen (mit Bestätigung,
	 * Form Action «?/removeTeam»); showJoinLinks: Links zum Anmelden bzw. Verwalten für andere Besucher.
	 */
	let { tournament, teams, ownTeamId = null, canRemove = false, showJoinLinks = false } = $props();
	let removeDialog = $state();
	let removeCandidate = $state(null);
	let removing = $state(false);
	let removeError = $state('');

	function confirmRemove(team) {
		removeCandidate = team;
		removeError = '';
		removeDialog?.showModal();
	}
	function removeSubmit({ cancel }) {
		if (removing) { cancel(); return; }
		removing = true;
		removeError = '';
		return async ({ result, update }) => {
			try {
				if (result.type === 'failure') removeError = result.data?.message ?? 'Das Team konnte nicht entfernt werden.';
				await update({ reset: false });
				if (result.type === 'success') { removeDialog?.close(); removeCandidate = null; }
			} finally { removing = false; }
		};
	}
</script>

<section class="registrations" aria-labelledby="registrations-heading">
	<h2 id="registrations-heading" aria-live="polite">{teams.length} von {tournament.teamCount} Teams angemeldet</h2>
	{#if teams.length}
		<ul class="registration-list">
			{#each teams as team (team.id)}
				<li>
					<span>{team.name}{#if ownTeamId === team.id} <small>(dein Team)</small>{/if}</span>
					{#if canRemove}
						<button class="link-button" type="button" aria-label={`Team entfernen: ${team.name}`} onclick={() => confirmRemove(team)}>Entfernen</button>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p>Noch keine Teams angemeldet.</p>
	{/if}
	{#if showJoinLinks}
		{#if ownTeamId}
			<a href={`/beitreten/${tournament.id}`}>Anmeldung verwalten</a>
		{:else if teams.length < tournament.teamCount && tournament.status === 'Bereit'}
			<a class="button" href={`/beitreten/${tournament.id}`}>Team anmelden</a>
		{/if}
	{/if}
</section>

{#if canRemove}
	<dialog class="confirm-dialog" bind:this={removeDialog} aria-labelledby="remove-heading" oncancel={(event) => { if (removing) event.preventDefault(); }}>
		<h2 id="remove-heading">Team entfernen?</h2>
		<p>«{removeCandidate?.name}» wird aus diesem Turnier entfernt. Der Platz wird wieder frei.</p>
		{#if removeError}<p role="alert">{removeError}</p>{/if}
		<form method="POST" action="?/removeTeam" use:enhance={removeSubmit}>
			<input type="hidden" name="teamId" value={removeCandidate?.id ?? ''} />
			<input type="hidden" name="confirmed" value="yes" />
			<div class="button-row">
				<button class="button button-secondary" type="button" disabled={removing} onclick={() => removeDialog?.close()}>Abbrechen</button>
				<button class="button button-remove" disabled={removing}>{removing ? 'Wird entfernt …' : 'Team entfernen'}</button>
			</div>
		</form>
	</dialog>
{/if}

<style>
	h2 { margin: 0 0 12px; font-size: 20px; line-height: 1.2; }
	.registrations { max-width: 640px; margin-bottom: 32px; }
	.registration-list { list-style: none; padding: 0; margin: 0 0 24px; }
	.registration-list li { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 48px; border-bottom: 1px solid var(--color-secondary); }
	.registration-list span { min-width: 0; overflow-wrap: anywhere; }
	.link-button { min-height: 44px; padding: 0 8px; border: 0; background: transparent; color: var(--color-text); text-decoration: underline; cursor: pointer; }
	.confirm-dialog { width: min(520px, calc(100% - 32px)); padding: 28px; border: 1px solid var(--color-text); border-radius: 0; background: var(--color-background); color: var(--color-text); }
	.confirm-dialog::backdrop { background: rgb(0 0 0 / 45%); }
	.confirm-dialog p { line-height: 1.6; overflow-wrap: anywhere; margin-block: 20px 28px; }
</style>
