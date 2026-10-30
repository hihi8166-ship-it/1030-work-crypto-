"use strict";
// 심볼 검색으로 외부 ID를 자동 확정하지 않습니다. 공식 자료를 대조한 매핑만 둡니다.
window.ListingIdentity = {
  records: [
    {id:"bitcoin-native",symbol:"BTC",english:"bitcoin",korean:"비트코인",exchanges:["upbit","bithumb"],network:"Bitcoin",contract:null,coingecko:"bitcoin",coinpaprika:"btc-bitcoin",website:["bitcoin.org"],sources:["https://datalab.upbit.com/assets/BTC/summary","https://feed-content.bithumb.com/cms/7f9554a7-0fd9-48a7-becf-b8dceca6f724.pdf"]},
    {id:"grass-solana",symbol:"GRASS",english:"grass",korean:"그래스",exchanges:["bithumb"],network:"Solana",contract:"Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs",coingecko:"grass",coinpaprika:"grass-grass",website:["getgrass.io","grass.io"],sources:["https://feed-content.bithumb.com/cms/copied-15bb147b-9d83-42ba-b723-4c9a5aba42d1.pdf","https://grass-foundation.gitbook.io/grass-docs","https://coinpaprika.com/coin/grass-grass/"]}
  ],
  find(m) {return this.records.find(r=>r.exchanges.includes(m.exchange)&&m.symbol===r.symbol&&AssetIdentity.normalize(m.english_name)===r.english&&AssetIdentity.normalize(m.korean_name)===r.korean)||null;},
  validate(record,provider,data) {
    if(!data||data.id!==record[provider]||String(data.symbol).toUpperCase()!==record.symbol)return false;
    const websites=provider==="coinpaprika"?data.links?.website:data.links?.homepage;
    const official=Array.isArray(websites)&&websites.some(url=>{try{return record.website.includes(new URL(url).hostname.replace(/^www\./,""));}catch{return false;}});
    if(!official)return false;
    if(!record.contract)return record.id==="bitcoin-native"&&(provider!=="coinpaprika"||data.type==="coin");
    return provider==="coinpaprika"?data.contracts?.some(c=>c.platform==="sol-solana"&&c.contract===record.contract):data.platforms?.solana===record.contract;
  }
};
