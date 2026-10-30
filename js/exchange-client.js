"use strict";
// 거래소마다 독립적인 요청 큐를 둡니다. CRUD 저장 키는 읽거나 쓰지 않습니다.
window.ExchangeClient = class ExchangeClient {
  constructor(id, name, base, gap, clockKey) {
    Object.assign(this, {id,name,base,gap,clockKey});
    this.cache = new Map(); this.pending = new Map(); this.chain = Promise.resolve();
    this.next = Date.now() + gap; // 새로고침 직후 이전 요청과 겹치지 않게 기다립니다.
    this.blocked = 0;
  }
  read(key) {try {return Number(localStorage.getItem(key)) || 0;} catch {return 0;}}
  write(key,value) {try {localStorage.setItem(key,String(value));} catch {/* 저장소가 차단되면 현재 탭 메모리 큐를 사용합니다. */}}
  status(text) {document.getElementById(`${this.id}-queue`).textContent = `${this.name}: ${text}`;}
  request(path, {ttl=30000,force=false,valid=()=>true}={}) {
    const cached = this.cache.get(path);
    if (!force && cached && Date.now()-cached.at < ttl) return Promise.resolve(cached);
    if (this.pending.has(path)) return this.pending.get(path).catch(error => {
      // 빠른 A→B→A 전환에서 취소된 A 요청을 공유했다면 새로 조회합니다.
      if (error.name === "AbortError" && valid()) return this.request(path,{ttl,force,valid});
      throw error;
    });
    const perform = async () => {
      const check = () => {if (!valid()) throw new DOMException("이전 선택 취소","AbortError");};
      check();
      const blocked = Math.max(this.blocked,this.read(`${this.clockKey}.blocked`));
      if (Date.now() < blocked) throw new Error(`요청 제한 대기 중입니다. ${new Date(blocked).toLocaleString("ko-KR")} 이후 재시도해 주세요.`);
      let until = Math.max(this.next,this.read(this.clockKey)+this.gap);
      while (Date.now() < until) {
        check(); this.status(`요청 대기 · 약 ${Math.ceil((until-Date.now())/1000)}초`);
        await new Promise(resolve => setTimeout(resolve,Math.min(500,until-Date.now())));
        until = Math.max(this.next,this.read(this.clockKey)+this.gap);
      }
      check(); this.write(this.clockKey,Date.now()); this.next=Date.now()+this.gap; this.status("조회 중…");
      const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(),15000);
      try {
        // Origin 조작, 인증키, CORS 우회는 사용하지 않습니다.
        const response = await fetch(this.base+path,{signal:controller.signal,credentials:"omit"});
        if (!response.ok) {
          if ([429,418].includes(response.status)) {
            const seconds=Number(response.headers.get("Retry-After"));
            this.blocked=Date.now()+Math.max(response.status===418?300000:60000,Number.isFinite(seconds)?seconds*1000:0);
            this.write(`${this.clockKey}.blocked`,this.blocked);
            throw new Error(`HTTP ${response.status} 요청 제한. 자동 재시도하지 않습니다. ${new Date(this.blocked).toLocaleString("ko-KR")} 이후 재시도해 주세요. 서버 차단은 더 오래 지속될 수 있습니다.`);
          }
          throw new Error(`API 요청 실패 (HTTP ${response.status})`);
        }
        const data=await response.json();
        if (!Array.isArray(data)) throw new Error("API 응답이 예상한 목록 형식이 아닙니다.");
        const result={data,at:Date.now()}; this.cache.set(path,result); return result;
      } catch(error) {
        if (error.name==="AbortError") throw new Error("응답 시간이 초과되었습니다. 연결을 확인하고 재시도해 주세요.");
        if (error instanceof TypeError) throw new Error(navigator.onLine?"네트워크·CORS 또는 요청 제한으로 응답을 읽을 수 없습니다. 잠시 후 재시도해 주세요.":"인터넷 연결이 없습니다. 연결 후 재시도해 주세요.");
        throw error;
      } finally {
        clearTimeout(timer); this.next=Date.now()+this.gap; this.write(this.clockKey,Date.now());
        this.status(`조회 종료 · 요청 간격 최소 ${this.gap/1000}초`);
      }
    };
    // Web Locks와 요청 시각 공유로 같은 출처의 여러 탭도 직렬화합니다.
    const task=this.chain.then(()=>navigator.locks?navigator.locks.request(`coin-note-${this.id}`,perform):perform());
    this.chain=task.catch(()=>{}); this.pending.set(path,task);
    task.then(()=>this.pending.delete(path),()=>this.pending.delete(path)); return task;
  }
};
