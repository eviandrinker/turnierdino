<script>
	/**
	 * Eine Spielzeile. editable: Tor-Eingaben anzeigen (Organisator, freigeschalteter Spieltag);
	 * showStatus: Speicherstatus anzeigen; sonst schreibgeschützte Ansicht für Besucher.
	 */
	let { match, labelA, labelB, editable = false, showStatus = false, edit = undefined, editor = null, disabled = false } = $props();
	const labels = $derived({ a: labelA, b: labelB });
	const statusText = $derived.by(() => {
		if (edit?.error) return edit.error;
		if (edit?.inFlight || edit?.status === 'saving') return 'Speichert …';
		if (edit?.status === 'incomplete') return 'unvollständig';
		if (edit?.status === 'pending') return 'Speichern ausstehend …';
		if (edit?.status === 'saved' || match.status === 'Beendet') return 'Gespeichert';
		return '';
	});
</script>

<li class="match-item">
	<p class="match-meta">{match.scheduledTime}{match.scheduledDay ? ` (+${match.scheduledDay} Tage)` : ''} · Feld {match.field} · Spiel {match.matchNumber}{match.phase === 'gruppe' ? ` · Gruppe ${match.group}` : ''}</p>
	<div class="match-row">
		<span class="team team-a">{labelA}</span>
		{#if editable && match.teamAId && match.teamBId}
			<div class="scores">
				{#each ['a', 'b'] as side}
					{#if side === 'b'}<span aria-hidden="true">:</span>{/if}
					<input class="score" type="text" inputmode="numeric" pattern="[0-9]{1,2}" maxlength="2"
						value={edit?.[side] ?? match[side === 'a' ? 'scoreA' : 'scoreB'] ?? ''}
						oninput={(event) => editor?.edit(match.id, side, event.currentTarget.value)}
						data-match-id={match.id}
						onfocus={() => editor?.focus(match.id)}
						onblur={(event) => editor?.blur(match.id, {
							retainFocus: event.relatedTarget?.getAttribute?.('data-match-id') === match.id
						})}
						{disabled}
						aria-label={`Tore ${labels[side]}, Spiel ${match.matchNumber}`}
						aria-invalid={!!edit?.error} aria-describedby={`result-status-${match.id}`} />
				{/each}
			</div>
		{:else if match.teamAId && match.teamBId}
			<span class="readonly-score" aria-label="Resultat">{match.scoreA ?? '–'} : {match.scoreB ?? '–'}</span>
		{:else}<span class="open-slot">–</span>{/if}
		<span class="team">{labelB}</span>
	</div>
	{#if showStatus}<p class="result-status" class:error={!!edit?.error} id={`result-status-${match.id}`} aria-live="polite">{statusText}</p>{/if}
	{#if edit?.error}
		<div class="error-actions">
			<button class="reset" type="button" onclick={() => editor?.retry(match.id)}>Erneut versuchen</button>
			<button class="reset" type="button" onclick={() => editor?.reset(match.id)}>Gespeicherten Stand übernehmen</button>
		</div>
	{/if}
</li>

<style>
	.match-item { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--color-secondary); }
	.match-meta { min-width: 180px; white-space: nowrap; margin: 0; color: #666; font-size: 0.6875rem; line-height: 1.4; }
	.match-row { display: grid; grid-template-columns: minmax(0, 1fr) 112px minmax(0, 1fr); gap: 8px; align-items: center; }
	.team { min-width: 0; overflow-wrap: anywhere; font-size: 0.875rem; line-height: 1.3; }
	.team-a { text-align: right; }
	.open-slot { text-align: center; }
	.readonly-score { text-align: center; font-weight: 700; font-variant-numeric: tabular-nums; }
	.scores { display: grid; grid-template-columns: 48px 16px 48px; align-items: center; text-align: center; }
	.score { width: 48px; height: 40px; border: 1px solid var(--color-text); border-radius: 0; padding: 4px; font: inherit; text-align: center; color: var(--color-text); background: var(--color-background); }
	.score[aria-invalid='true'] { border-width: 3px; }
	.result-status { margin: 0; font-size: 0.6875rem; line-height: 1.4; color: #666; overflow-wrap: anywhere; }
	.result-status.error { color: var(--color-remove); }
	.error-actions { grid-column: 2 / -1; display: flex; flex-wrap: wrap; gap: 8px; }
	.reset { min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--color-text); font-size: 0.75rem; text-decoration: underline; cursor: pointer; }
	@media (min-width: 768px) and (max-width: 1100px) {
		.match-item { grid-template-columns: minmax(0, 1fr) 64px; gap: 8px; }
		.match-meta { grid-column: 1 / -1; }
		.error-actions { grid-column: 1 / -1; }
		.match-row { gap: 4px; }
		.team { font-size: 0.8125rem; }
	}
	@media (max-width: 767px) {
		.match-item { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 16px 0; }
		.match-meta { grid-column: 1; grid-row: 1; min-width: 0; font-size: 0.6875rem; }
		.match-row { grid-column: 1 / -1; grid-row: 2; }
		.match-item > .result-status { grid-column: 1; grid-row: 3; text-align: right; }
		.score { height: 44px; }
		.error-actions { grid-column: 1 / -1; }
	}
</style>
