const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const DB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/transitops';
const BACKUP_DIR = path.join(__dirname, '../backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);

console.log(`Starting automated backup to ${backupPath}...`);

// Use mongodump to backup the database
exec(`mongodump --uri="${DB_URI}" --out="${backupPath}"`, (err, stdout, stderr) => {
  if (err) {
    console.error(`Backup failed: ${err.message}`);
    return;
  }
  console.log(`Backup completed successfully at ${timestamp}!`);
});
