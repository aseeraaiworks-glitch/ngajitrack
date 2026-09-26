import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {schedulerLab} from './scheduler-lab.mjs';
import {root} from './local-sandbox.mjs';
import {makeFixture} from '../tests/fixture.mjs';
const s=await schedulerLab({through:'20260923000600'});let passed=0;
const check=async(name,fn)=>{await fn();console.log('PASS '+name);passed++;};
const apply=async file=>{await s.query('begin');try{await s.query(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));await s.query('commit');}catch(e){await s.query('rollback');throw e;}};
let f;
async function as(name,sql,args=[]){const c=await s.connect();try{await c.query('set session authorization authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[f.users[name]]);return await c.query(sql,args);}finally{await c.end();}}
const denied=(name,sql,args=[],code='23514')=>assert.rejects(as(name,sql,args),e=>e.code===code);
try{
 f=await makeFixture(s);
 const legacy6=(await s.query('select row_to_json(e) value from public.institution_enrollments e order by id')).rows;
 await apply('20260924000700_temporary_enrollments.sql');
 await check('native data upgrade 6 to 7 preserves old columns and defaults to REGULAR',async()=>{
 const rows=(await s.query("select to_jsonb(e)-'enrollment_type'-'scheduled_end_at'-'reason' value from public.institution_enrollments e order by id")).rows;
 assert.deepEqual(rows,legacy6);assert.equal((await s.query("select count(*)::int n from public.institution_enrollments where enrollment_type<>'REGULAR'")).rows[0].n,0);
 });
 await s.query("update public.institution_enrollments set enrollment_type='HOLIDAY',scheduled_end_at=current_date+30 where id=$1",[f.ie.b1.id]);
 const ended=await f.insert('institution_enrollments',{institution_id:f.institutions.B,student_id:f.students.b2.id,status:'ENDED',enrollment_type:'TEMPORARY',started_at:'2020-01-01',scheduled_end_at:'2020-02-01'});
 const before=(await s.query('select row_to_json(e) value from public.institution_enrollments e order by id')).rows;
 await apply('20260925000800_expiry_scheduler.sql');
 await s.query("select cron.alter_job(jobid,active:=false) from cron.job");
 await apply('20260925000900_enrollment_approvals.sql');
 await apply('20260925001000_verified_provisioning.sql');
 await apply('20260926001100_academic_governance.sql');
 await check('native upgrade preserves every existing enrollment including ENDED',async()=>assert.deepEqual((await s.query('select row_to_json(e) value from public.institution_enrollments e order by id')).rows,before));
 await check('legacy ACTIVE exception audited once, no invented decisions',async()=>{assert.equal((await s.query('select count(*)::int n from private.enrollment_legacy_exceptions')).rows[0].n,1);assert.equal((await s.query("select count(*)::int n from public.audit_logs where action='LEGACY_APPROVAL_EXCEPTION'")).rows[0].n,1);assert.equal((await s.query('select count(*)::int n from private.enrollment_approval_decisions')).rows[0].n,0);});
 await check('legacy access remains valid; edits/reset cannot bypass new approvals',async()=>{assert.equal((await s.query('select private.enrollment_operational($1) ok',[f.ie.b1.id])).rows[0].ok,true);await denied('adminB',"update public.institution_enrollments set scheduled_end_at=scheduled_end_at+1 where id=$1",[f.ie.b1.id]);await denied('adminB',"update public.institution_enrollments set status='PENDING' where id=$1",[f.ie.b1.id]);});
 await check('legacy exception cannot authorize a new record in the same program',async()=>{
  await as('adminB',"update public.program_enrollments set status='ENDED' where id=$1",[f.pe.b1.id]);
  await assert.rejects(f.insert('program_enrollments',{institution_id:f.institutions.B,institution_enrollment_id:f.ie.b1.id,student_id:f.students.b1.id,program_id:f.programs.b.id,status:'ACTIVE'}),err=>err.code==='23514');
 });
 await as('adminB','select public.end_institution_enrollment($1)',[f.ie.b1.id]);
 const e=await f.insert('institution_enrollments',{institution_id:f.institutions.B,student_id:f.students.b1.id,status:'PENDING',enrollment_type:'HOLIDAY',started_at:'2020-01-01',scheduled_end_at:'2099-01-01',previous_institution_id:f.institutions.A});
 await check('new temporary defaults to verified guardian; direct activation blocked',()=>denied('adminB',"update public.institution_enrollments set status='ACTIVE' where id=$1",[e.id]));
 let request=(await as('adminB','select public.request_enrollment_approval($1) id',[e.id])).rows[0].id;
 await check('default mask WALI; unrelated admin cannot approve',async()=>{assert.equal((await s.query('select requirements from private.enrollment_approval_requests where id=$1',[request])).rows[0].requirements,1);await denied('adminA','select public.decide_enrollment_approval($1,$2,true)',[request,'WALI'],'42501');});
 await check('guardian sees minimum request projection, cannot read destination records',async()=>{assert.equal((await as('guardian','select * from public.my_enrollment_approval_requests()')).rows.length,1);assert.equal((await as('guardian','select id from public.institution_enrollments where id=$1',[e.id])).rows.length,0);await denied('guardian','select * from private.enrollment_approval_requests',[],'42501');});
 await as('guardian',"select public.decide_enrollment_approval($1,'WALI',true)",[request]);
 await check('pending date change invalidates approval even when date is restored',async()=>{await as('adminB',"update public.institution_enrollments set scheduled_end_at='2098-01-01' where id=$1",[e.id]);await as('adminB',"update public.institution_enrollments set scheduled_end_at='2099-01-01' where id=$1",[e.id]);await denied('adminB',"update public.institution_enrollments set status='ACTIVE' where id=$1",[e.id]);});
 request=(await as('adminB','select public.request_enrollment_approval($1) id',[e.id])).rows[0].id;
 await as('guardian',"select public.decide_enrollment_approval($1,'WALI',true)",[request]);
 await check('valid approval enables activation without changing original institution',async()=>{await as('adminB',"update public.institution_enrollments set status='ACTIVE' where id=$1",[e.id]);assert.equal((await s.query('select status from public.institution_enrollments where id=$1',[f.ie.a1.id])).rows[0].status,'ACTIVE');});
 await check('program cannot weaken institution default; explicit NONE authorized only',async()=>{await denied('adminB',"select public.set_enrollment_approval_policy($1,'NONE',$2)",[f.institutions.B,f.programs.b.id]);await denied('guardian',"select public.set_enrollment_approval_policy($1,'NONE')",[f.institutions.B],'42501');await as('adminB',"select public.set_enrollment_approval_policy($1,'WALI+LEMBAGA_A',$2)",[f.institutions.B,f.programs.b.id]);});
 const pr=(await as('adminB','select public.request_enrollment_approval($1,$2) id',[e.id,f.programs.b.id])).rows[0].id;
 await check('program requires both approvals; verified source admin distinct from destination',async()=>{await denied('adminB',"select public.decide_enrollment_approval($1,'LEMBAGA_A',true)",[pr],'42501');await as('adminA',"select public.decide_enrollment_approval($1,'LEMBAGA_A',true)",[pr]);await assert.rejects(f.insert('program_enrollments',{institution_id:f.institutions.B,institution_enrollment_id:e.id,student_id:f.students.b1.id,program_id:f.programs.b.id,status:'ACTIVE'}),err=>err.code==='23514');await as('guardian',"select public.decide_enrollment_approval($1,'WALI',true)",[pr]);await f.insert('program_enrollments',{institution_id:f.institutions.B,institution_enrollment_id:e.id,student_id:f.students.b1.id,program_id:f.programs.b.id,status:'ACTIVE'});});
 await check('authorized closure preserves other role memberships',async()=>{const m=(await s.query('select row_to_json(m) j from public.institution_members m order by id')).rows;await as('adminB','select public.end_institution_enrollment($1)',[e.id]);assert.deepEqual((await s.query('select row_to_json(m) j from public.institution_members m order by id')).rows,m);});
 await check('NONE explicit requires an audited destination request',async()=>{
  await as('adminB',"select public.set_enrollment_approval_policy($1,'NONE')",[f.institutions.B]);
  const n=await f.insert('institution_enrollments',{institution_id:f.institutions.B,student_id:f.students.b1.id,status:'PENDING',enrollment_type:'TEMPORARY',started_at:'2020-01-01',scheduled_end_at:'2099-01-01'});
  await denied('adminB',"update public.institution_enrollments set status='ACTIVE' where id=$1",[n.id]);
  await as('adminB','select public.request_enrollment_approval($1)',[n.id]);
  await as('adminB',"update public.institution_enrollments set status='ACTIVE' where id=$1",[n.id]);
  await as('adminB','select public.end_institution_enrollment($1)',[n.id]);
 });
 await as('adminB',"select public.set_enrollment_approval_policy($1,'WALI')",[f.institutions.B]);
 const n=await f.insert('institution_enrollments',{institution_id:f.institutions.B,student_id:f.students.b1.id,status:'PENDING',enrollment_type:'TEMPORARY',started_at:'2020-01-01',scheduled_end_at:'2099-01-01',previous_institution_id:f.institutions.A});
 let nr=(await as('adminB','select public.request_enrollment_approval($1) id',[n.id])).rows[0].id;
 await check('rejection prevents activation; cancellation permits a fresh request',async()=>{
  await as('guardian',"select public.decide_enrollment_approval($1,'WALI',false)",[nr]);await denied('adminB',"update public.institution_enrollments set status='ACTIVE' where id=$1",[n.id]);
  await as('adminB','select public.cancel_enrollment_approval($1)',[nr]);nr=(await as('adminB','select public.request_enrollment_approval($1) id',[n.id])).rows[0].id;
 });
 await as('guardian',"select public.decide_enrollment_approval($1,'WALI',true)",[nr]);
 await check('guardian revocation before activation invalidates approval authority',async()=>{
  await s.query("update public.guardian_students set status='REVOKED' where id=$1",[f.links.verified.id]);await denied('adminB',"update public.institution_enrollments set status='ACTIVE' where id=$1",[n.id]);
  await s.query("update public.guardian_students set status='VERIFIED',verified_by=$2 where id=$1",[f.links.verified.id,f.profiles.adminA]);
 });
 await check('tightened policy cannot be bypassed by old pending approval',async()=>{
  await as('adminB',"select public.set_enrollment_approval_policy($1,'WALI+LEMBAGA_A')",[f.institutions.B]);await denied('adminB',"update public.institution_enrollments set status='ACTIVE' where id=$1",[n.id]);
  await as('adminB','select public.cancel_enrollment_approval($1)',[nr]);nr=(await as('adminB','select public.request_enrollment_approval($1) id',[n.id])).rows[0].id;
  await as('guardian',"select public.decide_enrollment_approval($1,'WALI',true)",[nr]);await as('adminA',"select public.decide_enrollment_approval($1,'LEMBAGA_A',true)",[nr]);
  await as('adminB',"update public.institution_enrollments set status='ACTIVE' where id=$1",[n.id]);
 });
 await check('active context is immutable and revocation requires authorized closure',async()=>{
  await denied('adminB',"update public.institution_enrollments set previous_institution_id=null where id=$1",[n.id]);await denied('adminB','select public.cancel_enrollment_approval($1)',[nr]);
  await denied('adminA','select public.end_institution_enrollment($1)',[n.id],'42501');await as('adminB','select public.end_institution_enrollment($1)',[n.id]);
 });
 await check('late scheduler closes expired PENDING without approval; retry is no-op',async()=>{
  const expired=await f.insert('institution_enrollments',{institution_id:f.institutions.B,student_id:f.students.b1.id,status:'PENDING',enrollment_type:'HOLIDAY',started_at:'2020-01-01',scheduled_end_at:'2020-02-01'});
  assert.equal((await s.query('select private.enrollment_operational($1) ok',[expired.id])).rows[0].ok,false);
  const c=await s.connect();try{await c.query('set session authorization ngt_expiry_scheduler');assert.equal((await c.query('select public.expire_institution_enrollments(500) n')).rows[0].n,1);assert.equal((await c.query('select public.expire_institution_enrollments(500) n')).rows[0].n,0);}finally{await c.end();}
 });
 await check('scheduler remains expiry-only and workflow tables deny client access',async()=>{
  const funcs=(await s.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and has_function_privilege('ngt_expiry_scheduler',p.oid,'EXECUTE')")).rows;assert.deepEqual(funcs,[{proname:'expire_institution_enrollments'}]);
  await denied('adminB','select * from private.provisioning_invitations',[],'42501');
 });
 console.log(`${passed}/${passed} native approval upgrade checks passed`);
}finally{await s.close();}
