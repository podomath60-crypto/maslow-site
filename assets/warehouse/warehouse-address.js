(function(root){
  'use strict';

  var VWORLD_API_KEY = 'CBDA8338-FEF2-34AE-9B04-D31B3597153F';
  var resolver = null;
  var cache = new Map();

  function text(v){ return v == null ? '' : String(v).trim(); }
  function digits(v){ return text(v).replace(/\D/g, ''); }
  function unique(values){
    var seen = Object.create(null), out = [];
    (values || []).forEach(function(v){ v = text(v); if(!v || seen[v]) return; seen[v] = true; out.push(v); });
    return out;
  }
  function firstNonEmpty(){
    for(var i=0;i<arguments.length;i+=1){ var v=text(arguments[i]); if(v) return v; }
    return '';
  }

  function initRegionCompat(){
    if(!root.MaslowRegionCompat || typeof root.MaslowRegionCompat.load !== 'function') return Promise.resolve(null);
    return root.MaslowRegionCompat.load().then(function(r){ resolver = r || null; return resolver; }).catch(function(err){
      console.warn('[warehouse] region compat load failed:', err && err.message ? err.message : err);
      resolver = null;
      return null;
    });
  }
  var ready = initRegionCompat();

  function normalizeBjdongText(value){
    var s = text(value);
    s = s.replace(/\([^)]*\)/g, ' ');
    s = s.replace(/\[[^\]]*\]/g, ' ');
    s = s.replace(/,/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/^전북\s+/, '전북특별자치도 ');
    s = s.replace(/^전라북도\s+/, '전북특별자치도 ');
    s = s.replace(/^전북특별자치도\s*전북특별자치도\s+/, '전북특별자치도 ');
    s = s.replace(/([가-힣]+시)([가-힣]+구)(\s|$)/g, '$1 $2$3');
    return s.replace(/\s+/g, ' ').trim();
  }

  function currentAddress(value){
    var address = text(value);
    if(!address) return '';
    if(resolver && typeof resolver.getCurrentAddress === 'function'){
      try{ return text(resolver.getCurrentAddress(address)) || address; }catch(_e){}
    }
    return address;
  }

  function addressCandidates(value){
    var address = text(value);
    if(!address) return [];
    var list = [address, currentAddress(address)];
    if(resolver && typeof resolver.getAddressCandidates === 'function'){
      try{ list = list.concat(resolver.getAddressCandidates(address) || []); }catch(_e){}
    }
    return unique(list);
  }

  function parseJibunAddress(address){
    var clean = normalizeBjdongText(address);
    var lotMatch = clean.match(/^(.+?(?:읍|면|동|가|리))\s+((?:산\s*)?\d+(?:\s*-\s*\d+)?)(?:\s|,|\(|$)/);
    if(!lotMatch) return null;
    var legalName = text(lotMatch[1]);
    var lot = text(lotMatch[2]);
    var m = lot.match(/^(산\s*)?(\d+)(?:\s*-\s*(\d+))?$/);
    if(!m) return null;
    return {legalName:legalName,mountain:!!m[1],main:m[2],sub:m[3]||'0'};
  }

  function findBjdongCode(legalName){
    var target = normalizeBjdongText(legalName);
    if(resolver && typeof resolver.getBcodeCandidates === 'function'){
      try{
        var candidates = resolver.getBcodeCandidates(target) || [];
        if(candidates.length && /^\d{10}$/.test(String(candidates[0]))) return String(candidates[0]);
      }catch(_e){}
    }
    var codes = Array.isArray(root.BJDONG_CODES) ? root.BJDONG_CODES : [];
    var found = codes.find(function(row){ return normalizeBjdongText(row && row.name) === target; });
    if(found && found.code) return String(found.code);
    found = codes.filter(function(row){
      var name = normalizeBjdongText(row && row.name);
      return name && (target === name || target.indexOf(name + ' ') === 0 || name.indexOf(target + ' ') === 0);
    }).sort(function(a,b){ return String(b.name||'').length - String(a.name||'').length; })[0];
    return found && found.code ? String(found.code) : '';
  }

  function normalizePnu(pnu){
    pnu = digits(pnu);
    if(!/^\d{19}$/.test(pnu)) return '';
    if(resolver && typeof resolver.analyzePnu === 'function'){
      try{
        var a = resolver.analyzePnu(pnu);
        if(a && a.resolved && /^\d{19}$/.test(String(a.currentPnu||''))) return String(a.currentPnu);
      }catch(_e){}
    }
    return pnu;
  }

  function buildPnuFromJibunAddress(address){
    var parsed = parseJibunAddress(currentAddress(address));
    if(!parsed) return '';
    var code = findBjdongCode(parsed.legalName);
    if(!/^\d{10}$/.test(code)) return '';
    var main = String(parsed.main||'').padStart(4,'0');
    var sub = String(parsed.sub||'0').padStart(4,'0');
    if(!/^\d{4}$/.test(main) || !/^\d{4}$/.test(sub)) return '';
    return normalizePnu(code + (parsed.mountain ? '2' : '1') + main + sub);
  }

  function vworldJsonp(url, params){
    return new Promise(function(resolve,reject){
      var cb='wh_vw_cb_'+Date.now()+'_'+Math.floor(Math.random()*100000);
      var script=document.createElement('script'), done=false, timer=null;
      function cleanup(){
        try{ delete root[cb]; }catch(_e){}
        if(timer) clearTimeout(timer);
        if(script.parentNode) script.parentNode.removeChild(script);
      }
      root[cb]=function(payload){ if(done) return; done=true; cleanup(); resolve(payload||{}); };
      script.onerror=function(){ if(done) return; done=true; cleanup(); reject(new Error('VWorld 검색 요청 실패')); };
      var q=new URLSearchParams();
      Object.keys(params||{}).forEach(function(k){ q.set(k, params[k] == null ? '' : String(params[k])); });
      q.set('callback',cb); q.set('_ts',Date.now());
      script.src=url+'?'+q.toString();
      document.body.appendChild(script);
      timer=setTimeout(function(){ if(done) return; done=true; cleanup(); reject(new Error('VWorld 검색 타임아웃')); },15000);
    });
  }

  function searchVworldAddressItem(query, category){
    return vworldJsonp('https://api.vworld.kr/req/search', {
      service:'search', request:'search', version:'2.0', size:'1', page:'1', type:'address',
      category:category, format:'json', key:VWORLD_API_KEY, query:query
    }).then(function(data){
      var items=data && data.response && data.response.result && data.response.result.items;
      return items && items.length ? items[0] : null;
    });
  }

  function searchVworldParcelPnu(query){
    query=text(query);
    if(!query) return Promise.reject(new Error('주소가 없습니다.'));
    var item=null, searchType='parcel';
    return searchVworldAddressItem(query,'parcel').then(function(parcelItem){
      item=parcelItem;
      if(item && digits(item.id).length===19) return item;
      searchType='road';
      return searchVworldAddressItem(query,'road');
    }).then(function(foundItem){
      item=foundItem;
      if(!item) throw new Error('주소 검색 결과가 없습니다.');
      var pnu=digits(item.id);
      var parcelAddress=firstNonEmpty(item.address && item.address.parcel,'');
      if(pnu.length===19 || !parcelAddress) return item;
      return searchVworldAddressItem(parcelAddress,'parcel').then(function(parcelItem){
        if(parcelItem && digits(parcelItem.id).length===19){ item=parcelItem; searchType='road-to-parcel'; }
        return item;
      });
    }).then(function(finalItem){
      var pnu=normalizePnu(finalItem.id);
      if(!/^\d{19}$/.test(pnu)) throw new Error('PNU를 확인하지 못했습니다.');
      var parcelAddress=firstNonEmpty(finalItem.address && finalItem.address.parcel,'');
      var roadAddress=firstNonEmpty(finalItem.address && finalItem.address.road,'');
      return {
        pnu:pnu,
        address:currentAddress(firstNonEmpty(parcelAddress,roadAddress,finalItem.title,query)),
        roadAddress:currentAddress(roadAddress),
        parcelAddress:currentAddress(parcelAddress),
        query:query,
        searchType:searchType,
        point:finalItem.point||{}
      };
    });
  }

  async function resolveAddress(address){
    address=text(address);
    if(!address) throw new Error('주소가 없습니다.');
    if(cache.has(address)) return cache.get(address);
    await ready;
    var candidates=addressCandidates(address);
    var lastError=null;
    for(var i=0;i<candidates.length;i+=1){
      try{
        var found=await searchVworldParcelPnu(candidates[i]);
        var result={
          originalAddress:address,
          currentAddress:currentAddress(firstNonEmpty(found.address,address)),
          pnu:normalizePnu(found.pnu),
          parcelAddress:currentAddress(found.parcelAddress),
          roadAddress:currentAddress(found.roadAddress),
          source:'vworld-'+found.searchType
        };
        cache.set(address,result);
        return result;
      }catch(err){ lastError=err; }
    }
    for(var j=0;j<candidates.length;j+=1){
      var direct=buildPnuFromJibunAddress(candidates[j]);
      if(/^\d{19}$/.test(direct)){
        var fallback={originalAddress:address,currentAddress:currentAddress(candidates[j]),pnu:direct,parcelAddress:currentAddress(candidates[j]),roadAddress:'',source:'bjdong-fallback'};
        cache.set(address,fallback);
        return fallback;
      }
    }
    var noPnu={originalAddress:address,currentAddress:currentAddress(address),pnu:'',parcelAddress:'',roadAddress:'',source:'address-only',error:lastError ? String(lastError.message||lastError) : 'PNU 확인 실패'};
    cache.set(address,noPnu);
    return noPnu;
  }

  function openAsyncPopup(){
    var popup=null;
    try{ popup=root.open('about:blank','_blank'); if(popup) popup.opener=null; }catch(_e){ popup=null; }
    return popup;
  }
  function navigatePopup(popup,url){
    if(popup){ popup.location.href=url; return; }
    root.open(url,'_blank','noopener,noreferrer');
  }

  async function openDdangya(address){
    var popup=openAsyncPopup();
    try{
      var r=await resolveAddress(address);
      if(!/^\d{19}$/.test(r.pnu)) throw new Error('PNU를 확인할 수 없습니다.');
      navigatePopup(popup,'https://ddangya.com/land/detail/'+encodeURIComponent(r.pnu));
      return r;
    }catch(err){ if(popup) popup.close(); throw err; }
  }

  async function openNaver(address){
    var popup=openAsyncPopup();
    try{
      var r=await resolveAddress(address);
      var query=firstNonEmpty(r.roadAddress,r.parcelAddress,r.currentAddress,address);
      if(!query) throw new Error('주소를 확인할 수 없습니다.');
      navigatePopup(popup,'https://map.naver.com/p/search/'+encodeURIComponent(query));
      return r;
    }catch(err){
      var fallback=currentAddress(address);
      if(fallback){ navigatePopup(popup,'https://map.naver.com/p/search/'+encodeURIComponent(fallback)); return {currentAddress:fallback,pnu:'',source:'naver-fallback'}; }
      if(popup) popup.close(); throw err;
    }
  }

  root.WarehouseAddressTools={
    ready:ready,
    currentAddress:currentAddress,
    addressCandidates:addressCandidates,
    buildPnuFromJibunAddress:buildPnuFromJibunAddress,
    normalizePnu:normalizePnu,
    resolveAddress:resolveAddress,
    openDdangya:openDdangya,
    openNaver:openNaver
  };
})(window);
