"use strict";
// 목록은 API에서 생성합니다. 이 표는 목록이 아니라 공식 설명으로 검증한 자산 ID 연결 규칙입니다.
// 다른 자산은 심볼과 이름이 같아도 거래소 간 병합하지 않습니다.
window.AssetIdentity = {
  verified: [{
    id:"bitcoin-native",symbol:"BTC",english:"bitcoin",korean:"비트코인",
    sources:[
      "https://datalab.upbit.com/assets/BTC/summary",
      "https://feed-content.bithumb.com/cms/7f9554a7-0fd9-48a7-becf-b8dceca6f724.pdf"
    ]
  }],
  normalize(value) {return typeof value==="string"?value.trim().normalize("NFKC").toLowerCase():"";},
  key(market) {
    const match=this.verified.find(v=>market.symbol===v.symbol && this.normalize(market.english_name)===v.english && this.normalize(market.korean_name)===v.korean);
    if (match) return {key:match.id,verified:true,sources:match.sources};
    // 같은 거래소 안에서도 이름이 충돌하면 별개로 보존합니다.
    return {key:JSON.stringify([market.exchange,market.symbol,this.normalize(market.korean_name),this.normalize(market.english_name)]),verified:false,sources:[]};
  },
  group(markets) {
    const groups=new Map();
    for (const market of markets) {
      const identity=this.key(market);
      if (!groups.has(identity.key)) groups.set(identity.key,{...identity,markets:[],symbol:market.symbol,name:market.korean_name||market.english_name||market.symbol});
      groups.get(identity.key).markets.push(market);
    }
    return [...groups.values()];
  }
};
