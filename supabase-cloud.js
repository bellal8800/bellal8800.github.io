(function(){
const U='https://iwtmfsuakyelsgkokphe.supabase.co';
const K=String.fromCharCode(115,98,95,112,117,98,108,105,115,104,97,98,108,101,95,97,119,83,95,108,100,109,107,50,105,84,95,109,51,103,51,68,113,69,99,76,81,95,87,65,98,110,106,85,98,105);
let sb=null,user=null,busy=false;
const $=id=>document.getElementById(id);const toast=m=>typeof showToast==='function'&&showToast(m);const wait=ms=>new Promise(r=>setTimeout(r,ms));
function styles(){const s=document.createElement('style');s.textContent='.cloud-status{font-size:11px;color:var(--secondary);margin:5px 18px 0;text-align:right}.cloud-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#8e8e93;margin-right:5px}.cloud-dot.on{background:#34c759}.cloud-modal{position:fixed;inset:0;z-index:5000;display:flex;align-items:flex-end;background:rgba(0,0,0,.35);backdrop-filter:blur(14px)}.cloud-sheet{width:100%;max-width:560px;margin:auto 0 0;padding:12px 18px max(24px,env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:var(--card);border:1px solid var(--line);animation:sheetUp .45s var(--ios18-spring)}.cloud-title{font-size:24px;font-weight:750;margin:8px 0 4px}.cloud-sub{color:var(--secondary);font-size:13px;margin-bottom:15px}.cloud-input{width:100%;height:50px;margin-top:9px;border:0;border-radius:14px;padding:0 14px;background:var(--gray);color:var(--text);outline:0;box-sizing:border-box}.cloud-btn{width:100%;height:50px;margin-top:9px;border:0;border-radius:14px;background:var(--blue);color:#fff;font-weight:700}.cloud-btn.secondary{background:var(--gray);color:var(--text)}.cloud-btn:disabled{opacity:.55}.cloud-msg{font-size:13px;line-height:1.4;margin-top:10px;color:var(--secondary);text-align:center;min-height:18px}.cloud-msg.error{color:#ff3b30}';document.head.appendChild(s)}
function status(){let e=$('cloudStatus');if(!e){e=document.createElement('div');e.id='cloudStatus';e.className='cloud-status';const n=document.querySelector('.navbar');if(n)n.appendChild(e)}e.innerHTML=user?'<span class="cloud-dot on"></span>Cloud connected':'<span class="cloud-dot"></span>Cloud not connected'}
function authBox(){if($('cloudModal'))return;const b=document.createElement('div');b.id='cloudModal';b.className='cloud-modal';b.innerHTML='<div class="cloud-sheet" onclick="event.stopPropagation()"><div class="handle"></div><div class="cloud-title">☁️ Cloud Storage</div><div class="cloud-sub">Your documents can stay available across devices.</div><input id="cloudEmail" class="cloud-input" type="email" autocomplete="email" placeholder="Email address"><input id="cloudPassword" class="cloud-input" type="password" autocomplete="current-password" placeholder="Password (minimum 6 characters)"><button type="button" class="cloud-btn" id="cloudLogin">Sign in</button><button type="button" class="cloud-btn secondary" id="cloudSignup">Create account</button><div id="cloudMsg" class="cloud-msg">Ready.</div><button type="button" class="cloud-btn secondary" id="cloudClose">Close</button></div>';b.onclick=()=>b.remove();document.body.appendChild(b);$('cloudLogin').onclick=()=>login(false);$('cloudSignup').onclick=()=>login(true);$('cloudClose').onclick=()=>b.remove()}
async function login(signup){try{const email=($('cloudEmail')?.value||'').trim(),password=$('cloudPassword')?.value||'';if(!email){$('cloudMsg').textContent='Enter your email address.';return}if(password.length<6){$('cloudMsg').textContent='Password must be at least 6 characters.';return}const bt=signup?$('cloudSignup'):$('cloudLogin');bt.disabled=true;bt.textContent=signup?'Creating…':'Signing in…';const r=signup?await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await sb.auth.signInWithPassword({email,password});if(r.error)throw r.error;if(signup&&!r.data.session){$('cloudMsg').textContent='Account created. Check your email for confirmation.';toast('Check your email for confirmation');return}user=r.data.session?.user||null;status();$('cloudMsg').textContent='Cloud connected.';toast('Cloud connected');setTimeout(()=>$('cloudModal')?.remove(),500);await connect()}catch(e){console.error(e);$('cloudMsg').textContent=e?.message||'Cloud account failed.';$('cloudMsg').className='cloud-msg error';toast(e?.message||'Cloud account failed')}finally{const bt=signup?$('cloudSignup'):$('cloudLogin');if(bt){bt.disabled=false;bt.textContent=signup?'Create account':'Sign in'}}}
async function items(){const r=await sb.from('document_items').select('*').order('created_at');if(r.error)throw r.error;return r.data||[]}
async function row(x){const r=await sb.from('document_items').upsert({id:x.id,user_id:user.id,parent_id:x.parent||null,name:x.name,item_type:x.type==='file'?'file':'folder',mime_type:x.type==='file'?(x.type||'application/octet-stream'):null,size_bytes:x.size||null,object_path:x.objectPath||null,trashed:!!x.trashed,updated_at:new Date().toISOString()});if(r.error)throw r.error}
async function fromCloud(list){data.folders=list.filter(x=>x.item_type==='folder').map(x=>({id:x.id,name:x.name,parent:x.parent_id,trashed:!!x.trashed,trashedAt:x.updated_at}));data.files=list.filter(x=>x.item_type==='file').map(x=>({id:x.id,name:x.name,size:x.size_bytes||0,type:x.mime_type||'',parent:x.parent_id,trashed:!!x.trashed,trashedAt:x.updated_at,objectPath:x.object_path}));saveData();for(const f of data.files){if(f.trashed||!f.objectPath)continue;const d=await sb.storage.from('documents').download(f.objectPath);if(!d.error&&d.data)await saveBlob(f.id,d.data)}if(typeof render==='function')render()}
async function toCloud(){if(!user||busy)return;busy=true;try{for(const f of data.folders||[])await row(f);for(const f of data.files||[]){if(!f.objectPath){const blob=await getBlob(f.id),path=user.id+'/'+f.id+'/'+f.name;const up=await sb.storage.from('documents').upload(path,blob,{upsert:true,contentType:f.type||'application/octet-stream'});if(up.error)throw up.error;f.objectPath=path}await row(f)}saveData();const remote=await items(),ids=new Set([...(data.folders||[]),...(data.files||[])].map(x=>x.id));for(const old of remote.filter(x=>!ids.has(x.id))){if(old.item_type==='file'&&old.object_path)await sb.storage.from('documents').remove([old.object_path]);const d=await sb.from('document_items').delete().eq('id',old.id);if(d.error)throw d.error}}catch(e){console.error('Cloud save',e);toast('Cloud save failed')}finally{busy=false}}
async function connect(){if(!user)return;try{const list=await items();if(list.length)await fromCloud(list);else await toCloud();if(typeof render==='function')render()}catch(e){console.error('Cloud sync',e);toast('Cloud sync failed')}}
function hook(name){const f=window[name];if(typeof f!=='function'||f.__cloud)return;const w=function(){const r=f.apply(this,arguments);Promise.resolve(r).then(()=>toCloud());return r};w.__cloud=true;window[name]=w}
window.uploadFile=async function(){
  hideActionMenu();
  const input=document.createElement('input');
  input.type='file';
  input.accept='.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,image/*';
  input.multiple=true;
  input.onchange=async()=>{
    const fs=Array.from(input.files||[]);
    if(!fs.length)return;
    const parent=currentPath.length?currentPath[currentPath.length-1]:null;
    let localCount=0,cloudCount=0,cloudError=null;
    try{
      for(const file of fs){
        const id=makeId();
        await saveBlob(id,file);
        const item={id,name:file.name,size:file.size,type:file.type,parent,created:Date.now(),trashed:false};
        if(user){
          const path=user.id+'/'+id+'/'+file.name;
          const up=await sb.storage.from('documents').upload(path,file,{upsert:true,contentType:file.type||'application/octet-stream'});
          if(up.error){cloudError=up.error;data.files.push(item)}
          else{
            item.objectPath=path;
            await row(item);
            data.files.push(item);
            cloudCount++;
          }
        }else{
          data.files.push(item);
        }
        localCount++;
      }
      saveData();
      render();
      if(user&&cloudError){
        toast(localCount+' file'+(localCount===1?'':'s')+' saved locally; cloud upload failed: '+(cloudError.message||'unknown error'));
      }else if(user){
        toast(cloudCount+' file'+(cloudCount===1?'':'s')+' uploaded to cloud');
      }else{
        toast(localCount+' file'+(localCount===1?'':'s')+' uploaded');
      }
    }catch(e){
      console.error('Upload error',e);
      saveData();
      render();
      toast(e?.message||'Could not save file');
    }
  };
  input.click();
};
async function init(){styles();try{for(let i=0;i<40&&!window.supabase;i++)await wait(250);if(!window.supabase?.createClient)throw new Error('Supabase library unavailable');sb=window.supabase.createClient(U,K);const s=await sb.auth.getSession();user=s.data.session?.user||null;status();const n=document.querySelector('.nav-actions');if(n&&!$('cloudBtn')){const b=document.createElement('button');b.id='cloudBtn';b.className='circle-button';b.type='button';b.textContent='☁';b.title='Cloud Storage';b.onclick=authBox;n.prepend(b)}if(user)await connect();sb.auth.onAuthStateChange((event,session)=>{user=session?.user||null;status();if(user&&(event==='SIGNED_IN'||event==='INITIAL_SESSION'))setTimeout(connect,200)});['confirmModal','moveFileToTrash','moveFolderToTrash','restoreFile','restoreFolder','permanentDeleteFile','permanentDeleteFolder','emptyTrash'].forEach(hook)}catch(e){console.error('Supabase init',e);status()}}
window.openCloudAuth=authBox;init();
})();