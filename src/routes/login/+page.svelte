<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let saving = $state(false);
</script>
<svelte:head><title>Login – Turnierdino</title></svelte:head>
<div class="account-form">
	<h1>Login</h1>
	<form method="POST" use:enhance={() => {
		saving = true;
		return async ({ update }) => { try { await update({ reset: false }); } finally { saving = false; } };
	}}>
		<label for="email">E-Mail</label>
		<input class="text-input" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} maxlength="254" />
		<label for="password">Passwort</label>
		<input class="text-input" id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024" />
		{#if form?.message}<p role="alert">{form.message}</p>{/if}
		<button class="button" disabled={saving}>{saving ? 'Wird angemeldet …' : 'Anmelden'}</button>
	</form>
	<p><a href={`/registrieren?ziel=${encodeURIComponent(data.target)}`}>Noch kein Konto? Registrieren</a></p>
</div>
