import {readFile} from 'node:fs/promises';
import {schedulerLab} from './scheduler-lab.mjs';
import {root,runNode} from './local-sandbox.mjs';
const s=await schedulerLab();
try{
 for(const file of ['20260925000800_expiry_scheduler.sql','20260925000900_enrollment_approvals.sql','20260925001000_verified_provisioning.sql']){
  await s.query('begin');try{await s.query(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));await s.query('commit');}catch(e){await s.query('rollback');throw e;}
 }
 const url=new URL('postgresql://127.0.0.1/postgres');url.port=String(s.config.port);url.username=s.config.user;url.password=s.config.password;
 await runNode(['--test','--test-concurrency=1','tests/foundation.test.mjs'],{NGAJITRACK_TEST_DATABASE_URL:url.toString()});
}finally{await s.close();}
