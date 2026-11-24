<script>
	import { onMount, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { calculateStandings } from '#lib/standings.js';
	import { matchdays, canAdvance, currentMatchday } from '#lib/matchdays.js';
	import { createResultEditor } from '#lib/result-editor.js';
	import { validateResult } from '#lib/result-rules.js';
	import StandingsTable from '#lib/components/StandingsTable.svelte';
	let { data, form } = $props();
	const tournamentId = $derived(data.tournament.id);
	let standingsDialog = $state();
	let snapshot = $state(null);
	let edits = $state({});
	let editor = $state.raw(null);
	let saving = $state(false);
	let liveMessage = $state('');
	let selectedDay = $state(untrack(() => currentMatchday(data.tournament, data.matches)));
	let lastCurrentRound = $state(untrack(() => selectedDay));
	const modes = { liga: 'Liga', gruppen_ko: 'Gruppen + K.-o.', ko: 'Nur K.-o.' };
	const board = $derived(snapshot && snapshot.revision >= (data.tournament.revision ?? 0)
		? snapshot
		: { matches: data.matches, currentRound: currentMatchday(data.tournament, data.matches), status: data.tournament.status, revision: data.tournament.revision ?? 0 });
	const days = $derived(matchdays(board.matches));
	const editorMatches = $derived(board.matches.map((match) => {
		const edit = edits[match.id];
		// Teilnehmer und Eingabefelder bleiben während einer Bearbeitung stabil.
		return edit && (edit.focused || edit.dirty || edit.inFlight)
			? { ...match, teamAId: edit.expected.teamAId, teamBId: edit.expected.teamBId }
			: match;
	}));
	const shownDay = $derived(matchdays(editorMatches).find((day) => day.number === selectedDay));
	const names = $derived(new Map(data.teams.map((team) => [team.id, team.name])));
	const groups = $derived([...new Set(data.teams.map((team) => team.group).filter(Boolean))].sort());
	const knockout = $derived(days.filter((day) => day.phase === 'ko'));
	const dirty = $derived(Object.values(edits).some((edit) => edit.dirty || edit.inFlight));
	const interactionActive = $derived(Object.values(edits).some((edit) => edit.dirty || edit.focused || edit.inFlight));
	const readyForNext = $derived(canAdvance(board.matches, board.currentRound));
	const createdDate = $derived(new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich' }).format(new Date(data.tournament.createdAt)));
	const tableMatches = $derived(board.matches.map((match) => {
		const edit = edits[match.id];
		if (!edit?.optimistic || edit.error || edit.expected.teamAId !== match.teamAId || edit.expected.teamBId !== match.teamBId) return match;
		const result = validateResult({ scoreA: edit.a, scoreB: edit.b }, match.phase);
		return result.valid ? { ...match, ...result.values } : match;
	}));
	const winnerId = $derived.by(() => {
		if (board.status !== 'Abgeschlossen') return null;
		if (data.tournament.mode === 'liga') return calculateStandings(data.teams, board.matches)[0]?.teamId;
		const final = board.matches.find((match) => match.phase === 'ko' && match.roundName === 'Final');
		return final?.status === 'Beendet' ? (final.scoreA > final.scoreB ? final.teamAId : final.teamBId) : null;
	});

	$effect(() => {
		if (lastCurrentRound !== board.currentRound && !interactionActive) {
			selectedDay = board.currentRound;
			lastCurrentRound = board.currentRound;
		}
	});

	$effect(() => {
		// Nach jedem neuen Serverstand nur ungeschützte Felder synchronisieren.
		const currentEditor = editor;
		board.matches;
		if (currentEditor) untrack(() => currentEditor.sync());
	});

	function acceptSnapshot(next) {
		if (next && next.revision >= board.revision) snapshot = next;
	}
	function label(match, side) {
		const id = match[`team${side}Id`];
		if (id) return names.get(id) ?? 'Unbekanntes Team';
		const source = match[`source${side}`];
		if (source?.type === 'group') return `${source.rank}. Gruppe ${source.group}`;
		if (source?.type === 'winner') return `Sieger Spiel ${source.matchNumber}`;
		return 'Noch offen';
	}
	function statusText(match) {
		const edit = edits[match.id];
		if (edit?.error) return edit.error;
		if (edit?.inFlight || edit?.status === 'saving') return 'Speichert …';
		if (edit?.status === 'incomplete') return 'unvollständig';
		if (edit?.status === 'pending') return 'Speichern ausstehend …';
		if (edit?.status === 'saved' || match.status === 'Beendet') return 'Gespeichert';
		return '';
	}
	function submit({ cancel, action }) {
		if (saving || (action.search === '?/nextRound' && dirty)) { cancel(); return; }
		saving = true;
		return async ({ update }) => {
			try { await update({ reset: false }); }
			finally { saving = false; }
		};
	}
	$effect(() => {
		const activeTournamentId = tournamentId;
		const currentEditor = untrack(() => {
			snapshot = null;
			edits = {};
			selectedDay = currentMatchday(data.tournament, data.matches);
			lastCurrentRound = selectedDay;
			editor = createResultEditor({
				getMatch: (id) => board.matches.find((match) => match.id === id),
				onState: (next) => { edits = next; },
				onSaved: acceptSnapshot,
				save: async (id, input) => {
					const response = await fetch(`/api/matches/${id}`, {
						method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
					});
					const result = await response.json();
					if (!response.ok) {
						if (data.tournament.id === activeTournamentId) acceptSnapshot(result.snapshot);
						throw new Error(result.message ?? 'Speichern fehlgeschlagen. Bitte versuche es erneut.');
					}
					return result.snapshot;
				}
			});
			return editor;
		});
		return () => currentEditor.dispose();
	});

	onMount(() => {
		let refreshing = false;
		let active = true;
		async function refresh() {
			if (!active || document.visibilityState !== 'visible' || saving || refreshing) return;
			refreshing = true;
			try { await invalidateAll(); if (active) liveMessage = ''; }
			catch { if (active) liveMessage = 'Live-Aktualisierung momentan nicht möglich.'; }
			finally { refreshing = false; }
		}
		const interval = setInterval(refresh, 20000);
		document.addEventListener('visibilitychange', refresh);
		return () => {
			active = false; clearInterval(interval);
			document.removeEventListener('visibilitychange', refresh);
		};
	});
</script>

<svelte:head><title>{data.tournament.name} – Turnierdino</title></svelte:head>
<header class="tournament-header">
	<h1>{data.tournament.name}</h1>
	<div class="tournament-meta">
		<p>{modes[data.tournament.mode]} · Erstellt am {createdDate} · Start {data.tournament.startTime} Uhr</p>
		<span class="status" aria-live="polite">{board.status}</span>
	</div>
	{#if winnerId}
		<div class="winner" role="status">
			<span class="winner-label">Turniersieger</span>
			<strong>{names.get(winnerId)}</strong>
		</div>
	{/if}
	{#if data.tournament.teamEntry === 'code'}<a href={`/turnier/${data.tournament.id}/code`}>Code zum Teilen</a>{/if}
</header>
{#if liveMessage}<p role="status">{liveMessage}</p>{/if}
{#if form?.message}<p role="alert">{form.message}</p>{/if}

{#if !board.matches.length}
	{#if data.teams.length !== data.tournament.teamCount}
		<p aria-live="polite">Es sind erst {data.teams.length} von {data.tournament.teamCount} Teams angemeldet</p>
	{:else}
		<p>Alle {data.tournament.teamCount} Teams sind angemeldet.</p>
		<form method="POST" action="?/generate" use:enhance={submit}>
			<button class="button" disabled={saving}>{saving ? 'Turnierplan wird erstellt…' : 'Spielplan erstellen'}</button>
		</form>
	{/if}
{:else}
	<nav class="matchday-nav" aria-label="Spieltage">
		{#each days as day (day.key)}
			<button type="button" class:active={selectedDay === day.number} class:current={board.currentRound === day.number}
				aria-current={board.currentRound === day.number ? 'step' : undefined}
				disabled={day.number > board.currentRound}
				title={day.number > board.currentRound ? `Wird freigeschaltet, sobald Spieltag ${day.number - 1} fertig ist` : day.label}
				onclick={() => { selectedDay = day.number; }}>
				{day.label}
				<span class="current-marker">aktuell</span>
			</button>
		{/each}
	</nav>
	<div class="tournament-grid">
		<section class="standings" aria-labelledby="standings-heading">
			<div class="standings-heading">
				<h2 id="standings-heading">
					{data.tournament.mode === 'ko' ? 'Runden-Übersicht' : 'Live-Tabelle'}
					{#if data.tournament.mode !== 'ko'}<span class="live-dot" aria-hidden="true"></span>{/if}
				</h2>
				{#if data.tournament.mode !== 'ko'}
					<button class="expand-table" type="button" aria-haspopup="dialog" aria-controls="standings-dialog"
						onclick={() => standingsDialog?.showModal()}>Tabelle vergrössern ↗</button>
				{/if}
			</div>
			{#if data.tournament.mode === 'ko'}
				{#each knockout as section (section.key)}
					<h3>{section.label}</h3>
					<ul class="round-list">{#each section.matches as match (match.matchNumber)}
						<li><span>Spiel {match.matchNumber}</span><p>{label(match, 'A')} – {label(match, 'B')}</p><strong>{match.status === 'Beendet' ? `${match.scoreA} : ${match.scoreB}` : 'Noch offen'}</strong></li>
					{/each}</ul>
				{/each}
			{:else if data.tournament.mode === 'gruppen_ko'}
				{#each groups as group (group)}
					<h3>Gruppe {group}</h3>
					<StandingsTable label={`Tabelle Gruppe ${group}`} rows={calculateStandings(data.teams.filter((team) => team.group === group), tableMatches.filter((match) => match.group === group))} />
				{/each}
			{:else}
				<StandingsTable rows={calculateStandings(data.teams, tableMatches)} />
			{/if}
			{#if data.tournament.mode !== 'ko'}<p class="table-note">Sieg 3 Pkt. · Unentschieden 1 Pkt. · Bei Punktgleichheit zählt die Tordifferenz, dann die erzielten Tore.</p>{/if}
		</section>
		<section class="schedule" aria-labelledby="schedule-heading">
			<h2 id="schedule-heading">Spiele</h2>
			<noscript><p>Bitte aktiviere JavaScript, um Resultate automatisch zu speichern.</p></noscript>
			<ol class="match-list">
				{#each shownDay?.matches ?? [] as match (match.id)}
					<li>
						<p class="match-meta">{match.scheduledTime}{match.scheduledDay ? ` (+${match.scheduledDay} Tage)` : ''} · Feld {match.field} · Spiel {match.matchNumber}{match.phase === 'gruppe' ? ` · Gruppe ${match.group}` : ''}</p>
						<div class="match-row">
							<span class="team team-a">{label(match, 'A')}</span>
							{#if match.teamAId && match.teamBId && selectedDay <= board.currentRound}
								<div class="scores">
									{#each ['a', 'b'] as side}
										{#if side === 'b'}<span aria-hidden="true">:</span>{/if}
										<input class="score" type="text" inputmode="numeric" pattern="[0-9]{1,2}" maxlength="2"
											value={edits[match.id]?.[side] ?? match[side === 'a' ? 'scoreA' : 'scoreB'] ?? ''}
											oninput={(event) => editor?.edit(match.id, side, event.currentTarget.value)}
											data-match-id={match.id}
											onfocus={() => editor?.focus(match.id)}
											onblur={(event) => editor?.blur(match.id, {
												retainFocus: event.relatedTarget?.getAttribute?.('data-match-id') === match.id
											})}
											disabled={!editor || saving}
											aria-label={`Tore ${label(match, side.toUpperCase())}, Spiel ${match.matchNumber}`}
											aria-invalid={!!edits[match.id]?.error} aria-describedby={`result-status-${match.id}`} />
									{/each}
								</div>
							{:else}<span class="open-slot">–</span>{/if}
							<span class="team">{label(match, 'B')}</span>
						</div>
						<p class="result-status" class:error={!!edits[match.id]?.error} id={`result-status-${match.id}`} aria-live="polite">{statusText(match)}</p>
						{#if edits[match.id]?.error}
							<div class="error-actions">
								<button class="reset" type="button" onclick={() => editor?.retry(match.id)}>Erneut versuchen</button>
								<button class="reset" type="button" onclick={() => editor?.reset(match.id)}>Gespeicherten Stand übernehmen</button>
							</div>
						{/if}
					</li>
				{/each}
			</ol>
			{#if readyForNext}
				<form method="POST" action="?/nextRound" use:enhance={submit}>
					<input type="hidden" name="currentRound" value={board.currentRound} />
					<button class="button" disabled={saving || dirty}>{saving ? 'Spieltag wird gewechselt …' : 'Nächster Spieltag'}</button>
					{#if dirty}<p class="result-status">Bitte warte, bis alle Änderungen gespeichert sind, oder korrigiere die offenen Eingaben.</p>{/if}
				</form>
			{/if}
		</section>
	</div>
{/if}

{#if data.tournament.mode !== 'ko'}
	<dialog id="standings-dialog" class="standings-modal" bind:this={standingsDialog} aria-labelledby="modal-table-title">
		<header class="modal-heading">
			<div>
				<h2 id="modal-table-title">Live-Tabelle <span class="live-dot" aria-hidden="true"></span></h2>
				<p>{data.tournament.name}</p>
			</div>
			<form method="dialog"><button class="button" type="submit">Schliessen ×</button></form>
		</header>
		{#if data.tournament.mode === 'gruppen_ko'}
			{#each groups as group (group)}
				<section class="modal-group" aria-label={`Gruppe ${group}`}>
					<h3>Gruppe {group}</h3>
					<StandingsTable label={`Vergrösserte Tabelle Gruppe ${group}`} rows={calculateStandings(data.teams.filter((team) => team.group === group), tableMatches.filter((match) => match.group === group))} />
				</section>
			{/each}
		{:else}
			<StandingsTable label="Vergrösserte Live-Tabelle" rows={calculateStandings(data.teams, tableMatches)} />
		{/if}
		<p class="modal-note">Sieg 3 Pkt. · Unentschieden 1 Pkt. · Bei Punktgleichheit zählt die Tordifferenz, dann die erzielten Tore.</p>
	</dialog>
{/if}

<style>
	.standings-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
	.standings-heading h2 { margin: 0; }
	.expand-table { min-height: 44px; border: 0; padding: 0; background: transparent; color: var(--color-text); font-size: 0.75rem; text-decoration: underline; text-underline-offset: 4px; cursor: pointer; }
	.expand-table { padding-inline: 8px; transition: background-color 160ms ease, color 160ms ease; }
	.expand-table:focus-visible { background: var(--color-text); color: var(--color-background); }
	@media (hover: hover) {
		.expand-table:hover { background: var(--color-text); color: var(--color-background); text-decoration: none; }
	}
	@media (prefers-reduced-motion: reduce) {
		.expand-table { transition: none; }
	}
	.standings-modal { width: min(1100px, calc(100% - 48px)); max-height: 90dvh; margin: auto; padding: 36px; border: 1px solid var(--color-text); border-radius: 0; background: var(--color-background); color: var(--color-text); overflow-y: auto; }
	.standings-modal::backdrop { background: rgb(0 0 0 / 45%); }
	:global(body:has(.standings-modal[open])) { overflow: hidden; }
	.modal-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 32px; }
	.modal-heading h2 { font-size: 28px; margin-bottom: 8px; }
	.modal-heading p { margin: 0; overflow-wrap: anywhere; }
	.modal-heading > div { min-width: 0; }
	.modal-heading form { flex-shrink: 0; }
	.modal-group + .modal-group { margin-top: 32px; }
	.modal-group h3 { margin: 0 0 16px; font-size: 20px; }
	.standings-modal :global(table) { font-size: 1rem; line-height: 1.5; }
	.standings-modal :global(th), .standings-modal :global(td) { padding: 16px 12px; }
	.standings-modal :global(thead th) { font-size: 0.8125rem; color: #555; }
	.standings-modal :global(tbody tr:first-child) { background: var(--color-surface); }
	.modal-note { margin: 24px 0 0; font-size: 0.8125rem; line-height: 1.6; color: #555; }
	@media (max-width: 767px) {
		.standings-modal { width: calc(100% - 24px); max-height: 94dvh; padding: 20px; }
		.modal-heading { flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
		.modal-heading h2 { font-size: 24px; }
		.standings-modal :global(th), .standings-modal :global(td) { padding: 12px 8px; }
	}

	/* Seitenlokale Abstände; der Hero der Startseite bleibt unverändert. */
	:global(main:has(> .tournament-header)) { padding-block: 40px; }
	.tournament-header { margin-bottom: 32px; }
	h1 { font-size: 36px; line-height: 1.15; margin: 0 0 8px; overflow-wrap: anywhere; }
	.tournament-meta { display: flex; align-items: center; gap: 12px; font-size: 0.875rem; }
	.tournament-meta p { margin: 0; }
	.status { flex-shrink: 0; padding: 4px 8px; background: var(--color-surface); font-weight: 700; }
	.winner { margin-top: 16px; padding: 16px 20px; border: 1px solid var(--color-text); max-width: 640px; }
	.winner-label { display: block; margin-bottom: 6px; font-size: 0.75rem; }
	.winner strong { display: block; font-size: 28px; line-height: 1.2; font-weight: 800; overflow-wrap: anywhere; }
	.tournament-header > a { display: inline-block; margin-top: 8px; font-size: 0.875rem; }
	.matchday-nav { display: flex; gap: 20px; overflow-x: auto; margin-bottom: 32px; }
	.matchday-nav button { flex-shrink: 0; min-height: 40px; padding: 8px 0; border: 0; border-bottom: 3px solid transparent; background: transparent; color: var(--color-text); cursor: pointer; }
	.matchday-nav button.active { border-bottom-color: var(--color-text); font-weight: 700; }
	.current-marker { display: none; margin-left: 6px; font-size: 0.6875rem; font-weight: 400; }
	.matchday-nav button.current .current-marker { display: inline; }
	.matchday-nav button:disabled { color: #888; cursor: not-allowed; }
	.tournament-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 64px; align-items: start; }
	.schedule { grid-column: 1; grid-row: 1; min-width: 0; }
	.standings { grid-column: 2; grid-row: 1; min-width: 0; }
	h2 { margin: 0 0 12px; font-size: 20px; line-height: 1.2; }
	.live-dot { display: inline-block; width: 8px; height: 8px; margin-left: 6px; border-radius: 50%; background: var(--color-remove); vertical-align: middle; }
	h3 { margin: 12px 0 6px; font-size: 1rem; line-height: 1.25; }
	.standings :global(table) { font-size: 0.8125rem; line-height: 1.25; }
	.standings :global(th), .standings :global(td) { padding: 12px 5px; }
	.standings :global(th:nth-child(2)), .standings :global(tbody th) { min-width: 80px; }
	.match-list, .round-list { list-style: none; padding: 0; margin: 0 0 12px; }
	.match-list { display: grid; grid-template-columns: minmax(180px, max-content) minmax(0, 1fr) 82px; column-gap: 12px; }
	.match-list li { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; padding: 16px 0; border-bottom: 1px solid var(--color-secondary); }
	.match-meta { min-width: 180px; white-space: nowrap; margin: 0; color: #666; font-size: 0.6875rem; line-height: 1.4; }
	.match-row { display: grid; grid-template-columns: minmax(0, 1fr) 112px minmax(0, 1fr); gap: 8px; align-items: center; }
	.team { min-width: 0; overflow-wrap: anywhere; font-size: 0.875rem; line-height: 1.3; }
	.team-a { text-align: right; }
	.open-slot { text-align: center; }
	.scores { display: grid; grid-template-columns: 48px 16px 48px; align-items: center; text-align: center; }
	.score { width: 48px; height: 40px; border: 1px solid var(--color-text); border-radius: 0; padding: 4px; font: inherit; text-align: center; color: var(--color-text); background: var(--color-background); }
	.score[aria-invalid='true'] { border-width: 3px; }
	.result-status { margin: 0; font-size: 0.6875rem; line-height: 1.4; color: #666; overflow-wrap: anywhere; }
	.result-status.error { color: var(--color-remove); }
	.schedule form > .result-status { margin-top: 8px; }
	.error-actions { grid-column: 2 / -1; display: flex; flex-wrap: wrap; gap: 8px; }
	.reset { min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--color-text); font-size: 0.75rem; text-decoration: underline; cursor: pointer; }
	.table-note { margin: 12px 0 0; font-size: 0.6875rem; line-height: 1.4; }
	.round-list li { padding: 8px 12px; background: var(--color-surface); margin-bottom: 6px; font-size: 0.8125rem; }
	.round-list p { margin: 4px 0; overflow-wrap: anywhere; }
	@media (min-width: 768px) and (max-width: 1100px) {
		.tournament-grid { gap: 32px; }
		.match-list { display: block; }
		.match-list li { grid-template-columns: minmax(0, 1fr) 64px; gap: 8px; }
		.match-meta { grid-column: 1 / -1; }
		.error-actions { grid-column: 1 / -1; }
		.match-row { gap: 4px; }
		.team { font-size: 0.8125rem; }
	}
	@media (max-width: 767px) {
		h1 { font-size: 28px; }
		.tournament-meta { flex-wrap: wrap; gap: 6px 10px; }
		.matchday-nav button { min-height: 44px; }
		.tournament-grid { display: flex; flex-direction: column; gap: 24px; }
		.standings, .schedule { width: 100%; }
		.match-list { display: block; }
		.match-list li { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 16px 0; }
		.match-meta { grid-column: 1; grid-row: 1; min-width: 0; font-size: 0.6875rem; }
		.winner strong { font-size: 24px; }
		.match-row { grid-column: 1 / -1; grid-row: 2; }
		.match-list .result-status { grid-column: 1; grid-row: 3; text-align: right; }
		.score { height: 44px; }
		.error-actions { grid-column: 1 / -1; }
	}
</style>
