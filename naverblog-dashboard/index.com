<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>블로그 작업 현황</title>
  <style>
    :root{
      --bg:#f6f8fc;
      --paper:#ffffff;
      --ink:#16181d;
      --muted:#6f7b88;
      --line:#e7ecf2;
      --blue:#0f7cff;
      --blue-soft:#eef5ff;
      --green:#19b36b;
      --green-soft:#ecfbf3;
      --pink:#e84b82;
      --pink-soft:#fff1f6;
      --orange:#ff9f1a;
      --orange-soft:#fff7eb;
      --gray-soft:#f5f7fa;
      --shadow:0 18px 38px rgba(15,23,42,.08);
      --page:1180px;
    }
    *{box-sizing:border-box}
    html,body{
      margin:0;padding:0;background:var(--bg);color:var(--ink);
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR","Apple SD Gothic Neo",sans-serif;
    }
    body{min-width:0}
    button,input,select{font:inherit}
    button{cursor:pointer;border:none;background:none}
    .page{min-height:100vh;padding:0 0 56px}
    .topbar{
      position:sticky;top:0;z-index:40;
      backdrop-filter:blur(12px);
      background:rgba(246,248,252,.92);
      border-bottom:1px solid rgba(231,236,242,.92);
    }
    .topbar-inner{
      max-width:var(--page);margin:0 auto;padding:14px 16px;
    }
    .topline{
      display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
      margin-bottom:12px;
    }
    .title-wrap{display:grid;gap:6px}
    .title{
      margin:0;font-size:28px;line-height:1.15;font-weight:950;letter-spacing:-0.05em;
    }
    .sub{
      font-size:13px;line-height:1.5;color:var(--muted);font-weight:800;
    }
    .ghost-btn,.primary-btn{
      min-height:42px;padding:0 14px;border-radius:14px;font-size:14px;font-weight:900;letter-spacing:-0.03em;
      border:1px solid var(--line);box-shadow:0 8px 20px rgba(15,23,42,.04);
      background:#fff;color:var(--ink);
    }
    .primary-btn{background:var(--blue);border-color:var(--blue);color:#fff}
    .toolbar{
      display:grid;grid-template-columns:minmax(0,1.5fr) 180px 160px auto;gap:8px;align-items:center;
    }
    .search,.select{
      width:100%;min-height:44px;padding:0 14px;border-radius:14px;border:1px solid var(--line);
      background:#fff;color:var(--ink);outline:none;font-size:14px;font-weight:800;
      box-shadow:0 8px 20px rgba(15,23,42,.03);
    }
    .chip-row{
      max-width:var(--page);margin:14px auto 0;padding:0 16px;
      display:flex;gap:8px;flex-wrap:wrap;
    }
    .chip{
      min-height:34px;padding:0 12px;border-radius:999px;border:1px solid #dbe5f0;background:#fff;
      color:#415163;font-size:12px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;
    }
    .chip.is-active{background:var(--blue-soft);border-color:#cfe2ff;color:var(--blue)}
    .summary{
      max-width:var(--page);margin:18px auto 0;padding:0 16px;
      display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;
    }
    .sum-card{
      background:var(--paper);border:1px solid var(--line);border-radius:22px;padding:16px 16px 15px;box-shadow:var(--shadow);
    }
    .sum-label{font-size:12px;color:var(--muted);font-weight:900;letter-spacing:.01em}
    .sum-value{margin-top:6px;font-size:28px;line-height:1;font-weight:950;letter-spacing:-0.05em}
    .shell{max-width:var(--page);margin:16px auto 0;padding:0 16px}
    .empty{
      border:1px dashed #d8e1ec;border-radius:26px;background:#fff;padding:48px 20px;text-align:center;
      color:#768392;font-size:15px;font-weight:900;
    }
    .list{display:grid;gap:14px}
    .card{
      display:grid;grid-template-columns:200px minmax(0,1fr);
      gap:16px;background:var(--paper);border:1px solid var(--line);border-radius:28px;padding:14px;box-shadow:var(--shadow);
    }
    .thumb{
      width:100%;aspect-ratio:1 / .78;border-radius:20px;border:1px solid #ebeff5;background:#eef2f6 center/cover no-repeat;
      overflow:hidden;
    }
    .thumb.empty{display:flex;align-items:center;justify-content:center;color:#93a0af;font-size:13px;font-weight:900}
    .body{min-width:0;display:grid;gap:10px}
    .card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .status-col{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .status-pill{
      min-height:30px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;
      border:1px solid transparent;white-space:nowrap;
    }
    .pill-draft{background:var(--blue-soft);border-color:#cfe2ff;color:var(--blue)}
    .pill-ready{background:var(--orange-soft);border-color:#ffd8a0;color:#c46c00}
    .pill-published{background:var(--green-soft);border-color:#bde9cf;color:#148a53}
    .pill-failed{background:var(--pink-soft);border-color:#f7c4d8;color:#c23669}
    .pill-muted{background:var(--gray-soft);border-color:#e3e8ef;color:#6f7b88}
    .date{font-size:12px;color:#8b96a3;font-weight:900;white-space:nowrap}
    .card-title{
      font-size:24px;line-height:1.32;font-weight:950;letter-spacing:-0.045em;word-break:keep-all;
      margin:0;
    }
    .meta{
      display:flex;gap:8px;flex-wrap:wrap;
    }
    .meta-item{
      min-height:30px;padding:0 10px;border-radius:999px;background:#f8fafc;border:1px solid #e7edf5;
      color:#52606f;font-size:12px;font-weight:900;display:inline-flex;align-items:center;
    }
    .desc{
      font-size:14px;line-height:1.7;color:#3e4b59;font-weight:700;word-break:keep-all;white-space:pre-line;
    }
    .error-box{
      border:1px solid #f3c1d4;background:#fff5f8;color:#ab295b;border-radius:18px;padding:12px 14px;
      font-size:13px;line-height:1.6;font-weight:800;white-space:pre-line;
    }
    .actions{display:flex;gap:8px;flex-wrap:wrap}
    .btn{
      min-height:40px;padding:0 13px;border-radius:12px;border:1px solid var(--line);background:#fff;color:var(--ink);
      font-size:13px;font-weight:900;letter-spacing:-0.03em;
    }
    .btn.blue{background:var(--blue-soft);border-color:#cfe2ff;color:var(--blue)}
    .btn.green{background:var(--green-soft);border-color:#bde9cf;color:#148a53}
    .btn.pink{background:var(--pink-soft);border-color:#f7c4d8;color:#c23669}
    .loading-overlay{
      position:fixed;inset:0;z-index:120;display:none;align-items:center;justify-content:center;
      background:rgba(255,255,255,.74);backdrop-filter:blur(3px);padding:24px;
    }
    .loading-overlay.show{display:flex}
    .loading-panel{display:grid;gap:12px;justify-items:center;text-align:center}
    .spinner{
      width:66px;height:66px;border-radius:999px;border:5px solid #dae8ff;border-top-color:#0f7cff;animation:spin 1s linear infinite
    }
    .loading-text{font-size:18px;font-weight:900;color:#257fe3;letter-spacing:-0.03em}
    @keyframes spin{to{transform:rotate(360deg)}}
    .toast{
      position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:140;min-width:180px;max-width:calc(100% - 40px);
      padding:13px 16px;border-radius:14px;background:rgba(17,24,39,.92);color:#fff;font-size:14px;font-weight:800;
      line-height:1.45;text-align:center;opacity:0;pointer-events:none;transition:opacity .18s ease;
    }
    .toast.show{opacity:1}
    @media (max-width: 980px){
      .toolbar{grid-template-columns:1fr 1fr}
      .summary{grid-template-columns:repeat(2,minmax(0,1fr))}
      .card{grid-template-columns:1fr}
      .card-title{font-size:21px}
    }
    @media (max-width: 640px){
      .title{font-size:24px}
      .summary{grid-template-columns:1fr 1fr}
      .toolbar{grid-template-columns:1fr}
      .sum-value{font-size:24px}
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div class="topbar-inner">
        <div class="topline">
          <div class="title-wrap">
            <h1 class="title">블로그 작업 현황</h1>
            <div class="sub">AI 생성 내역, 발행상태, 실패건 확인, 편집 진입</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="ghost-btn" id="refreshBtn">새로고침</button>
            <button type="button" class="primary-btn" id="goInputBtn">발행기로 이동</button>
          </div>
        </div>
        <div class="toolbar">
          <input id="searchInput" class="search" type="text" placeholder="제목, 매물번호, 주소 검색" autocomplete="off" />
          <select id="statusSelect" class="select">
            <option value="all">상태 전체</option>
            <option value="draft">AI생성완료</option>
            <option value="ready">발행대기</option>
            <option value="published">발행완료</option>
            <option value="failed">실패</option>
          </select>
          <select id="sortSelect" class="select">
            <option value="updated_desc">최근수정순</option>
            <option value="created_desc">최근생성순</option>
            <option value="published_desc">최근발행순</option>
          </select>
          <button type="button" class="ghost-btn" id="clearBtn">필터 초기화</button>
        </div>
      </div>
    </div>

    <div class="chip-row" id="quickChips"></div>

    <div class="summary">
      <div class="sum-card"><div class="sum-label">전체</div><div class="sum-value" id="sumAll">0</div></div>
      <div class="sum-card"><div class="sum-label">AI생성완료</div><div class="sum-value" id="sumDraft">0</div></div>
      <div class="sum-card"><div class="sum-label">발행대기</div><div class="sum-value" id="sumReady">0</div></div>
      <div class="sum-card"><div class="sum-label">발행완료</div><div class="sum-value" id="sumPublished">0</div></div>
      <div class="sum-card"><div class="sum-label">실패</div><div class="sum-value" id="sumFailed">0</div></div>
    </div>

    <div class="shell">
      <div id="emptyBox" class="empty" style="display:none;">작업 내역이 없습니다.</div>
      <div id="list" class="list"></div>
    </div>
  </div>

  <div id="loadingOverlay" class="loading-overlay" aria-hidden="true">
    <div class="loading-panel">
      <div class="spinner"></div>
      <div id="loadingText" class="loading-text">불러오는 중</div>
    </div>
  </div>
  <div id="toast" class="toast"></div>

  <script>
    const CONFIG = {
      adminListUrl: 'https://script.google.com/macros/s/AKfycbznhBvYFIv_GKeNoGIPFTi_mIXXH04BOvYrb4ZN9dk_Cc4Xjir3TP_vL3bbPrLLxgg2/exec',
      editorUrl: '/blog-editor',
      inputUrl: '/naverbloginput'
    };

    const state = {
      rows: [],
      filtered: [],
      quickStatus: 'all'
    };

    const els = {
      searchInput: document.getElementById('searchInput'),
      statusSelect: document.getElementById('statusSelect'),
      sortSelect: document.getElementById('sortSelect'),
      refreshBtn: document.getElementById('refreshBtn'),
      clearBtn: document.getElementById('clearBtn'),
      goInputBtn: document.getElementById('goInputBtn'),
      quickChips: document.getElementById('quickChips'),
      list: document.getElementById('list'),
      emptyBox: document.getElementById('emptyBox'),
      sumAll: document.getElementById('sumAll'),
      sumDraft: document.getElementById('sumDraft'),
      sumReady: document.getElementById('sumReady'),
      sumPublished: document.getElementById('sumPublished'),
      sumFailed: document.getElementById('sumFailed'),
      loadingOverlay: document.getElementById('loadingOverlay'),
      loadingText: document.getElementById('loadingText'),
      toast: document.getElementById('toast')
    };

    function text(v){ return String(v == null ? '' : v).trim(); }
    function esc(v){
      return String(v == null ? '' : v).replace(/[&<>"']/g, function(s){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[s];
      });
    }
    function parseJson(v, fallback){ try{ const x = JSON.parse(v); return x == null ? fallback : x; }catch(_){ return fallback; } }
    function setLoading(on, label){
      els.loadingText.textContent = label || '불러오는 중';
      els.loadingOverlay.classList.toggle('show', !!on);
    }
    function showToast(msg){
      if(!msg) return;
      els.toast.textContent = msg;
      els.toast.classList.add('show');
      clearTimeout(showToast._timer);
      showToast._timer = setTimeout(function(){ els.toast.classList.remove('show'); }, 1800);
    }
    function fetchPostJson(payload){
      return fetch(CONFIG.adminListUrl, {
        method:'POST',
        mode:'cors',
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body: JSON.stringify(payload)
      }).then(function(res){
        if(!res.ok) throw new Error('요청 실패: ' + res.status);
        return res.json();
      });
    }
    function formatDate(v){
      const s = text(v);
      if(!s) return '-';
      const d = new Date(s);
      if(isNaN(d.getTime())) return s;
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const day = String(d.getDate()).padStart(2,'0');
      const hh = String(d.getHours()).padStart(2,'0');
      const mm = String(d.getMinutes()).padStart(2,'0');
      return y + '.' + m + '.' + day + ' ' + hh + ':' + mm;
    }
    function makeThumbUrl(row){
      return text(row.heroImageUrl)
        || ((parseJson(row.infoImageFilesJson || '[]', [])[0] || {}).url || '')
        || '';
    }
    function makeTitle(row){
      return text(row.draftTitle) || text(row.publishedTitle) || text(row.seoTitle) || '제목 없음';
    }
    function makeAddress(row){
      return text(row.addressMasked) || text(row.address) || (parseJson(row.listingSnapshotJson || '{}', {}).addressMasked || '') || '-';
    }
    function makeDealPrice(row){
      const deal = text(row.dealTypeSnapshot);
      const price = text(row.priceSnapshot);
      if(deal && price) return deal + ' / ' + price;
      return deal || price || '-';
    }
    function classifyStatus(row){
      const status = text(row.status).toLowerCase();
      const sub = text(row.subStatus).toLowerCase();
      const publishedUrl = text(row.publishedUrl);
      const err = text(row.errorMessage) || text(row.errorCode) || text(row.errorStage);

      if(status.indexOf('publish') > -1 && status.indexOf('ready') > -1) return 'ready';
      if(sub.indexOf('ready') > -1) return 'ready';
      if(status.indexOf('published') > -1 || sub.indexOf('published') > -1 || publishedUrl) return 'published';
      if(status.indexOf('error') > -1 || sub.indexOf('error') > -1 || err) return 'failed';
      return 'draft';
    }
    function statusLabel(type){
      if(type === 'ready') return '발행대기';
      if(type === 'published') return '발행완료';
      if(type === 'failed') return '실패';
      return 'AI생성완료';
    }
    function statusClass(type){
      if(type === 'ready') return 'pill-ready';
      if(type === 'published') return 'pill-published';
      if(type === 'failed') return 'pill-failed';
      return 'pill-draft';
    }
    function normalizeRow(row, idx){
      const item = row || {};
      const cls = classifyStatus(item);
      return {
        idx: idx,
        blogId: text(item.blogId),
        listingNumber: text(item.listingNumber),
        title: makeTitle(item),
        statusType: cls,
        statusLabel: statusLabel(cls),
        styleType: text(item.styleType) || '-',
        address: makeAddress(item),
        priceLine: makeDealPrice(item),
        createdAt: text(item.createdAt),
        updatedAt: text(item.updatedAt),
        publishedAt: text(item.publishedAt),
        publishedUrl: text(item.publishedUrl),
        heroImageUrl: makeThumbUrl(item),
        errorMessage: text(item.errorMessage),
        publishAttemptCount: text(item.publishAttemptCount || '0'),
        isUserEdited: String(item.isUserEdited).toLowerCase() === 'true' || item.isUserEdited === true,
        raw: item
      };
    }
    function sortRows(rows){
      const mode = text(els.sortSelect.value) || 'updated_desc';
      const getTs = function(v){
        const t = new Date(text(v)).getTime();
        return isNaN(t) ? 0 : t;
      };
      return rows.slice().sort(function(a,b){
        if(mode === 'created_desc') return getTs(b.createdAt) - getTs(a.createdAt);
        if(mode === 'published_desc') return getTs(b.publishedAt) - getTs(a.publishedAt);
        return getTs(b.updatedAt || b.createdAt) - getTs(a.updatedAt || a.createdAt);
      });
    }
    function matchesSearch(row, q){
      if(!q) return true;
      const hay = [
        row.title, row.blogId, row.listingNumber, row.address, row.styleType,
        text(row.raw && row.raw.status), text(row.raw && row.raw.subStatus)
      ].join(' ').toLowerCase();
      return hay.indexOf(q.toLowerCase()) > -1;
    }
    function applyFilters(){
      const q = text(els.searchInput.value);
      const selectStatus = text(els.statusSelect.value || 'all');
      const chipStatus = text(state.quickStatus || 'all');
      const finalStatus = chipStatus !== 'all' ? chipStatus : selectStatus;

      let rows = state.rows.filter(function(row){
        if(finalStatus !== 'all' && row.statusType !== finalStatus) return false;
        return matchesSearch(row, q);
      });

      rows = sortRows(rows);
      state.filtered = rows;
      renderSummary();
      renderQuickChips();
      renderList();
    }
    function renderSummary(){
      const counts = { all: state.rows.length, draft:0, ready:0, published:0, failed:0 };
      state.rows.forEach(function(row){
        if(counts[row.statusType] != null) counts[row.statusType] += 1;
      });
      els.sumAll.textContent = counts.all;
      els.sumDraft.textContent = counts.draft;
      els.sumReady.textContent = counts.ready;
      els.sumPublished.textContent = counts.published;
      els.sumFailed.textContent = counts.failed;
    }
    function renderQuickChips(){
      const defs = [
        ['all','전체'],
        ['draft','AI생성완료'],
        ['ready','발행대기'],
        ['published','발행완료'],
        ['failed','실패']
      ];
      els.quickChips.innerHTML = defs.map(function(def){
        const key = def[0], label = def[1];
        return '<button type="button" class="chip' + (state.quickStatus === key ? ' is-active' : '') + '" data-chip-status="' + key + '">' + esc(label) + '</button>';
      }).join('');
      Array.prototype.forEach.call(els.quickChips.querySelectorAll('[data-chip-status]'), function(btn){
        btn.addEventListener('click', function(){
          state.quickStatus = btn.getAttribute('data-chip-status') || 'all';
          applyFilters();
        });
      });
    }
    function renderList(){
      const rows = state.filtered || [];
      if(!rows.length){
        els.emptyBox.style.display = 'block';
        els.list.innerHTML = '';
        els.emptyBox.textContent = state.rows.length ? '조건에 맞는 작업이 없습니다.' : '작업 내역이 없습니다.';
        return;
      }
      els.emptyBox.style.display = 'none';
      els.list.innerHTML = rows.map(function(row){
        const thumbStyle = row.heroImageUrl ? 'background-image:url(\'' + esc(row.heroImageUrl) + '\')' : '';
        const thumbClass = 'thumb' + (row.heroImageUrl ? '' : ' empty');
        const metaEdited = row.isUserEdited ? '<span class="meta-item">사용자수정</span>' : '';
        const errorHtml = row.errorMessage ? '<div class="error-box">실패 사유\\n' + esc(row.errorMessage) + '</div>' : '';
        const pubUrlBtn = row.publishedUrl ? '<button type="button" class="btn green" data-open-url="' + esc(row.publishedUrl) + '">게시글 열기</button>' : '';
        return ''
          + '<div class="card">'
          + '  <div class="' + thumbClass + '" style="' + thumbStyle + '">' + (row.heroImageUrl ? '' : '썸네일 없음') + '</div>'
          + '  <div class="body">'
          + '    <div class="card-top">'
          + '      <div class="status-col">'
          + '        <span class="status-pill ' + statusClass(row.statusType) + '">' + esc(row.statusLabel) + '</span>'
          + '        <span class="status-pill pill-muted">' + esc(text(row.raw.status) || '-') + ' / ' + esc(text(row.raw.subStatus) || '-') + '</span>'
          + '      </div>'
          + '      <div class="date">수정 ' + esc(formatDate(row.updatedAt || row.createdAt)) + '</div>'
          + '    </div>'
          + '    <h2 class="card-title">' + esc(row.title) + '</h2>'
          + '    <div class="meta">'
          + '      <span class="meta-item">매물번호 ' + esc(row.listingNumber || '-') + '</span>'
          + '      <span class="meta-item">스타일 ' + esc(row.styleType) + '</span>'
          + '      <span class="meta-item">가격 ' + esc(row.priceLine) + '</span>'
          + '      <span class="meta-item">발행시도 ' + esc(row.publishAttemptCount || '0') + '</span>'
          +        metaEdited
          + '    </div>'
          + '    <div class="desc">' + esc(row.address) + '\\n생성 ' + esc(formatDate(row.createdAt)) + (row.publishedAt ? '\\n발행 ' + esc(formatDate(row.publishedAt)) : '') + '</div>'
          +        errorHtml
          + '    <div class="actions">'
          + '      <button type="button" class="btn blue" data-edit-blogid="' + esc(row.blogId) + '">편집</button>'
          + '      <button type="button" class="btn" data-copy-blogid="' + esc(row.blogId) + '">blogId 복사</button>'
          +         pubUrlBtn
          + '    </div>'
          + '  </div>'
          + '</div>';
      }).join('');

      Array.prototype.forEach.call(els.list.querySelectorAll('[data-edit-blogid]'), function(btn){
        btn.addEventListener('click', function(){
          const blogId = btn.getAttribute('data-edit-blogid');
          if(!blogId) return;
          location.href = CONFIG.editorUrl + '?blogId=' + encodeURIComponent(blogId);
        });
      });
      Array.prototype.forEach.call(els.list.querySelectorAll('[data-open-url]'), function(btn){
        btn.addEventListener('click', function(){
          const url = btn.getAttribute('data-open-url');
          if(url) window.open(url, '_blank');
        });
      });
      Array.prototype.forEach.call(els.list.querySelectorAll('[data-copy-blogid]'), function(btn){
        btn.addEventListener('click', function(){
          const blogId = btn.getAttribute('data-copy-blogid') || '';
          navigator.clipboard.writeText(blogId).then(function(){ showToast('blogId 복사 완료'); }).catch(function(){ showToast('복사 실패'); });
        });
      });
    }
    function loadRows(){
      setLoading(true, '작업 내역 불러오는 중');
      fetchPostJson({ action:'listBlogDrafts' })
        .then(function(data){
          const items = (data && (data.items || data.rows || data.list)) || [];
          state.rows = (Array.isArray(items) ? items : []).map(normalizeRow);
          renderSummary();
          applyFilters();
          showToast('작업 내역을 불러왔습니다');
        })
        .catch(function(err){
          console.error(err);
          state.rows = [];
          state.filtered = [];
          renderSummary();
          renderQuickChips();
          renderList();
          showToast((err && err.message) || '불러오기 실패');
        })
        .finally(function(){
          setLoading(false);
        });
    }

    els.searchInput.addEventListener('input', applyFilters);
    els.statusSelect.addEventListener('change', function(){
      state.quickStatus = 'all';
      applyFilters();
    });
    els.sortSelect.addEventListener('change', applyFilters);
    els.refreshBtn.addEventListener('click', loadRows);
    els.clearBtn.addEventListener('click', function(){
      els.searchInput.value = '';
      els.statusSelect.value = 'all';
      els.sortSelect.value = 'updated_desc';
      state.quickStatus = 'all';
      applyFilters();
    });
    els.goInputBtn.addEventListener('click', function(){
      location.href = CONFIG.inputUrl;
    });

    renderQuickChips();
    renderSummary();
    renderList();
    loadRows();
  </script>
</body>
</html>
