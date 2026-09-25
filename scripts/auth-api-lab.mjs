// Disposable Auth/PostgREST services against schedulerLab's independent database.
// Secrets are generated per run, passed through environment, never logged or saved.
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {setTimeout} from 'node:timers/promises';
export async function authApiLab(s){
 const name=s.name+'-api',containers=[];let network;
 const docker=(args,options={})=>{try{return execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024,...options});}catch{throw Error('Isolated API Docker operation failed (credentials redacted)');}};
 const stop=async()=>{for(const id of containers.reverse())docker(['rm','-f','-v',id]);if(network){docker(['network','disconnect',name,s.name]);docker(['network','rm',name]);}};
 try{
  network=docker(['network','create',name]).trim();docker(['network','connect',name,s.name]);
  const secret=randomBytes(48).toString('hex'),password=randomBytes(32).toString('hex');
  await s.query(`alter role authenticator login password '${password}'; grant anon,authenticated,service_role to authenticator; grant usage on schema public to anon,authenticated,service_role; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  const versions=docker(['exec','supabase_db_ngajitrack','pg_dump','-U','postgres','-d','postgres','--data-only','--table=auth.schema_migrations','--no-owner','--no-privileges']);
  docker(['exec','-i',s.name,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:versions});
  async function run(kind,port,env){
   const image=docker(['inspect',`supabase_${kind}_ngajitrack`,'--format','{{.Config.Image}}']).trim();
   const args=['run','-d','--network',name,'-p',`127.0.0.1::${port}`];for(const key of Object.keys(env))args.push('-e',key);
   const id=docker([...args,image],{env:{...process.env,...env}}).trim();containers.push(id);
   const publicPort=JSON.parse(docker(['inspect',id]))[0].NetworkSettings.Ports[`${port}/tcp`][0].HostPort;
   return `http://127.0.0.1:${publicPort}`;
  }
  const auth=await run('auth',9999,{
   GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:'http://127.0.0.1:9999',GOTRUE_SITE_URL:'http://localhost',
   GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_NAMESPACE:'auth',GOTRUE_DB_DATABASE_URL:`postgresql://postgres:${s.config.password}@${s.name}:5432/postgres?search_path=auth`,
   GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',
   GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_RATE_LIMIT_EMAIL_SENT:'1000'
  });
  const rest=await run('rest',3000,{PGRST_DB_URI:`postgresql://authenticator:${password}@${s.name}:5432/postgres`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret});
  for(const url of [auth+'/health',rest+'/']){let ready=false;for(let i=0;i<60;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await setTimeout(500);}if(!ready){for(const id of containers){const output=spawnSync('docker',['logs',id],{encoding:'utf8'});let logs=(output.stdout??'')+(output.stderr??'');for(const key of [secret,password,s.config.password])logs=logs.replaceAll(key,'[REDACTED]');console.log(logs.slice(-5000));}throw Error('Isolated Auth/PostgREST health check failed: '+url);}}
  return {auth,rest,close:stop};
 }catch(e){await stop();throw e;}
}
