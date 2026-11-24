<script>
	import MatchRow from './MatchRow.svelte';
	/**
	 * Spiele eines Spieltags. label(match, 'A' | 'B') liefert den Anzeigenamen;
	 * editable: Tor-Eingaben erlaubt; showStatus: Speicherstatus anzeigen (Organisator).
	 */
	let { matches, label, editable = false, showStatus = false, edits = {}, editor = null, disabled = false } = $props();
</script>

<ol class="match-list">
	{#each matches as match (match.id)}
		<MatchRow {match} labelA={label(match, 'A')} labelB={label(match, 'B')} {editable} {showStatus}
			edit={edits[match.id]} {editor} {disabled} />
	{/each}
</ol>

<style>
	.match-list { list-style: none; padding: 0; margin: 0 0 12px; }
	.match-list { display: grid; grid-template-columns: minmax(180px, max-content) minmax(0, 1fr) 82px; column-gap: 12px; }
	@media (min-width: 768px) and (max-width: 1100px) {
		.match-list { display: block; }
	}
	@media (max-width: 767px) {
		.match-list { display: block; }
	}
</style>
