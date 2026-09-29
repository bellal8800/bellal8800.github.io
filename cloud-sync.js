/* Cloud compatibility + reliable in-app file opening. */
(function(){
  let tries=0;

  async function getCloudClient(){
    for(let i=0;i<40&&!window.supabase;i++)await new Promise(r=>setTimeout(r,250));
    if(!window.supabase?.createClient)throw new Error('Supabase library unavailable');
    const src=await fetch('./supabase-cloud.js',{cache:'no-store'}).then(r=>r.text());
    const um=src.match(/const SUPABASE_URL\\s*=\\s*['"]([^'"]+)['"]/);
    const oldU=src.match(/const U\\s*=\\s*['"]([^'"]+)['"]/);
    const km=src.match(/const K\\s*=\\s*String\\.fromCharCode\\(([^)]+)\\)/);
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
        if(objectPath)f.objectPath=objectPath;
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
      saveData();
    }catch(e){console.warn('Cloud compatibility repair skipped',e)}
  }

  function closeViewer(){
    const box=document.getElementById('fileViewer');
    if(!box)return;
    if(box.dataset.url)URL.revokeObjectURL(box.dataset.url);
    box.remove();
  }

  async function openInViewer(id){
    const file=(window.data?.files||[]).find(f=>f.id===id);
    if(!file||file.trashed)return;
    try{
      let blob=null;
      if(file.objectPath){
        try{
          const sb=await getCloudClient();
          const s=await sb.auth.getSession();
          if(s.data.session?.user){
            const d=await sb.storage.from('documents').download(file.objectPath);
            if(!d.error&&d.data)blob=d.data;
          }
        }catch(e){console.warn('Cloud download fallback',e)}
      }
      if(!blob)blob=await window.getBlob(id);
      if(!blob)throw new Error('File not found');

      closeViewer();
      const url=URL.createObjectURL(blob);
      const box=document.createElement('div');
      box.id='fileViewer';
      box.dataset.url=url;
      box.style.cssText='position:fixed;inset:0;z-index:20000;background:#111;display:flex;flex-direction:column;';
      const bar=document.createElement('div');
      bar.style.cssText='height:58px;min-height:58px;display:flex;align-items:center;gap:12px;padding:0 14px;background:#1c1c1e;color:#fff;box-sizing:border-box;';
      const close=document.createElement('button');
      close.textContent='×';
      close.style.cssText='width:40px;height:40px;border:0;border-radius:50%;background:#3a3a3c;color:#fff;font-size:28px;';
      close.onclick=closeViewer;
      const title=document.createElement('div');
      title.textContent=file.name;
      title.style.cssText='font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      bar.append(close,title);
      const frame=document.createElement('iframe');
      frame.src=url;
      frame.setAttribute('allowfullscreen','');
      frame.style.cssText='border:0;width:100%;height:calc(100% - 58px);background:#fff;flex:1;';
      box.append(bar,frame);
      document.body.appendChild(box);
    }catch(e){
      console.error('Open file failed',e);
      if(typeof showToast==='function')showToast('File could not be opened');
    }
  }

  function patchOpen(){
    if(typeof window.getBlob!=='function')return false;
    window.openFile=function(id){
      const file=(window.data?.files||[]).find(f=>f.id===id);
      if(!file||file.trashed)return;
      if(/\\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)){
        if(typeof window.openImagePreviewDirect==='function')return window.openImagePreviewDirect(id);
      }
      return openInViewer(id);
    };
    return true;
  }

  function patchCloudSave(){
    const names=['uploadFile','confirmModal','moveFileToTrash','moveFolderToTrash','restoreFile','restoreFolder','permanentDeleteFile','permanentDeleteFolder','emptyTrash'];
    for(const name of names){
      const f=window[name];
      if(typeof f!=='function'||f.__cloudRepair)continue;
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