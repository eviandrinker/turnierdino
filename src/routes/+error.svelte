<script>
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} – Turnierdino</title></svelte:head>

<p>{page.status}</p>
<h1>{page.status === 404 ? 'Seite nicht gefunden' : page.status === 403 ? 'Kein Zugriff' : 'Etwas ist schiefgelaufen'}</h1>
<p>{page.status === 404
	? 'Die gesuchte Seite oder das Turnier existiert nicht.'
	: page.status === 403 ? 'Du darfst dieses Turnier nicht bearbeiten. Nur der Besitzer kann Änderungen vornehmen.' : 'Bitte versuche es später erneut.'}</p>
<a class="button" href="/">Zur Startseite</a>
