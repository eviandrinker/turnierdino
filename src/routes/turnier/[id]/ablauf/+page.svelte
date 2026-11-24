<script>
	import { enhance } from '$app/forms';
	import { tick, untrack } from 'svelte';
	import { defaultSchedule, validateSchedule } from '#lib/schedule-rules.js';
	let { data, form } = $props();
	let values = $state(untrack(() => ({ ...defaultSchedule, ...form?.values })));
	let errors = $state(untrack(() => form?.errors ?? {}));
	let message = $state(untrack(() => form?.message ?? ''));
	let saving = $state(false);

	function submit({ cancel, action, formElement }) {
		if (saving) { cancel(); return; }
		errors = {};
		message = '';
		if (action.search !== '?/skip') {
			const result = validateSchedule(values);
			if (!result.valid) {
				errors = result.errors;
				cancel();
				void tick().then(() => formElement.querySelector('[aria-invalid="true"]')?.focus());
				return;
			}
		}
		saving = true;
		return async ({ result, update }) => {
			try {
				if (result.type === 'failure') {
					errors = result.data.errors ?? {};
					message = result.data.message ?? '';
				}
				await update({ reset: false });
			} finally { saving = false; }
			await tick();
			formElement.querySelector('[aria-invalid="true"]')?.focus();
		};
	}
</script>

<svelte:head><title>Ablauf – {data.tournament.name} – Turnierdino</title></svelte:head>
<div class="step-heading"><span class="step">3/3</span><h1>Ablauf</h1></div>
<p class="tournament-subtitle">{data.tournament.name}</p>
<form method="POST" action="?/save" use:enhance={submit} novalidate aria-busy={saving}
	oninput={() => { errors = {}; message = ''; }}>
	<fieldset disabled={saving}>
		<legend class="visually-hidden">Ablauf-Angaben</legend>
		<div class="form-field">
			<label for="startTime">Startzeit</label>
			<div>
				<input class="text-input" type="time" id="startTime" name="startTime" bind:value={values.startTime} required
					aria-invalid={!!errors.startTime} aria-describedby={errors.startTime ? 'startTime-error' : undefined} />
				{#if errors.startTime}<p class="field-error" id="startTime-error">{errors.startTime}</p>{/if}
			</div>
		</div>
		<div class="form-field">
			<label for="fields">Anzahl Spielfelder</label>
			<div>
				<input class="text-input" type="number" id="fields" name="fields" min="1" max="10" step="1" bind:value={values.fields} required
					aria-invalid={!!errors.fields} aria-describedby={errors.fields ? 'fields-error' : undefined} />
				{#if errors.fields}<p class="field-error" id="fields-error">{errors.fields}</p>{/if}
			</div>
		</div>
		<div class="form-field">
			<label for="matchDuration">Spieldauer in Minuten</label>
			<div>
				<input class="text-input" type="number" id="matchDuration" name="matchDuration" min="5" max="120" step="1" bind:value={values.matchDuration} required
					aria-invalid={!!errors.matchDuration} aria-describedby={errors.matchDuration ? 'matchDuration-error' : undefined} />
				{#if errors.matchDuration}<p class="field-error" id="matchDuration-error">{errors.matchDuration}</p>{/if}
			</div>
		</div>
		{#if message}<p role="alert">{message}</p>{/if}
		<p class="hint">Beim Überspringen: 09:00 Uhr, 1 Spielfeld, 15 Minuten pro Spiel.</p>
		<div class="button-row">
			<button class="button button-secondary" type="submit" formaction="?/skip">überspringen</button>
			<button class="button" type="submit">{saving ? 'Wird gespeichert …' : 'weiter'}</button>
		</div>
	</fieldset>
</form>

<style>
	form { max-width: 800px; }
	fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
	.form-field { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 24px; margin-bottom: 28px; }
	label { padding-top: 14px; font-weight: 600; }
	.hint { margin-block: 32px; line-height: 1.6; }
	@media (max-width: 767px) { .form-field { grid-template-columns: minmax(0, 1fr); gap: 10px; } label { padding-top: 0; } }
</style>
