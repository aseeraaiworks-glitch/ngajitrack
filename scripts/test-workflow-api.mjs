import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {setTimeout} from 'node:timers/promises';
import {schedulerLab} from './scheduler-lab.mjs';
import {authApiLab} from './auth-api-lab.mjs';
import {root} from './local-sandbox.mjs';
import {makeFixture} from '../tests/fixture.mjs';
const s=await schedulerLab();let api,passed=0;const sessions={},authUsers={};
const check=async(name,fn)=>{await fn();console.log('PASS '+name);passed++;};
async function request(base,path,{token,body,method=body?'POST':'GET',status=200}={}){
 const response=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),Prefer:'return=representation'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 const value=await response.json().catch(()=>null);
 assert.equal(response.status,status,`HTTP ${method} ${path.split('?')[0]}: code=${value?.code??value?.error_code??'none'}`);return value;
}
const rest=(who,path,options={})=>request(api.rest,path,{token:sessions[who]?.access_token,...options});
const rpc=(who,name,body,status=200)=>rest(who,'/rpc/'+name,{body,status});
try{
 api=await authApiLab(s);
 for(const who of ['super','adminA','adminB','teacher','unassigned','guardian','student','student2','outsider']){
  const credentials={email:`${who.toLowerCase()}-${randomBytes(6).toString('hex')}@example.test`,password:randomBytes(24).toString('hex'),data:{full_name:who,role:'SUPER_ADMIN'}};
  const signed=await request(api.auth,'/signup',{body:credentials});authUsers[who]=signed.user.id;
  sessions[who]=await request(api.auth,'/token?grant_type=password',{body:{email:credentials.email,password:credentials.password}});
 }
 const f=await makeFixture(s,{authUsers});
 for(const file of ['20260925000800_expiry_scheduler.sql','20260925000900_enrollment_approvals.sql','20260925001000_verified_provisioning.sql','20260926001100_academic_governance.sql']){
  await s.query('begin');try{await s.query(await readFile(new URL('supabase/migrations/'+file,root),'utf8'));await s.query('commit');}catch(e){await s.query('rollback');throw e;}
 }
 await s.query("select cron.alter_job(jobid,active:=false) from cron.job; notify pgrst,'reload schema'");await setTimeout(1200);
 await check('real Auth password JWT validates and metadata grants no admin',async()=>{const user=await request(api.auth,'/user',{token:sessions.outsider.access_token});assert.equal(user.id,authUsers.outsider);assert.deepEqual(await rest('outsider','/institution_members'),[]);});
 await check('anonymous and forged JWT rejected',async()=>{await rest(null,'/institution_enrollments',{status:401});await request(api.rest,'/institution_enrollments',{token:'invalid.jwt.token',status:401});});
 await check('cross-tenant API reads and updates remain isolated',async()=>{assert.deepEqual(await rest('adminA',`/student_profiles?id=eq.${f.students.b1.id}`),[]);assert.deepEqual(await rest('adminA',`/student_profiles?id=eq.${f.students.b1.id}`,{method:'PATCH',body:{display_name:'forbidden'}}),[]);});
 await rpc('adminB','end_institution_enrollment',{enrollment_id:f.ie.b1.id},204);
 const e=(await rest('adminB','/institution_enrollments',{body:{institution_id:f.institutions.B,student_id:f.students.b1.id,enrollment_type:'HOLIDAY',status:'PENDING',started_at:'2020-01-01',scheduled_end_at:'2099-01-01',previous_institution_id:f.institutions.A},status:201}))[0];
 await check('direct API activation cannot bypass approval guard',()=>rest('adminB',`/institution_enrollments?id=eq.${e.id}`,{method:'PATCH',body:{status:'ACTIVE'},status:400}));
 const req=await rpc('adminB','request_enrollment_approval',{enrollment_id:e.id});
 await check('guardian minimal RPC projection does not grant foreign history access',async()=>{const rows=await rpc('guardian','my_enrollment_approval_requests',{});assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]).sort(),['request_id','enrollment_id','student_name','destination_name','source_name','program_name','started_at','scheduled_end_at','requirements'].sort());assert.deepEqual(await rest('guardian',`/institution_enrollments?id=eq.${e.id}`),[]);});
 await check('unrelated role cannot approve; valid guardian decision is idempotent',async()=>{await rpc('teacher','decide_enrollment_approval',{request_id:req,party:'WALI',approved:true},403);await rpc('guardian','decide_enrollment_approval',{request_id:req,party:'WALI',approved:true},204);await rpc('guardian','decide_enrollment_approval',{request_id:req,party:'WALI',approved:true},204);});
 await check('approved activation succeeds through PostgREST',async()=>{const rows=await rest('adminB',`/institution_enrollments?id=eq.${e.id}`,{method:'PATCH',body:{status:'ACTIVE'}});assert.equal(rows[0].status,'ACTIVE');});
 await check('clients cannot issue invitations, link global identity, or invoke scheduler',async()=>{await rpc('adminB','issue_verified_invitation',{tenant_id:f.institutions.B,recipient_profile_id:f.profiles.outsider,role_code:'TEACHER',authorized_by:f.profiles.adminB,verification_reference:'synthetic'},403);await rpc('adminB','link_verified_student_identity',{identity_id:f.identities.student.id,profile_id:f.profiles.outsider,verification_reference:'synthetic'},403);await rpc('adminB','expire_institution_enrollments',{batch_size:500},403);});
 async function server(sql,args=[]){const c=await s.connect();try{await c.query('set session authorization service_role');return await c.query(sql,args);}finally{await c.end();}}
 async function issue(who,role){const result=await server('select public.issue_verified_invitation($1,$2,$3,$4,$5) invitation',[f.institutions.B,f.profiles[who],role,f.profiles.adminB,'Synthetic verified ownership test']);return result.rows[0].invitation;}
 const invite=await issue('guardian','TEACHER');
 await check('token binds recipient; wrong account cannot consume',()=>rpc('outsider','accept_provisioning_invitation',{token:invite.token},403));
 await check('single-use token provisions teacher atomically and preserves guardian context',async()=>{const accepted=await rpc('guardian','accept_provisioning_invitation',{token:invite.token});assert.equal(accepted.role_code,'TEACHER');await rpc('guardian','accept_provisioning_invitation',{token:invite.token},403);const institutions=await rpc('guardian','my_institutions',{});assert.equal(institutions.length,2);});
 await check('second role same institution is independent, never grants ADMIN',async()=>{const i=await issue('guardian','GUARDIAN');await rpc('guardian','accept_provisioning_invitation',{token:i.token});const rows=await rest('guardian','/institution_members?select=role_id,institution_id');assert.equal(rows.filter(x=>x.institution_id===f.institutions.B).length,2);await rpc('guardian','set_enrollment_approval_policy',{tenant_id:f.institutions.B,requirements:'NONE'},403);});
 await check('expired/revoked invitations fail without provisioning',async()=>{const i=await issue('outsider','TEACHER');await s.query('update private.provisioning_invitations set expires_at=now()-interval \'1 second\' where id=$1',[i.invitation_id]);await rpc('outsider','accept_provisioning_invitation',{token:i.token},403);const j=await issue('outsider','TEACHER');await rpc('adminB','revoke_provisioning_invitation',{invitation_id:j.invitation_id},204);await rpc('outsider','accept_provisioning_invitation',{token:j.token},403);assert.deepEqual(await rest('outsider','/institution_members'),[]);});
 await check('concurrent duplicate redemption succeeds exactly once',async()=>{const i=await issue('outsider','GUARDIAN');const responses=await Promise.all([1,2].map(()=>fetch(api.rest+'/rpc/accept_provisioning_invitation',{method:'POST',headers:{Authorization:'Bearer '+sessions.outsider.access_token,'Content-Type':'application/json'},body:JSON.stringify({token:i.token})})));assert.deepEqual(responses.map(x=>x.status).sort(),[200,403]);assert.equal((await s.query("select count(*)::int n from public.audit_logs where action='ACCEPT_INVITATION' and entity_id=$1",[i.invitation_id])).rows[0].n,1);});
 await check('student linking reuses identity/account and cannot replace its owner',async()=>{
  await assert.rejects(server('select public.link_verified_student_identity($1,$2,$3)',[f.identities.student.id,f.profiles.outsider,'synthetic']),e=>e.code==='23514');
  const before=(await s.query('select count(*)::int n from public.student_identities')).rows[0].n;
  const local=await f.insert('student_profiles',{institution_id:f.institutions.B,display_name:'Existing account student2',status:'ACTIVE'});
  const i=(await server('select public.issue_verified_invitation($1,$2,$3,$4,$5,$6,$7) invitation',[f.institutions.B,f.profiles.student2,'STUDENT',f.profiles.adminB,'verified synthetic identity',local.id,f.identities.student2.id])).rows[0].invitation;
  await rpc('student2','accept_provisioning_invitation',{token:i.token});
  assert.equal((await s.query('select student_identity_id from public.student_profiles where id=$1',[local.id])).rows[0].student_identity_id,f.identities.student2.id);
  assert.equal((await s.query('select count(*)::int n from public.student_identities')).rows[0].n,before);
 });
 await check('nullable guardian activates through fixed invitation binding',async()=>{
  const i=(await server('select public.issue_verified_invitation($1,$2,$3,$4,$5,null,null,$6) invitation',[f.institutions.A,f.profiles.outsider,'GUARDIAN',f.profiles.adminA,'verified synthetic guardian',f.guardians.pending.id])).rows[0].invitation;
  await rpc('outsider','accept_provisioning_invitation',{token:i.token});
  assert.equal((await s.query('select profile_id from public.guardian_profiles where id=$1',[f.guardians.pending.id])).rows[0].profile_id,f.profiles.outsider);
 });
 await check('provisioning failure rolls back membership, token consumption and audit',async()=>{
  const i=await issue('student','TEACHER');
  await s.query("create function private.test_provisioning_failure() returns trigger language plpgsql as $$begin raise exception 'Synthetic rollback failure' using errcode='23514'; end$$; create trigger test_provisioning_failure before insert on public.teacher_profiles for each row execute function private.test_provisioning_failure()");
  const before=(await s.query('select count(*)::int n from public.institution_members')).rows[0].n;
  await rpc('student','accept_provisioning_invitation',{token:i.token},400);
  assert.equal((await s.query('select count(*)::int n from public.institution_members')).rows[0].n,before);
  assert.equal((await s.query('select consumed_at from private.provisioning_invitations where id=$1',[i.invitation_id])).rows[0].consumed_at,null);
  assert.equal((await s.query("select count(*)::int n from public.audit_logs where entity_id=$1 and action='ACCEPT_INVITATION'",[i.invitation_id])).rows[0].n,0);
  await s.query('drop trigger test_provisioning_failure on public.teacher_profiles; drop function private.test_provisioning_failure()');
  await rpc('student','accept_provisioning_invitation',{token:i.token});
 });
 await check('three contextual roles still do not imply admin privileges',async()=>{
  const i=await issue('student','GUARDIAN');await rpc('student','accept_provisioning_invitation',{token:i.token});
  const rows=await rest('student','/institution_members?select=role_id,institution_id');assert.equal(rows.filter(x=>x.institution_id===f.institutions.B).length,3);
  await rpc('student','set_enrollment_approval_policy',{tenant_id:f.institutions.B,requirements:'NONE'},403);
 });
 await check('refresh and logout use real Auth; disabled profile loses data access',async()=>{
  const fresh=await request(api.auth,'/token?grant_type=refresh_token',{body:{refresh_token:sessions.outsider.refresh_token}});
  assert.equal(typeof fresh.access_token,'string');await request(api.auth,'/logout',{method:'POST',token:fresh.access_token,status:204});
  await s.query('update public.profiles set is_active=false where id=$1',[f.profiles.outsider]);assert.deepEqual(await rest('outsider','/institution_members'),[]);
 });
 await s.query('update public.profiles set is_active=true where id=$1',[f.profiles.outsider]);
 const governance=await rpc('adminA','request_mudir_case',{tenant_id:f.institutions.A,recipient_profile_id:f.profiles.outsider,purpose:'ONBOARDING',reason:'Synthetic verified institutional onboarding'});
 await check('HTTP governance requires platform verification before leadership issuance',async()=>{
  await rpc('adminA','invite_leadership',{tenant_id:f.institutions.A,recipient_profile_id:f.profiles.outsider,role_code:'MUDIR',case_id:governance},403);
  await rpc('adminA','verify_mudir_case',{case_id:governance,evidence_reference:'self-assertion'},403);
  await rpc('super','verify_mudir_case',{case_id:governance,evidence_reference:'synthetic institutional verification'},204);
 });
 const leader=await rpc('adminA','invite_leadership',{tenant_id:f.institutions.A,recipient_profile_id:f.profiles.outsider,role_code:'MUDIR',case_id:governance});
 await check('leadership snapshot cannot be changed or consumed by another recipient over API',async()=>{
  await rpc('guardian','accept_provisioning_invitation',{token:leader.token},403);
  await rpc('outsider','accept_provisioning_invitation',{token:leader.token,role_code:'INSTITUTION_ADMIN'},404);
  await rpc('outsider','accept_provisioning_invitation',{token:leader.token});
  await rpc('outsider','accept_provisioning_invitation',{token:leader.token},403);
 });
 await check('Mudir JWT gains institution monitoring, no CRUD or approval bypass',async()=>{
  assert.equal((await rest('outsider',`/programs?institution_id=eq.${f.institutions.A}`)).length,2);
  assert.deepEqual(await rest('outsider',`/programs?institution_id=eq.${f.institutions.B}`),[]);
  assert.deepEqual(await rest('outsider',`/programs?id=eq.${f.programs.a.id}`,{method:'PATCH',body:{name:'unauthorized'}}),[]);
  await rpc('outsider','decide_enrollment_approval',{request_id:req,party:'WALI',approved:true},403);
  await rpc('outsider','decide_enrollment_approval',{request_id:req,party:'LEMBAGA_A',approved:true},403);
  await rpc('outsider','set_enrollment_approval_policy',{tenant_id:f.institutions.A,requirements:'NONE'},403);
 });
 const deputy=await rpc('outsider','invite_leadership',{tenant_id:f.institutions.A,recipient_profile_id:f.profiles.guardian,role_code:'WAKIL_MUDIR',program_ids:[f.programs.a.id]});
 await rpc('guardian','accept_provisioning_invitation',{token:deputy.token});
 await check('multi-role guardian deputy sees monitoring only in assigned program',async()=>{
  assert.equal((await rpc('guardian','monitor_students',{tenant_id:f.institutions.A,program_id:f.programs.a.id})).length,2);
  assert.deepEqual(await rpc('guardian','monitor_students',{tenant_id:f.institutions.A,program_id:f.programs.aOther.id}),[]);
  assert.deepEqual(await rpc('guardian','monitor_students',{tenant_id:f.institutions.B,program_id:f.programs.b.id}),[]);
  await rpc('guardian','invite_leadership',{tenant_id:f.institutions.A,recipient_profile_id:f.profiles.student,role_code:'WAKIL_MUDIR'},403);
 });
 await check('revoked leadership scope stops API access without removing guardian role',async()=>{
  const scopes=await rpc('guardian','my_leadership_scopes',{});
  await rpc('outsider','revoke_leadership_scope',{scope_id:scopes[0].scope_id},204);
  assert.deepEqual(await rpc('guardian','monitor_students',{tenant_id:f.institutions.A,program_id:f.programs.a.id}),[]);
  assert.ok((await rest('guardian','/guardian_profiles')).length>0);
 });
 await check('academic API relation is tenant-safe and historical group cannot be relabeled',async()=>{
  const level=(await rest('adminA','/institution_levels',{body:{institution_id:f.institutions.A,code:'MI',name:'MI'},status:201}))[0];
  const pl=(await rest('adminA','/program_levels',{body:{institution_id:f.institutions.A,program_id:f.programs.a.id,level_id:level.id},status:201}))[0];
  await rest('adminB','/program_levels',{body:{institution_id:f.institutions.B,program_id:f.programs.b.id,level_id:level.id},status:409});
  await rest('adminA',`/groups?id=eq.${f.groups.a1.id}`,{method:'PATCH',body:{program_level_id:pl.id},status:400});
  assert.deepEqual(await rest('adminB',`/institution_levels?id=eq.${level.id}`),[]);
 });
 console.log(`${passed}/${passed} real Auth/JWT/API workflow checks passed`);
}finally{if(api)await api.close();await s.close();}
