// Integration-only: never falls back to PGlite or fabricates user JWTs.
// Writes synthetic fixtures to an EMPTY local database; does not reset/delete it.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,readdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {makeFixture} from '../tests/fixture.mjs';

const root=new URL('../',import.meta.url);
const report={started_at:new Date().toISOString(),status:'BLOCKED',engine:'Supabase Auth + PostgREST + native PostgreSQL',checks:[],fixtures_committed:false};
let client,phase='preflight';
const sessions={},credentials={},authUsers={};
const names=['super','adminA','adminB','teacher','unassigned','guardian','student','student2','outsider'];
const environment=process.env;
function localURL(value,port,protocol) {
  const u=new URL(value);
  if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname) || u.port!==port || u.protocol!==protocol)
    throw new Error('Only the project local disposable Supabase ports are allowed');
  return u;
}
async function check(name,run) {
  try {await run();report.checks.push({name,status:'PASS'});console.log(`PASS ${name}`);}
  catch(error) {report.checks.push({name,status:'FAIL',error:error.message});console.log(`FAIL ${name}`);}
}
try {
  for(const key of ['NGAJITRACK_TEST_API_URL','NGAJITRACK_TEST_DATABASE_URL','NGAJITRACK_TEST_ANON_KEY','NGAJITRACK_TEST_SERVICE_ROLE_KEY']) {
    if(!environment[key]) throw new Error(`Missing ${key}; start the local Supabase stack first`);
  }
  const api=localURL(environment.NGAJITRACK_TEST_API_URL,'54321','http:');
  const dbURL=localURL(environment.NGAJITRACK_TEST_DATABASE_URL,'54322','postgresql:');
  if(api.pathname!=='/' || api.search || api.hash || api.username || api.password || dbURL.pathname!=='/postgres')
    throw new Error('Unexpected local project endpoint');
  const anon=environment.NGAJITRACK_TEST_ANON_KEY,service=environment.NGAJITRACK_TEST_SERVICE_ROLE_KEY;
  async function request(path,{method='GET',body,token,key=anon,expected=[200]}={}) {
    const headers={apikey:key};
    if(token) headers.Authorization=`Bearer ${token}`;
    if(body!==undefined) headers['Content-Type']='application/json';
    if(path.startsWith('/rest/v1/')) headers.Prefer='return=representation';
    const response=await fetch(new URL(path,api),{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
    // Never print request/response bodies: Auth responses contain credentials.
    assert.ok(expected.includes(response.status),`${method} ${path.split('?')[0]} returned HTTP ${response.status}; expected ${expected.join('/')}`);
    const text=await response.text();
    return text?JSON.parse(text):null;
  }
  const rest=(name,path,options={})=>request(`/rest/v1/${path}`,{token:sessions[name]?.access_token,...options});
  const ids=async(name,table)=>(await rest(name,`${table}?select=id`)).map(x=>x.id).sort();
  await request('/auth/v1/health');
  client=new pg.Client({connectionString:dbURL.toString(),connectionTimeoutMillis:10000});
  await client.connect();
  const query=(sql,args=[])=>client.query(sql,args);
  const versions=(await query('select version from supabase_migrations.schema_migrations order by version')).rows.map(x=>x.version);
  const expectedVersions=(await readdir(new URL('supabase/migrations/',root))).filter(f=>f.endsWith('.sql')).sort().map(f=>f.split('_')[0]);
  assert.deepEqual(versions,expectedVersions,'Local migration history must match all project migrations');
  const counts=(await query('select (select count(*) from auth.users)::int users,(select count(*) from public.profiles)::int profiles,(select count(*) from public.institutions)::int institutions')).rows[0];
  assert.deepEqual(counts,{users:0,profiles:0,institutions:0},'Real API tests require an empty disposable local database; no automatic reset is performed');
  report.migrations=versions;
  report.postgresql=(await query('show server_version')).rows[0].server_version;
  phase='auth setup';
  const suffix=randomBytes(6).toString('hex');
  for(const name of names) {
    const credential={email:`ngt-${name.toLowerCase()}-${suffix}@example.test`,password:`Ngt!${randomBytes(24).toString('hex')}`};
    credentials[name]=credential;
    const user=await request('/auth/v1/admin/users',{method:'POST',key:service,token:service,body:{...credential,email_confirm:true,user_metadata:{full_name:`Fixture ${name}`,role:'SUPER_ADMIN'}}});
    assert.equal(typeof user.id,'string','Auth admin must return the new user ID');
    authUsers[name]=user.id;
    sessions[name]=await request('/auth/v1/token?grant_type=password',{method:'POST',body:credential});
    assert.equal(typeof sessions[name].access_token,'string','Password login must issue an access token');
  }
  phase='fixture setup';
  await query('begin');
  let f;
  try {
    f=await makeFixture({query,exec:sql=>query(sql)},{authUsers});
    f.multiLinks={};
    // Exact combined context: student A+B, guardian A+B, teacher B.
    for(const tenant of ['A','B']) {
      await f.member('student',tenant,'GUARDIAN');
      const gp=await f.insert('guardian_profiles',{institution_id:f.institutions[tenant],profile_id:f.profiles.student,guardian_public_id:`G-MULTI-${tenant}`,status:'ACTIVE'});
      f.multiLinks[tenant]=await f.insert('guardian_students',{institution_id:f.institutions[tenant],guardian_id:gp.id,student_id:f.students[tenant==='A'?'a2':'b2'].id,status:'VERIFIED',verified_by:f.profiles[`admin${tenant}`]});
    }
    await f.member('student','B','TEACHER');
    const teacher=await f.insert('teacher_profiles',{institution_id:f.institutions.B,profile_id:f.profiles.student,teacher_public_id:'T-MULTI-B',status:'ACTIVE'});
    f.multiAssignment=await f.insert('teacher_assignments',{institution_id:f.institutions.B,teacher_id:teacher.id,program_id:f.programs.b.id,group_id:f.groups.b.id});
    await query('commit');report.fixtures_committed=true;
  } catch(error) {await query('rollback');throw error;}
  phase='HTTP tests';
  await check('Auth login issues user JWT and Auth validates it',async()=>{
    for(const name of names) {
      const user=await request('/auth/v1/user',{token:sessions[name].access_token});
      assert.equal(user.id,authUsers[name]);
      const payload=JSON.parse(Buffer.from(sessions[name].access_token.split('.')[1],'base64url'));
      assert.equal(payload.sub,authUsers[name]);assert.equal(payload.role,'authenticated');
    }
  });
  await check('Auth trigger creates one profile and metadata does not grant admin',async()=>{
    for(const name of names) assert.deepEqual(await ids(name,'profiles'),[f.profiles[name]]);
    assert.deepEqual(await ids('outsider','platform_roles'),[]);
    assert.deepEqual(await ids('super','student_profiles'),[]);
  });
  await check('Wrong password and forged JWT are rejected',async()=>{
    await request('/auth/v1/token?grant_type=password',{method:'POST',body:{...credentials.student,password:'Incorrect!Password'},expected:[400]});
    const [header,payload]=sessions.student.access_token.split('.');
    await request('/rest/v1/profiles?select=id',{token:`${header}.${payload}.${Buffer.alloc(64).toString('base64url')}`,expected:[401]});
  });
  await check('Refresh token returns a usable user session',async()=>{
    sessions.student=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:sessions.student.refresh_token}});
    assert.deepEqual(await ids('student','profiles'),[f.profiles.student]);
  });
  await check('Anonymous table access is denied',async()=>{
    await request('/rest/v1/student_profiles?select=id',{expected:[401,403]});
  });
  await check('Admins read only their own tenant across all tenant tables',async()=>{
    for(const tenant of ['A','B']) for(const table of ['institution_members','student_profiles','teacher_profiles','guardian_profiles','guardian_students','programs','groups','institution_enrollments','program_enrollments','group_memberships','teacher_assignments','audit_logs']) {
      const data=await rest(`admin${tenant}`,`${table}?select=institution_id`);
      assert.ok(data.length>0,`${tenant} ${table} fixture missing`);
      assert.ok(data.every(r=>r.institution_id===f.institutions[tenant]),`${tenant} ${table} leaked rows`);
    }
  });
  await check('Cross-tenant API reads and writes cannot change another institution',async()=>{
    assert.deepEqual(await rest('adminA',`student_profiles?id=eq.${f.students.b1.id}&select=id`),[]);
    assert.deepEqual(await rest('adminA',`student_profiles?id=eq.${f.students.b1.id}`,{method:'PATCH',body:{display_name:'Forbidden'}}),[]);
    await rest('adminA','student_profiles',{method:'POST',body:{institution_id:f.institutions.B,display_name:'Forbidden'},expected:[403]});
    await rest('adminA','rpc/end_institution_enrollment',{method:'POST',body:{enrollment_id:f.ie.b1.id},expected:[403]});
  });
  await check('Teacher assignment and VERIFIED guardian relationships limit API scope',async()=>{
    assert.deepEqual(await ids('teacher','student_profiles'),[f.students.a1.id,f.students.b2.id].sort());
    assert.deepEqual(await ids('guardian','student_profiles'),[f.students.a1.id]);
    assert.deepEqual(await ids('unassigned','student_profiles'),[]);
    assert.deepEqual(await ids('student2','student_profiles'),[f.students.a2.id]);
  });
  await check('Student in A+B plus guardian A+B and teacher B reuse one identity',async()=>{
    assert.deepEqual(await ids('student','student_identities'),[f.identities.student.id]);
    assert.deepEqual(await ids('student','student_profiles'),Object.values(f.students).map(x=>x.id).sort());
    assert.equal((await rest('student','rpc/my_institutions',{method:'POST',body:{}})).length,2);
    await rest('student','rpc/end_institution_enrollment',{method:'POST',body:{enrollment_id:f.ie.b1.id},expected:[403]});
    await rest('student','institution_members',{method:'POST',body:{institution_id:f.institutions.B,profile_id:f.profiles.student,role_id:(await query("select id from public.roles where code='INSTITUTION_ADMIN'")).rows[0].id},expected:[403]});
  });
  await check('Identity binding and global directory remain protected over API',async()=>{
    assert.deepEqual(await ids('adminB','student_identities'),[]);
    await rest('adminB',`student_profiles?id=eq.${f.students.b1.id}`,{method:'PATCH',body:{student_identity_id:f.identities.student2.id},expected:[403]});
  });
  await check('Scheduled expiry denies teacher roster and class moves before worker runs',async()=>{
    const today=(await query('select private.institution_today($1)::text today',[f.institutions.A])).rows[0].today;
    await rest('adminA',`institution_enrollments?id=eq.${f.ie.a1.id}`,{method:'PATCH',body:{enrollment_type:'HOLIDAY',scheduled_end_at:today}});
    assert.deepEqual(await ids('teacher','student_profiles'),[f.students.b2.id]);
    await rest('adminA','rpc/move_student_group',{method:'POST',body:{enrollment_id:f.pe.a1.id,target_group_id:f.groups.a2.id},expected:[400]});
    assert.equal((await query('select status from public.institution_enrollments where id=$1',[f.ie.a1.id])).rows[0].status,'ACTIVE');
  });
  await check('Worker is service-only and preserves active guardian/teacher roles',async()=>{
    const today=(await query('select private.institution_today($1)::text today',[f.institutions.B])).rows[0].today;
    await rest('adminB',`institution_enrollments?id=eq.${f.ie.b1.id}`,{method:'PATCH',body:{enrollment_type:'TEMPORARY',scheduled_end_at:today}});
    await rest('student','rpc/expire_institution_enrollments',{method:'POST',body:{},expected:[401,403,404]});
    assert.equal(await request('/rest/v1/rpc/expire_institution_enrollments',{method:'POST',key:service,token:service,body:{}}),2);
    assert.equal(await request('/rest/v1/rpc/expire_institution_enrollments',{method:'POST',key:service,token:service,body:{}}),0);
    for(const key of ['a1','b1']) assert.equal((await rest('student',`institution_enrollments?id=eq.${f.ie[key].id}&select=status`))[0].status,'ENDED');
    const roles=await rest('student',`institution_members?institution_id=eq.${f.institutions.B}&select=status`);
    assert.equal(roles.length,3);assert.ok(roles.every(r=>r.status==='ACTIVE'));
    assert.ok((await ids('student','teacher_assignments')).length>0);
    assert.ok((await ids('student','student_profiles')).includes(f.students.b2.id));
  });
  await check('ENDED history cannot be reopened via API',async()=>{
    await rest('adminB',`institution_enrollments?id=eq.${f.ie.b1.id}`,{method:'PATCH',body:{status:'ACTIVE',ended_at:null},expected:[400]});
  });
  await check('Revoking guardian access does not revoke independent teacher access',async()=>{
    await rest('adminB',`guardian_students?id=eq.${f.multiLinks.B.id}`,{method:'PATCH',body:{status:'REVOKED'}});
    assert.ok((await ids('student','student_profiles')).includes(f.students.b2.id));
  });
  await check('Ending teacher assignment removes that scope while guardian A remains valid',async()=>{
    await rest('adminB',`teacher_assignments?id=eq.${f.multiAssignment.id}`,{method:'PATCH',body:{is_active:false}});
    assert.deepEqual(await ids('student','student_profiles'),[f.students.a1.id,f.students.a2.id,f.students.b1.id].sort());
  });
  await check('Disabling a profile immediately blocks API data despite an existing JWT',async()=>{
    await query('update public.profiles set is_active=false where id=$1',[f.profiles.student]);
    try {assert.deepEqual(await ids('student','student_profiles'),[]);assert.deepEqual(await ids('student','profiles'),[]);}
    finally {await query('update public.profiles set is_active=true where id=$1',[f.profiles.student]);}
  });
  await check('Logout invalidates the refresh session',async()=>{
    await request('/auth/v1/logout',{method:'POST',token:sessions.outsider.access_token,expected:[204]});
    await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:sessions.outsider.refresh_token},expected:[400,401]});
  });
  report.status=report.checks.some(c=>c.status==='FAIL')?'FAIL':'PASS';
} catch(error) {
  report.status=phase==='preflight'?'BLOCKED':'FAIL';
  // Avoid connection strings, request payloads and raw error objects in reports.
  report.error=error.code?`Phase ${phase}: ${error.code}`:error.message;
  console.error(`${report.status}: ${report.error}`);
} finally {
  if(client) await client.end().catch(()=>{});
  report.finished_at=new Date().toISOString();
  report.passed=report.checks.filter(c=>c.status==='PASS').length;
  report.failed=report.checks.filter(c=>c.status==='FAIL').length;
  await mkdir(new URL('reports/',root),{recursive:true});
  await writeFile(new URL('reports/local-api-test.json',root),JSON.stringify(report,null,2)+'\n');
  console.log(`API checks: ${report.passed} passed, ${report.failed} failed; status ${report.status}`);
  process.exitCode=report.status==='PASS'?0:report.status==='BLOCKED'?2:1;
}
