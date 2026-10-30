"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const clients = {
    upbit: new ExchangeClient("upbit","업비트","https://api.upbit.com",11000,"coin-note.upbit-clock.v1"),
    bithumb: new ExchangeClient("bithumb","빗썸","https://api.bithumb.com",1100,"coin-note.bithumb-clock.v1")
  };
  const listPaths={upbit:"/v1/market/all?is_details=true",bithumb:"/v1/market/all?isDetails=true"};
  const exchangeName=id=>clients[id].name;
  const loaded={upbit:false,bithumb:false},loading={upbit:false,bithumb:false};
  let markets=[],groups=[],selected=null,selection=0,viewVersion=0,comparisonVersion=0,warningVersion=0,view=null;
  const numeric=n=>typeof n==="number"&&Number.isFinite(n);
  // 소수 가격도 표시하며 선택한 결제 통화를 원화로 바꾸지 않습니다.
  const fmt=n=>numeric(n)?new Intl.NumberFormat("ko-KR",{maximumSignificantDigits:15}).format(n):"—";
  const money=(n,quote=selected?.quote)=>numeric(n)?`${fmt(n)} ${quote||""}`:"미제공";
  const time=value=>{
    if(value===undefined||value===null||value==="")return "미제공";
    const d=new Date(typeof value==="string"&&/^\d+$/.test(value)?Number(value):value);
    return Number.isNaN(d.getTime())?"미제공":new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",dateStyle:"short",timeStyle:"medium",hour12:false}).format(d);
  };
  // 외부 데이터는 textContent로만 출력해 HTML 실행을 막습니다.
  function el(tag,text,cls=""){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function state(id,message,retry){const n=$(id);n.replaceChildren();n.classList.toggle("error",Boolean(retry));if(message)n.append(el("p",message));if(retry){const b=el("button","재시도");b.type="button";b.onclick=retry;n.append(b);}}
  function metrics(items){const dl=el("dl",undefined,"api-metrics");items.forEach(([label,value])=>{const n=el("div");n.append(el("dt",label),el("dd",value));dl.append(n);});return dl;}
  function matches(m,term){return [m.korean_name,m.english_name,m.symbol,m.market,exchangeName(m.exchange)].some(s=>String(s||"").toLowerCase().includes(term));}
  function rebuild(){
    groups=AssetIdentity.group(markets);
    const previous=$("quote-filter").value,quotes=[...new Set(markets.map(m=>m.quote))].sort();
    $("quote-filter").replaceChildren(new Option("전체","all"),...quotes.map(q=>new Option(q,q)));$("quote-filter").value=quotes.includes(previous)?previous:"all";
    stats();listMarkets();if(selected){related();if(view==="listings")loadExtra();}
  }
  function stats(){
    const u=markets.filter(m=>m.exchange==="upbit"),b=markets.filter(m=>m.exchange==="bithumb"),ug=AssetIdentity.group(u),bg=AssetIdentity.group(b);
    const us=new Set(u.map(m=>m.symbol)),bs=new Set(b.map(m=>m.symbol)),complete=loaded.upbit&&loaded.bithumb;
    const shared=[...us].filter(s=>bs.has(s)).length,known=groups.filter(g=>g.verified&&new Set(g.markets.map(m=>m.exchange)).size===2).length;
    $("market-stats").replaceChildren(metrics([
      ["업비트 전체 거래마켓",loaded.upbit?`${u.length}개 · 코인 ${ug.length}개`:"미완료"],
      ["빗썸 전체 거래마켓",loaded.bithumb?`${b.length}개 · 코인 ${bg.length}개`:"미완료"],
      ["통합 거래마켓",`${markets.length}개${complete?"":" (부분 집계)"}`],
      ["확인 가능한 중복 제거 코인",`${groups.length}개 (미확인 자산 분리${complete?"":", 부분 집계"})`],
      ["업비트 전용 코인 수",complete?`미확정 · 상대 목록에 동일심볼 없는 후보 ${[...us].filter(s=>!bs.has(s)).length}개`:"양쪽 목록 조회 필요"],
      ["빗썸 전용 코인 수",complete?`미확정 · 상대 목록에 동일심볼 없는 후보 ${[...bs].filter(s=>!us.has(s)).length}개`:"양쪽 목록 조회 필요"],
      ["양쪽 공통 코인 수",complete?`확인 ${known}개 · 전체 미확정 (동일심볼 후보 ${shared}개)`:"양쪽 목록 조회 필요"]
    ]));
    $("identity-note").textContent=`${complete?"양쪽 목록 조회 완료":"일부 거래소 조회 중이거나 실패 · 전체 집계 아님"} · BTC만 공식 설명으로 거래소 간 연결했습니다. 미확인 중복을 분리하여 통합 코인 수에 중복이 남을 수 있습니다.`;
  }
  function listMarkets(){
    const term=$("coin-search").value.trim().toLowerCase(),exchange=$("exchange-filter").value,quote=$("quote-filter").value;
    const results=groups.map(g=>({...g,visible:g.markets.filter(m=>(exchange==="all"||m.exchange===exchange)&&(quote==="all"||m.quote===quote)&&matches(m,term))})).filter(g=>g.visible.length);
    $("market-count").textContent=`검색 ${results.length}개 자산 묶음 · ${results.reduce((n,g)=>n+g.visible.length,0)}개 거래마켓`;$("market-list").replaceChildren();
    if(!results.length){$("market-list").append(el("p","검색 결과가 없습니다. 필터와 거래소 조회 상태를 확인해 주세요.","muted"));return;}
    const fragment=document.createDocumentFragment();
    results.forEach(g=>{
      const card=el("article",undefined,"asset-result");card.dataset.assetKey=g.key;card.append(el("h3",`${g.name} · ${g.symbol}`));
      const other=markets.filter(m=>m.symbol===g.symbol&&!g.markets.some(x=>x.id===m.id)),exchanges=new Set(g.markets.map(m=>m.exchange)),badges=el("p",undefined,"muted");
      for(const id of Object.keys(clients))badges.append(el("span",`${exchangeName(id)} ${exchanges.has(id)?"상장 확인":other.some(m=>m.exchange===id)?"동일심볼 후보":"일치 정보 없음"}`,"listing-badge"));
      card.append(badges,el("p",g.verified?"자산 식별 확인":"거래소 간 동일 자산 미확인 · 분리 표시","identity-label"));
      g.visible.forEach(m=>{const button=el("button",`${exchangeName(m.exchange)} · ${m.market}`,"market-item");button.type="button";button.dataset.marketId=m.id;button.setAttribute("aria-pressed",String(m.id===selected?.id));button.onclick=()=>select(m);card.append(button);});fragment.append(card);
    });$("market-list").append(fragment);
  }
  async function loadMarkets(exchange,force=false){
    if(loading[exchange])return;loading[exchange]=true;state(`${exchange}-state`,`${exchangeName(exchange)} 전체 마켓 조회 중…`);
    try{
      const r=await clients[exchange].request(listPaths[exchange],{ttl:300000,force}),seen=new Set();
      // KRW로 필터링하지 않습니다. 모든 결제 통화와 거래소별 마켓 ID를 보존합니다.
      const rows=r.data.filter(m=>typeof m.market==="string"&&/^[^-]+-.+$/.test(m.market)).filter(m=>{if(seen.has(m.market))return false;seen.add(m.market);return true;}).map(m=>({...m,exchange,id:`${exchange}:${m.market}`,quote:m.market.split("-")[0],symbol:m.market.slice(m.market.indexOf("-")+1),listedAt:r.at}));
      if(!rows.length)throw new Error("조회 가능한 거래마켓이 없습니다.");
      markets=[...markets.filter(m=>m.exchange!==exchange),...rows];loaded[exchange]=true;markets.sort((a,b)=>(a.korean_name||a.symbol).localeCompare(b.korean_name||b.symbol,"ko")||a.id.localeCompare(b.id));
      state(`${exchange}-state`,`${exchangeName(exchange)} ${rows.length}개 · ${time(r.at)} KST`);$("coin-search").disabled=false;rebuild();
      if(!selected&&(exchange==="upbit"||!loading.upbit))select(markets.find(m=>m.id==="upbit:KRW-BTC")||rows.find(m=>m.market==="KRW-BTC")||rows[0]);
      else if(selected?.exchange===exchange){const updated=rows.find(m=>m.id===selected.id);if(updated){selected=updated;loadWarning();}}
    }catch(e){state(`${exchange}-state`,`${exchangeName(exchange)}: ${e.message}`,()=>loadMarkets(exchange,true));stats();}
    finally{loading[exchange]=false;if(!selected&&markets.length&&!loading.upbit)select(markets.find(m=>m.market==="KRW-BTC")||markets[0]);}
  }
  function related(){
    const key=AssetIdentity.key(selected).key,rows=markets.filter(m=>AssetIdentity.key(m).key===key||m.symbol===selected.symbol),target=$("related-markets");target.replaceChildren();
    rows.forEach(m=>{const confirmed=AssetIdentity.key(m).key===key,button=el("button",`${exchangeName(m.exchange)} ${m.market}${confirmed?"":" · 동일심볼 후보"}`,"related-button");button.type="button";button.dataset.marketId=m.id;button.setAttribute("aria-pressed",String(m.id===selected.id));button.onclick=()=>select(m);target.append(button);});
    target.append(el("p","후보는 검색 편의를 위한 연결이며 동일 자산으로 병합하지 않습니다. 시세 비교는 같은 결제 통화만 조회하고 조회 시각을 함께 표시합니다.","muted"));
  }
  function select(m){
    if(m.id===selected?.id)return;selected=m;selection++;viewVersion++;comparisonVersion++;warningVersion++;
    $("selected-name").textContent=m.korean_name||m.english_name||m.symbol;$("selected-market").textContent=`${exchangeName(m.exchange)} · ${m.english_name||m.symbol} · ${m.market} · 결제 ${m.quote}`;
    ["ticker-data","extra-data","compare-data","warning-data"].forEach(id=>$(id).replaceChildren());["extra-time","warning-time"].forEach(id=>$(id).textContent="");state("compare-state","");
    ["refresh-ticker","compare-button","refresh-warning"].forEach(id=>$(id).disabled=false);document.querySelectorAll("[data-view]").forEach(b=>b.disabled=false);
    related();listMarkets();loadTicker();loadWarning();if(view)loadExtra();
  }
  async function loadTicker(force=false){
    if(!selected)return;const m=selected,version=selection;state("ticker-state","기본 시세 조회 대기 중…");$("refresh-ticker").disabled=true;
    try{
      const r=await clients[m.exchange].request(`/v1/ticker?markets=${encodeURIComponent(m.market)}`,{force,valid:()=>version===selection});if(version!==selection)return;
      const t=r.data.find(t=>t.market===m.market);if(!t)throw new Error("현재가 데이터가 없습니다.");const color=t.change==="RISE"?"rise":t.change==="FALL"?"fall":"neutral";
      const diff=numeric(t.signed_change_price)?`${t.signed_change_price>0?"+":""}${money(t.signed_change_price,m.quote)}`:"미제공",rate=numeric(t.signed_change_rate)?`${t.signed_change_rate>0?"+":""}${(t.signed_change_rate*100).toFixed(2)}%`:"미제공";
      const hero=el("div",undefined,"price-hero");hero.append(el("span",`${exchangeName(m.exchange)} 현재가 · ${m.quote}`,"muted"),el("strong",money(t.trade_price,m.quote),color),el("span",`전일 대비 ${diff} (${rate})`,color));
      $("ticker-data").replaceChildren(hero,metrics([["전일 종가",money(t.prev_closing_price,m.quote)],["당일 시가",money(t.opening_price,m.quote)],["당일 최고가",money(t.high_price,m.quote)],["당일 최저가",money(t.low_price,m.quote)],["52주 최고가",`${money(t.highest_52_week_price,m.quote)} · ${t.highest_52_week_date||"기록일 미제공"}`],["52주 최저가",`${money(t.lowest_52_week_price,m.quote)} · ${t.lowest_52_week_date||"기록일 미제공"}`],["최근 24시간 거래량",`${fmt(t.acc_trade_volume_24h)} ${m.symbol}`],["최근 24시간 거래대금",money(t.acc_trade_price_24h,m.quote)]]),el("p",`조회: ${time(r.at)} KST · API 데이터 시각: ${time(t.timestamp)} KST (API 제공 타임스탬프)`,"muted"));state("ticker-state","");
    }catch(e){if(version===selection&&e.name!=="AbortError")state("ticker-state",`${e.message} 남아 있는 값은 이전 조회값입니다.`,()=>loadTicker(true));}
    finally{if(version===selection)$("refresh-ticker").disabled=false;}
  }
  async function compare(){
    const m=selected;if(!m)return;const version=++comparisonVersion,key=AssetIdentity.key(m).key,rows=markets.filter(x=>x.quote===m.quote&&(AssetIdentity.key(x).key===key||x.symbol===m.symbol));
    $("compare-data").replaceChildren();state("compare-state","거래소별 시세 비교 조회 중…");$("compare-button").disabled=true;
    const results=await Promise.all(rows.map(async x=>{try{const r=await clients[x.exchange].request(`/v1/ticker?markets=${encodeURIComponent(x.market)}`,{valid:()=>version===comparisonVersion});const t=r.data.find(t=>t.market===x.market);return [exchangeName(x.exchange),x.market,AssetIdentity.key(x).key===key?"동일 묶음":"미확인 후보",money(t?.trade_price,x.quote),time(r.at)];}catch(e){return [exchangeName(x.exchange),x.market,"조회 실패",e.message,"—"];}}));
    if(version!==comparisonVersion)return;$("compare-data").append(table(["거래소","마켓","식별","현재가","조회 시각 (KST)"],results));state("compare-state","");$("compare-button").disabled=false;
  }
  async function loadWarning(force=false){
    const m=selected;if(!m)return;const version=++warningVersion;state("warning-state","경보 조회 중…");$("refresh-warning").disabled=true;
    try{
      let row=m;if(force){const r=await clients[m.exchange].request(listPaths[m.exchange],{force:true,valid:()=>version===warningVersion}),fresh=r.data.find(x=>x.market===m.market);if(!fresh)throw new Error("갱신된 목록에 선택 종목이 없습니다.");row={...m,...fresh,listedAt:r.at};}if(version!==warningVersion)return;
      const target=$("warning-data");target.replaceChildren();
      if(m.exchange==="upbit"){
        const event=row.market_event,labels={PRICE_FLUCTUATIONS:"가격 급등락",TRADING_VOLUME_SOARING:"거래량 급등",DEPOSIT_AMOUNT_SOARING:"입금량 급등",GLOBAL_PRICE_DIFFERENCES:"국내외 가격 차이",CONCENTRATION_OF_SMALL_ACCOUNTS:"소수 계정 거래 집중"};
        if(!event||typeof event.warning!=="boolean"||!event.caution)target.append(el("p","경보 데이터 일부 누락 · 정상 여부 미확인"));
        else{target.append(el("p",event.warning?"투자유의 종목 지정":"투자유의 지정 없음",event.warning?"rise":""));const alerts=Object.entries(event.caution).filter(([,v])=>v===true),complete=Object.keys(labels).every(k=>typeof event.caution[k]==="boolean");target.append(el("p",alerts.length?`시장경보: ${alerts.map(([k])=>labels[k]||k).join(" · ")}`:complete?"정상 · 제공된 시장경보 없음":"경보 데이터 일부 누락",alerts.length?"rise":""));}
        $("warning-time").textContent=`종목·경보 조회: ${time(row.listedAt)} KST`;
      }else{
        target.append(el("p",row.market_warning==="CAUTION"?"투자유의 종목 지정":row.market_warning==="NONE"?"투자유의 지정 없음":`투자유의 상태 미확인 (${row.market_warning||"미제공"})`,row.market_warning==="CAUTION"?"rise":""));
        const r=await clients.bithumb.request("/v1/market/virtual_asset_warning",{ttl:60000,force,valid:()=>version===warningVersion});if(version!==warningVersion)return;
        const warnings=r.data.filter(w=>w.market===m.market),types={PRICE_SUDDEN_FLUCTUATION:"가격 급등락",PRICE_DIFFERENCE_HIGH:"글로벌 시세 차이",SPECIFIC_ACCOUNT_HIGH_TRANSACTION:"소수계정 거래 집중",TRADING_VOLUME_SUDDEN_FLUCTUATION:"거래량 급등",DEPOSIT_AMOUNT_SUDDEN_FLUCTUATION:"입금량 급등"},steps={CAUTION:"주의",WARNING:"경고",DANGER:"위험"};
        if(!warnings.length)target.append(el("p",row.market_warning==="NONE"?"정상 · 경보제 조회 결과 없음":"경보제 조회 결과 없음"));warnings.forEach(w=>target.append(el("p",`${types[w.warning_type]||w.warning_type||"유형 미제공"} · ${steps[w.warning_step]||w.warning_step||"단계 미제공"} · 종료 ${w.end_date||"미제공"} KST`,"rise")));
        $("warning-time").textContent=`투자유의 목록: ${time(row.listedAt)} KST · 경보제: ${time(r.at)} KST`;
      }state("warning-state","");
    }catch(e){if(version===warningVersion&&e.name!=="AbortError")state("warning-state",`${e.message} 경보 조회 실패는 정상 상태를 의미하지 않습니다.`,()=>loadWarning(true));}
    finally{if(version===warningVersion)$("refresh-warning").disabled=false;}
  }
  function choose(v){view=v;document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.view===v)));$("chart-controls").hidden=v!=="chart";$("refresh-extra").hidden=false;$("extra-heading").textContent={orderbook:"매수 · 매도 1호가",trades:"최근 체결 20건",chart:"종가 기준 가격 추이",listings:"국내외 상장현황"}[v];loadExtra();}
  async function loadExtra(force=false){
    if(!selected||!view)return;
    if(view==="listings"){
      const version=++viewVersion;
      state("extra-state","");$("extra-time").textContent="";$("refresh-extra").disabled=false;
      ListingsPanel.show({target:$("extra-data"),selected,markets,loaded,clients,force,valid:()=>version===viewVersion});
      return;
    }
    const m=selected,version=++viewVersion,v=view,period=$("chart-period").value,code=encodeURIComponent(m.market),path=v==="orderbook"?`/v1/orderbook?markets=${code}`:v==="trades"?`/v1/trades/ticks?market=${code}&count=20`:period==="days"?`/v1/candles/days?market=${code}&count=30`:`/v1/candles/minutes/60?market=${code}&count=24`;
    $("extra-data").replaceChildren();$("extra-time").textContent="";$("refresh-extra").disabled=true;state("extra-state",`${exchangeName(m.exchange)} ${m.market} 조회 대기 중…`);
    try{const r=await clients[m.exchange].request(path,{force,ttl:v==="chart"?60000:30000,valid:()=>version===viewVersion});if(version!==viewVersion)return;if(!r.data.length)throw new Error("조회 가능한 데이터가 없습니다.");
      if(v==="orderbook"){const b=r.data.find(b=>b.market===m.market)?.orderbook_units?.[0];if(!b)throw new Error("1호가 데이터가 없습니다.");$("extra-data").append(metrics([["매수 1호가",money(b.bid_price)],["매수 잔량",`${fmt(b.bid_size)} ${m.symbol}`],["매도 1호가",money(b.ask_price)],["매도 잔량",`${fmt(b.ask_size)} ${m.symbol}`]]));}
      else if(v==="trades")$("extra-data").append(table(["체결 시각 (KST)",`가격 (${m.quote})`,`수량 (${m.symbol})`,"체결 방향"],r.data.slice(0,20).map(t=>[time(t.timestamp),fmt(t.trade_price),fmt(t.trade_volume),t.ask_bid==="BID"?"매수":t.ask_bid==="ASK"?"매도":"미제공"])));else chart(r.data,period);
      state("extra-state","");$("extra-time").textContent=`${exchangeName(m.exchange)} ${m.market} · 조회: ${time(r.at)} KST`;
    }catch(e){if(version===viewVersion&&e.name!=="AbortError")state("extra-state",e.message,()=>loadExtra(true));}finally{if(version===viewVersion)$("refresh-extra").disabled=false;}
  }
  function table(headings,rows) {
    const scroll=el("div",undefined,"table-scroll"), t=el("table",undefined,"trade-table"), head=el("thead"), tr=el("tr");
    headings.forEach(label=>{const th=el("th",label);th.scope="col";tr.append(th);});head.append(tr);t.append(head);
    const body=el("tbody"); rows.forEach(values=>{const row=el("tr");values.forEach(value=>row.append(el("td",value,value==="매수"?"rise":value==="매도"?"fall":"")));body.append(row);});
    t.append(body);scroll.append(t);return scroll;
  }
  // 순수 SVG 종가 선 차트입니다. 가격 데이터가 없으면 임의 값으로 채우지 않습니다.
  function chart(data,period) {
    const candles=data.map(c=>({...c,date:Date.parse(`${c.candle_date_time_utc}Z`)})).filter(c=>numeric(c.trade_price)&&Number.isFinite(c.date)).sort((a,b)=>a.date-b.date);
    if(!candles.length) throw new Error("표시 가능한 캔들 데이터가 없습니다.");
    const target=$("extra-data"), expected=period==="days"?30:24;
    if(candles.length<expected) target.append(el("p",`요청 ${expected}개 중 ${candles.length}개만 제공되었습니다. 상장 이력 또는 체결이 없는 구간에 따라 부족할 수 있습니다.`,"muted"));
    function svgEl(tag,attrs,text) {const n=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;return n;}
    const svg=svgEl("svg",{viewBox:"0 0 760 310",role:"img","aria-label":`${selected.korean_name||selected.market} ${period==="days"?"일봉":"60분봉"} 종가 추이`,class:"price-chart"});
    svg.append(svgEl("title",{},"시간순 종가 차트. 날짜와 가격은 아래 데이터 표에서도 확인할 수 있습니다."));
    const prices=candles.map(c=>c.trade_price), min=Math.min(...prices),max=Math.max(...prices),pad=max===min?Math.max(Math.abs(max)*.01,1):(max-min)*.1;
    const low=min-pad,high=max+pad,x=i=>110+(candles.length===1?300:i/(candles.length-1)*600),y=p=>250-(p-low)/(high-low)*220;
    for(let i=0;i<5;i++){const value=low+(high-low)*i/4;svg.append(svgEl("line",{x1:110,x2:710,y1:y(value),y2:y(value),stroke:"#293549"}),svgEl("text",{x:100,y:y(value)+4,"text-anchor":"end",fill:"#a2afc3","font-size":11},fmt(value)));}
    svg.append(svgEl("text",{x:12,y:16,fill:"#a2afc3","font-size":11},selected.quote),svgEl("polyline",{points:candles.map((c,i)=>`${x(i)},${y(c.trade_price)}`).join(" "),fill:"none",stroke:"#78e4c4","stroke-width":2.5}));
    candles.forEach((c,i)=>{const dot=svgEl("circle",{cx:x(i),cy:y(c.trade_price),r:3,fill:"#78e4c4"});dot.append(svgEl("title",{},`${time(c.date)} KST · ${money(c.trade_price)}`));svg.append(dot);});
    const df=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",...(period==="hours"?{hour:"2-digit",hour12:false}:{})});
    [...new Set([0,Math.floor((candles.length-1)/2),candles.length-1])].forEach(i=>svg.append(svgEl("text",{x:x(i),y:280,"text-anchor":"middle",fill:"#a2afc3","font-size":12},df.format(candles[i].date))));
    target.append(svg,el("p","각 캔들의 종가를 연결합니다. 마지막 캔들은 진행 중일 수 있으며, 체결 없는 구간에는 캔들이 생성되지 않습니다.","muted"));
    const details=el("details");details.append(el("summary","차트 날짜·종가 데이터 보기"),table(["캔들 시작 (KST)",`종가 (${selected.quote})`],candles.map(c=>[time(c.date),fmt(c.trade_price)])));target.append(details);
  }


  $("coin-search").oninput=listMarkets;$("exchange-filter").onchange=listMarkets;$("quote-filter").onchange=listMarkets;
  $("refresh-ticker").onclick=()=>loadTicker(true);$("refresh-extra").onclick=()=>loadExtra(true);$("refresh-warning").onclick=()=>loadWarning(true);$("compare-button").onclick=compare;
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>choose(b.dataset.view));$("chart-period").onchange=()=>loadExtra();
  if(!navigator.locks)document.querySelector(".notice").append(" 이 브라우저는 탭 간 잠금을 지원하지 않습니다. 한 탭에서 사용해 주세요.");
  stats();loadMarkets("upbit");loadMarkets("bithumb");
})();



