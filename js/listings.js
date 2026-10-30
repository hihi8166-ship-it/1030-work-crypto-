"use strict";
window.ListingsPanel = (() => {
  const cp=new ForeignClient("CoinPaprika","https://api.coinpaprika.com/v1",1100);
  const cg=new ForeignClient("CoinGecko","https://api.coingecko.com/api/v3",11000);
  const identityCache=new Map();
  // 거래소 지역·링크 검증 범위를 명시합니다. 목록과 가격 자체는 API에서만 가져옵니다.
  const foreignExchanges=new Set(["lbank","okx","whitebit","bitget","kucoin","bitvavo","toobit","xt","bitrue","kanga-exchange","cexio","htx","coinw","bybit-spot","gateio","mexc","revolut-x","biconomy","bitkub","poloniex","binance","kraken","coinbase-exchange","bitstamp","bitfinex","crypto-com","digifinex","coinex","btcc","phemex","bingx","bitmart","ascendex","orca-dex","raydium","raydium-clmm","meteora","meteora-damm-v2"]);
  const domains=["binance.com","okx.com","whitebit.com","kucoin.com","bybit.com","gate.io","gate.com","mexc.com","lbank.info","lbank.com","htx.com","bitget.com","kraken.com","coinbase.com","bitfinex.com","bitstamp.net","crypto.com","coinex.com","poloniex.com","cex.io","bitrue.com","kanga.global","bitkub.com","btcc.com","digifinex.com"];
  const el=(tag,text,cls="")=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const number=n=>typeof n==="number"&&Number.isFinite(n);
  const fmt=n=>number(n)?new Intl.NumberFormat("ko-KR",{maximumSignificantDigits:15}).format(n):"미제공";
  const money=(n,unit)=>number(n)?`${fmt(n)} ${unit}`:"미제공";
  const time=n=>n&&Number.isFinite(new Date(n).getTime())?new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",dateStyle:"short",timeStyle:"medium",hour12:false}).format(new Date(n)):"미제공";
  const normalize=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  function table(headings){const scroll=el("div",undefined,"table-scroll"),table=el("table",undefined,"trade-table"),head=el("thead"),tr=el("tr"),body=el("tbody");headings.forEach(s=>{const th=el("th",s);th.scope="col";tr.append(th);});head.append(tr);table.append(head,body);scroll.append(table);return {scroll,body};}
  function row(body,values){const tr=el("tr");values.forEach(value=>{const td=el("td");td.append(value instanceof Node?value:document.createTextNode(String(value)));tr.append(td);});body.append(tr);return tr;}
  function safeLink(url){try{const u=new URL(url);if(u.protocol!=="https:"||u.username||u.password||/futures|perpetual|swap/i.test(u.pathname)||!domains.some(d=>u.hostname===d||u.hostname.endsWith(`.${d}`)))return null;const a=el("a","거래 페이지 ↗");a.href=u.href;a.target="_blank";a.rel="noopener noreferrer";return a;}catch{return null;}}
  function show({target,selected,markets,loaded,clients,valid,force=false}){
    target.replaceChildren();
    const record=ListingIdentity.find(selected),assetKey=AssetIdentity.key(selected).key;
    const known=m=>AssetIdentity.key(m).key===assetKey||(record&&ListingIdentity.find(m)?.id===record.id);
    const confirmed=markets.filter(known),candidates=markets.filter(m=>!known(m)&&m.symbol===selected.symbol);
    const confidence=record?"확인됨":candidates.length?"동일 자산 후보":"식별 불확실";
    const basic=el("div",undefined,"listing-basic");basic.append(el("h3",`${selected.korean_name||selected.english_name} · ${selected.symbol}`),el("span",confidence,"tag"));
    basic.append(el("p",record?`검증 ID: ${record.id} · CoinGecko ${record.coingecko} · CoinPaprika ${record.coinpaprika}`:"검증된 외부 자산 ID 없음", "muted"));
    if(record){basic.append(el("p",`${record.network}${record.contract?` · 계약 주소 ${record.contract}`:" · 네이티브 자산"}`,"contract-text"));const sources=el("p",undefined,"muted");record.sources.forEach((url,i)=>{const a=el("a",`식별 근거 ${i+1}`);a.href=url;a.target="_blank";a.rel="noopener noreferrer";sources.append(a,document.createTextNode(" · "));});basic.append(sources);}
    target.append(basic);
    const summary=el("div",undefined,"listing-summary");const summaryCells={};
    for(const [key,label] of [["domesticEx","국내 상장 거래소"],["domesticPairs","국내 거래마켓"],["foreignEx","해외 현물 거래소"],["foreignPairs","해외 현물 거래쌍"]]){const box=el("div");box.append(el("span",label,"muted"));const value=el("strong","미확인");box.append(value);summary.append(box);summaryCells[key]=value;}
    target.append(summary);
    const complete=loaded.upbit&&loaded.bithumb&&!candidates.length;
    const exchanges=new Set(confirmed.map(m=>m.exchange));
    summaryCells.domesticEx.textContent=complete?`${exchanges.size}개`:`확인 ${exchanges.size}개 · 전체 미확정`;
    summaryCells.domesticPairs.textContent=complete?`${confirmed.length}개`:`확인 ${confirmed.length}개 · 전체 미확정`;
    const classification=complete?(exchanges.size===2?"양쪽 상장":exchanges.has("upbit")?"업비트 전용 (조회 목록 기준)":"빗썸 전용 (조회 목록 기준)"):"전용·공통 여부 미확정";
    target.append(el("h3","국내 거래소 상장현황"),el("p",classification,"listing-classification"));
    const domestic=table(["거래소","상장 상태","KRW","BTC","USDT","기타 마켓","목록 조회 (KST)"]);
    for(const ex of ["upbit","bithumb"]){
      const rows=confirmed.filter(m=>m.exchange===ex),other=candidates.filter(m=>m.exchange===ex),all=[...rows,...other];
      const status=!loaded[ex]?"조회하지 못함":rows.length?"상장 확인":other.length?"동일 자산 후보":"목록상 미상장";
      const quotes=q=>!loaded[ex]?"미확인":all.filter(q).map(m=>`${m.market}${other.includes(m)?" (후보)":""}`).join(", ")||"목록 없음";
      row(domestic.body,[ex==="upbit"?"업비트":"빗썸",status,quotes(m=>m.quote==="KRW"),quotes(m=>m.quote==="BTC"),quotes(m=>m.quote==="USDT"),quotes(m=>!["KRW","BTC","USDT"].includes(m.quote)),loaded[ex]?time(markets.find(m=>m.exchange===ex)?.listedAt):"미확인"]);
    }
    target.append(domestic.scroll,el("p","미상장은 이번에 읽은 목록 기준입니다. 동일심볼 후보는 확정 상장 수에 포함하지 않습니다. 실패한 거래소는 미상장으로 처리하지 않습니다.","muted"));
    const tickers=table(["거래소","거래마켓","식별","현재가","24시간 거래대금","조회 시각 (KST)"]);
    target.append(tickers.scroll);
    for(const market of [...confirmed,...candidates]){
      const tr=row(tickers.body,[market.exchange==="upbit"?"업비트":"빗썸",market.market,known(market)?"선택 자산":"동일 자산 후보","조회 대기…","조회 대기…","—"]);
      // 기존 거래소 큐·캐시를 그대로 사용하며 마켓 목록을 재호출하지 않습니다.
      clients[market.exchange].request(`/v1/ticker?markets=${encodeURIComponent(market.market)}`,{force,valid}).then(r=>{
        if(!valid())return;const t=r.data.find(x=>x.market===market.market);tr.children[3].textContent=money(t?.trade_price,market.quote);tr.children[4].textContent=money(t?.acc_trade_price_24h,market.quote);tr.children[5].textContent=time(r.at);
      }).catch(error=>{if(valid()){tr.children[3].textContent="조회 실패";tr.children[4].textContent="미확인";tr.children[5].textContent=error.message;}});
    }
    target.append(el("h3","해외 · 글로벌 현물 상장현황"));
    const foreignState=el("p","검증된 자산 ID로 조회 중…","muted"),foreignData=el("div");foreignState.setAttribute("role","status");target.append(foreignState,foreignData);
    const retry=el("button","해외 정보 재시도");retry.hidden=true;retry.onclick=()=>{retry.hidden=true;foreignData.replaceChildren();runForeign(true);};target.append(retry);
    if(!record){foreignState.textContent=`조회 불가 · ${confidence}. 심볼만으로 해외 자산을 연결하지 않습니다. 공식 네트워크·계약 주소와 외부 ID 검증이 필요합니다.`;return;}
    async function metadata(provider,client){
      const key=`${provider}:${record.id}`,old=identityCache.get(key);
      if(old&&Date.now()-old.at<1800000)return old.result;
      const path=provider==="coinpaprika"?`/coins/${record.coinpaprika}`:`/coins/${record.coingecko}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`;
      const result=await client.request(path,{ttl:1800000,valid});
      if(!ListingIdentity.validate(record,provider,result.data)){client.cache.delete(path);throw new Error(`${provider} 자산 ID·공식 홈페이지·계약 주소 검증 불일치`);}
      identityCache.set(key,{at:Date.now(),result});return result;
    }
    async function loadForeign(refresh){
      foreignState.textContent="현물 목록과 외부 자산 ID 검증 중… CoinGecko 요청은 최소 11초 간격이므로 잠시 기다려 주세요.";
      summaryCells.foreignEx.textContent="미확인";summaryCells.foreignPairs.textContent="미확인";
      // 실패한 제공처가 있어도 성공한 제공처의 데이터를 표시합니다.
      const sources=await Promise.allSettled([
        (async()=>{await metadata("coinpaprika",cp);const r=await cp.request(`/coins/${record.coinpaprika}/markets`,{force:refresh,valid});if(!Array.isArray(r.data))throw new Error("CoinPaprika 마켓 목록 형식 오류");return r;})(),
        (async()=>{await metadata("coingecko",cg);const r=await cg.request(`/coins/${record.coingecko}/tickers?page=1`,{force:refresh,valid});if(!Array.isArray(r.data.tickers))throw new Error("CoinGecko 거래쌍 형식 오류");return r;})()
      ]);
      if(!valid())return;
      const paprika=sources[0].status==="fulfilled"?sources[0].value:null,gecko=sources[1].status==="fulfilled"?sources[1].value:null;
      if(!paprika){foreignState.textContent=`조회 불가 · 현물 여부를 확인할 CoinPaprika 목록을 읽지 못했습니다. ${sources[0].reason?.message||""} CoinGecko 단독 응답은 현물 확정 통계에 포함하지 않습니다.`;retry.hidden=false;return;}
      if(paprika.data.length&&!paprika.data.some(m=>m&&typeof m==="object"&&typeof m.pair==="string"))throw new Error("해외 마켓 응답 필드 누락");
      const matching=paprika.data.filter(m=>m&&typeof m==="object"&&m.base_currency_id===record.coinpaprika);
      const spot=matching.filter(m=>m.category==="Spot"&&typeof m.pair==="string"&&m.pair.split("/").length===2&&foreignExchanges.has(m.exchange_id));
      const unique=new Map();spot.forEach(m=>{const key=JSON.stringify([m.exchange_id,m.pair,m.base_currency_id,m.quote_currency_id]);if(!unique.has(key))unique.set(key,m);});
      const rows=[...unique.values()];
      summaryCells.foreignEx.textContent=`${new Set(rows.map(m=>m.exchange_id)).size}개 · 조회 범위 내`;
      summaryCells.foreignPairs.textContent=`${rows.length}개 · 조회 범위 내`;
      foreignState.textContent=`CoinPaprika 현물·식별 검증 완료 · 조회 ${time(paprika.at)} KST. ${gecko?`CoinGecko 1페이지 ${gecko.data.tickers.length}건 · ${time(gecko.at)} KST`:`CoinGecko 조회 불가: ${sources[1].reason?.message||""}`} · 선물·무기한·기타 ${matching.filter(m=>m.category!=="Spot").length}건과 국내/분류 미확인 거래소는 통계에서 제외했습니다.`;
      foreignData.replaceChildren();
      foreignData.append(el("p","조회된 범위 내 정보입니다. 확인한 해외·글로벌 거래소 목록과 category=Spot만 포함합니다. 제공처 미추적 시장은 포함되지 않습니다. 선택 자산이 거래쌍의 기준 자산(앞쪽)에 있는 시장만 표시합니다. 거래쌍 가격이 없으면 USD 환산가를 별도 표시하며, USDT 가격으로 간주하지 않습니다. 파생상품은 표시·합산하지 않습니다.","muted"));
      if(!gecko)retry.hidden=false;
      if(!rows.length){foreignData.append(el("p","조회된 현물 데이터가 없습니다. 전 세계 미상장을 의미하지 않습니다."));return;}
      renderForeign(rows,gecko,paprika,foreignData);
    }
    function renderForeign(rows,gecko,paprika,container){
      let page=0;const pageSize=50;const holder=el("div"),controls=el("div",undefined,"listing-pagination"),prev=el("button","이전"),next=el("button","다음"),label=el("span",undefined,"muted");
      controls.append(prev,label,next);container.append(holder,controls);
      function render(){
        holder.replaceChildren();const t=table(["거래소 · 현물","거래쌍 / 결제통화","거래쌍 가격","USD 환산가","24시간 거래대금 (USD 환산)","가격 출처 / 데이터 시각 (KST)","거래 링크"]);
        rows.slice(page*pageSize,(page+1)*pageSize).forEach(m=>{
          const pair=String(m.pair||"").split("/"),quote=pair[1]||"통화 미제공";
          // 현물 확정은 CoinPaprika category로, 원래 거래쌍 가격은 같은 거래소·쌍·자산 ID의 CoinGecko 값으로만 보완합니다.
          const aliases={"bybit-spot":"bybit_spot","gateio":"gate","htx":"huobi","coinbase-exchange":"gdax","crypto-com":"crypto_com"};
          const tick=gecko?.data.tickers.find(x=>x&&typeof x==="object"&&String(x.base).toUpperCase()===String(pair[0]).toUpperCase()&&String(x.target).toUpperCase()===quote.toUpperCase()&&(normalize(x.market?.name)===normalize(m.exchange_name)||normalize(x.market?.identifier)===normalize(aliases[m.exchange_id]||m.exchange_id))&&(m.base_currency_id===record.coinpaprika?x.coin_id===record.coingecko:x.target_coin_id===record.coingecko)&&!x.is_stale&&!x.is_anomaly);
          const native=tick?money(tick.last,quote):"미제공";
          const link=safeLink(m.market_url)||safeLink(tick?.trade_url)||document.createTextNode("검증 범위 밖 / 미제공");
          row(t.body,[m.exchange_name||m.exchange_id,`${m.pair||"미제공"} / ${quote}`,native,money(m.quotes?.USD?.price,"USD"),money(m.quotes?.USD?.volume_24h,"USD"),`${tick?`CoinGecko 가격 ${time(tick.last_fetch_at)} · `:""}CoinPaprika ${time(m.last_updated)}`,link]);
        });holder.append(t.scroll);prev.disabled=page===0;next.disabled=(page+1)*pageSize>=rows.length;label.textContent=`${page+1} / ${Math.ceil(rows.length/pageSize)} 페이지 · 메모리 내 표 이동`;
      }
      prev.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};render();
    }
    function runForeign(refresh){
      loadForeign(refresh).catch(error=>{
        if(!valid())return;
        summaryCells.foreignEx.textContent="미확인";summaryCells.foreignPairs.textContent="미확인";
        foreignData.replaceChildren();foreignState.textContent=`조회 불가 · ${error.message}`;retry.hidden=false;
      });
    }
    runForeign(force);
  }
  return {show};
})();



