// Docker Desktop may ignore a bridge's default host_binding_ipv4.
// Recreate only this project's published containers, preserving config and volumes.
import {execFileSync} from 'node:child_process';
import http from 'node:http';
import {setTimeout} from 'node:timers/promises';
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8'}).trim();
const host=docker('context','inspect','--format','{{.Endpoints.docker.Host}}');
if(host!=='npipe:////./pipe/dockerDesktopLinuxEngine') throw new Error('Expected local Docker Desktop Linux engine');
const socketPath='\\\\.\\pipe\\dockerDesktopLinuxEngine';
async function api(method,path,body) {
  return new Promise((resolve,reject)=>{
    const data=body===undefined?null:JSON.stringify(body);
    const req=http.request({socketPath,path,method,headers:data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{}},res=>{
      let output='';res.on('data',c=>output+=c);res.on('end',()=>{
        if(res.statusCode>=400) return reject(new Error(`Docker ${method} ${path} returned ${res.statusCode}`));
        resolve(output?JSON.parse(output):null);
      });
    });
    req.on('error',reject);req.end(data);
  });
}
const names=['db','kong','studio','inbucket','analytics'].map(s=>`supabase_${s}_ngajitrack`);
for(const name of names) {
  const c=JSON.parse(docker('inspect',name))[0];
  const bindings=c.HostConfig.PortBindings;
  if(!bindings || Object.values(bindings).every(v=>v.every(p=>p.HostIp==='127.0.0.1'))) continue;
  if(Object.keys(c.NetworkSettings.Networks).some(n=>n!=='ngajitrack-local')) throw new Error('Unexpected project network');
  if(c.Mounts.some(m=>m.Type==='volume' && !(c.HostConfig.Binds??[]).some(b=>b.startsWith(`${m.Name}:`)))) throw new Error('Unmapped volume: refusing recreation');
  for(const ports of Object.values(bindings)) for(const p of ports) p.HostIp='127.0.0.1';
  const endpoints=Object.fromEntries(Object.entries(c.NetworkSettings.Networks).map(([n,v])=>[n,{Aliases:(v.Aliases??[]).filter(a=>a!==c.Id.slice(0,12))}]));
  const backup=`${name}_port_backup`;
  // CLI copies generated TLS files into Kong's writable layer, not a volume.
  const kongFiles=name==='supabase_kong_ngajitrack'
    ?execFileSync('docker',['cp',`${name}:/home/kong/.`,'-'],{maxBuffer:16*1024*1024}):null;
  await api('POST',`/containers/${c.Id}/stop?t=30`);
  await api('POST',`/containers/${c.Id}/rename?name=${backup}`);
  let replacement;
  try {
    replacement=await api('POST',`/containers/create?name=${name}`,{...c.Config,HostConfig:c.HostConfig,NetworkingConfig:{EndpointsConfig:endpoints}});
    if(kongFiles) execFileSync('docker',['cp','-',`${replacement.Id}:/home/kong`],{input:kongFiles});
    await api('POST',`/containers/${replacement.Id}/start`);
    const deadline=Date.now()+60000;
    while(true) {
      const state=(await api('GET',`/containers/${replacement.Id}/json`)).State;
      if(state.Running && (!state.Health || state.Health.Status==='healthy')) break;
      if(Date.now()>=deadline) throw new Error(`${name}: replacement did not become healthy`);
      await setTimeout(1000);
    }
  } catch(error) {
    if(replacement) await api('DELETE',`/containers/${replacement.Id}?force=true`);
    await api('POST',`/containers/${c.Id}/rename?name=${name}`);
    await api('POST',`/containers/${c.Id}/start`);
    throw error;
  }
  // No volume deletion: both generations use the same named volumes.
  await api('DELETE',`/containers/${c.Id}`);
  console.log(`${name}: ports bound to 127.0.0.1`);
}
