(function(){
  'use strict';

  const RAW_DATA = Array.isArray(window.WAREHOUSE_DATA) ? window.WAREHOUSE_DATA : [];
  const META = window.WAREHOUSE_META || {};
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
    const generalArea = toNumber(row.generalArea);
    const coldArea = toNumber(row.coldArea);
    const storageArea = toNumber(row.storageArea);
    const otherArea = toNumber(row.otherArea);
    const totalArea = generalArea + coldArea + storageArea + otherArea;
    const originalAddress = String(row.address || '').trim();
    const currentAddress = AddressTools ? AddressTools.currentAddress(originalAddress) : originalAddress;
    return Object.assign({},row,{
      id: Number(row.id)||0,
      name:String(row.name||'').trim(),
      bizNo:String(row.bizNo||'').trim(),
      address:originalAddress,
      currentAddress:currentAddress || originalAddress,
      sido:regionFromAddress(currentAddress || originalAddress,row.sido),
      generalArea,coldArea,storageArea,otherArea,totalArea,
      item:String(row.item||'').trim(),law:String(row.law||'').trim(),
      _search:normalizeText([row.name,row.bizNo,normalizeBizNo(row.bizNo),originalAddress,currentAddress,row.item,row.law].join(' '))
    });
  }

  let DATA = RAW_DATA.map(normalizeRow);

  const state = {regions:new Set(),types:new Set(),areaMin:0,keyword:'',sorts:[],page:1,pageSize:100};
  const el = id => document.getElementById(id);
  const els = {
    keyword:el('keywordInput'),reset:el('resetAllBtn'),clearRegion:el('clearRegionBtn'),clearType:el('clearTypeBtn'),clearArea:el('clearAreaBtn'),clearSort:el('clearSortBtn'),
    regions:el('regionChips'),types:el('typeChips'),areas:el('areaChips'),sorts:el('sortChips'),activeSorts:el('activeSorts'),activeFilters:el('activeFilters'),
    count:el('resultCount'),caption:el('resultCaption'),body:el('resultBody'),empty:el('emptyState'),pagination:el('pagination'),pageSize:el('pageSizeSelect'),
    drawer:el('detailDrawer'),backdrop:el('detailBackdrop'),close:el('closeDetailBtn'),detailName:el('detailName'),detailContent:el('detailContent')
  };

  const REGION_LABELS = {
    '서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산',
    '세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라남도':'전남',
    '경상북도':'경북','경상남도':'경남','제주특별자치도':'제주','전남광주통합특별시':'전남광주'
  };
  const REGION_ORDER = ['서울특별시','경기도','인천광역시','부산광역시','대구광역시','광주광역시','대전광역시','울산광역시','세종특별자치시','강원특별자치도','충청북도','충청남도','전북특별자치도','전라남도','전남광주통합특별시','경상북도','경상남도','제주특별자치도'];
  const TYPE_DEFS = [
    {key:'general',label:'일반창고',test:r=>r.generalArea>0},
    {key:'cold',label:'냉동·냉장',test:r=>r.coldArea>0},
    {key:'storage',label:'보관장소',test:r=>r.storageArea>0},
    {key:'other',label:'타법률창고',test:r=>r.otherArea>0}
  ];
  const AREA_DEFS = [{v:0,label:'전체'},{v:1000,label:'1,000㎡+'},{v:3000,label:'3,000㎡+'},{v:5000,label:'5,000㎡+'},{v:10000,label:'10,000㎡+'},{v:20000,label:'20,000㎡+'},{v:50000,label:'50,000㎡+'}];
  const SORT_DEFS = [
    {key:'item',label:'품목순',defaultDir:'asc'},
    {key:'totalArea',label:'총면적',defaultDir:'desc'},
    {key:'name',label:'이름순',defaultDir:'asc'},
    {key:'generalArea',label:'일반면적',defaultDir:'desc'},
    {key:'coldArea',label:'냉동·냉장면적',defaultDir:'desc'},
    {key:'storageArea',label:'보관장소면적',defaultDir:'desc'},
    {key:'otherArea',label:'타법률면적',defaultDir:'desc'},
    {key:'currentAddress',label:'주소순',defaultDir:'asc'},
    {key:'bizNo',label:'사업자번호',defaultDir:'asc'}
  ];
  const sortDef = key => SORT_DEFS.find(x=>x.key===key);

  function regionCounts(){
    return DATA.reduce((acc,r)=>{const k=r.sido||'기타';acc[k]=(acc[k]||0)+1;return acc;},{});
  }
  function renderRegions(){
    const counts=regionCounts();
    const keys=Object.keys(counts).sort((a,b)=>{
      const ai=REGION_ORDER.indexOf(a),bi=REGION_ORDER.indexOf(b);
      return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'ko');
    });
    els.regions.innerHTML=keys.map(k=>`<button class="chip region-chip ${state.regions.has(k)?'active':''}" data-region="${esc(k)}"><span>${esc(REGION_LABELS[k]||k)}</span><span class="chip-count">${Number(counts[k]||0).toLocaleString()}건</span></button>`).join('');
  }
  function renderTypes(){
    const filteredWithoutTypes=filterRows({ignoreTypes:true});
    els.types.innerHTML=TYPE_DEFS.map(d=>{
      const count=filteredWithoutTypes.reduce((n,r)=>n+(d.test(r)?1:0),0);
      return `<button class="chip ${state.types.has(d.key)?'active':''}" data-type="${d.key}"><span>${d.label}</span><span class="chip-mini-count">${count.toLocaleString()}</span></button>`;
    }).join('');
  }
  function renderAreas(){
    els.areas.innerHTML=AREA_DEFS.map(d=>`<button class="chip ${state.areaMin===d.v?'active':''}" data-area="${d.v}">${d.label}</button>`).join('');
  }
  function renderSorts(){
    els.sorts.innerHTML=SORT_DEFS.map(d=>{
      const i=state.sorts.findIndex(s=>s.key===d.key),s=i>=0?state.sorts[i]:null;
      return `<button class="chip sort-chip ${s?'active':''}" data-sort="${d.key}">${s?`<span class="sort-index">${i+1}</span>`:''}<span>${d.label}</span>${s?`<span class="sort-dir">${s.dir==='asc'?'↑':'↓'}</span>`:''}</button>`;
    }).join('');
    if(state.sorts.length){
      els.activeSorts.hidden=false;
      els.activeSorts.innerHTML='<strong>정렬</strong> · '+state.sorts.map((s,i)=>`${i+1}. ${sortDef(s.key).label} ${s.dir==='asc'?'↑':'↓'}`).join(' → ');
    }else{els.activeSorts.hidden=true;els.activeSorts.textContent='';}
  }
  function renderActiveFilters(){
    const parts=[];
    if(state.regions.size) parts.push('지역 '+Array.from(state.regions).map(r=>REGION_LABELS[r]||r).join(' · '));
    if(state.types.size) parts.push('유형 '+Array.from(state.types).map(k=>TYPE_DEFS.find(d=>d.key===k).label).join(' · '));
    if(state.areaMin) parts.push('총면적 '+fmt(state.areaMin)+'㎡ 이상');
    if(state.keyword) parts.push('검색 “'+state.keyword+'”');
    if(parts.length){els.activeFilters.hidden=false;els.activeFilters.innerHTML='<strong>필터</strong> · '+parts.map(esc).join(' / ');}else{els.activeFilters.hidden=true;els.activeFilters.textContent='';}
  }

  function filterRows(options){
    options=options||{};
    const q=normalizeText(state.keyword);
    const bizQ=normalizeBizNo(state.keyword);
    return DATA.filter(r=>{
      if(state.regions.size && !state.regions.has(r.sido)) return false;
      // 같은 필터군(창고유형)은 OR: 선택 유형 중 하나라도 해당하면 포함.
      if(!options.ignoreTypes && state.types.size){
        const ok=Array.from(state.types).some(k=>{const d=TYPE_DEFS.find(x=>x.key===k);return d&&d.test(r);});
        if(!ok) return false;
      }
      if(state.areaMin && r.totalArea<state.areaMin) return false;
      if(q){
        const found=r._search.includes(q) || (bizQ && normalizeBizNo(r.bizNo).includes(bizQ));
        if(!found) return false;
      }
      return true;
    });
  }
  function compareText(a,b){return String(a||'').localeCompare(String(b||''),'ko-KR',{numeric:true,sensitivity:'base'});}
  function sortRows(rows){
    if(!state.sorts.length) return rows.slice().sort((a,b)=>a.id-b.id);
    return rows.slice().sort((a,b)=>{
      for(const s of state.sorts){
        const av=a[s.key],bv=b[s.key];
        const c=(typeof av==='number'||typeof bv==='number') ? (toNumber(av)-toNumber(bv)) : compareText(av,bv);
        if(c) return s.dir==='asc'?c:-c;
      }
      return a.id-b.id;
    });
  }
  function typeBadges(r){
    return TYPE_DEFS.filter(d=>d.test(r)).map(d=>`<span class="type-badge">${d.label}</span>`).join('');
  }
  function renderRows(rows){
    const total=rows.length,pages=Math.max(1,Math.ceil(total/state.pageSize));
    if(state.page>pages) state.page=pages;
    const start=(state.page-1)*state.pageSize,visible=rows.slice(start,start+state.pageSize);
    els.count.textContent=total.toLocaleString()+'건';
    els.caption.textContent=`검색결과 ${total.toLocaleString()}건 · 전체 ${DATA.length.toLocaleString()}건 · ${state.page}/${pages}페이지`;
    els.empty.hidden=total!==0;
    els.body.innerHTML=visible.map((r,i)=>`<tr data-id="${r.id}">
      <td class="col-no">${start+i+1}</td>
      <td><div class="company">${esc(r.name||'상호명 없음')}</div><div class="bizno">${esc(r.bizNo)}</div><div class="type-badges">${typeBadges(r)}</div></td>
      <td><div class="address">${esc(r.currentAddress||r.address)}</div></td>
      <td class="num"><div class="area-main">${fmt(r.totalArea)}㎡</div><div class="area-sub">${pyung(r.totalArea)}평</div></td>
      <td class="num">${r.generalArea?fmt(r.generalArea)+'㎡':'-'}</td>
      <td class="num">${r.coldArea?fmt(r.coldArea)+'㎡':'-'}</td>
      <td><div class="item">${esc(r.item||'-')}</div></td>
      <td class="col-action"><div class="row-actions"><button class="mini-map-btn ddangya" data-row-map="ddangya" data-id="${r.id}" type="button" title="땅야">땅</button><button class="mini-map-btn naver" data-row-map="naver" data-id="${r.id}" type="button" title="네이버지도">N</button><button class="view-btn" data-detail="${r.id}" type="button">상세</button></div></td>
    </tr>`).join('');
    renderPagination(pages);
  }
  function renderPagination(pages){
    const cur=state.page;let start=Math.max(1,cur-3),end=Math.min(pages,start+6);start=Math.max(1,end-6);
    let h=`<button class="page-btn" data-page="${cur-1}" ${cur===1?'disabled':''}>‹</button>`;
    if(start>1) h+=`<button class="page-btn" data-page="1">1</button>${start>2?'<span>…</span>':''}`;
    for(let p=start;p<=end;p++) h+=`<button class="page-btn ${p===cur?'active':''}" data-page="${p}">${p}</button>`;
    if(end<pages) h+=`${end<pages-1?'<span>…</span>':''}<button class="page-btn" data-page="${pages}">${pages}</button>`;
    h+=`<button class="page-btn" data-page="${cur+1}" ${cur===pages?'disabled':''}>›</button>`;
    els.pagination.innerHTML=h;
  }
  function refresh(resetPage=true){
    if(resetPage) state.page=1;
    renderRegions();renderAreas();renderSorts();renderActiveFilters();renderTypes();renderRows(sortRows(filterRows()));
  }

  function toggleSort(key){
    const idx=state.sorts.findIndex(s=>s.key===key),def=sortDef(key);
    if(idx<0) state.sorts.push({key,dir:def.defaultDir});
    else state.sorts[idx].dir=state.sorts[idx].dir==='asc'?'desc':'asc';
    refresh();
  }
  function rowById(id){return DATA.find(x=>x.id===Number(id));}

  async function resolveDetailAddress(r){
    const status=el('detailPnuStatus'),pnuEl=el('detailPnu'),currentEl=el('detailCurrentAddress');
    if(!AddressTools){if(status)status.textContent='주소 모듈 없음';return null;}
    if(status) status.textContent='PNU 조회중…';
    try{
      const result=await AddressTools.resolveAddress(r.address);
      if(currentEl) currentEl.textContent=result.currentAddress||r.currentAddress||r.address||'-';
      if(pnuEl) pnuEl.textContent=result.pnu||'-';
      if(status) status.textContent=result.pnu ? 'PNU 확인' : 'PNU 미확정';
      return result;
    }catch(err){
      if(status) status.textContent='PNU 조회 실패';
      if(pnuEl) pnuEl.textContent='-';
      return null;
    }
  }

  function openDetail(id){
    const r=rowById(id);if(!r)return;
    els.detailName.textContent=r.name||'상호명 없음';
    els.detailContent.innerHTML=`
      <div class="detail-address"><strong>원본주소</strong> ${esc(r.address||'-')}</div>
      <div class="detail-address current"><strong>현재주소</strong> <span id="detailCurrentAddress">${esc(r.currentAddress||r.address||'-')}</span></div>
      <div class="pnu-line"><span id="detailPnuStatus" class="pnu-status">PNU 조회중…</span><code id="detailPnu">-</code></div>
      <div class="map-actions"><button class="map-btn naver" data-map="naver" type="button">네이버지도</button><button class="map-btn ddangya" data-map="ddangya" type="button">땅야 토지상세</button><button class="map-btn copy" data-map="copy-pnu" type="button">PNU 복사</button></div>
      <div class="detail-grid">
        <div class="detail-card wide"><div class="detail-label">총 창고면적</div><div class="detail-value detail-total">${fmt(r.totalArea)}㎡ <span class="detail-py">(${pyung(r.totalArea)}평)</span></div></div>
        <div class="detail-card"><div class="detail-label">일반창고면적</div><div class="detail-value">${fmt(r.generalArea)}㎡</div></div>
        <div class="detail-card"><div class="detail-label">냉동냉장창고면적</div><div class="detail-value">${fmt(r.coldArea)}㎡</div></div>
        <div class="detail-card"><div class="detail-label">보관장소면적</div><div class="detail-value">${fmt(r.storageArea)}㎡</div></div>
        <div class="detail-card"><div class="detail-label">타법률창고면적</div><div class="detail-value">${fmt(r.otherArea)}㎡</div></div>
        <div class="detail-card wide"><div class="detail-label">창고 분류</div><div class="detail-value type-badges">${typeBadges(r)||'-'}</div></div>
        <div class="detail-card wide"><div class="detail-label">취급품목</div><div class="detail-value">${esc(r.item||'-')}</div></div>
        <div class="detail-card"><div class="detail-label">사업자번호</div><div class="detail-value">${esc(r.bizNo||'-')}</div></div>
        <div class="detail-card"><div class="detail-label">관련법률</div><div class="detail-value">${esc(r.law||'-')}</div></div>
      </div>`;
    els.detailContent.dataset.id=String(r.id);
    els.backdrop.hidden=false;els.drawer.classList.add('open');els.drawer.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
    resolveDetailAddress(r);
  }
  function closeDetail(){els.drawer.classList.remove('open');els.drawer.setAttribute('aria-hidden','true');els.backdrop.hidden=true;document.body.style.overflow='';}
  function showMapError(err){alert((err&&err.message)||'지도 연결에 실패했습니다.');}
  async function openMapForRow(r,kind){
    if(!r||!AddressTools) return showMapError(new Error('주소 연결 모듈을 불러오지 못했습니다.'));
    try{if(kind==='ddangya') await AddressTools.openDdangya(r.address); else await AddressTools.openNaver(r.address);}catch(err){showMapError(err);}
  }
  async function copyText(value){
    value=String(value||'').trim();if(!value)return;
    try{if(navigator.clipboard&&navigator.clipboard.writeText) await navigator.clipboard.writeText(value);else throw new Error();}
    catch(_e){const ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(_x){}ta.remove();}
  }

  els.regions.addEventListener('click',e=>{const b=e.target.closest('[data-region]');if(!b)return;const k=b.dataset.region;state.regions.has(k)?state.regions.delete(k):state.regions.add(k);refresh();});
  els.types.addEventListener('click',e=>{const b=e.target.closest('[data-type]');if(!b)return;const k=b.dataset.type;state.types.has(k)?state.types.delete(k):state.types.add(k);refresh();});
  els.areas.addEventListener('click',e=>{const b=e.target.closest('[data-area]');if(!b)return;state.areaMin=Number(b.dataset.area)||0;refresh();});
  els.sorts.addEventListener('click',e=>{const b=e.target.closest('[data-sort]');if(b)toggleSort(b.dataset.sort);});
  els.keyword.addEventListener('input',()=>{state.keyword=els.keyword.value.trim();refresh();});
  els.clearRegion.addEventListener('click',()=>{state.regions.clear();refresh();});
  els.clearType.addEventListener('click',()=>{state.types.clear();refresh();});
  els.clearArea.addEventListener('click',()=>{state.areaMin=0;refresh();});
  els.clearSort.addEventListener('click',()=>{state.sorts=[];refresh();});
  els.reset.addEventListener('click',()=>{state.regions.clear();state.types.clear();state.areaMin=0;state.keyword='';state.sorts=[];state.page=1;els.keyword.value='';refresh();});
  els.pageSize.addEventListener('change',()=>{state.pageSize=Number(els.pageSize.value)||100;refresh();});
  els.pagination.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b||b.disabled)return;state.page=Math.max(1,Number(b.dataset.page)||1);renderRows(sortRows(filterRows()));window.scrollTo({top:document.querySelector('.results-panel').offsetTop-8,behavior:'smooth'});});
  els.body.addEventListener('click',e=>{
    const mapBtn=e.target.closest('[data-row-map]');
    if(mapBtn){e.preventDefault();e.stopPropagation();openMapForRow(rowById(mapBtn.dataset.id),mapBtn.dataset.rowMap);return;}
    const b=e.target.closest('[data-detail]');if(b)openDetail(Number(b.dataset.detail));
  });
  els.close.addEventListener('click',closeDetail);els.backdrop.addEventListener('click',closeDetail);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail();});
  els.detailContent.addEventListener('click',async e=>{
    const b=e.target.closest('[data-map]');if(!b)return;
    const r=rowById(els.detailContent.dataset.id);if(!r)return;
    if(b.dataset.map==='copy-pnu'){await copyText((el('detailPnu')&&el('detailPnu').textContent)||'');return;}
    openMapForRow(r,b.dataset.map);
  });

  refresh(false);
  if(AddressTools && AddressTools.ready){
    AddressTools.ready.then(function(){
      DATA=RAW_DATA.map(normalizeRow);
      refresh(false);
    });
  }
})();
