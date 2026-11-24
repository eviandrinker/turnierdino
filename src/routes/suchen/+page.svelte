<script>
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import TournamentCard from '#lib/components/TournamentCard.svelte';
	import { SEARCH_CATEGORIES, sectionTitles, categoryLabels } from '#lib/tournament-search.js';
	let { data } = $props();

	let q = $state(untrack(() => data.query.q));
	let submitted = untrack(() => data.query.q);
	let timer;
	let more = $state({});
	let loadingMore = $state('');
	let moreError = $state('');

	const tabs = [{ key: 'alle', label: 'Alle' }, ...SEARCH_CATEGORIES.map((key) => ({ key, label: categoryLabels[key] }))];
	const total = $derived(SEARCH_CATEGORIES.reduce((sum, key) => sum + data.counts[key], 0));
	const counts = $derived({ alle: total, ...data.counts });
	const shownCount = $derived(data.query.category === 'alle' ? total : data.counts[data.query.category]);
	const sections = $derived(Object.entries(data.sections).map(([key, section]) => {
		const extra = more[key];
		const seen = new Set(section.items.map((item) => item.id));
		return {
			key, title: sectionTitles[key],
			items: [...section.items, ...(extra?.items ?? []).filter((item) => !seen.has(item.id))],
			page: extra?.page ?? section.page,
			hasMore: extra ? extra.hasMore : section.hasMore
		};
	}).filter((section) => section.items.length));

	// Nach jeder Navigation (Tippen, Tabs, «Zurück») den Serverstand übernehmen.
	$effect(() => {
		const incoming = data.query.q;
		data.sections;
		untrack(() => {
			more = {};
			moreError = '';
			if (incoming !== submitted) { q = incoming; submitted = incoming; }
		});
	});

	function searchUrl(query, category) {
		const params = new URLSearchParams();
		if (query.trim()) params.set('q', query.trim());
		if (category !== 'alle') params.set('kategorie', category);
		const text = params.toString();
		return text ? `?${text}` : '?';
	}
	function onInput() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (q.trim() === submitted) return;
			submitted = q.trim();
			goto(searchUrl(q, data.query.category), { keepFocus: true, noScroll: true });
		}, 300);
	}
	function onSubmit(event) {
		event.preventDefault();
		clearTimeout(timer);
		submitted = q.trim();
		goto(searchUrl(q, data.query.category), { keepFocus: true, noScroll: true });
	}
	async function loadMore(section) {
		if (loadingMore) return;
		loadingMore = section.key;
		moreError = '';
		try {
			const params = new URLSearchParams({ kategorie: section.key, seite: String(section.page + 1) });
			if (data.query.q) params.set('q', data.query.q);
			const response = await fetch(`/api/turniere?${params}`);
			if (!response.ok) throw new Error();
			const result = (await response.json()).sections[section.key];
			const previous = more[section.key]?.items ?? [];
			more[section.key] = { items: [...previous, ...result.items], page: result.page, hasMore: result.hasMore };
		} catch {
			moreError = 'Weitere Turniere konnten nicht geladen werden. Bitte versuche es erneut.';
		} finally {
			loadingMore = '';
		}
	}
</script>

<svelte:head><title>Turnier suchen – Turnierdino</title></svelte:head>

<section class="search-page">
	<h1>Turnier suchen</h1>
	<form class="search-form" method="GET" role="search" onsubmit={onSubmit}>
		<label class="visually-hidden" for="search-input">Turniername</label>
		<svg class="search-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
			<circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" />
		</svg>
		<input id="search-input" class="search-input" type="search" name="q" placeholder="Turniername eingeben" autocomplete="off"
			maxlength="100" bind:value={q} oninput={onInput} />
		{#if data.query.category !== 'alle'}<input type="hidden" name="kategorie" value={data.query.category} />{/if}
		<button class="visually-hidden" type="submit">Suchen</button>
	</form>

	<nav class="filters" aria-label="Turniere filtern">
		{#each tabs as tab (tab.key)}
			<a href={searchUrl(data.query.q, tab.key)} data-sveltekit-noscroll data-sveltekit-keepfocus
				class:active={data.query.category === tab.key}
				aria-current={data.query.category === tab.key ? 'page' : undefined}>{tab.label} ({counts[tab.key]})</a>
		{/each}
	</nav>

	<div class="results" aria-live="polite" aria-busy={!!navigating.to}>
		{#if shownCount === 0}
			<p class="empty">
				{#if data.query.q}Keine Turniere zu ‹{data.query.q}› gefunden
				{:else}Gerade gibt es hier keine Turniere.{/if}
			</p>
		{:else}
			{#each sections as section (section.key)}
				<section class="result-section" aria-labelledby={`section-${section.key}`}>
					<h2 id={`section-${section.key}`}>{section.title} <span class="count">({data.counts[section.key]})</span></h2>
					<ul class="card-grid">
						{#each section.items as tournament (tournament.id)}
							<li><TournamentCard {tournament} /></li>
						{/each}
					</ul>
					{#if section.hasMore}
						<button class="button button-secondary more" type="button" disabled={!!loadingMore} onclick={() => loadMore(section)}>
							{loadingMore === section.key ? 'Wird geladen …' : 'Mehr anzeigen'}
						</button>
					{/if}
				</section>
			{/each}
			{#if moreError}<p role="alert">{moreError}</p>{/if}
		{/if}
	</div>

	<p class="create-hint">Lieber selber erstellen? <a href="/turnier/neu">Hier klicken</a></p>
</section>

<style>
	:global(main:has(> .search-page)) { padding-block: 40px; }
	.search-page h1 { font-size: clamp(2rem, 5vw, 3.5rem); margin-bottom: 24px; }
	.search-form { position: relative; max-width: 800px; margin-bottom: 32px; }
	.search-icon { position: absolute; left: 20px; top: 50%; transform: translateY(-50%); pointer-events: none; }
	.search-input { width: 100%; min-height: 72px; padding: 16px 20px 16px 64px; border: 2px solid var(--color-text); border-radius: 0; background: var(--color-background); color: var(--color-text); font-size: clamp(1.125rem, 3vw, 1.5rem); }
	.filters { display: flex; gap: 24px; overflow-x: auto; margin-bottom: 32px; }
	.filters a { flex-shrink: 0; padding: 12px 0; min-height: 44px; border-bottom: 3px solid transparent; text-decoration: none; }
	.filters a.active { border-color: var(--color-text); font-weight: 700; }
	.result-section + .result-section { margin-top: 48px; }
	.result-section h2 { margin: 0 0 16px; font-size: 22px; }
	.count { font-weight: 400; font-size: 1rem; }
	.card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; list-style: none; padding: 0; margin: 0; }
	.card-grid li { display: flex; min-width: 0; }
	.card-grid li > :global(*) { flex: 1; }
	.more { margin-top: 24px; }
	.empty { padding-block: 32px; font-size: 1.125rem; overflow-wrap: anywhere; }
	.create-hint { margin-top: 64px; font-size: 0.875rem; }
	@media (max-width: 1023px) { .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (max-width: 767px) {
		.card-grid { grid-template-columns: minmax(0, 1fr); }
		.search-input { min-height: 60px; padding-left: 56px; }
		.search-icon { left: 16px; }
		.more { width: 100%; }
	}
</style>
