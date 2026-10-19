// Loaded before every test file (see the "test" script). The tests create and delete rows and even drop database
// connections, so they must never run against a real, shared or production database by accident.
import 'dotenv/config';

const url = process.env.DATABASE_URL ?? '';
let host = '';
try {
  host = new URL(url).hostname;
} catch {
  /* an unreadable URL is reported by the app itself */
}
const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);

if (host && !local && process.env.ALLOW_REMOTE_TEST_DB !== 'true') {
  console.error(
    `\nRefusing to run the tests: DATABASE_URL points at "${host}", which is not this computer.\n` +
      'The tests create and delete data, so run them against a local database:\n' +
      '  docker compose up -d      (then use postgres://jobflow:jobflow@localhost:5432/jobflow in server/.env)\n' +
      'If you really mean to use that database, set ALLOW_REMOTE_TEST_DB=true.\n',
  );
  process.exit(1);
}
