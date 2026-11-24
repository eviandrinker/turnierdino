<script>
	/** days: aus matchdays(); selected: gewählter Spieltag; current: aktueller Spieltag (spätere sind gesperrt). */
	let { days, selected, current, onselect } = $props();
</script>

<nav class="matchday-nav" aria-label="Spieltage">
	{#each days as day (day.key)}
		<button type="button" class:active={selected === day.number} class:current={current === day.number}
			aria-current={current === day.number ? 'step' : undefined}
			disabled={day.number > current}
			title={day.number > current ? `Wird freigeschaltet, sobald Spieltag ${day.number - 1} fertig ist` : day.label}
			onclick={() => onselect(day.number)}>
			{day.label}
			<span class="current-marker">aktuell</span>
		</button>
	{/each}
</nav>

<style>
	.matchday-nav { display: flex; gap: 20px; overflow-x: auto; margin-bottom: 32px; }
	.matchday-nav button { flex-shrink: 0; min-height: 40px; padding: 8px 0; border: 0; border-bottom: 3px solid transparent; background: transparent; color: var(--color-text); cursor: pointer; }
	.matchday-nav button.active { border-bottom-color: var(--color-text); font-weight: 700; }
	.current-marker { display: none; margin-left: 6px; font-size: 0.6875rem; font-weight: 400; }
	.matchday-nav button.current .current-marker { display: inline; }
	.matchday-nav button:disabled { color: #888; cursor: not-allowed; }
	@media (max-width: 767px) {
		.matchday-nav button { min-height: 44px; }
	}
</style>
