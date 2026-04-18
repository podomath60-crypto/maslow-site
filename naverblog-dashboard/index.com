<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>블로그 발행 박업현황</title>
  <style>
    :root{
      --bg:#f5f7fb;
      --card:#ffffff;
      --line:#e6ebf2;
      --ink:#18202a;
      --muted:#6b7280;
      --blue:#0f7cff;
      --green:#10b981;
      --amber:#f59e0b;
      --shadow:0 14px 32px rgba(15,23,42,.08);
      --radius:24px;
      --max:1280px;
    }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR","Apple SD Gothic Neo",sans-serif}
    body{min-width:0}
    a{text-decoration:none;color:inherit}
    button{font:inherit;border:none;background:none;cursor:pointer}

    .page{min-height:100vh;padding:26px 14px 48px}
    .wrap{max-width:var(--max);margin:0 auto}
    .head{
      display:flex;align-items:flex-end;justify-content:space-between;gap:16px;
      margin-bottom:20px;
    }
    .title{margin:0;font-size:34px;line-height:1.2;font-weight:950;letter-spacing:-0.05em}
    .sub{margin:8px 0 0;font-size:14px;color:var(--muted);font-weight:800}
    .count{
      display:inline-flex;align-items:center;justify-content:center;
      min-height:42px;padding:0 16px;border-radius:999px;
      background:#fff;border:1px solid var(--line);box-shadow:var(--shadow);
      font-size:14px;font-weight:900;white-space:nowrap;
    }

    .grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:18px;
    }

    .card{
      background:var(--card);
      border:1px solid var(--line);
      border-radius:var(--radius);
      overflow:hidden;
      box-shadow:var(--shadow);
    }
    .thumb{
      width:100%;
      aspect-ratio:16/9;
      background:#eef2f7 center/cover no-repeat;
      display:flex;align-items:center;justify-content:center;
      color:#97a1ae;font-size:14px;font-weight:900;
    }
    .body{padding:18px 18px 18px}
    .meta{
      display:flex;align-items:center;justify-content:space-between;gap:12px;
      margin-bottom:10px;
    }
    .date{font-size:13px;color:var(--muted);font-weight:800}
    .status{
      display:inline-flex;align-items:center;justify-content:center;
      min-height:30px;padding:0 12px;border-radius:999px;
      font-size:12px;font-weight:900;white-space:nowrap;
      border:1px solid transparent;
    }
    .status.draft{background:#eff6ff;border-color:#cfe2ff;color:#2563eb}
    .status.scheduled{background:#fff7ed;border-color:#fed7aa;color:#c2410c}
    .status.published{background:#ecfdf5;border-color:#a7f3d0;color:#047857}

    .listing{font-size:13px;color:#7b8491;font-weight:900;margin-bottom:8px}
    .card-title{
      margin:0;
      font-size:22px;line-height:1.42;font-weight:950;letter-spacing:-0.04em;
      word-break:keep-all;
      min-height:62px;
    }

    .actions{
      display:flex;align-items:center;gap:10px;margin-top:18px;
    }
    .btn{
      display:inline-flex;align-items:center;justify-content:center;
      min-height:44px;padding:0 16px;border-radius:14px;
      font-size:14px;font-weight:900;
      border:1px solid var(--line);
      background:#fff;color:var(--ink);
      flex:1 1 0;
    }
    .btn.primary{
      background:var(--blue);
      border-color:var(--blue);
      color:#fff;
    }
    .btn.green{
      background:var(--green);
      border-color:var(--green);
      color:#fff;
    }
    .btn.disabled{
      background:#f3f4f6;
      border-color:#e5e7eb;
      color:#9ca3af;
      cursor:default;
      pointer-events:none;
    }

    .loading,
    .empty{
      padding:60px 18px;
      text-align:center;
      color:var(--muted);
      font-size:16px;
      font-weight:900;
    }

    @media (max-width:900px){
      .page{padding:18px 10px 36px}
      .head{align-items:flex-start;flex-direction:column}
      .title{font-size:28px}
      .grid{grid-template-columns:1fr}
      .card-title{font-size:20px;min-height:auto}
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="wrap">
      <div class="head">
        <div>
          <h1 class="title">블로그 대시보드</h1>
          <p class="sub">createdAt 기준 최신순</p>
        </div>
        <div class="count" id="countBox">불러오는 중</div>
      </div>

      <div id="loadingBox" class="loading">블로그 리스트를 불러오는 중입니다.</div>
      <div id="emptyBox" class="empty" style="display:none;">표시할 블로그가 없습니다.</div>
      <div id="grid" class="grid" style="display:none;"></div>
    </div>
  </div>

  <script>
    const CONFIG = {
      adminListUrl: 'https://script.google.com/macros/s/AKfycbznhBvYFIv_GKeNoGIPFTi_mIXXH04BOvYrb4ZN9dk_Cc4Xjir3TP_vL3bbPrLLxgg2/exec',
      siteOrigin: 'https://maslowkorea.site'
    };

    const els = {
      countBox: document.getElementById('countBox'),
      loadingBox: document.getElementById('loadingBox'),
      emptyBox: document.getElementById('emptyBox'),
      grid: document.getElementById('grid')
    };

    function text(v){ return String(v == null ? '' : v).trim(); }
    function esc(v){
      return String(v == null ? '' : v).replace(/[&<>"']/g, function(s){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'})[s];
      });
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

    function formatDate(iso){
      const s = text(iso);
      if(!s) return '-';
      const d = new Date(s);
      if(isNaN(d.getTime())) return s;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
    }

    function getStatusClass(status){
      if(status === '발행완료') return 'published';
      if(status === '예약발행중') return 'scheduled';
      return 'draft';
    }

    function renderAction(item){
      const status = text(item.displayStatus);

      if(status === '발행완료'){
        if(text(item.publishedUrl)){
          return '<a class="btn green" href="' + esc(item.publishedUrl) + '" target="_blank" rel="noopener noreferrer">발행글 보기</a>';
        }
        return '<div class="btn disabled">발행완료</div>';
      }

      if(status === '예약발행중'){
        return '<div class="btn disabled">예약중</div>';
      }

      return '<a class="btn primary" href="' + esc(item.editorUrl) + '" target="_blank" rel="noopener noreferrer">검수하기</a>';
    }

    function renderCard(item){
      const thumb = text(item.heroImageUrl);
      const thumbHtml = thumb
        ? '<div class="thumb" style="background-image:url(\'' + thumb.replace(/'/g, '%27') + '\')"></div>'
        : '<div class="thumb">대표사진 없음</div>';

      return ''
        + '<article class="card">'
        +   thumbHtml
        +   '<div class="body">'
        +     '<div class="meta">'
        +       '<div class="date">' + esc(formatDate(item.createdAt)) + '</div>'
        +       '<div class="status ' + getStatusClass(item.displayStatus) + '">' + esc(item.displayStatus) + '</div>'
        +     '</div>'
        +     '<div class="listing">' + esc(text(item.listingNumber) || '-') + '</div>'
        +     '<h2 class="card-title">' + esc(text(item.title) || '제목 없음') + '</h2>'
        +     '<div class="actions">'
        +       renderAction(item)
        +     '</div>'
        +   '</div>'
        + '</article>';
    }

    function render(items){
      els.countBox.textContent = '총 ' + items.length + '건';
      els.loadingBox.style.display = 'none';

      if(!items.length){
        els.emptyBox.style.display = 'block';
        els.grid.style.display = 'none';
        els.grid.innerHTML = '';
        return;
      }

      els.emptyBox.style.display = 'none';
      els.grid.style.display = 'grid';
      els.grid.innerHTML = items.map(renderCard).join('');
    }

    function load(){
      fetchPostJson({
        action: 'listBlogDashboard',
        siteOrigin: CONFIG.siteOrigin
      })
      .then(function(data){
        const items = Array.isArray(data && data.items) ? data.items : [];
        render(items);
      })
      .catch(function(err){
        console.error(err);
        els.loadingBox.textContent = '리스트를 불러오지 못했습니다.';
        els.countBox.textContent = '오류';
      });
    }

    load();
  </script>
</body>
</html>
