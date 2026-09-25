import {spawnSync} from 'node:child_process';
if(!process.env.NGAJITRACK_TEST_DATABASE_URL) {
  console.error('Set NGAJITRACK_TEST_DATABASE_URL to an empty, migrated LOCAL Supabase database. No database URL was provided.');
  process.exit(1);
}
const result=spawnSync(process.execPath,['--test','--test-concurrency=1','tests/foundation.test.mjs','tests/enrollments.test.mjs'],{stdio:'inherit',env:process.env});
if(result.error){console.error(result.error.message);process.exit(1);}
process.exit(result.status??1);
