<script>
	let { data } = $props();
	const modes = { liga: 'Liga', gruppen_ko: 'Gruppen + K.-o.', ko: 'Nur K.-o.' };
</script>

<svelte:head><title>{data.tournament.name} – Turnierdino</title></svelte:head>
<h1>{data.tournament.name}</h1>
<dl>
	<div><dt>Status</dt><dd>{data.tournament.status}</dd></div>
	<div><dt>Modus</dt><dd>{modes[data.tournament.mode]}</dd></div>
	<div><dt>Anzahl Teams</dt><dd>{data.tournament.teamCount}</dd></div>
	<div><dt>Erfasste Teams</dt><dd>{data.teams.length}</dd></div>
	<div><dt>Startzeit</dt><dd>{data.tournament.startTime} Uhr</dd></div>
	<div><dt>Anzahl Spielfelder</dt><dd>{data.tournament.fields}</dd></div>
	<div><dt>Spieldauer</dt><dd>{data.tournament.matchDuration} Minuten</dd></div>
</dl>
<p>Spielplan und Live-Tabelle folgen im nächsten Schritt.</p>
{#if data.tournament.teamEntry === 'code'}
	<a class="button" href={`/turnier/${data.tournament.id}/code`}>Code zum Teilen</a>
{/if}

<style>
	h1 { overflow-wrap: anywhere; }
	dl { max-width: 700px; margin-block: 40px; }
	dl div { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding-block: 12px; }
	dt { font-weight: 600; }
	dd { margin: 0; }
	p { margin-bottom: 32px; }
</style>
