<script>
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	let { form } = $props();
	let element;
	let saving = $state(false);
	onMount(() => { if (!form?.message) element.requestSubmit(); });
</script>
<svelte:head><title>Turnierplan erstellen – Turnierdino</title></svelte:head>
<h1>Turnierplan wird erstellt…</h1>
<p role="status">{saving ? 'Die Spiele werden verteilt und die Spielzeiten berechnet.' : 'Dein Spielplan ist gleich bereit.'}</p>
{#if form?.message}<p role="alert">{form.message}</p>{/if}
<form method="POST" bind:this={element} use:enhance={({ cancel }) => {
	if (saving) { cancel(); return; }
	saving = true;
	return async ({ update }) => { try { await update(); } finally { saving = false; } };
}}>
	<button class="button" disabled={saving}>{form?.message ? 'Erneut versuchen' : 'Spielplan erstellen'}</button>
</form>
