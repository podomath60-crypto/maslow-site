(function(){
  'use strict';
  const DATA = Array.isArray(window.WAREHOUSE_DATA) ? window.WAREHOUSE_DATA : [];
  const META = window.WAREHOUSE_META || {};
  const state = { regions:new Set(), types:new Set(), areaMin:0, keyword:'', sorts:[], page:1, pageSize:100 };
  const el = id => document.getElementById(id);
  const els = {
    keyword:el('keywordInput'), reset:el('resetAllBtn'), clearRegion:el('clearRegionBtn'), clearType:el('clearTypeBtn'), clearArea:el('clearAreaBtn'), clearSort:el('clearSortBtn'),
    regions:el('regionChips'), types:el('typeChips'), areas:el('areaChips'), sorts:el('sortChips'), activeSorts:el('activeSorts'), activeFilters:el('activeFilters'),
    count:el('resultCount'), caption:el('resultCaption'), body:el('resultBody'), empty:el('emptyState'), pagination:el('pagination'), pageSize:el('pageSizeSelect'),
    drawer:el('detailDrawer'), backdrop:el('detailBackdrop'), close:el('closeDetailBtn'), detailName:el('detailName'), detailContent:el('detailContent')
  };

  const REGION_LABELS = {'서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','강원도':'강원(구)','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라북도':'전북(구)','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주','전남광주통합특별시':'전남광주','경기':'경기(기타)'};
  const TYPE_DEFS = [
    {key:'general',label:'일반창고',test:r=>r.generalArea>0}, {key:'cold',label:'냉동·냉장',test:r=>r.coldArea>0},
    {key:'storage',label:'보관장소',test:r=>r.storageArea>0}, {key:'other',label:'타법률창고',test:r=>r.otherArea>0}
  ];
  const AREA_DEFS = [{v:0,label:'전체'},{v:1000,label:'1,000㎡+'},{v:3000,label:'3,000㎡+'},{v:5000,label:'5,000㎡+'},{v:10000,label:'10,000㎡+'},{v:20000,label:'20,000㎡+'},{v:50000,label:'50,000㎡+'}];
  const SORT_DEFS = [
    {key:'item',label:'품목순',defaultDir:'asc'}, {key:'totalArea',label:'총면적',defaultDir:'desc'}, {key:'name',label:'이름순',defaultDir:'asc'},
    {key:'generalArea',label:'일반면적',defaultDir:'desc'}, {key:'coldArea',label:'냉동·냉장면적',defaultDir:'desc'}, {key:'address',label:'주소순',defaultDir:'asc'}, {key:'bizNo',label:'사업자번호',defaultDir:'asc'}
  ];
  const sortDef = key => SORT_DEFS.find(x=>x.key===key);
  const esc = s => String(s==null?'':s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt = n => Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:2});
  const pyung = n => (Number(n||0)/3.305785).toLocaleString('ko-KR',{maximumFractionDigits:0});
  const normalize = s => String(s||'').trim().toLocaleLowerCase('ko-KR');

  function renderRegions(){
    const counts = META.regionCounts || DATA.reduce((a,r)=>(a[r.sido]=(a[r.sido]||0)+1,a),{});
    const order=['서울특별시','경기도','인천광역시','부산광역시','대구광역시','광주광역시','대전광역시','울산광역시','세종특별자치시','강원특별자치도','강원도','충청북도','충청남도','전북특별자치도','전라북도','전남광주통합특별시','전라남도','경상북도','경상남도','제주특별자치도','경기'];
    const keys = Object.keys(counts).sort((a,b)=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'ko');});
    els.regions.innerHTML = keys.map(k=>`<button class="chip region-chip ${state.regions.has(k)?'active':''}" data-region="${esc(k)}"><span>${esc(REGION_LABELS[k]||k)}</span><span class="chip-count">${Number(counts[k]||0).toLocaleString()}건</span></button>`).join('');
  }
  function renderTypes(){ els.types.innerHTML=TYPE_DEFS.map(d=>`<button class="chip ${state.types.has(d.key)?'active':''}" data-type="${d.key}">${d.label}</button>`).join(''); }
  function renderAreas(){ els.areas.innerHTML=AREA_DEFS.map(d=>`<button class="chip ${state.areaMin===d.v?'active':''}" data-area="${d.v}">${d.label}</button>`).join(''); }
  function renderSorts(){
    els.sorts.innerHTML=SORT_DEFS.map(d=>{const i=state.sorts.findIndex(s=>s.key===d.key); const s=i>=0?state.sorts[i]:null; return `<button class="chip sort-chip ${s?'active':''}" data-sort="${d.key}">${s?`<span class="sort-index">${i+1}</span>`:''}<span>${d.label}</span>${s?`<span class="sort-dir">${s.dir==='asc'?'↑':'↓'}</span>`:''}</button>`}).join('');
    if(state.sorts.length){els.activeSorts.hidden=false;els.activeSorts.innerHTML='<strong>적용 순서</strong> · '+state.sorts.map((s,i)=>`${i+1}. ${sortDef(s.key).label} ${s.dir==='asc'?'오름차순':'내림차순'}`).join(' → ');}else{els.activeSorts.hidden=true;els.activeSorts.textContent='';}
  }
  function renderActiveFilters(){
    const parts=[];
    if(state.regions.size) parts.push('지역 '+Array.from(state.regions).map(r=>REGION_LABELS[r]||r).join(' · '));
    if(state.types.size) parts.push('유형 '+Array.from(state.types).map(k=>TYPE_DEFS.find(d=>d.key===k).label).join(' · '));
    if(state.areaMin) parts.push('총면적 '+fmt(state.areaMin)+'㎡ 이상');
    if(state.keyword) parts.push('검색 “'+state.keyword+'”');
    if(parts.length){els.activeFilters.hidden=false;els.activeFilters.innerHTML='<strong>적용 필터</strong> · '+parts.map(esc).join(' / ');}else{els.activeFilters.hidden=true;els.activeFilters.textContent='';}
  }

  function filterRows(){
    const q=normalize(state.keyword);
    return DATA.filter(r=>{
      if(state.regions.size && !state.regions.has(r.sido)) return false;
      if(state.types.size && !Array.from(state.types).every(k=>TYPE_DEFS.find(d=>d.key===k).test(r))) return false;
      if(state.areaMin && r.totalArea<state.areaMin) return false;
      if(q && !normalize([r.name,r.bizNo,r.address,r.item,r.law].join(' ')).includes(q)) return false;
      return true;
    });
  }
  function compareText(a,b){return String(a||'').localeCompare(String(b||''),'ko',{numeric:true,sensitivity:'base'});}
  function sortRows(rows){
    if(!state.sorts.length) return rows.slice().sort((a,b)=>a.id-b.id);
    return rows.slice().sort((a,b)=>{
      for(const s of state.sorts){
        const av=a[s.key],bv=b[s.key]; let c;
        if(typeof av==='number'||typeof bv==='number') c=(Number(av)||0)-(Number(bv)||0); else c=compareText(av,bv);
        if(c) return s.dir==='asc'?c:-c;
      }
      return a.id-b.id;
    });
  }
  function renderRows(rows){
    const total=rows.length, pages=Math.max(1,Math.ceil(total/state.pageSize)); if(state.page>pages)state.page=pages;
    const start=(state.page-1)*state.pageSize, visible=rows.slice(start,start+state.pageSize);
    els.count.textContent=total.toLocaleString()+'건'; els.caption.textContent=`전체 ${DATA.length.toLocaleString()}건 중 · ${state.page}/${pages}페이지`;
    els.empty.hidden=total!==0;
    els.body.innerHTML=visible.map((r,i)=>`<tr data-id="${r.id}">
      <td class="col-no">${start+i+1}</td>
      <td><div class="company">${esc(r.name||'상호명 없음')}</div><div class="bizno">${esc(r.bizNo)}</div></td>
      <td><div class="address">${esc(r.address)}</div></td>
      <td class="num" data-label="총"><div class="area-main">${fmt(r.totalArea)}㎡</div><div class="area-sub">${pyung(r.totalArea)}평</div></td>
      <td class="num" data-label="일반">${r.generalArea?fmt(r.generalArea)+'㎡':'-'}</td>
      <td class="num" data-label="냉장">${r.coldArea?fmt(r.coldArea)+'㎡':'-'}</td>
      <td><div class="item">${esc(r.item||'-')}</div></td>
      <td class="col-action"><button class="view-btn" data-detail="${r.id}" type="button">상세</button></td>
    </tr>`).join('');
    renderPagination(pages);
  }
  function renderPagination(pages){
    const cur=state.page; let start=Math.max(1,cur-3),end=Math.min(pages,start+6); start=Math.max(1,end-6);
    let h=`<button class="page-btn" data-page="${cur-1}" ${cur===1?'disabled':''}>‹</button>`;
    if(start>1) h+=`<button class="page-btn" data-page="1">1</button>${start>2?'<span>…</span>':''}`;
    for(let p=start;p<=end;p++) h+=`<button class="page-btn ${p===cur?'active':''}" data-page="${p}">${p}</button>`;
    if(end<pages) h+=`${end<pages-1?'<span>…</span>':''}<button class="page-btn" data-page="${pages}">${pages}</button>`;
    h+=`<button class="page-btn" data-page="${cur+1}" ${cur===pages?'disabled':''}>›</button>`; els.pagination.innerHTML=h;
  }
  function refresh(resetPage=true){if(resetPage)state.page=1;renderRegions();renderTypes();renderAreas();renderSorts();renderActiveFilters();renderRows(sortRows(filterRows()));}

  function toggleSort(key){
    const idx=state.sorts.findIndex(s=>s.key===key),def=sortDef(key);
    if(idx<0) state.sorts.push({key,dir:def.defaultDir});
    else state.sorts[idx].dir=state.sorts[idx].dir==='asc'?'desc':'asc';
    refresh();
  }
  function openDetail(id){
    const r=DATA.find(x=>x.id===id); if(!r)return;
    els.detailName.textContent=r.name||'상호명 없음';
    els.detailContent.innerHTML=`
      <div class="detail-address">${esc(r.address)}</div>
      <div class="map-actions"><button class="map-btn naver" data-map="naver" type="button">네이버 지도</button><button class="map-btn ddangya" data-map="ddangya" type="button">땅야에서 확인</button></div>
      <div class="detail-grid">
        <div class="detail-card wide"><div class="detail-label">총 창고면적</div><div class="detail-value detail-total">${fmt(r.totalArea)}㎡ <span style="font-size:13px;color:#64748b">(${pyung(r.totalArea)}평)</span></div></div>
        <div class="detail-card"><div class="detail-label">일반창고면적</div><div class="detail-value">${fmt(r.generalArea)}㎡</div></div>
        <div class="detail-card"><div class="detail-label">냉동냉장창고면적</div><div class="detail-value">${fmt(r.coldArea)}㎡</div></div>
        <div class="detail-card"><div class="detail-label">보관장소면적</div><div class="detail-value">${fmt(r.storageArea)}㎡</div></div>
        <div class="detail-card"><div class="detail-label">타법률창고면적</div><div class="detail-value">${fmt(r.otherArea)}㎡</div></div>
        <div class="detail-card wide"><div class="detail-label">취급품목</div><div class="detail-value">${esc(r.item||'-')}</div></div>
        <div class="detail-card"><div class="detail-label">사업자번호</div><div class="detail-value">${esc(r.bizNo||'-')}</div></div>
        <div class="detail-card"><div class="detail-label">관련법률</div><div class="detail-value">${esc(r.law||'-')}</div></div>
      </div>
      <div class="detail-note">땅야는 원본 데이터에 PNU가 없어 주소를 클립보드에 복사한 뒤 땅야 메인 페이지를 엽니다. 네이버 지도는 주소 검색 결과를 바로 엽니다.</div>`;
    els.detailContent.dataset.address=r.address||''; els.backdrop.hidden=false; els.drawer.classList.add('open'); els.drawer.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
  }
  function closeDetail(){els.drawer.classList.remove('open');els.drawer.setAttribute('aria-hidden','true');els.backdrop.hidden=true;document.body.style.overflow='';}
  function openNaver(address){if(address)window.open('https://map.naver.com/p/search/'+encodeURIComponent(address),'_blank','noopener,noreferrer');}
  async function openDdangya(address){
    try{if(address&&navigator.clipboard)await navigator.clipboard.writeText(address);}catch(e){}
    window.open('https://ddangya.com/','_blank','noopener,noreferrer');
  }

  els.regions.addEventListener('click',e=>{const b=e.target.closest('[data-region]');if(!b)return;const k=b.dataset.region;state.regions.has(k)?state.regions.delete(k):state.regions.add(k);refresh();});
  els.types.addEventListener('click',e=>{const b=e.target.closest('[data-type]');if(!b)return;const k=b.dataset.type;state.types.has(k)?state.types.delete(k):state.types.add(k);refresh();});
  els.areas.addEventListener('click',e=>{const b=e.target.closest('[data-area]');if(!b)return;state.areaMin=Number(b.dataset.area)||0;refresh();});
  els.sorts.addEventListener('click',e=>{const b=e.target.closest('[data-sort]');if(b)toggleSort(b.dataset.sort);});
  els.keyword.addEventListener('input',()=>{state.keyword=els.keyword.value.trim();refresh();});
  els.clearRegion.addEventListener('click',()=>{state.regions.clear();refresh();}); els.clearType.addEventListener('click',()=>{state.types.clear();refresh();}); els.clearArea.addEventListener('click',()=>{state.areaMin=0;refresh();}); els.clearSort.addEventListener('click',()=>{state.sorts=[];refresh();});
  els.reset.addEventListener('click',()=>{state.regions.clear();state.types.clear();state.areaMin=0;state.keyword='';state.sorts=[];state.page=1;els.keyword.value='';refresh();});
  els.pageSize.addEventListener('change',()=>{state.pageSize=Number(els.pageSize.value)||100;refresh();});
  els.pagination.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b||b.disabled)return;state.page=Math.max(1,Number(b.dataset.page)||1);renderRows(sortRows(filterRows()));window.scrollTo({top:document.querySelector('.results-head').offsetTop-12,behavior:'smooth'});});
  els.body.addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(b)openDetail(Number(b.dataset.detail));});
  els.close.addEventListener('click',closeDetail);els.backdrop.addEventListener('click',closeDetail);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail();});
  els.detailContent.addEventListener('click',e=>{const b=e.target.closest('[data-map]');if(!b)return;const a=els.detailContent.dataset.address||'';b.dataset.map==='naver'?openNaver(a):openDdangya(a);});

  refresh(false);
})();
