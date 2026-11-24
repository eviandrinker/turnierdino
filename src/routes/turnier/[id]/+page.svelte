<script>
	import { onMount, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { calculateStandings } from '#lib/standings.js';
	import { matchdays, canAdvance, currentMatchday } from '#lib/matchdays.js';
	import { createResultEditor } from '#lib/result-editor.js';
	import { validateResult } from '#lib/result-rules.js';
	import StandingsTable from '#lib/components/StandingsTable.svelte';
	import TournamentHeader from '#lib/components/TournamentHeader.svelte';
	import MatchdayTabs from '#lib/components/MatchdayTabs.svelte';
	import MatchList from '#lib/components/MatchList.svelte';
	import TeamRegistrationList from '#lib/components/TeamRegistrationList.svelte';
	let { data, form } = $props();
	const tournamentId = $derived(data.tournament.id);
	const canEdit = $derived(data.canEdit);
	let standingsDialog = $state();
	let snapshot = $state(null);
	let edits = $state({});
	let editor = $state.raw(null);
	let saving = $state(false);
	let liveMessage = $state('');
	let selectedDay = $state(untrack(() => currentMatchday(data.tournament, data.matches)));
	let lastCurrentRound = $state(untrack(() => selectedDay));
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
	function submit({ cancel, action }) {
		if (!canEdit || saving || (action.search === '?/nextRound' && dirty)) { cancel(); return; }
		saving = true;
		return async ({ update }) => {
			try { await update({ reset: false }); }
			finally { saving = false; }
		};
	}
	$effect(() => {
		const activeTournamentId = tournamentId;
		const allowEditing = canEdit;
		const currentEditor = untrack(() => {
			snapshot = null;
			edits = {};
			selectedDay = currentMatchday(data.tournament, data.matches);
			lastCurrentRound = selectedDay;
			if (!allowEditing) { editor = null; return null; }
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
		return () => currentEditor?.dispose();
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
<TournamentHeader tournament={data.tournament} status={board.status} {canEdit}
	winnerName={winnerId ? (names.get(winnerId) ?? '') : null} />
{#if liveMessage}<p role="status">{liveMessage}</p>{/if}
{#if data.justRegistered}<p class="notice" role="status">Dein Team ist angemeldet</p>{/if}
{#if form?.removed}<p role="status">{form.message}</p>
{:else if form?.message}<p role="alert">{form.message}</p>{/if}

{#if !board.matches.length}
	{#if data.creationIncomplete}
		<p>Dieses Turnier wird noch vorbereitet.</p>
	{:else}
		<TeamRegistrationList tournament={data.tournament} teams={data.teams} ownTeamId={data.ownTeam?.id ?? null}
			canRemove={canEdit && data.tournament.teamEntry === 'code'} showJoinLinks={!canEdit && data.tournament.teamEntry === 'code'} />
	{/if}
	{#if !data.creationIncomplete && data.teams.length === data.tournament.teamCount}
		{#if canEdit}
			<p>Alle {data.tournament.teamCount} Teams sind angemeldet.</p>
			<form method="POST" action="?/generate" use:enhance={submit}>
				<button class="button" disabled={saving}>{saving ? 'Turnierplan wird erstellt…' : 'Spielplan erstellen'}</button>
			</form>
		{:else}
			<p>Alle Teams sind angemeldet. Der Besitzer erstellt den Spielplan.</p>
		{/if}
	{/if}
{:else}
	<MatchdayTabs {days} selected={selectedDay} current={board.currentRound} onselect={(number) => { selectedDay = number; }} />
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
			{#if canEdit}<noscript><p>Bitte aktiviere JavaScript, um Resultate automatisch zu speichern.</p></noscript>{/if}
			<MatchList matches={shownDay?.matches ?? []} {label} editable={canEdit && selectedDay <= board.currentRound} showStatus={canEdit}
				{edits} {editor} disabled={!editor || saving} />
			{#if canEdit && readyForNext}
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

	.notice { padding: 12px 16px; background: var(--color-surface); font-weight: 600; }

	/* Seitenlokale Abstände; der Hero der Startseite bleibt unverändert. */
	:global(main:has(> .tournament-header)) { padding-block: 40px; }
	.tournament-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 64px; align-items: start; }
	.schedule { grid-column: 1; grid-row: 1; min-width: 0; }
	.standings { grid-column: 2; grid-row: 1; min-width: 0; }
	h2 { margin: 0 0 12px; font-size: 20px; line-height: 1.2; }
	.live-dot { display: inline-block; width: 8px; height: 8px; margin-left: 6px; border-radius: 50%; background: var(--color-remove); vertical-align: middle; }
	h3 { margin: 12px 0 6px; font-size: 1rem; line-height: 1.25; }
	.standings :global(table) { font-size: 0.8125rem; line-height: 1.25; }
	.standings :global(th), .standings :global(td) { padding: 12px 5px; }
	.standings :global(th:nth-child(2)), .standings :global(tbody th) { min-width: 80px; }
	.round-list { list-style: none; padding: 0; margin: 0 0 12px; }
	.result-status { margin: 0; font-size: 0.6875rem; line-height: 1.4; color: #666; overflow-wrap: anywhere; }
	.schedule form > .result-status { margin-top: 8px; }
	.table-note { margin: 12px 0 0; font-size: 0.6875rem; line-height: 1.4; }
	.round-list li { padding: 8px 12px; background: var(--color-surface); margin-bottom: 6px; font-size: 0.8125rem; }
	.round-list p { margin: 4px 0; overflow-wrap: anywhere; }
	@media (min-width: 768px) and (max-width: 1100px) {
		.tournament-grid { gap: 32px; }
	}
	@media (max-width: 767px) {
		.tournament-grid { display: flex; flex-direction: column; gap: 24px; }
		.standings, .schedule { width: 100%; }
	}
</style>
