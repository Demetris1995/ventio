import 'dotenv/config';
import { Client } from 'pg';

const url = process.env.DATABASE_URL ?? 'postgres://ventio:ventio@127.0.0.1:55432/ventio';

(async () => {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const r = await client.query('select current_user, current_database()');
    console.log('OK ->', r.rows[0]);
  } catch (e) {
    console.error('FAIL ->', e);
  } finally {
    await client.end();
  }
})();
