/* Compatibility + repair layer.
   supabase-cloud.js remains the primary cloud module.
   This file fixes legacy rows written with item_type=folder and makes mobile opening reliable.
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
        if(row.item_type!=='file'||row.mime_type!==f.type||row.size_bytes!==f.size||row.object_path!==f.objectPath){
          const up=await sb.from('document_items').upsert({
            id:f.id,user_id:user.id,parent_id:f.parent||null,name:f.name,item_type:'file',
            mime_type:f.type||'application/octet-stream',size_bytes:f.size||0,
            object_path:f.objectPath||row.object_path||null,trashed:!!f.trashed,
            updated_at:new Date().toISOString()
          },{onConflict:'id'});
          if(up.error)console.warn('Cloud metadata repair failed',up.error);
        }
      }
      // If the cloud row exists but the browser has no local blob, restore it.
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
    if(typeof window.getBlob!=='function'||typeof window.openImagePreviewDirect!=='function')return false;
    window.openFile=async function(id){
      const file=(window.data?.files||[]).find(f=>f.id===id);
      if(!file||file.trashed)return;
      if(/\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)){window.openImagePreviewDirect(id);return}
      const tab=window.open('about:blank','_blank');
      try{
        const blob=await window.getBlob(id);
        if(!blob)throw new Error('File not found');
        const url=URL.createObjectURL(blob);
        if(tab&&!tab.closed){tab.location.href=url}
        else{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove()}
        setTimeout(()=>URL.revokeObjectURL(url),60000);
      }catch(e){if(tab&&!tab.closed)tab.close();if(typeof showToast==='function')showToast('File not found')}
    };
    return true;
  }
  const timer=setInterval(async()=>{
    tries++;
    const ok=patchOpen();
    if(ok){clearInterval(timer);await repairCloud()}
    else if(tries>40)clearInterval(timer);
  },250);
})();
