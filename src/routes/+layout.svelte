<script>
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';

	let { children } = $props();
	let menuOpen = $state(false);
	let menuButton;

	function closeMenu(event) {
		if (event.key === 'Escape' && menuOpen) {
			menuOpen = false;
			menuButton?.focus();
		}
	}
</script>

<svelte:window onkeydown={closeMenu} />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="container">
	<a class="brand" href="/" onclick={() => (menuOpen = false)}>
		<img src="/logo.png" alt="" width="64" height="64" />
		<span>Turnierdino.</span>
	</a>
	<button
		class="button menu-toggle"
		type="button"
		bind:this={menuButton}
		aria-label={menuOpen ? 'Menü schliessen' : 'Menü öffnen'}
		aria-expanded={menuOpen}
		aria-controls="navigation"
		onclick={() => (menuOpen = !menuOpen)}
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d={menuOpen ? 'M6 6l12 12M6 18L18 6' : 'M3 6h18M3 12h18M3 18h18'} />
		</svg>
	</button>
	<nav id="navigation" aria-label="Hauptnavigation" class:open={menuOpen}>
		<a href="/suchen" onclick={() => (menuOpen = false)}>Turnier suchen</a>
		<a href="/beitreten" onclick={() => (menuOpen = false)}>Turnier beitreten</a>
		<a class="button" href="/login" onclick={() => (menuOpen = false)}>Login</a>
	</nav>
</header>

<main class="container">
	{@render children()}
</main>

<style>
	header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-block: 24px; }
	.brand { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; }
	.brand img { width: auto; height: 64px; object-fit: contain; }
	.brand span { font-size: clamp(1.25rem, 2.5vw, 1.75rem); font-weight: 800; letter-spacing: -0.04em; }
	nav { display: flex; align-items: center; gap: 32px; }
	nav a { text-decoration: none; font-weight: 600; }
	nav a:not(.button):hover { text-decoration: underline; text-underline-offset: 5px; }
	.menu-toggle { display: none; padding: 12px; }
	@media (max-width: 767px) {
		header { flex-wrap: wrap; gap: 16px; }
		.menu-toggle { display: inline-flex; }
		nav { display: none; width: 100%; align-items: stretch; gap: 8px; }
		nav.open { display: flex; flex-direction: column; }
		nav a { padding: 16px; }
	}
</style>
