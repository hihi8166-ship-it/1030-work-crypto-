"use strict";
// 해외 제공처별 메모리 캐시와 큐입니다. 기존 localStorage 키와 데이터를 변경하지 않습니다.
window.ForeignClient = class ForeignClient {
  constructor(id,base,gap){Object.assign(this,{id,base,gap});this.cache=new Map();this.pending=new Map();this.chain=Promise.resolve();this.blocked=0;}
  request(path,{ttl=300000,force=false,valid=()=>true}={}){
    const old=this.cache.get(path);if(!force&&old&&Date.now()-old.at<ttl)return Promise.resolve(old);
    if(this.pending.has(path))return this.pending.get(path).catch(error=>{if(error.name==="AbortError"&&valid())return this.request(path,{ttl,force,valid});throw error;});
    const perform=async()=>{
      if(!valid())throw new DOMException("이전 선택 취소","AbortError");
      if(Date.now()<this.blocked)throw new Error("해외 API 요청 제한 대기 중입니다. 잠시 후 재시도해 주세요.");
      // 잠금을 유지한 채 요청 전 간격을 둬 같은 출처의 다른 탭도 순차 처리합니다.
      await new Promise(resolve=>setTimeout(resolve,this.gap));
      if(!valid())throw new DOMException("이전 선택 취소","AbortError");
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      try{
        const response=await fetch(this.base+path,{signal:controller.signal,credentials:"omit"});
        if(!response.ok){if([402,418,429].includes(response.status)){const seconds=Number(response.headers.get("Retry-After"));this.blocked=Date.now()+Math.max(60000,Number.isFinite(seconds)?seconds*1000:0);}throw new Error(`${this.id}: HTTP ${response.status}. 자동 재시도하지 않습니다.`);}
        const data=await response.json();if(!data||typeof data!=="object")throw new Error("해외 API 응답 형식이 올바르지 않습니다.");
        const entry={data,at:Date.now()};this.cache.set(path,entry);return entry;
      }catch(error){if(error.name==="AbortError")throw new Error("해외 API 응답 시간 초과");if(error instanceof TypeError)throw new Error("해외 API 네트워크·CORS 오류로 조회 불가");throw error;}
      finally{clearTimeout(timer);}
    };
    const task=this.chain.then(()=>navigator.locks?navigator.locks.request(`coin-note-foreign-${this.id}`,perform):perform());this.chain=task.catch(()=>{});this.pending.set(path,task);task.then(()=>this.pending.delete(path),()=>this.pending.delete(path));return task;
  }
};
