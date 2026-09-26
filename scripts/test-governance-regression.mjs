import {runNode} from './local-sandbox.mjs';
const kind=process.argv[2];
if(!['concurrency','scheduler'].includes(kind))throw Error('Choose concurrency or scheduler');
await runNode(kind==='concurrency'?['--test','--test-concurrency=1','tests/concurrency.test.mjs']:['scripts/test-scheduler.mjs'],{NGAJITRACK_TEST_SCHEMA_VERSION:'11'});
