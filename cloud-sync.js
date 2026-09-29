/* File opening compatibility patch.
   Supabase/cloud sync is handled by supabase-cloud.js.
   This patch keeps the existing UI but makes async file opening reliable on mobile browsers.
*/
(function(){
  function patch(){
    if(typeof window.getBlob!=='function'||typeof window.openImagePreviewDirect!=='function')return false;
    window.openFile=async function(id){
      const file=(window.data?.files||[]).find(f=>f.id===id);
      if(!file||file.trashed)return;
      if(/\\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)){
        window.openImagePreviewDirect(id);
        return;
      }
      const tab=window.open('about:blank','_blank');
      try{
        const blob=await window.getBlob(id);
        if(!blob)throw new Error('File not found');
        const url=URL.createObjectURL(blob);
        if(tab&&!tab.closed){
          tab.location.href=url;
          setTimeout(()=>URL.revokeObjectURL(url),60000);
        }else{
          const a=document.createElement('a');
          a.href=url;a.target='_blank';a.rel='noopener';
          document.body.appendChild(a);a.click();a.remove();
          setTimeout(()=>URL.revokeObjectURL(url),60000);
        }
      }catch(e){
        if(tab&&!tab.closed)tab.close();
        if(typeof showToast==='function')showToast('File not found');
      }
    };
    return true;
  }
  let tries=0;
  const timer=setInterval(()=>{if(patch()||++tries>40)clearInterval(timer)},250);
})();
