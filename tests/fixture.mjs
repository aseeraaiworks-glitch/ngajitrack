import {randomUUID} from 'node:crypto';
export async function makeFixture(db,{authUsers=null}={}) {
  const f={users:{},profiles:{},institutions:{},students:{},identities:{},programs:{},groups:{},teachers:{},guardians:{},links:{},ie:{},pe:{},gm:{},assignments:{}};
  const insert=async(table,data)=>{
    const keys=Object.keys(data);
    return (await db.query(`insert into public.${table} (${keys.join(',')}) values (${keys.map((_,i)=>`$${i+1}`).join(',')}) returning *`,Object.values(data))).rows[0];
  };
  for(const name of ['super','adminA','adminB','teacher','unassigned','guardian','student','student2','outsider']) {
    if(authUsers) {
      if(!authUsers[name]) throw new Error(`Missing real Auth fixture user: ${name}`);
      f.users[name]=authUsers[name];
    } else {
      f.users[name]=randomUUID();
      await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[f.users[name],JSON.stringify({full_name:`Fixture ${name}`,role:'SUPER_ADMIN'})]);
    }
    f.profiles[name]=(await db.query('select id from public.profiles where auth_user_id=$1',[f.users[name]])).rows[0].id;
  }
  await insert('platform_roles',{profile_id:f.profiles.super,role_code:'SUPER_ADMIN'});
  for(const key of ['A','B']) {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[f.users.super]);
    await db.exec('set role authenticated');
    f.institutions[key]=(await db.query('select public.create_institution($1,$2,$3,$4) id',[`FIXTURE_${key}`,`Lembaga Uji ${key}`,'TPQ',f.profiles[`admin${key}`]])).rows[0].id;
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
  }
  f.member = async(name,tenant,code)=>insert('institution_members',{
    institution_id:f.institutions[tenant],profile_id:f.profiles[name],
    role_id:(await db.query('select id from public.roles where code=$1',[code])).rows[0].id,
    status:'ACTIVE',joined_at:'2020-01-01T00:00:00Z'
  });
  for(const [name,tenant,role] of [['teacher','A','TEACHER'],['teacher','B','GUARDIAN'],['unassigned','A','TEACHER'],['guardian','A','GUARDIAN'],['student','A','STUDENT'],['student','B','STUDENT'],['student2','A','STUDENT'],['adminA','A','TEACHER']]) await f.member(name,tenant,role);
  for(const name of ['teacher','unassigned']) f.teachers[name]=await insert('teacher_profiles',{institution_id:f.institutions.A,profile_id:f.profiles[name],teacher_public_id:`T-${name}`,status:'ACTIVE'});
  f.guardians.A=await insert('guardian_profiles',{institution_id:f.institutions.A,profile_id:f.profiles.guardian,guardian_public_id:'G-A',status:'ACTIVE'});
  f.guardians.B=await insert('guardian_profiles',{institution_id:f.institutions.B,profile_id:f.profiles.teacher,guardian_public_id:'G-B',status:'ACTIVE'});
  f.guardians.pending=await insert('guardian_profiles',{institution_id:f.institutions.A,guardian_public_id:'G-NO-LOGIN',status:'PENDING'});
  for(const name of ['student','student2']) f.identities[name]=await insert('student_identities',{ngajitrack_student_id:`NGT-FIXTURE-${name}`,profile_id:f.profiles[name],full_name_canonical:`Global ${name}`,status:'ACTIVE'});
  for(const [key,tenant,identity] of [['a1','A','student'],['a2','A','student2'],['b1','B','student'],['b2','B',null]]) {
    f.students[key]=await insert('student_profiles',{institution_id:f.institutions[tenant],student_identity_id:identity?f.identities[identity].id:null,institution_student_id:key,display_name:`Santri ${key}`,status:'ACTIVE'});
    f.ie[key]=await insert('institution_enrollments',{institution_id:f.institutions[tenant],student_id:f.students[key].id,status:'ACTIVE',started_at:'2020-01-01'});
  }
  for(const [key,tenant,type] of [['a','A','TAHFIZ'],['aOther','A','QURAN_READING'],['b','B','CUSTOM']]) {
    f.programs[key]=await insert('programs',{institution_id:f.institutions[tenant],name:`Program ${key}`,program_type_id:(await db.query('select id from public.program_types where code=$1',[type])).rows[0].id});
  }
  for(const [key,tenant,program] of [['a1','A','a'],['a2','A','a'],['aOther','A','aOther'],['b','B','b']]) f.groups[key]=await insert('groups',{institution_id:f.institutions[tenant],program_id:f.programs[program].id,name:`Kelas ${key}`,status:'ACTIVE'});
  for(const [key,student,tenant,program,group] of [['a1','a1','A','a','a1'],['a2','a2','A','a','a2'],['aOther','a1','A','aOther','aOther'],['b1','b1','B','b','b'],['b2','b2','B','b','b']]) {
    f.pe[key]=await insert('program_enrollments',{institution_id:f.institutions[tenant],institution_enrollment_id:f.ie[student].id,student_id:f.students[student].id,program_id:f.programs[program].id,status:'ACTIVE',enrolled_at:'2020-01-01'});
    f.gm[key]=await insert('group_memberships',{institution_id:f.institutions[tenant],program_enrollment_id:f.pe[key].id,student_id:f.students[student].id,program_id:f.programs[program].id,group_id:f.groups[group].id,status:'ACTIVE',started_at:'2020-01-01T00:00:00Z'});
  }
  f.assignments.teacher=await insert('teacher_assignments',{institution_id:f.institutions.A,teacher_id:f.teachers.teacher.id,program_id:f.programs.a.id,group_id:f.groups.a1.id});
  f.links.verified=await insert('guardian_students',{institution_id:f.institutions.A,guardian_id:f.guardians.A.id,student_id:f.students.a1.id,status:'VERIFIED',verified_by:f.profiles.adminA});
  f.links.pending=await insert('guardian_students',{institution_id:f.institutions.A,guardian_id:f.guardians.A.id,student_id:f.students.a2.id,status:'PENDING'});
  f.links.B=await insert('guardian_students',{institution_id:f.institutions.B,guardian_id:f.guardians.B.id,student_id:f.students.b2.id,status:'VERIFIED',verified_by:f.profiles.adminB});
  f.insert=insert;
  return f;
}
