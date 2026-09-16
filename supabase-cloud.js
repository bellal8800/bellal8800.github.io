(function(){
  const SUPABASE_URL='https://iwtmfsuakyelsgkokphe.supabase.co';
  const SUPABASE_KEY='sb_publishable_awS_ldmk2iT_m3g3DqEcLQ_WAbnjUbi';
  let client=null,user=null;
  const q=id=>document.getElementById(id);
  function toast(m){if(typeof showToast==='function')showToast(m);else alert(m)}
  function setMsg(text,error=false){const el=q('cloudMsg');if(el){el.textContent=text;el.className='cloud-msg'+(error?' error':'')}}
  function addStyles(){const st=document.createElement('style');st.textContent='.cloud-status{font-size:11px;color:var(--secondary);margin:5px 18px 0;text-align:right}.cloud-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#8e8e93;margin-right:5px}.cloud-dot.on{background:#34c759}.cloud-modal{position:fixed;inset:0;z-index:5000;display:flex;align-items:flex-end;background:rgba(0,0,0,.35);backdrop-filter:blur(14px)}.cloud-sheet{width:100%;max-width:560px;margin:auto 0 0;padding:12px 18px max(24px,env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:var(--card);border:1px solid var(--line);animation:sheetUp .45s var(--ios18-spring)}.cloud-title{font-size:24px;font-weight:750;margin:8px 0 4px}.cloud-sub{color:var(--secondary);font-size:13px;margin-bottom:15px}.cloud-input{width:100%;height:50px;margin-top:9px;border:0;border-radius:14px;padding:0 14px;background:var(--gray);color:var(--text);outline:0;box-sizing:border-box}.cloud-btn{width:100%;height:50px;margin-top:9px;border:0;border-radius:14px;background:var(--blue);color:#fff;font-weight:700;cursor:pointer;touch-action:manipulation}.cloud-btn.secondary{background:var(--gray);color:var(--text)}.cloud-btn:disabled{opacity:.55}.cloud-msg{font-size:13px;line-height:1.4;margin-top:10px;color:var(--secondary);text-align:center;min-height:18px}.cloud-msg.error{color:#ff3b30}';document.head.appendChild(st)}
  function status(){let el=q('cloudStatus');if(!el){el=document.createElement('div');el.id='cloudStatus';el.className='cloud-status';const nav=document.querySelector('.navbar');if(nav)nav.appendChild(el)}el.innerHTML=user?'<span class="cloud-dot on"></span>Cloud connected':'<span class="cloud-dot"></span>Cloud not connected'}
  function openAuth(){
    if(q('cloudModal'))return;
    const box=document.createElement('div');box.id='cloudModal';box.className='cloud-modal';
    box.innerHTML='<div class="cloud-sheet" onclick="event.stopPropagation()"><div class="handle"></div><div class="cloud-title">☁️ Cloud Storage</div><div class="cloud-sub">Create an account to keep your documents across devices.</div><input id="cloudEmail" class="cloud-input" type="email" autocomplete="email" placeholder="Email address"><input id="cloudPassword" class="cloud-input" type="password" autocomplete="new-password" placeholder="Password (minimum 6 characters)"><button type="button" class="cloud-btn" id="cloudLoginBtn">Sign in</button><button type="button" class="cloud-btn secondary" id="cloudSignupBtn">Create account</button><div id="cloudMsg" class="cloud-msg">Loading cloud service…</div><button type="button" class="cloud-btn secondary" id="cloudCloseBtn">Close</button></div>';
    box.onclick=()=>box.remove();document.body.appendChild(box);
    q('cloudLoginBtn').addEventListener('click',function(){auth(false)});
    q('cloudSignupBtn').addEventListener('click',function(){auth(true)});
    q('cloudCloseBtn').addEventListener('click',function(){box.remove()});
    setMsg(client?'Ready. Enter email and password.':'Cloud service is loading…');
  }
  async function auth(signup){
    try{
      if(!client){setMsg('Cloud service is not ready. Refresh the page and try again.',true);toast('Cloud service is not ready');return}
      const email=(q('cloudEmail')?.value||'').trim(),password=q('cloudPassword')?.value||'';
      if(!email){setMsg('Enter your email address.',true);return}
      if(password.length<6){setMsg('Password must be at least 6 characters.',true);return}
      const btn=signup?q('cloudSignupBtn'):q('cloudLoginBtn');if(btn){btn.disabled=true;btn.textContent=signup?'Creating…':'Signing in…'}setMsg('Please wait…');
      const r=signup?await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname}}):await client.auth.signInWithPassword({email,password});
      if(r.error)throw r.error;
      if(signup&&!r.data.session){setMsg('Account created. Check your email for the confirmation link.');toast('Account created — check your email');return}
      user=r.data.session?.user||null;status();setMsg(signup?'Cloud account created successfully.':'Cloud connected.');toast(signup?'Cloud account created':'Cloud connected');setTimeout(()=>q('cloudModal')?.remove(),700);await syncDown();
    }catch(e){console.error('Supabase Auth error:',e);setMsg((e&&e.message)?e.message:'Account creation failed. Please try again.',true);toast((e&&e.message)?e.message:'Cloud account failed')}
    finally{const btn=signup?q('cloudSignupBtn'):q('cloudLoginBtn');if(btn){btn.disabled=false;btn.textContent=signup?'Create account':'Sign in'}}
  }
  async function init(){
    addStyles();
    try{
      if(window.supabase?.createClient){client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY)}else{await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=()=>reject(new Error('Could not load Supabase library'));document.head.appendChild(s)});if(!window.supabase?.createClient)throw new Error('Supabase library unavailable');client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY)}
      const s=await client.auth.getSession();user=s.data.session?.user||null;status();
      client.auth.onAuthStateChange(async(_event,session)=>{user=session?.user||null;status();if(user)await syncDown()});
      const nav=document.querySelector('.nav-actions');if(nav&&!q('cloudBtn')){const b=document.createElement('button');b.id='cloudBtn';b.className='circle-button';b.type='button';b.textContent='☁';b.title='Cloud Storage';b.addEventListener('click',openAuth);nav.prepend(b)}
      if(user)await syncDown();
    }catch(e){console.error('Supabase init error:',e);status()}
  }
  async function syncDown(){if(!user||!client)return;try{const r=await client.from('document_items').select('*').order('created_at');if(r.error)throw r.error;const items=r.data||[];if(!items.length)return;data.folders=items.filter(x=>x.item_type==='folder').map(x=>({id:x.id,name:x.name,parent:x.parent_id,trashed:x.trashed,trashedAt:x.updated_at}));data.files=items.filter(x=>x.item_type==='file').map(x=>({id:x.id,name:x.name,size:x.size_bytes||0,type:x.mime_type||'',parent:x.parent_id,trashed:x.trashed,trashedAt:x.updated_at,objectPath:x.object_path}));saveData();for(const f of data.files){if(f.trashed||!f.objectPath)continue;const d=await client.storage.from('documents').download(f.objectPath);if(!d.error&&d.data)await saveBlob(f.id,d.data)}if(typeof render==='function')render()}catch(e){console.error(e)}}
  async function cloudMeta(item){if(!user||!client)return;const row={id:item.id,user_id:user.id,parent_id:item.parent||null,name:item.name,item_type:item.type==='file'?'file':'folder',mime_type:item.type==='file'?(item.mime_type||item.type||'application/octet-stream'):null,size_bytes:item.size||null,object_path:item.objectPath||null,trashed:!!item.trashed,updated_at:new Date().toISOString()};const r=await client.from('document_items').upsert(row);if(r.error)console.error(r.error)}
  window.uploadFile=async function(){if(!user){openAuth();return}const input=document.createElement('input');input.type='file';input.accept='.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,image/*';input.multiple=true;input.onchange=async()=>{const files=Array.from(input.files||[]);if(!files.length)return;const parent=currentPath.length?currentPath[currentPath.length-1]:null;let count=0;try{for(const file of files){const id=makeId(),path=user.id+'/'+id+'/'+file.name;const up=await client.storage.from('documents').upload(path,file,{upsert:true,contentType:file.type||'application/octet-stream'});if(up.error)throw up.error;await saveBlob(id,file);const item={id,name:file.name,size:file.size,type:file.type,parent,objectPath:path,trashed:false};data.files.push(item);await cloudMeta(item);count++}saveData();render();toast(count+(count===1?' file':' files')+' uploaded to cloud')}catch(e){console.error(e);toast(e.message||'Cloud upload failed')}};input.click()};
  const wrap=(name,after)=>{const orig=window[name];if(typeof orig!=='function')return;window[name]=function(){const r=orig.apply(this,arguments);Promise.resolve(r).then(()=>after()).catch(()=>{});return r}};
  wrap('createFolder',async()=>{if(!user)return;const latest=data.folders[data.folders.length-1];if(latest)await cloudMeta(latest)});
  wrap('renameFolder',async()=>{if(!user)return;const f=data.folders.find(x=>x.id===selectedFolderId);if(f)await cloudMeta(f)});
  wrap('moveFileToTrash',async(id)=>{if(!user)return;const f=data.files.find(x=>x.id===id);if(f)await cloudMeta(f)});
  wrap('moveFolderToTrash',async()=>{if(!user)return;for(const x of [...data.folders.filter(x=>x.trashed),...data.files.filter(x=>x.trashed)])await cloudMeta(x)});
  window.openCloudAuth=openAuth;init();
})();