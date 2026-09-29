/* Cloud compatibility + reliable file opening.
   supabase-cloud.js remains the primary cloud module.
*/
(function(){
  let tries=0;

  async function getCloudClient(){
    for(let i=0;i<40&&!window.supabase;i++)await new Promise(r=>setTimeout(r,250));
    if(!window.supabase?.createClient)throw new Error('Supabase library unavailable');
    const src=await fetch('./supabase-cloud.js',{cache:'no-store'}).then(r=>r.text());
    const um=src.match(/const SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
    const oldU=src.match(/const U\s*=\s*['"]([^'"]+)['"]/);
    const km=src.match(/const K\s*=\s*String\.fromCharCode\(([^)]+)\)/);
    const url=(um||oldU)?.[1];
    const key=km?String.fromCharCode(...km[1].split(',').map(x=>Number(x.trim()))):null;
    if(!url||!key)throw new Error('Supabase configuration unavailable');
    return window.supabase.createClient(url,key);
  }

  async function repairCloud(){
    if(!window.data?.files||typeof window.getBlob!=='function')return;
    try{
      const sb=await getCloudClient();
      const session=await sb.auth.getSession();
      const user=session.data.session?.user;
      if(!user)return;
      const q=await sb.from('document_items').select('*').eq('user_id',user.id);
      if(q.error)throw q.error;
      const rows=q.data||[];

      for(const f of window.data.files){
        if(f.trashed)continue;
        let row=rows.find(x=>x.id===f.id);
        if(!row&&f.objectPath)row=rows.find(x=>x.object_path===f.objectPath);
        if(!row)continue;
        const objectPath=f.objectPath||row.object_path||null;
        if(row.item_type!=='file'||row.mime_type!==(f.type||'application/octet-stream')||row.size_bytes!==(f.size||0)||row.object_path!==objectPath){
          const up=await sb.from('document_items').upsert({
            id:f.id,user_id:user.id,parent_id:f.parent||null,name:f.name,item_type:'file',
            mime_type:f.type||'application/octet-stream',size_bytes:f.size||0,
            object_path:objectPath,trashed:!!f.trashed,
            updated_at:new Date().toISOString()
          },{onConflict:'id'});
          if(up.error)console.warn('Cloud metadata repair failed',up.error);
        }
      }

      for(const row of rows.filter(x=>x.item_type==='file'&&x.object_path)){
        if(!window.data.files.some(f=>f.id===row.id))continue;
        try{
          const blob=await window.getBlob(row.id);
          if(blob)continue;
        }catch(e){}
        const d=await sb.storage.from('documents').download(row.object_path);
        if(!d.error&&d.data)await window.saveBlob(row.id,d.data);
      }
    }catch(e){console.warn('Cloud compatibility repair skipped',e)}
  }

  function patchOpen(){
    if(typeof window.getBlob!=='function')return false;

    window.openFile=async function(id){
      const file=(window.data?.files||[]).find(f=>f.id===id);
      if(!file||file.trashed)return;

      if(/\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)){
        if(typeof window.openImagePreviewDirect==='function')window.openImagePreviewDirect(id);
        return;
      }

      // Open the tab synchronously while the user's tap is still active.
      const tab=window.open('about:blank','_blank');
      try{
        const blob=await window.getBlob(id);
        if(!blob)throw new Error('File not found');
        const url=URL.createObjectURL(blob);

        if(tab&&!tab.closed){
          tab.location.replace(url);
          try{tab.document.title=file.name}catch(e){}
        }else{
          // Fallback for browsers that refuse the pre-opened tab.
          const a=document.createElement('a');
          a.href=url;
          a.target='_blank';
          a.rel='noopener';
          a.download='';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        setTimeout(()=>URL.revokeObjectURL(url),60000);
      }catch(e){
        console.error('Open file failed',e);
        if(tab&&!tab.closed)tab.close();
        if(typeof showToast==='function')showToast('File could not be opened');
      }
    };
    return true;
  }

  function patchCloudSave(){
    // Run repair after the primary cloud module has finished an upload/sync.
    const names=['uploadFile','confirmModal','moveFileToTrash','moveFolderToTrash','restoreFile','restoreFolder','permanentDeleteFile','permanentDeleteFolder','emptyTrash'];
    for(const name of names){
      const f=window[name];
      if(typeof f!=='function'||f.__cloudRepair)return;
      const w=function(){
        const result=f.apply(this,arguments);
        Promise.resolve(result).then(()=>repairCloud()).catch(()=>{});
        return result;
      };
      w.__cloudRepair=true;
      window[name]=w;
    }
  }

  const timer=setInterval(async()=>{
    tries++;
    const opened=patchOpen();
    patchCloudSave();
    if(opened&&tries>2){
      clearInterval(timer);
      await repairCloud();
    }else if(tries>40){
      clearInterval(timer);
    }
  },250);
})();