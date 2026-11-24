<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let saving = $state(false);
</script>

<svelte:head><title>Teams – {data.tournament.name} – Turnierdino</title></svelte:head>
<div class="step-heading"><span class="step">2/3</span><h1>Teams</h1></div>
<p class="tournament-subtitle">{data.tournament.name}</p>
<form method="POST" use:enhance={() => {
	saving = true;
	return async ({ update }) => { try { await update(); } finally { saving = false; } };
}}>
	<fieldset disabled={saving}>
		<legend>Teams manuell hinzufügen?</legend>
		<div class="choices">
			<label><input type="radio" name="teamEntry" value="manuell" checked={form?.teamEntry !== 'code'} /> ja</label>
			<label><input type="radio" name="teamEntry" value="code" checked={form?.teamEntry === 'code'} /> nein</label>
		</div>
		{#if form?.message}<p role="alert">{form.message}</p>{/if}
		<button class="button" type="submit">{saving ? 'Wird gespeichert …' : 'weiter'}</button>
	</fieldset>
</form>

<style>
	fieldset { border: 0; padding: 0; margin: 0; }
	legend { font-size: 1.5rem; font-weight: 600; }
	.choices { display: flex; gap: 40px; margin: 28px 0 48px; }
	label { display: flex; align-items: center; gap: 12px; min-height: 44px; cursor: pointer; }
	input { width: 22px; height: 22px; accent-color: var(--color-text); }
</style>
