import {sandbox,runNode} from './local-sandbox.mjs';
const test=await sandbox();
try{await runNode(['scripts/test-postgres.mjs'],{NGAJITRACK_TEST_DATABASE_URL:test.url.toString()});}
finally{await test.close();}
