<script>
	import { enhance } from '$app/forms';
	import TournamentCard from '#lib/components/TournamentCard.svelte';
	let { form } = $props();
	const LENGTH = 6;
	let digits = $state(Array.from({ length: LENGTH }, (_, i) => form?.digits?.[i] ?? ''));
	let inputs = $state([]);
	let submitting = $state(false);
	let dialog = $state();
	let opener = $state();
	let search = $state('');
	let searchInput = $state();
	let loading = $state(false);
	let loadError = $state('');
	let tournaments = $state([]);
	const complete = $derived(digits.every((digit) => /^\d$/.test(digit)));
	const filtered = $derived.by(() => {
		const query = search.trim().toLocaleLowerCase('de');
		return query ? tournaments.filter((t) => t.name.toLocaleLowerCase('de').includes(query)) : tournaments;
	});

	function fill(start, text) {
		const chars = text.replace(/\D/g, '').slice(0, LENGTH - start).split('');
		chars.forEach((char, offset) => { digits[start + offset] = char; });
		const next = Math.min(start + chars.length, LENGTH - 1);
		inputs[next]?.focus();
		return chars.length;
	}
	function onInput(index, event) {
		const input = event.currentTarget;
		const typed = input.value.replace(/\D/g, '');
		if (typed.length > 1) {
			// Mehrere Ziffern (z. B. Autovervollständigung) werden auf die Folgefelder verteilt.
			fill(index, typed);
		} else {
			digits[index] = typed;
			if (typed && index < LENGTH - 1) inputs[index + 1]?.focus();
		}
		input.value = digits[index];
	}
	function onKeydown(index, event) {
		if (event.key === 'Backspace' && !digits[index] && index > 0) {
			event.preventDefault();
			digits[index - 1] = '';
			inputs[index - 1]?.focus();
		} else if (event.key === 'ArrowLeft' && index > 0) {
			event.preventDefault();
			inputs[index - 1]?.focus();
		} else if (event.key === 'ArrowRight' && index < LENGTH - 1) {
			event.preventDefault();
			inputs[index + 1]?.focus();
		}
	}
	function onPaste(index, event) {
		const text = event.clipboardData?.getData('text') ?? '';
		const code = text.replace(/\D/g, '');
		event.preventDefault();
		if (code.length >= LENGTH) fill(0, code);
		else fill(index, code);
	}

	async function openDialog() {
		search = '';
		dialog.showModal();
		searchInput?.focus();
		loading = true;
		loadError = '';
		try {
			const response = await fetch('/api/offene-turniere');
			if (!response.ok) throw new Error();
			tournaments = await response.json();
		} catch {
			loadError = 'Die offenen Turniere konnten nicht geladen werden. Bitte versuche es erneut.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Turnier beitreten – Turnierdino</title></svelte:head>

<section class="join">
	<h1>Turnier beitreten</h1>
	<p class="hint" id="code-hint">Gib den Code ein, den der Organisator mitgeteilt hat</p>
	<form method="POST" use:enhance={() => {
		submitting = true;
		return async ({ update }) => { try { await update({ reset: false }); } finally { submitting = false; } };
	}}>
		<fieldset>
			<legend class="visually-hidden">Beitrittscode, 6 Ziffern</legend>
			<div class="digits">
				{#each digits as digit, index (index)}
					<input bind:this={inputs[index]} name={`digit${index}`} value={digit}
						type="text" inputmode="numeric" pattern="[0-9]" maxlength={index === 0 ? LENGTH : 1}
						autocomplete={index === 0 ? 'one-time-code' : 'off'} required
						aria-label={`Ziffer ${index + 1} von ${LENGTH}`} aria-describedby="code-hint"
						aria-invalid={form?.message ? 'true' : undefined}
						oninput={(event) => onInput(index, event)}
						onkeydown={(event) => onKeydown(index, event)}
						onpaste={(event) => onPaste(index, event)}
						onfocus={(event) => event.currentTarget.select()} />
				{/each}
			</div>
		</fieldset>
		{#if form?.message}<p class="field-error" role="alert">{form.message}</p>{/if}
		<button class="button" disabled={submitting || !complete}>{submitting ? 'Wird geprüft …' : 'Beitreten'}</button>
	</form>
	<button class="open-list" type="button" bind:this={opener} aria-haspopup="dialog" aria-controls="open-tournaments" onclick={openDialog}>Offene Turniere anzeigen</button>
</section>

<dialog id="open-tournaments" class="open-modal" bind:this={dialog} aria-labelledby="open-heading" onclose={() => opener?.focus()}>
	<header class="modal-heading">
		<h2 id="open-heading">Offene Turniere</h2>
		<form method="dialog"><button class="button button-secondary" type="submit">Schliessen</button></form>
	</header>
	<label class="visually-hidden" for="open-search">Nach Turniername suchen</label>
	<input id="open-search" class="text-input" type="search" placeholder="Nach Name suchen" autocomplete="off" bind:this={searchInput} bind:value={search} />
	<div class="results" aria-live="polite" aria-busy={loading}>
		{#if loading}
			<p>Wird geladen …</p>
		{:else if loadError}
			<p role="alert">{loadError}</p>
		{:else if !tournaments.length}
			<p class="empty">Gerade sind keine offenen Turniere verfügbar</p>
		{:else if !filtered.length}
			<p class="empty">Kein offenes Turnier passt zu «{search}».</p>
		{:else}
			<ul class="open-list-items">
				{#each filtered as tournament (tournament.id)}
					<li><TournamentCard {tournament} /></li>
				{/each}
			</ul>
		{/if}
	</div>
</dialog>

<style>
	:global(main:has(> .join)) { padding-block: 40px; }
	.join { max-width: 640px; }
	.join h1 { font-size: clamp(2rem, 5vw, 3.5rem); margin-bottom: 16px; }
	.hint { margin: 0 0 32px; line-height: 1.6; }
	fieldset { border: 0; padding: 0; margin: 0; }
	.digits { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: clamp(6px, 2vw, 16px); }
	.digits input { width: 100%; aspect-ratio: 4 / 5; min-height: 56px; border: 2px solid var(--color-text); border-radius: 0; padding: 0; background: var(--color-background); color: var(--color-text); font-size: clamp(1.75rem, 7vw, 3rem); font-weight: 800; font-variant-numeric: tabular-nums; text-align: center; }
	.digits input[aria-invalid='true'] { border-width: 3px; }
	form > .button { margin-top: 32px; }
	.field-error { margin-top: 16px; }
	.open-list { display: block; margin-top: 24px; min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--color-text); font-size: 0.875rem; text-decoration: underline; text-underline-offset: 4px; cursor: pointer; }
	.open-modal { width: min(720px, calc(100% - 48px)); max-height: 85dvh; padding: 28px; border: 1px solid var(--color-text); border-radius: 0; background: var(--color-background); color: var(--color-text); overflow-y: auto; }
	.open-modal::backdrop { background: rgb(0 0 0 / 45%); }
	:global(body:has(.open-modal[open])) { overflow: hidden; }
	.modal-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
	.modal-heading h2 { margin: 0; font-size: 26px; }
	.results { margin-top: 16px; }
	.empty { padding-block: 24px; }
	.open-list-items { display: grid; gap: 16px; list-style: none; padding: 0; margin: 0; }
	.open-list-items li { display: flex; min-width: 0; }
	.open-list-items li > :global(*) { flex: 1; }
	@media (max-width: 767px) {
		.open-modal { width: calc(100% - 16px); max-width: none; height: calc(100dvh - 16px); max-height: none; padding: 20px; }
	}
</style>
