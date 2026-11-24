<script>
	let { rows, label = 'Live-Tabelle' } = $props();
</script>
<!-- svelte-ignore a11y_no_noninteractive_tabindex (Die breite Tabelle muss per Tastatur horizontal scrollbar sein.) -->
<div class="table-scroll" tabindex="0" role="region" aria-label={label}>
	<table>
		<caption class="visually-hidden">{label}</caption>
		<thead><tr><th scope="col">Rang</th><th scope="col">Team</th><th scope="col"><abbr title="Spiele">Sp</abbr></th><th scope="col"><abbr title="Siege">S</abbr></th><th scope="col"><abbr title="Unentschieden">U</abbr></th><th scope="col"><abbr title="Niederlagen">N</abbr></th><th scope="col">Tore</th><th scope="col"><abbr title="Differenz">Diff</abbr></th><th scope="col"><abbr title="Punkte">Pkt</abbr></th></tr></thead>
		<tbody>{#each rows as row (row.teamId)}<tr><td>{row.rank}</td><th scope="row">{row.name}</th><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.goalsFor}:{row.goalsAgainst}</td><td>{row.difference > 0 ? '+' : ''}{row.difference}</td><td><strong>{row.points}</strong></td></tr>{/each}</tbody>
	</table>
</div>
<style>
	.table-scroll { overflow-x: auto; }
	table { border-collapse: collapse; width: 100%; font-size: 0.875rem; font-variant-numeric: tabular-nums; }
	th, td { padding: 14px 8px; text-align: center; border-bottom: 1px solid var(--color-secondary); white-space: nowrap; }
	th:nth-child(2), tbody th { text-align: left; white-space: normal; min-width: 100px; overflow-wrap: anywhere; }
	th { font-weight: 700; }
	abbr { text-decoration: none; }
	th, td { transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease; }
	@media (hover: hover) {
		tbody tr:hover > th, tbody tr:hover > td { background: var(--color-surface); }
		tbody tr:hover > td:first-child { box-shadow: inset 3px 0 0 var(--color-text); }
		tbody tr:hover > th { text-decoration: underline; text-underline-offset: 4px; }
		tbody tr:hover > td:last-child { background: var(--color-text); color: var(--color-background); }
		thead th:hover { background: var(--color-secondary); }
		tbody tr > td:hover { background: var(--color-secondary); }
	}
	@media (prefers-reduced-motion: reduce) {
		th, td { transition: none; }
	}
</style>
