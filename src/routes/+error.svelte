<script>
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} – Turnierdino</title></svelte:head>

<p>{page.status}</p>
<h1>{page.status === 404 ? 'Seite nicht gefunden' : 'Etwas ist schiefgelaufen'}</h1>
<p>{page.status === 404
	? 'Die gesuchte Seite oder das Turnier existiert nicht.'
	: 'Bitte versuche es später erneut.'}</p>
<a class="button" href="/">Zur Startseite</a>
