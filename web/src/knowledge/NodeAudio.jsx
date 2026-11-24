import { useEffect, useState } from 'react';
import { knowledgeApi } from './api.js';
import { cacheMedia, readLocal } from './local.js';
import { mediaUrl, speakLocally } from './media.js';

/** 原详情页的朗读能力归到解读区，保留所选音色、缓存与设备朗读回退。 */
export function NodeAudio({asset,language,preferences={},onToast}) {
  const [audio,setAudio]=useState(null),[loading,setLoading]=useState(false);
  const text=asset.explanations?.[language] || '';
  useEffect(()=>()=>{if(audio?.startsWith('blob:'))URL.revokeObjectURL(audio);},[audio]);

  /** 点击后才准备朗读，接口失败时使用设备朗读已保存的解读。 */
  async function play(){
    if(!preferences.voice&&speakLocally(text,language))return;
    setLoading(true);
    try{
      const result=await knowledgeApi(`/audio/${asset.key}`,{language});await cacheMedia(result.url);
      const blob=await readLocal('media',result.url);setAudio(blob?URL.createObjectURL(blob):mediaUrl(result.url));
    }catch(error){
      if(!speakLocally(text,language))onToast?.({type:'error',message:error.message});
      else onToast?.({type:'info',message:'使用设备朗读已保存的文字'});
    }finally{setLoading(false);}
  }

  return <div className="node-explanation-audio"><button className="btn" disabled={loading||!text} onClick={play}>{loading?'准备朗读…':'朗读解读'}</button>
    {audio&&<audio src={audio} controls autoPlay/>}</div>;
}
