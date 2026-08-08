(function(){
  'use strict';

  const RAW_DATA = Array.isArray(window.WAREHOUSE_DATA) ? window.WAREHOUSE_DATA : [];
  const AddressTools = window.WarehouseAddressTools || null;

  const toNumber = value => {
    if(typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value == null ? '' : value).replace(/,/g,'').replace(/[^0-9.+-]/g,'').trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };
  const normalizeText = s => String(s == null ? '' : s).normalize('NFKC').trim().toLocaleLowerCase('ko-KR').replace(/\s+/g,' ');
  const normalizeBizNo = s => String(s == null ? '' : s).replace(/\D/g,'');
  const esc = s => String(s == null ? '' : s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = n => toNumber(n).toLocaleString('ko-KR',{maximumFractionDigits:2});
  const pyung = n => (toNumber(n)/3.305785).toLocaleString('ko-KR',{maximumFractionDigits:0});

  function regionFromAddress(address, fallback){
    const current = AddressTools ? AddressTools.currentAddress(address) : String(address||'').trim();
    const first = String(current||'').split(/\s+/)[0] || String(fallback||'').trim();
    const alias = {
      '서울':'서울특별시','부산':'부산광역시','대구':'대구광역시','인천':'인천광역시','광주':'광주광역시','대전':'대전광역시','울산':'울산광역시',
      '세종':'세종특별자치시','경기':'경기도','강원':'강원특별자치도','강원도':'강원특별자치도','충북':'충청북도','충남':'충청남도',
      '전북':'전북특별자치도','전라북도':'전북특별자치도','전남':'전라남도','경북':'경상북도','경남':'경상남도','제주':'제주특별자치도'
    };
    return alias[first] || first || fallback || '';
  }

  function normalizeRow(row){
    const generalArea=toNumber(row.generalArea), coldArea=toNumber(row.coldArea), storageArea=toNumber(row.storageArea), otherArea=toNumber(row.otherArea);
    const law=String(row.law||'').trim();
    const logisticsArea=generalArea+coldArea+storageArea;
    const registeredArea=law==='물류시설법' ? logisticsArea : otherArea;
    const originalAddress=String(row.address||'').trim();
    const currentAddress=AddressTools ? AddressTools.currentAddress(originalAddress) : originalAddress;
    return Object.assign({},row,{
      id:Number(row.id)||0,name:String(row.name||'').trim(),bizNo:String(row.bizNo||'').trim(),address:originalAddress,currentAddress:currentAddress||originalAddress,
      sido:regionFromAddress(currentAddress||originalAddress,row.sido),law,item:String(row.item||'').trim(),generalArea,coldArea,storageArea,otherArea,
      logisticsArea,registeredArea,hasArea:registeredArea>0,
      _search:normalizeText([row.name,row.bizNo,normalizeBizNo(row.bizNo),originalAddress,currentAddress,row.item,law].join(' '))
    });
  }

  const META = window.WAREHOUSE_META || {};
  let DATA=[];
  let isIndexing=true;
  const state={regions:new Set(),types:new Set(),laws:new Set(),areaMin:0,areaStatus:'all',keyword:'',sorts:[],page:1,pageSize:100};
  const el=id=>document.getElementById(id);
  const els={
    keyword:el('keywordInput'),reset:el('resetAllBtn'),clearRegion:el('clearRegionBtn'),clearType:el('clearTypeBtn'),clearLaw:el('clearLawBtn'),clearArea:el('clearAreaBtn'),clearSort:el('clearSortBtn'),
    regions:el('regionChips'),types:el('typeChips'),laws:el('lawChips'),areas:el('areaChips'),areaStatus:el('areaStatusChips'),sorts:el('sortChips'),
    count:el('resultCount'),caption:el('resultCaption'),body:el('resultBody'),empty:el('emptyState'),pagination:el('pagination'),pageSize:el('pageSizeSelect'),
    drawer:el('detailDrawer'),backdrop:el('detailBackdrop'),close:el('closeDetailBtn'),detailName:el('detailName'),detailBizNo:el('detailBizNo'),detailContent:el('detailContent'),loading:el('loadingOverlay')
  };

  const REGION_LABELS={'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주','전남광주통합특별시':'전남광주'};
  const REGION_ORDER=['서울특별시','경기도','인천광역시','부산광역시','대구광역시','광주광역시','대전광역시','울산광역시','세종특별자치시','강원특별자치도','충청북도','충청남도','전북특별자치도','전라남도','전남광주통합특별시','경상북도','경상남도','제주특별자치도'];
  const TYPE_DEFS=[{key:'general',label:'일반',test:r=>r.generalArea>0},{key:'cold',label:'냉동·냉장',test:r=>r.coldArea>0},{key:'storage',label:'보관장소',test:r=>r.storageArea>0}];
  const LAW_ORDER=['물류시설법','축산물위생법','식품위생법','관세법','수산식품산업법','물류시설법(항만)','화학물질관리법'];
  const LAW_LABELS={'물류시설법':'물류시설법','축산물위생법':'축산물위생법','식품위생법':'식품위생법','관세법':'관세법','수산식품산업법':'수산식품산업법','물류시설법(항만)':'물류시설법(항만)','화학물질관리법':'화학물질관리법'};
  const AREA_DEFS=[{v:0,label:'전체'},{v:1000,label:'1,000㎡+'},{v:3000,label:'3,000㎡+'},{v:5000,label:'5,000㎡+'},{v:10000,label:'10,000㎡+'},{v:30000,label:'30,000㎡+'},{v:50000,label:'50,000㎡+'}];
  const AREA_STATUS_DEFS=[{key:'all',label:'전체'},{key:'has',label:'면적 있음'},{key:'missing',label:'면적 미제공'}];
  const SORT_DEFS=[
    {key:'registeredArea',label:'등록면적',defaultDir:'desc',area:true},{key:'name',label:'상호명',defaultDir:'asc'},{key:'sido',label:'지역',defaultDir:'asc'},
    {key:'law',label:'관련법률',defaultDir:'asc'},{key:'item',label:'품목',defaultDir:'asc'},{key:'currentAddress',label:'주소',defaultDir:'asc'}
  ];
  const sortDef=key=>SORT_DEFS.find(x=>x.key===key);

  function baseFilter(options){
    options=options||{};
    const q=normalizeText(state.keyword),bizQ=normalizeBizNo(state.keyword);
    return DATA.filter(r=>{
      if(!options.ignoreRegion && state.regions.size && !state.regions.has(r.sido)) return false;
      if(!options.ignoreType && state.types.size){
        const ok=Array.from(state.types).some(k=>{const d=TYPE_DEFS.find(x=>x.key===k);return d&&d.test(r);});
        if(!ok) return false;
      }
      if(!options.ignoreLaw && state.laws.size && !state.laws.has(r.law)) return false;
      if(!options.ignoreArea && state.areaMin && (!r.hasArea || r.registeredArea<state.areaMin)) return false;
      if(!options.ignoreAreaStatus){
        if(state.areaStatus==='has'&&!r.hasArea) return false;
        if(state.areaStatus==='missing'&&r.hasArea) return false;
      }
      if(q){const found=r._search.includes(q)||(bizQ&&normalizeBizNo(r.bizNo).includes(bizQ));if(!found)return false;}
      return true;
    });
  }

  function renderRegions(){
    let counts,keys;
    if(isIndexing && META && META.regionCounts){
      counts={};
      Object.entries(META.regionCounts).forEach(([raw,count])=>{
        const k=regionFromAddress('',raw);
        counts[k]=(counts[k]||0)+Number(count||0);
      });
      keys=Object.keys(counts);
    }else{
      const rows=baseFilter({ignoreRegion:true});
      counts=rows.reduce((a,r)=>(a[r.sido]=(a[r.sido]||0)+1,a),{});
      keys=Object.keys(DATA.reduce((a,r)=>(a[r.sido]=1,a),{}));
    }
    keys.sort((a,b)=>{const ai=REGION_ORDER.indexOf(a),bi=REGION_ORDER.indexOf(b);return(ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'ko');});
    els.regions.innerHTML=keys.map(k=>`<button class="chip region-chip ${state.regions.has(k)?'active':''}" data-region="${esc(k)}"><span>${esc(REGION_LABELS[k]||k)}</span><span class="chip-count">${Number(counts[k]||0).toLocaleString()}건</span></button>`).join('');
  }
  function renderTypes(){
    const rows=isIndexing?RAW_DATA:baseFilter({ignoreType:true});
    els.types.innerHTML=TYPE_DEFS.map(d=>{const count=rows.reduce((n,r)=>n+(d.test(r)?1:0),0);return `<button class="chip ${state.types.has(d.key)?'active':''}" data-type="${d.key}">${d.label}<span class="chip-mini-count">${count.toLocaleString()}</span></button>`;}).join('');
  }
  function renderLaws(){
    const rows=isIndexing?RAW_DATA:baseFilter({ignoreLaw:true});
    const counts=rows.reduce((a,r)=>(a[String(r.law||'').trim()]=(a[String(r.law||'').trim()]||0)+1,a),{});
    els.laws.innerHTML=LAW_ORDER.map(l=>`<button class="chip law-chip ${state.laws.has(l)?'active':''}" data-law="${esc(l)}">${esc(LAW_LABELS[l]||l)}<span class="chip-mini-count">${Number(counts[l]||0).toLocaleString()}</span></button>`).join('');
  }
  function renderAreas(){els.areas.innerHTML=AREA_DEFS.map(d=>`<button class="chip ${state.areaMin===d.v?'active':''}" data-area="${d.v}">${d.label}</button>`).join('');}
  function renderAreaStatus(){els.areaStatus.innerHTML=AREA_STATUS_DEFS.map(d=>`<button class="chip ${state.areaStatus===d.key?'active':''}" data-area-status="${d.key}">${d.label}</button>`).join('');}
  function renderSorts(){
    els.sorts.innerHTML=SORT_DEFS.map(d=>{
      const i=state.sorts.findIndex(s=>s.key===d.key),s=i>=0?state.sorts[i]:null;
      if(!s) return `<button class="chip sort-chip" type="button" data-sort="${d.key}" title="클릭하면 ${state.sorts.length+1}순위 정렬로 추가"><span>${d.label}</span></button>`;
      return `<div class="chip sort-chip active" data-sort-key="${d.key}">
        <button class="sort-main" type="button" data-sort-dir="${d.key}" title="다시 클릭하면 정렬 방향 전환">
          <span class="sort-index">${i+1}</span><span>${d.label}</span><span class="sort-dir">${s.dir==='asc'?'↑':'↓'}</span>
        </button>
        <button type="button" class="sort-x" data-sort-remove="${d.key}" title="이 정렬만 제거">×</button>
      </div>`;
    }).join('');
  }

  function compareText(a,b){return String(a||'').localeCompare(String(b||''),'ko-KR',{numeric:true,sensitivity:'base'});}
  function criterionCompare(a,b,s){
    const d=sortDef(s.key);let c=0;
    if(d&&d.area){
      if(a.hasArea!==b.hasArea) return a.hasArea?-1:1;
      c=a.registeredArea-b.registeredArea;
    }else c=compareText(a[s.key],b[s.key]);
    return s.dir==='asc'?c:-c;
  }
  function buildRankMap(rows,s){
    const ordered=rows.slice().sort((a,b)=>criterionCompare(a,b,s)||a.id-b.id);
    const rank=new Map();
    const denom=Math.max(1,ordered.length-1);
    ordered.forEach((r,i)=>rank.set(r.id,i/denom));
    return rank;
  }
  function sortRows(rows){
    if(!state.sorts.length)return rows.slice().sort((a,b)=>a.id-b.id);
    /*
      Weighted rank sort: ① is strongest, but ②·③ also always participate.
      This intentionally differs from strict SQL ORDER BY, where later keys only
      affect exact ties. The UI promise is that changing any active sort changes
      the overall ranking while preserving click-order priority.
    */
    const weights=[1,.34,.13,.055,.024,.01];
    const ranks=state.sorts.map(s=>buildRankMap(rows,s));
    const score=new Map();
    rows.forEach(r=>{
      let v=0;
      for(let i=0;i<ranks.length;i++) v+=(weights[i]||Math.pow(.42,i))*ranks[i].get(r.id);
      score.set(r.id,v);
    });
    return rows.slice().sort((a,b)=>{
      const diff=(score.get(a.id)||0)-(score.get(b.id)||0);
      if(Math.abs(diff)>1e-12)return diff;
      for(const s of state.sorts){const c=criterionCompare(a,b,s);if(c)return c;}
      return a.id-b.id;
    });
  }
  function typeBadges(r){return TYPE_DEFS.filter(d=>d.test(r)).map(d=>`<span class="type-badge">${d.label}</span>`).join('');}
  function classCell(r){const types=r.law==='물류시설법'?typeBadges(r):'';return `<div class="class-stack"><span class="law-badge">${esc(r.law||'법률 미기재')}</span>${types}</div>`;}
  function areaCell(r){return r.hasArea?`<div class="area-main">${fmt(r.registeredArea)}㎡</div><div class="area-sub">${pyung(r.registeredArea)}평</div>`:`<span class="area-missing">면적 미제공</span>`;}

  function renderRows(rows){
    const total=rows.length,pages=Math.max(1,Math.ceil(total/state.pageSize));if(state.page>pages)state.page=pages;
    const start=(state.page-1)*state.pageSize,visible=rows.slice(start,start+state.pageSize);
    if(isIndexing){
      const knownTotal=Number(META.count||RAW_DATA.length||total);
      els.count.textContent=knownTotal.toLocaleString()+'건';
      els.caption.textContent=`초기 ${total.toLocaleString()}건 표시 · 전체 ${knownTotal.toLocaleString()}건 준비 중`;
    }else{
      els.count.textContent=total.toLocaleString()+'건';
      els.caption.textContent=`검색결과 ${total.toLocaleString()}건 · 전체 ${DATA.length.toLocaleString()}건 · ${state.page}/${pages}페이지`;
    }
    els.empty.hidden=total!==0;
    els.body.innerHTML=visible.map((r,i)=>`<tr data-id="${r.id}">
      <td class="col-no">${start+i+1}</td>
      <td class="company-cell"><div class="company">${esc(r.name||'상호명 없음')}</div><div class="bizno">${esc(r.bizNo||'사업자번호 미기재')}</div></td>
      <td><div class="address">${esc(r.currentAddress||r.address||'-')}</div></td>
      <td>${classCell(r)}</td>
      <td class="num">${areaCell(r)}</td>
      <td class="item-cell"><div class="item ${r.item?'':'missing'}">${esc(r.item||'미기재')}</div></td>
      <td class="col-action"><button class="view-btn" data-detail="${r.id}" type="button">상세보기</button></td>
    </tr>`).join('');
    renderPagination(pages);
  }
  function renderPagination(pages){
    const cur=state.page;let start=Math.max(1,cur-3),end=Math.min(pages,start+6);start=Math.max(1,end-6);let h=`<button class="page-btn" data-page="${cur-1}" ${cur===1?'disabled':''}>‹</button>`;
    if(start>1)h+=`<button class="page-btn" data-page="1">1</button>${start>2?'<span>…</span>':''}`;for(let p=start;p<=end;p++)h+=`<button class="page-btn ${p===cur?'active':''}" data-page="${p}">${p}</button>`;if(end<pages)h+=`${end<pages-1?'<span>…</span>':''}<button class="page-btn" data-page="${pages}">${pages}</button>`;h+=`<button class="page-btn" data-page="${cur+1}" ${cur===pages?'disabled':''}>›</button>`;els.pagination.innerHTML=h;
  }
  function refresh(resetPage=true){if(resetPage)state.page=1;renderRegions();renderTypes();renderLaws();renderAreas();renderAreaStatus();renderSorts();renderRows(sortRows(baseFilter()));}
  function toggleSort(key){const idx=state.sorts.findIndex(s=>s.key===key),def=sortDef(key);if(idx<0)state.sorts.push({key,dir:def.defaultDir});else state.sorts[idx].dir=state.sorts[idx].dir==='asc'?'desc':'asc';refresh();}
  function removeSort(key){const idx=state.sorts.findIndex(s=>s.key===key);if(idx>=0){state.sorts.splice(idx,1);refresh();}}
  function rowById(id){return DATA.find(x=>x.id===Number(id));}

  function areaBreakdown(r){
    const lines=[];
    if(r.law==='물류시설법'){
      if(r.generalArea>0)lines.push(['일반창고',r.generalArea]);
      if(r.coldArea>0)lines.push(['냉동·냉장',r.coldArea]);
      if(r.storageArea>0)lines.push(['보관장소',r.storageArea]);
    }else if(r.otherArea>0) lines.push(['등록 창고면적',r.otherArea]);
    if(!lines.length)return '<div class="missing-note">이 데이터에는 면적정보가 제공되지 않습니다.</div>';
    return `<div class="area-breakdown">${lines.map(x=>`<div class="area-line"><span class="area-line-label">${esc(x[0])}</span><span class="area-line-value">${fmt(x[1])}㎡ <small>(${pyung(x[1])}평)</small></span></div>`).join('')}</div>`;
  }
  function typeSummary(r){
    if(r.law!=='물류시설법')return '';
    const badges=typeBadges(r);return badges?`<div class="detail-section"><div class="detail-section-title">창고 형태</div><div class="warehouse-types">${badges}</div></div>`:'';
  }

  async function resolveDetailAddress(r){
    const status=el('detailPnuStatus'),pnuEl=el('detailPnu'),currentEl=el('detailCurrentAddress');
    if(!AddressTools){if(status)status.textContent='주소 모듈 없음';return null;}
    if(status)status.textContent='PNU 조회중…';
    try{const result=await AddressTools.resolveAddress(r.address);if(currentEl)currentEl.textContent=result.currentAddress||r.currentAddress||r.address||'-';if(pnuEl)pnuEl.textContent=result.pnu||'-';if(status)status.textContent=result.pnu?'PNU 확인':'PNU 미확정';return result;}
    catch(err){if(status)status.textContent='PNU 조회 실패';if(pnuEl)pnuEl.textContent='-';return null;}
  }
  function openDetail(id){
    const r=rowById(id);if(!r)return;els.detailName.textContent=r.name||'상호명 없음';els.detailBizNo.textContent=r.bizNo?`사업자번호 ${r.bizNo}`:'사업자번호 미기재';
    els.detailContent.innerHTML=`
      <div class="address-box">
        <div class="address-row"><span class="address-label">원본주소</span><span class="address-value">${esc(r.address||'-')}</span></div>
        <div class="address-row"><span class="address-label">현재주소</span><span class="address-value" id="detailCurrentAddress">${esc(r.currentAddress||r.address||'-')}</span></div>
        <div class="pnu-row"><span id="detailPnuStatus" class="pnu-status">PNU 조회중…</span><code id="detailPnu" class="pnu-code">-</code></div>
      </div>
      <div class="map-actions"><button class="map-btn naver" data-map="naver" type="button">네이버지도</button><button class="map-btn ddangya" data-map="ddangya" type="button">땅야 토지상세</button><button class="map-btn copy" data-map="copy-pnu" type="button">PNU 복사</button></div>
      <div class="detail-primary">
        <div class="info-card"><div class="info-label">관련 법률</div><div class="info-value">${esc(r.law||'미기재')}</div></div>
        <div class="info-card"><div class="info-label">등록면적</div>${r.hasArea?`<div class="info-value registered-area">${fmt(r.registeredArea)}㎡ <small>${pyung(r.registeredArea)}평</small></div>`:`<div class="info-value"><span class="area-missing">면적 미제공</span></div>`}</div>
      </div>
      ${typeSummary(r)}
      <div class="detail-section"><div class="detail-section-title">면적 구성</div>${areaBreakdown(r)}</div>
      <div class="detail-section"><div class="detail-section-title">취급품목</div><div class="info-card item-box">${esc(r.item||'미기재')}</div></div>`;
    els.detailContent.dataset.id=String(r.id);els.backdrop.hidden=false;els.drawer.classList.add('open');els.drawer.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';resolveDetailAddress(r);
  }
  function closeDetail(){els.drawer.classList.remove('open');els.drawer.setAttribute('aria-hidden','true');els.backdrop.hidden=true;document.body.style.overflow='';}
  function showMapError(err){alert((err&&err.message)||'지도 연결에 실패했습니다.');}
  async function openMapForRow(r,kind){if(!r||!AddressTools)return showMapError(new Error('주소 연결 모듈을 불러오지 못했습니다.'));try{if(kind==='ddangya')await AddressTools.openDdangya(r.address);else await AddressTools.openNaver(r.address);}catch(err){showMapError(err);}}
  async function copyText(value){value=String(value||'').trim();if(!value||value==='-')return;try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(value);else throw new Error();}catch(_e){const ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(_x){}ta.remove();}}

  els.regions.addEventListener('click',e=>{const b=e.target.closest('[data-region]');if(!b)return;const k=b.dataset.region;state.regions.has(k)?state.regions.delete(k):state.regions.add(k);refresh();});
  els.types.addEventListener('click',e=>{const b=e.target.closest('[data-type]');if(!b)return;const k=b.dataset.type;state.types.has(k)?state.types.delete(k):state.types.add(k);refresh();});
  els.laws.addEventListener('click',e=>{const b=e.target.closest('[data-law]');if(!b)return;const k=b.dataset.law;state.laws.has(k)?state.laws.delete(k):state.laws.add(k);refresh();});
  els.areas.addEventListener('click',e=>{const b=e.target.closest('[data-area]');if(!b)return;state.areaMin=Number(b.dataset.area)||0;refresh();});
  els.areaStatus.addEventListener('click',e=>{const b=e.target.closest('[data-area-status]');if(!b)return;state.areaStatus=b.dataset.areaStatus||'all';refresh();});
  els.sorts.addEventListener('click',e=>{
    const dir=e.target.closest('[data-sort-dir]');if(dir){toggleSort(dir.dataset.sortDir);return;}
    const rm=e.target.closest('[data-sort-remove]');if(rm){removeSort(rm.dataset.sortRemove);return;}
    const add=e.target.closest('[data-sort]');if(add)toggleSort(add.dataset.sort);
  });
  els.keyword.addEventListener('input',()=>{state.keyword=els.keyword.value.trim();refresh();});
  els.clearRegion.addEventListener('click',()=>{state.regions.clear();refresh();});els.clearType.addEventListener('click',()=>{state.types.clear();refresh();});els.clearLaw.addEventListener('click',()=>{state.laws.clear();refresh();});els.clearArea.addEventListener('click',()=>{state.areaMin=0;state.areaStatus='all';refresh();});els.clearSort.addEventListener('click',()=>{state.sorts=[];refresh();});
  els.reset.addEventListener('click',()=>{state.regions.clear();state.types.clear();state.laws.clear();state.areaMin=0;state.areaStatus='all';state.keyword='';state.sorts=[];state.page=1;els.keyword.value='';refresh();});
  els.pageSize.addEventListener('change',()=>{state.pageSize=Number(els.pageSize.value)||100;refresh();});
  els.pagination.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b||b.disabled)return;state.page=Math.max(1,Number(b.dataset.page)||1);renderRows(sortRows(baseFilter()));window.scrollTo({top:document.querySelector('.results-panel').offsetTop-8,behavior:'smooth'});});
  els.body.addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(b)openDetail(Number(b.dataset.detail));});
  els.close.addEventListener('click',closeDetail);els.backdrop.addEventListener('click',closeDetail);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail();});
  els.detailContent.addEventListener('click',async e=>{const b=e.target.closest('[data-map]');if(!b)return;const r=rowById(els.detailContent.dataset.id);if(!r)return;if(b.dataset.map==='copy-pnu'){await copyText((el('detailPnu')&&el('detailPnu').textContent)||'');return;}openMapForRow(r,b.dataset.map);});

  function hideLoading(){
    if(!els.loading)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>els.loading.classList.add('is-done')));
    setTimeout(()=>{if(els.loading)els.loading.setAttribute('aria-hidden','true');},240);
  }
  function yieldToBrowser(){
    return new Promise(resolve=>{
      if('requestIdleCallback' in window){
        requestIdleCallback(()=>resolve(),{timeout:60});
      }else{
        setTimeout(resolve,0);
      }
    });
  }
  async function buildFullDataInBackground(){
    try{
      if(AddressTools&&AddressTools.ready) await AddressTools.ready;
    }catch(err){
      console.warn('[warehouse] address module background ready fallback:',err);
    }
    const full=new Array(RAW_DATA.length);
    const chunkSize=250;
    for(let start=0;start<RAW_DATA.length;start+=chunkSize){
      const end=Math.min(RAW_DATA.length,start+chunkSize);
      for(let i=start;i<end;i++) full[i]=normalizeRow(RAW_DATA[i]);
      await yieldToBrowser();
    }
    DATA=full;
    isIndexing=false;
    refresh(false);
  }
  function initialize(){
    try{
      const initialCount=Math.min(100,RAW_DATA.length);
      DATA=RAW_DATA.slice(0,initialCount).map(normalizeRow);
      refresh(false);
      hideLoading();
      setTimeout(()=>{buildFullDataInBackground().catch(err=>console.warn('[warehouse] background indexing failed:',err));},0);
    }catch(err){
      console.warn('[warehouse] initial 100 load fallback:',err);
      DATA=RAW_DATA.slice(0,Math.min(100,RAW_DATA.length)).map(normalizeRow);
      refresh(false);
      hideLoading();
      setTimeout(()=>{buildFullDataInBackground().catch(e=>console.warn('[warehouse] background indexing failed:',e));},0);
    }
  }
  initialize();
})();
