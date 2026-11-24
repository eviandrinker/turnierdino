<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();
	let saving = $state(false);
</script>
<svelte:head><title>Registrieren – Turnierdino</title></svelte:head>
<div class="account-form">
	<h1>Registrieren</h1>
	<form method="POST" use:enhance={() => {
		saving = true;
		return async ({ update }) => { try { await update({ reset: false }); } finally { saving = false; } };
	}}>
		<label for="name">Name</label>
		<input class="text-input" id="name" name="name" autocomplete="name" required minlength="2" maxlength="60" value={form?.values?.name ?? ''} aria-invalid={!!form?.errors?.name} aria-describedby={form?.errors?.name ? 'name-error' : undefined} />
		{#if form?.errors?.name}<p class="field-error" id="name-error">{form.errors.name}</p>{/if}
		<label for="email">E-Mail</label>
		<input class="text-input" id="email" name="email" type="email" autocomplete="email" required maxlength="254" value={form?.values?.email ?? ''} aria-invalid={!!form?.errors?.email} aria-describedby={form?.errors?.email ? 'email-error' : undefined} />
		{#if form?.errors?.email}<p class="field-error" id="email-error">{form.errors.email}</p>{/if}
		<label for="password">Passwort</label>
		<input class="text-input" id="password" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="1024" aria-invalid={!!form?.errors?.password} aria-describedby="password-hint" />
		<p class="field-error" id="password-hint">{form?.errors?.password ?? 'Mindestens 8 Zeichen.'}</p>
		<label for="passwordRepeat">Passwort wiederholen</label>
		<input class="text-input" id="passwordRepeat" name="passwordRepeat" type="password" autocomplete="new-password" required minlength="8" maxlength="1024" aria-invalid={!!form?.errors?.passwordRepeat} aria-describedby={form?.errors?.passwordRepeat ? 'repeat-error' : undefined} />
		{#if form?.errors?.passwordRepeat}<p class="field-error" id="repeat-error">{form.errors.passwordRepeat}</p>{/if}
		{#if form?.message}<p role="alert">{form.message}</p>{/if}
		<button class="button" disabled={saving}>{saving ? 'Konto wird erstellt …' : 'Konto erstellen'}</button>
	</form>
	<p><a href={`/login?ziel=${encodeURIComponent(data.target)}`}>Bereits ein Konto? Anmelden</a></p>
</div>
