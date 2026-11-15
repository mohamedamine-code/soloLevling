// ABI probe: verifies better-sqlite3 loads inside Electron's Node runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app } = require('electron')
app.whenReady().then(() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    db.exec('CREATE TABLE probe (id INTEGER)')
    db.prepare('INSERT INTO probe VALUES (1)').run()
    const row = db.prepare('SELECT COUNT(*) AS n FROM probe').get()
    console.log('SQLITE_PROBE_OK rows=' + row.n)
    db.close()
  } catch (error) {
    console.error('SQLITE_PROBE_FAIL: ' + error.message)
  }
  app.quit()
})

