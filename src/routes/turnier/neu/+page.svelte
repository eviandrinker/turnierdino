<script>
	import { enhance } from '$app/forms';
	import { tick, untrack } from 'svelte';
	import { validateTournament, tournamentPreview } from '#lib/tournament-rules.js';

	let { form } = $props();
	let values = $state(untrack(() => ({
		name: '', mode: 'liga', teamCount: 4, groupCount: 2, qualifiersPerGroup: 1,
		...form?.values,
		teamCount: form?.values?.teamCount === '' ? undefined : Number(form?.values?.teamCount ?? 4)
	})));
	let attempted = $state(false);
	let serverErrors = $state(untrack(() => form?.errors ?? {}));
	let message = $state(untrack(() => form?.message ?? ''));
	let saving = $state(false);
	const validation = $derived(validateTournament(values));
	const errors = $derived({ ...(attempted ? validation.errors : {}), ...serverErrors });
	const preview = $derived(tournamentPreview(values));

	function edit() {
		serverErrors = {};
		message = '';
	}

	async function focusError(element) {
		await tick();
		element.querySelector('[aria-invalid="true"]')?.focus();
	}

	function submit({ cancel, formElement }) {
		if (saving) {
			cancel();
			return;
		}
		attempted = true;
		serverErrors = {};
		message = '';
		if (!validation.valid) {
			cancel();
			void focusError(formElement);
			return;
		}
		saving = true;
		return async ({ result, update }) => {
			try {
				if (result.type === 'failure') {
					serverErrors = result.data.errors ?? {};
					message = result.data.message ?? '';
				}
				await update({ reset: false });
				if (result.type === 'failure') await focusError(formElement);
			} finally {
				saving = false;
			}
		};
	}
</script>

<svelte:head><title>Turnier erstellen – Turnierdino</title></svelte:head>

<div class="step-heading">
	<span class="step">1/3</span>
	<h1>Turnier erstellen</h1>
</div>

{#snippet fieldError(key)}
	{#if errors[key]}
		<p class="field-error" id={`${key}-error`}>{errors[key]}</p>
	{/if}
{/snippet}

<form method="POST" use:enhance={submit} novalidate oninput={edit} onchange={edit} aria-busy={saving}>
	<fieldset disabled={saving}>
		<legend class="visually-hidden">Turnierangaben</legend>
		<div class="field-row">
			<label for="name">Name</label>
			<div>
				<input id="name" name="name" type="text" bind:value={values.name} required minlength="3" maxlength="60"
					aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} />
				{@render fieldError('name')}
			</div>
		</div>
		<div class="field-row">
			<label for="mode">Modus</label>
			<div>
				<select id="mode" name="mode" bind:value={values.mode} required
					onchange={(event) => {
						if (event.currentTarget.value === 'ko' && ![4, 8, 16].includes(Number(values.teamCount))) values.teamCount = 4;
					}}
					aria-invalid={!!errors.mode} aria-describedby={errors.mode ? 'mode-error' : undefined}>
					<option value="liga">Liga</option>
					<option value="gruppen_ko">Gruppen + K.-o.</option>
					<option value="ko">Nur K.-o.</option>
				</select>
				{@render fieldError('mode')}
			</div>
		</div>
		<div class="field-row">
			<label for="teamCount">Anzahl Teams</label>
			<div>
				{#if values.mode === 'ko'}
					<select id="teamCount" name="teamCount" bind:value={values.teamCount} required
						aria-invalid={!!errors.teamCount} aria-describedby={errors.teamCount ? 'teamCount-error' : undefined}>
						<option value={4}>4</option>
						<option value={8}>8</option>
						<option value={16}>16</option>
					</select>
				{:else}
					<input id="teamCount" name="teamCount" type="number" min={values.mode === 'gruppen_ko' ? 6 : 2} step="1"
						bind:value={values.teamCount} required aria-invalid={!!errors.teamCount}
						aria-describedby={errors.teamCount ? 'teamCount-error' : undefined} />
				{/if}
				{@render fieldError('teamCount')}
			</div>
		</div>
		{#if values.mode === 'gruppen_ko'}
			<div class="field-row">
				<label for="groupCount">Anzahl Gruppen</label>
				<div>
					<input id="groupCount" name="groupCount" type="number" min="2" step="1"
						bind:value={values.groupCount} required aria-invalid={!!errors.groupCount}
						aria-describedby={errors.groupCount ? 'groupCount-error' : undefined} />
					{@render fieldError('groupCount')}
				</div>
			</div>
			<div class="field-row">
				<label for="qualifiersPerGroup">Qualifizierte pro Gruppe</label>
				<div>
					<input id="qualifiersPerGroup" name="qualifiersPerGroup" type="number" min="1" step="1"
						bind:value={values.qualifiersPerGroup} required aria-invalid={!!errors.qualifiersPerGroup}
						aria-describedby={errors.qualifiersPerGroup ? 'qualifiersPerGroup-error' : undefined} />
					{@render fieldError('qualifiersPerGroup')}
				</div>
			</div>
		{/if}
	</fieldset>
	<div class="form-footer">
		<p class="preview" aria-live="polite">{preview || 'Wähle die Teamanzahl und den Modus für eine Vorschau.'}</p>
		{#if message}<p role="alert">{message}</p>{/if}
		<button class="button" type="submit" disabled={saving}>{saving ? 'Wird gespeichert …' : 'weiter'}</button>
	</div>
</form>

<style>
	form { max-width: 800px; }
	fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
	.field-row { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 24px; margin-bottom: 28px; }
	label { padding-top: 14px; font-weight: 600; }
	input, select { width: 100%; min-height: 52px; padding: 12px 16px; border: 1px solid var(--color-text); border-radius: 0; background: var(--color-background); color: var(--color-text); }
	[aria-invalid='true'] { border-width: 2px; }
	.field-error { margin: 8px 0 0; font-size: 0.875rem; font-weight: 600; }
	.form-footer { margin-left: 264px; }
	.preview { margin: 8px 0 32px; line-height: 1.6; }
	button { min-width: 144px; }
	button:disabled { opacity: 0.6; cursor: wait; }
	.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	@media (max-width: 767px) {
		.field-row { grid-template-columns: minmax(0, 1fr); gap: 10px; }
		label { padding-top: 0; }
		.form-footer { margin-left: 0; }
	}
</style>
