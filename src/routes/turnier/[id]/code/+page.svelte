<script>
	let { data } = $props();
</script>

<svelte:head><title>Code zum Teilen – {data.tournament.name} – Turnierdino</title></svelte:head>
<h1>Code zum Teilen</h1>
<p class="tournament-subtitle">{data.tournament.name}</p>
<div class="join-code" role="img" aria-label={`Beitrittscode: ${data.tournament.joinCode.split('').join(' ')}`}>
	{#each data.tournament.joinCode as digit, index (index)}<span aria-hidden="true">{digit}</span>{/each}
</div>
<p class="hint">Teams können mit diesem Code über ‹Turnier beitreten› mitmachen</p>
<a class="button" href={`/turnier/${data.tournament.id}`}>weiter</a>

<style>
	.join-code { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: clamp(6px, 2vw, 20px); max-width: 900px; margin-block: 48px; }
	.join-code span { display: flex; align-items: center; justify-content: center; border: 2px solid var(--color-text); font-size: clamp(2rem, 9vw, 7rem); font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.4; }
	.hint { margin-bottom: 40px; line-height: 1.6; }
</style>
