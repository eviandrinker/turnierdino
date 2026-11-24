# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@1.7.0 create --template minimal --no-types --add playwright="demo:no" --install npm turnierdino
```

## Adding features

Add features to your project with `sv add`:

```sh
npx sv add
```

For example, to add Tailwind CSS:

```sh
npx sv add tailwindcss
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Deployment (Netlify)

Das Projekt verwendet `@sveltejs/adapter-netlify`. Die Build-Einstellungen stehen in `netlify.toml`
(Build-Befehl `npm run build`, Publish-Ordner `build`, Node 22). Die App läuft als Node-basierte
Netlify Function.

In Netlify unter **Site configuration → Environment variables** setzen:

| Variable  | Beschreibung                                                                  |
| --------- | ----------------------------------------------------------------------------- |
| `DB_URI`  | MongoDB-Verbindungs-URI, z. B. `mongodb+srv://BENUTZER:PASSWORT@CLUSTER.mongodb.net/` |
| `DB_NAME` | Name der Datenbank                                                            |

Hinweise:

- Die Variablen werden beim Start der Function gelesen (nicht beim Build eingebaut). Nach einer
  Änderung genügt ein erneutes Deploy, der Code muss nicht angepasst werden.
- Fehlt eine der Variablen, startet die App mit einer Fehlermeldung.
- Für Anmeldungen und Spielpläne werden MongoDB-Transaktionen genutzt; die Datenbank muss daher
  ein Replica Set sein (bei MongoDB Atlas automatisch der Fall).
- In MongoDB Atlas unter **Network Access** den Zugriff für Netlify erlauben (Netlify hat keine
  festen IP-Adressen, daher in der Regel `0.0.0.0/0` mit starkem Passwort).
