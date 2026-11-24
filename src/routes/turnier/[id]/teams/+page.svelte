<script>
	let { data } = $props();
</script>

<svelte:head><title>Teams – {data.tournament.name} – Turnierdino</title></svelte:head>

<div class="step-heading">
	<span class="step">2/3</span>
	<h1>Teams</h1>
</div>
<p class="tournament-name">{data.tournament.name}</p>
<p>Hier kannst du bald die Teams erfassen.</p>

<style>
	.tournament-name { font-size: 1.5rem; font-weight: 700; overflow-wrap: anywhere; }
</style>
