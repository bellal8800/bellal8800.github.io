(function(){
  const SUPABASE_URL='https://iwtmfsuakyelsgkokphe.supabase.co';
  const SUPABASE_KEY='sb_publishable_awS_ldmk2iT_m3g3DqEcLQ_WAbnjUbi';
  const ready=new Promise((resolve,reject)=>{
    if(window.supabase){resolve(window.supabase);return}
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload=()=>resolve(window.supabase);
    s.onerror=()=>reject(new Error('Supabase library failed to load'));
    document.head.appendChild(s);
  });
  let client=null, user=null;
  const q=(id)=>document.getElementById(id);
  function toast(m){ if(typeof showToast==='function')showToast(m); else console.log(m); }
  function addStyles(){
    const st=document.createElement('style');st.textContent=`
      .cloud-status{font-size:11px;color:var(--secondary);margin:5px 18px 0;text-align:right}
      .cloud-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#8e8e93;margin-right:5px}.cloud-dot.on{background:#34c759}
      .cloud-modal{position:fixed;inset:0;z-index:5000;display:flex;align-items:flex-end;background:rgba(0,0,0,.35);backdrop-filter:blur(14px)}
      .cloud-sheet{width:100%;max-width:560px;margin:auto 0 0;padding:12px 18px max(24px,env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:var(--card);border:1px solid var(--line);animation:sheetUp .45s var(--ios18-spring)}
      .cloud-title{font-size:24px;font-weight:750;margin:8px 0 4px}.cloud-sub{color:var(--secondary);font-size:13px;margin-bottom:15px}
      .cloud-input{width:100%;height:50px;margin-top:9px;border:0;border-radius:14px;padding:0 14px;background:var(--gray);color:var(--text);outline:0}
      .cloud-btn{width:100%;height:50px;margin-top:9px;border-radius:14px;background:var(--blue);color:#fff;font-weight:700}.cloud-btn.secondary{background:var(--gray);color:var(--text)}.cloud-link{display:block;text-align:center;margin:13px 0 0;color:var(--blue);font-size:14px}
    `;document.head.appendChild(st);
  }
  function status(){
    let el=q('cloudStatus'); if(!el){el=document.createElement('div');el.id='cloudStatus';el.className='cloud-status';const nav=document.querySelector('.navbar');if(nav)nav.appendChild(el)}
    el.innerHTML=user?'<span class="cloud-dot on"></span>Cloud connected':'<span class="cloud-dot"></span>Cloud not connected';
  }
  function openAuth(){
    if(q('cloudModal'))return;
    const box=document.createElement('div');box.id='cloudModal';box.className='cloud-modal';
    box.innerHTML=`<div class="cloud-sheet" onclick="event.stopPropagation()"><div class="handle"></div><div class="cloud-title">☁️ Cloud Storage</div><div class="cloud-sub">Use your Supabase account to keep files across devices.</div><input id="cloudEmail" class="cloud-input" type="email" placeholder="Email"><input id="cloudPassword" class="cloud-input" type="password" placeholder="Password"><button class="cloud-btn" id="cloudLoginBtn">Sign in</button><button class="cloud-btn secondary" id="cloudSignupBtn">Create account</button><button class="cloud-btn secondary" id="cloudCloseBtn">Close</button><a class="cloud-link" href="javascript:void(0)" id="cloudLogoutBtn">Sign out</a></div>`;
    box.onclick=()=>box.remove();document.body.appendChild(box);
    q('cloudLoginBtn').onclick=async()=>auth(false);q('cloudSignupBtn').onclick=async()=>auth(true);q('cloudCloseBtn').onclick=()=>box.remove();q('cloudLogoutBtn').onclick=async()=>{await client.auth.signOut();box.remove();toast('Signed out');};
  }
  async function auth(signup){
    const email=q('cloudEmail').value.trim(),password=q('cloudPassword').value;
    if(!email||password.length<6){toast('Enter email and a 6+ character password');return}
    try{const r=signup?await client.auth.signUp({email,password}):await client.auth.signInWithPassword({email,password});if(r.error)throw r.error;if(signup&&!r.data.session){toast('Check your email to confirm the account');return}toast(signup?'Cloud account created':'Cloud connected');q('cloudModal')?.remove();await syncDown();}catch(e){console.error(e);toast(e.message||'Cloud login failed')}
  }
  async function init(){
    addStyles();
    try{const S=await ready;client=S.createClient(SUPABASE_URL,SUPABASE_KEY);const s=await client.auth.getSession();user=s.data.session?.user||null;status();
      client.auth.onAuthStateChange(async(_event,session)=>{user=session?.user||null;status();if(user)await syncDown();});
      const nav=document.querySelector('.nav-actions');if(nav&&!q('cloudBtn')){const b=document.createElement('button');b.id='cloudBtn';b.className='circle-button';b.textContent='☁';b.title='Cloud Storage';b.onclick=openAuth;nav.prepend(b)}
      if(user)await syncDown();
    }catch(e){console.error(e);status();}
  }
  async function syncDown(){
    if(!user||!client)return;
    try{
      const {data:items,error}=await client.from('document_items').select('*').order('created_at');if(error)throw error;
      if(!items.length)return;
      data.folders=items.filter(x=>x.item_type==='folder').map(x=>({id:x.id,name:x.name,parent:x.parent_id,trashed:x.trashed,trashedAt:x.updated_at}));
      data.files=items.filter(x=>x.item_type==='file').map(x=>({id:x.id,name:x.name,size:x.size_bytes||0,type:x.mime_type||'',parent:x.parent_id,trashed:x.trashed,trashedAt:x.updated_at,objectPath:x.object_path}));
      saveData();
      for(const f of data.files){if(f.trashed||!f.objectPath)continue;const {data:blob,error}=await client.storage.from('documents').download(f.objectPath);if(!error&&blob)await saveBlob(f.id,blob);}
      if(typeof render==='function')render();
    }catch(e){console.error(e);toast('Cloud sync failed')}
  }
  async function cloudMeta(item){if(!user)return;const row={id:item.id,user_id:user.id,parent_id:item.parent||null,name:item.name,item_type:item.type==='file'?'file':'folder',mime_type:item.type==='file'?(item.mime_type||item.type||'application/octet-stream'):null,size_bytes:item.size||null,object_path:item.objectPath||null,trashed:!!item.trashed,updated_at:new Date().toISOString()};const {error}=await client.from('document_items').upsert(row);if(error)console.error(error)}
  window.uploadFile=async function(){
    if(!user){openAuth();return}
    const input=document.createElement('input');input.type='file';input.accept='.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,image/*';input.multiple=true;
    input.onchange=async()=>{const files=Array.from(input.files||[]);if(!files.length)return;const parent=currentPath.length?currentPath[currentPath.length-1]:null;let count=0;try{for(const file of files){const id=makeId(),path=user.id+'/'+id+'/'+file.name;const up=await client.storage.from('documents').upload(path,file,{upsert:true,contentType:file.type||'application/octet-stream'});if(up.error)throw up.error;await saveBlob(id,file);const item={id,name:file.name,size:file.size,type:file.type,parent,objectPath:path,trashed:false};data.files.push(item);await cloudMeta(item);count++}saveData();render();toast(count+(count===1?' file':' files')+' uploaded to cloud')}catch(e){console.error(e);toast(e.message||'Cloud upload failed')}};input.click();
  };
  const wrap=(name,after)=>{const orig=window[name];if(typeof orig!=='function')return;window[name]=function(){const r=orig.apply(this,arguments);Promise.resolve(r).then(()=>after()).catch(()=>{});return r}};
  wrap('createFolder',async()=>{if(!user)return;const latest=data.folders[data.folders.length-1];if(latest)await cloudMeta(latest)});
  wrap('renameFolder',async()=>{if(!user)return;const f=data.folders.find(x=>x.id===selectedFolderId);if(f)await cloudMeta(f)});
  wrap('moveFileToTrash',async(id)=>{if(!user)return;const f=data.files.find(x=>x.id===id);if(f)await cloudMeta(f)});
  wrap('moveFolderToTrash',async(id)=>{if(!user)return;const fs=data.folders.filter(x=>x.trashed);const ff=data.files.filter(x=>x.trashed);for(const x of [...fs,...ff])await cloudMeta(x)});
  window.openCloudAuth=openAuth;
  init();
})();
