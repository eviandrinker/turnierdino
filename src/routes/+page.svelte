<script>
  let { data } = $props();
</script>

<h1>Turnierdino</h1>
<p>{data.dbOk ? 'Datenbank verbunden' : 'Keine Verbindung zur Datenbank'}</p>