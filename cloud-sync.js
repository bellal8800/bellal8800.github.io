(function(){
  let sb=null,user=null,busy=false;
  const toast=m=>{if(typeof showToast==='function')showToast(m)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function getClient(){
    for(let i=0;i<40&&!window.supabase;i++)await wait(250);
    if(!window.supabase?.createClient)throw new Error('Supabase library unavailable');
    const src=await fetch('./supabase-cloud.js',{cache:'no-store'}).then(r=>r.text());
    const url=(src.match(/SUPABASE_URL\s*=\s*['\"]([^'\"]+)/)||[])[1];
    const key=(src.match(/SUPABASE_KEY\s*=\s*['\"]([^'\"]+)/)||[])[1];
    if(!url||!key)throw new Error('Supabase configuration unavailable');
    return window.supabase.createClient(url,key);
  }
  async function cloudItems(){const r=await sb.from('document_items').select('*').order('created_at');if(r.error)throw r.error;return r.data||[]}
  async function cloudRow(x){const row={id:x.id,user_id:user.id,parent_id:x.parent||null,name:x.name,item_type:x.type==='file'?'file':'folder',mime_type:x.type==='file'?(x.type||'application/octet-stream'):null,size_bytes:x.size||null,object_path:x.objectPath||null,trashed:!!x.trashed,updated_at:new Date().toISOString()};const r=await sb.from('document_items').upsert(row);if(r.error)throw r.error}
  async function downloadToLocal(items){
    data.folders=items.filter(x=>x.item_type==='folder').map(x=>({id:x.id,name:x.name,parent:x.parent_id,trashed:!!x.trashed,trashedAt:x.updated_at}));
    data.files=items.filter(x=>x.item_type==='file').map(x=>({id:x.id,name:x.name,size:x.size_bytes||0,type:x.mime_type||'',parent:x.parent_id,trashed:!!x.trashed,trashedAt:x.updated_at,objectPath:x.object_path}));
    saveData();
    for(const f of data.files){if(f.trashed||!f.objectPath)continue;try{const d=await sb.storage.from('documents').download(f.objectPath);if(!d.error&&d.data)await saveBlob(f.id,d.data)}catch(e){console.warn('Cloud file download skipped',f.name,e)}}
    if(typeof render==='function')render();
  }
  async function uploadLocal(){
    for(const f of data.folders||[])await cloudRow(f);
    for(const f of data.files||[]){
      if(!f.objectPath){const blob=await getBlob(f.id);const path=user.id+'/'+f.id+'/'+f.name;const up=await sb.storage.from('documents').upload(path,blob,{upsert:true,contentType:f.type||'application/octet-stream'});if(up.error)throw up.error;f.objectPath=path}
      await cloudRow(f);
    }
    saveData();
  }
  async function reconcileDeleted(){
    const remote=await cloudItems();
    const localIds=new Set([...(data.folders||[]),...(data.files||[])].map(x=>x.id));
    for(const old of remote.filter(x=>!localIds.has(x.id))){
      if(old.item_type==='file'&&old.object_path){try{await sb.storage.from('documents').remove([old.object_path])}catch(e){console.warn('Storage delete skipped',e)}}
      const d=await sb.from('document_items').delete().eq('id',old.id);if(d.error)throw d.error;
    }
  }
  async function sync(){
    if(!sb||!user||busy)return;
    busy=true;
    try{
      const remote=await cloudItems();
      if(remote.length){await downloadToLocal(remote)}
      else{await uploadLocal();await reconcileDeleted();}
    }catch(e){console.error('Cloud sync error:',e);toast('Cloud sync failed')}
    finally{busy=false}
  }
  async function saveCurrent(){
    if(!sb||!user||busy)return;
    busy=true;
    try{await uploadLocal();await reconcileDeleted()}catch(e){console.error('Cloud save error:',e);toast('Cloud save failed')}finally{busy=false}
  }
  function hook(name){
    const original=window[name];if(typeof original!=='function'||original.__cloudHook)return;
    const wrapped=function(){const result=original.apply(this,arguments);Promise.resolve(result).then(()=>saveCurrent());return result};
    wrapped.__cloudHook=true;window[name]=wrapped;
  }
  async function boot(){
    try{
      sb=await getClient();
      const s=await sb.auth.getSession();user=s.data.session?.user||null;
      if(user)await sync();
      sb.auth.onAuthStateChange((event,session)=>{user=session?.user||null;if(user&&(event==='SIGNED_IN'||event==='INITIAL_SESSION'))setTimeout(sync,200)});
      ['confirmModal','moveFileToTrash','moveFolderToTrash','restoreFile','restoreFolder','permanentDeleteFile','permanentDeleteFolder','emptyTrash'].forEach(hook);
    }catch(e){console.error('Cloud sync boot error:',e)}
  }
  setTimeout(boot,500);
})();