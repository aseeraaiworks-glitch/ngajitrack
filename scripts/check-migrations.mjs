import {createDatabase} from '../tests/database.mjs';
const db = await createDatabase();
console.log(await db.query('select version()'));
console.log(await db.query("select tablename,rowsecurity from pg_tables where schemaname='public' order by tablename"));
await db.close();
