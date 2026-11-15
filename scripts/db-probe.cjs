/* eslint-disable @typescript-eslint/no-require-imports -- plain CJS diagnostic script */
// One-off probe: verify migration state of the live app database.
const path = require('node:path')
const { app } = require('electron')
const Database = require('better-sqlite3')

app.whenReady().then(() => {
  const file = path.join(process.env.APPDATA ?? '', 'soloLeving', 'sololeving.db')
  const db = new Database(file)
  console.log('DB file:', file)
  console.log('Integrity:', db.pragma('integrity_check', { simple: true }))
  console.log('Tables:', db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((row) => row.name)
    .join(', '))
  const mig = db.prepare('SELECT * FROM schema_migrations ORDER BY version').all()
  console.log('Migrations:', JSON.stringify(mig))
  db.close()
  app.quit()
}).catch((error) => {
  console.error('PROBE_FAILED:', error.message)
  app.exit(1)
})
