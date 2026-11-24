<script>
	import { enhance } from '$app/forms';
	import { tick, untrack } from 'svelte';
	import { validateTeam } from '#lib/team-rules.js';
	let { data, form } = $props();
	let name = $state(untrack(() => form?.name ?? ''));
	let localError = $state('');
	let saving = $state(false);
	let nameInput = $state();
	let nextButton = $state();
	const complete = $derived(data.teams.length === data.tournament.teamCount);
	const nameError = $derived(localError || form?.errors?.name);

	function submit({ cancel, action, formData }) {
		if (saving) { cancel(); return; }
		localError = '';
		const adding = action.search === '?/add';
		if (adding) {
			const result = validateTeam({ name: formData.get('name') }, data.teams, data.tournament.teamCount);
			if (!result.valid) {
				localError = result.errors.name;
				cancel();
				nameInput?.focus();
				return;
			}
		}
		saving = true;
		return async ({ result, update }) => {
			try {
				await update({ reset: false });
				if (result.type === 'success' && (result.data?.added || result.data?.imported)) name = '';
			} finally { saving = false; }
			await tick();
			if (adding || (result.type === 'success' && (result.data?.removed || result.data?.imported))) (nameInput ?? nextButton)?.focus();
		};
	}
</script>

<svelte:head><title>Teams manuell hinzufügen – {data.tournament.name} – Turnierdino</title></svelte:head>
<div class="step-heading"><span class="step">2/3</span><h1>Teams manuell hinzufügen</h1></div>
<p class="tournament-subtitle">{data.tournament.name}</p>
<p aria-live="polite">{data.teams.length} von {data.tournament.teamCount} Teams erfasst</p>

{#if complete}
	<p class="complete" role="status">Alle Teams erfasst</p>
{:else}
	<form method="POST" action="?/add" use:enhance={submit} novalidate class="add-form">
		<label for="team-name">Team-Name</label>
		<div class="add-controls">
			<input class="text-input" id="team-name" name="name" list="team-suggestions" bind:value={name} bind:this={nameInput}
				oninput={() => { localError = ''; if (form) form = null; }} disabled={saving}
				required minlength="2" maxlength="40" aria-invalid={!!nameError} aria-describedby={nameError ? 'name-error' : undefined} />
			<datalist id="team-suggestions">{#each data.suggestions as suggestion (suggestion.name)}<option value={suggestion.name}></option>{/each}</datalist>
			<button class="button button-add" type="submit" disabled={saving}>Team hinzufügen</button>
		</div>
		{#if nameError}<p class="field-error" id="name-error" role="alert">{nameError}</p>{/if}
	</form>
	{#if data.suggestions.length}
		<section class="suggestions" aria-labelledby="suggestions-heading">
			<h2 id="suggestions-heading">Teams aus früheren Turnieren</h2>
			<div class="chips">
				{#each data.suggestions as suggestion (suggestion.name)}
					<form method="POST" action="?/add" use:enhance={submit}>
						<input type="hidden" name="name" value={suggestion.name} />
						<button class="chip" disabled={saving} aria-label={`Team hinzufügen: ${suggestion.name}`}>{suggestion.name}</button>
					</form>
				{/each}
			</div>
			<form method="POST" action="?/importLast" use:enhance={submit}>
				<button class="button" disabled={saving}>Teams vom letzten Turnier übernehmen</button>
			</form>
		</section>
	{/if}
{/if}

{#if form?.message}<p role={form.imported ? 'status' : 'alert'}>{form.message}</p>{/if}
<ul class="team-list">
	{#each data.teams as team (team.id)}
		<li>
			<div class="team-row">
				<span class="team-name">{team.name}</span>
				<form method="POST" action="?/confirmRemove" use:enhance={submit}>
					<input type="hidden" name="teamId" value={team.id} />
					<button class="button button-remove" disabled={saving} aria-label={`Team entfernen: ${team.name}`}>Team entfernen</button>
				</form>
			</div>
			{#if form?.removeId === team.id}
				<div class="confirmation" role="alert">
					<p>Team «{team.name}» wirklich entfernen?</p>
					<form method="POST" action="?/remove" use:enhance={submit} class="button-row">
						<input type="hidden" name="teamId" value={team.id} />
						<input type="hidden" name="confirmed" value="yes" />
						<button class="button button-remove" disabled={saving}>Entfernen bestätigen</button>
						<button class="button button-secondary" formaction="?/cancelRemove" disabled={saving}>Abbrechen</button>
					</form>
				</div>
			{/if}
		</li>
	{/each}
</ul>
<form method="POST" action="?/next" use:enhance={submit}>
	<button class="button" disabled={!complete || saving} bind:this={nextButton}>weiter</button>
</form>

<style>
	.suggestions { max-width: 800px; margin-block: 24px 40px; }
	.suggestions h2 { font-size: 20px; margin-bottom: 16px; }
	.chips { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
	.chip { min-height: 44px; padding: 10px 16px; border: 1px solid var(--color-text); border-radius: 0; background: var(--color-background); color: var(--color-text); cursor: pointer; overflow-wrap: anywhere; }
	.chip:hover { background: var(--color-text); color: var(--color-background); }
	.chip:disabled { background: var(--color-surface); color: var(--color-text); cursor: wait; }

	.add-form { max-width: 800px; margin-block: 32px; }
	label { display: block; font-weight: 600; margin-bottom: 12px; }
	.add-controls, .team-row { display: flex; gap: 16px; }
	.add-controls input { flex: 1; min-width: 0; }
	.add-controls button { flex-shrink: 0; }
	.team-list { list-style: none; padding: 0; margin: 32px 0 48px; max-width: 800px; }
	li { margin-bottom: 16px; }
	.team-name { flex: 1; background: var(--color-surface); padding: 16px; overflow-wrap: anywhere; min-width: 0; }
	.confirmation { border: 1px solid var(--color-text); padding: 20px; margin-top: 12px; }
	.complete { font-weight: 700; margin-top: 32px; }
	@media (max-width: 600px) { .add-controls, .team-row { flex-direction: column; } .team-row button { width: 100%; } }
</style>
