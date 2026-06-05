
    var GAS_URL = 'https://script.google.com/macros/s/AKfycbznhBvYFIv_GKeNoGIPFTi_mIXXH04BOvYrb4ZN9dk_Cc4Xjir3TP_vL3bbPrLLxgg2/exec';
    var picked = null;
    var addressLocked = false;

    var els = {
      addressSearchTrigger: document.getElementById('addressSearchTrigger'),
      addressDisplay: document.getElementById('addressDisplay'),
      refreshAddressBtn: document.getElementById('refreshAddressBtn'),
      useAprDayInput: document.getElementById('useAprDayInput'),
      lookupBtn: document.getElementById('lookupBtn'),
      pickedLine: document.getElementById('pickedLine'),
      status: document.getElementById('status'),
      loading: document.getElementById('loading'),
      summaryGrid: document.getElementById('summaryGrid'),
      sumAddress: document.getElementById('sumAddress'),
      sumPurpose: document.getElementById('sumPurpose'),
      sumTotalArea: document.getElementById('sumTotalArea'),
      sumFloorHeight: document.getElementById('sumFloorHeight'),
      mapLinkSection: document.getElementById('mapLinkSection'),
      mapLinkCaption: document.getElementById('mapLinkCaption'),
      naverMapBtn: document.getElementById('naverMapBtn'),
      overviewSection: document.getElementById('overviewSection'),
      overviewGrid: document.getElementById('overviewGrid'),
      captureStage: document.getElementById('captureStage'),
      captureSheet: document.getElementById('captureSheet'),
      sourcesSection: document.getElementById('sourcesSection'),
      sourcesStack: document.getElementById('sourcesStack'),
      sourceCountChip: document.getElementById('sourceCountChip'),
      emptyState: document.getElementById('emptyState')
    };

    var SOURCE_CONFIG = {
      title: {
        label: '표제부',
        fields: [
          ['주소', function(v){ return firstNonEmpty(v.newPlatPlc, v.platPlc); }],
          ['건물용도', function(v){ return firstNonEmpty(v.mainPurpsCdNm, v.etcPurps); }],
          ['기타용도', function(v){ return v.etcPurps; }],
          ['구조', function(v){ return firstNonEmpty(v.strctCdNm, v.etcStrct); }],
          ['지붕', function(v){ return firstNonEmpty(v.roofCdNm, v.etcRoof); }],
          ['대지면적', function(v){ return formatArea(v.platArea); }],
          ['건축면적', function(v){ return formatArea(v.archArea); }],
          ['연면적', function(v){ return formatArea(v.totArea); }],
          ['용적률 산정 연면적', function(v){ return formatArea(v.vlRatEstmTotArea); }],
          ['건폐율', function(v){ return formatPercent(v.bcRat); }],
          ['용적률', function(v){ return formatPercent(v.vlRat); }],
          ['사용승인일', function(v){ return formatDate(v.useAprDay); }],
          ['허가일', function(v){ return formatDate(v.pmsDay); }],
          ['착공일', function(v){ return formatDate(v.stcnsDay); }],
          ['층수', function(v){ return buildFloorText(v); }],
          ['층고', function(v){ return formatHeight(v.heit); }],
          ['주차', function(v){ return buildParkingText(v); }]
        ]
      },
      recap: {
        label: '총괄표제부',
        fields: [
          ['대지면적', function(v){ return formatArea(v.platArea); }],
          ['건축면적', function(v){ return formatArea(v.archArea); }],
          ['연면적', function(v){ return formatArea(v.totArea); }],
          ['건물용도', function(v){ return firstNonEmpty(v.mainPurpsCdNm, v.etcPurps); }],
          ['주건축물 수', function(v){ return formatInt(v.mainBldCnt, '동'); }],
          ['주차대수', function(v){ return formatInt(v.totPkngCnt, '대'); }]
        ]
      },
      basis: {
        label: '기본개요',
        fields: [
          ['주소', function(v){ return firstNonEmpty(v.newPlatPlc, v.platPlc); }],
          ['용도지역', function(v){ return joinValues([v.jiyukCdNm, v.jiguCdNm, v.guyukCdNm], ' / '); }],
          ['건물 ID', function(v){ return v.bldgId; }],
          ['생성일', function(v){ return formatDate(v.crtnDay); }]
        ]
      },
      flr: {
        label: '층별개요',
        perItemTitle: function(item){ return firstNonEmpty(item.flrNoNm, item.flrGbCdNm, '층 정보'); },
        fields: [
          ['층구분', function(v){ return firstNonEmpty(v.flrGbCdNm, v.flrNoNm); }],
          ['용도', function(v){ return firstNonEmpty(v.mainPurpsCdNm, v.etcPurps); }],
          ['기타용도', function(v){ return v.etcPurps; }],
          ['구조', function(v){ return firstNonEmpty(v.strctCdNm, v.etcStrct); }],
          ['면적', function(v){ return formatArea(v.area); }]
        ]
      },
      atchJibun: { label: '부속지번', fields: [['부속지번', function(v){ return joinValues([v.platPlc, v.newPlatPlc], ' / '); }]] },
      jijigu: { label: '지역지구구역', fields: [['지역/지구/구역', function(v){ return joinValues([v.jiyukCdNm, v.jiguCdNm, v.guyukCdNm, v.jijigu], ' / '); }]] },
      exposPubuseArea: {
        label: '전유공용면적',
        fields: [
          ['전유면적', function(v){ return formatArea(v.excluUseArea); }],
          ['공용면적', function(v){ return formatArea(v.pubuseArea); }],
          ['계약면적', function(v){ return formatArea(v.area); }]
        ]
      },
      expos: { label: '전유부', fields: [['용도', function(v){ return firstNonEmpty(v.mainPurpsCdNm, v.etcPurps); }], ['면적', function(v){ return formatArea(v.area); }]] },
      wclf: {
        label: '오수정화시설',
        fields: [
          ['방식', function(v){ return firstNonEmpty(v.modeCdNm, v.etcMode); }],
          ['기타방식', function(v){ return v.etcMode; }],
          ['처리인원', function(v){ return formatInt(v.capaPsper, '인'); }],
          ['처리용량', function(v){ return formatInt(v.capaLube, ''); }]
        ]
      },
      hsprc: { label: '주택가격', fields: [['기준가격', function(v){ return v.housePc; }], ['공시기준일', function(v){ return formatDate(v.stdrYear); }]] }
    };

    function firstNonEmpty(){
      for(var i=0;i<arguments.length;i++){
        var v = arguments[i];
        if(v == null) continue;
        v = String(v).trim();
        if(v) return v;
      }
      return '';
    }
    function joinValues(arr, sep){
      sep = sep || ' / ';
      var out = [];
      (arr || []).forEach(function(v){
        v = String(v == null ? '' : v).trim();
        if(v && out.indexOf(v) === -1) out.push(v);
      });
      return out.join(sep);
    }
    function formatDate(v){
      v = String(v == null ? '' : v).replace(/\D/g,'');
      if(v.length !== 8) return String(v || '').trim();
      return v.slice(0,4)+'.'+v.slice(4,6)+'.'+v.slice(6,8);
    }
    function formatArea(v){
      if(v == null || v === '') return '';
      var n = Number(v);
      if(!isFinite(n)) return String(v).trim();
      return numberText(n)+'㎡';
    }
    function formatPercent(v){
      if(v == null || v === '') return '';
      var n = Number(v);
      if(!isFinite(n)) return String(v).trim();
      return numberText(n)+'%';
    }
    function formatHeight(v){
      if(v == null || v === '') return '';
      var n = Number(v);
      if(!isFinite(n) || n === 0) return '';
      return numberText(n)+'m';
    }
    function formatInt(v, suffix){
      if(v == null || v === '') return '';
      var n = Number(v);
      if(!isFinite(n)) return String(v).trim();
      return String(Math.round(n)) + (suffix || '');
    }
    function numberText(n){
      if(!isFinite(n)) return '';
      if(Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
      return (Math.round(n*100)/100).toString();
    }
    function buildFloorText(v){
      var g = firstNonEmpty(v.grndFlrCnt);
      var u = firstNonEmpty(v.ugrndFlrCnt);
      if(!g && !u) return '';
      return '지상 ' + (g || '0') + '층 / 지하 ' + (u || '0') + '층';
    }
    function buildParkingText(v){
      var total = Number(firstNonEmpty(v.oudrAutoUtcnt, 0)) + Number(firstNonEmpty(v.indrAutoUtcnt, 0));
      if(!isFinite(total) || total === 0) return '';
      return String(total) + '대';
    }
    function setStatus(text, type){
      els.status.textContent = text || '';
      els.status.className = 'status' + (type ? ' ' + type : '');
    }
    function setLoading(isLoading){
      els.loading.classList.toggle('show', !!isLoading);
      els.lookupBtn.disabled = !!isLoading;
    }
    function escapeHtml(str){
      return String(str == null ? '' : str)
        .replaceAll('&','&amp;')
        .replaceAll('<','&lt;')
        .replaceAll('>','&gt;')
        .replaceAll('"','&quot;')
        .replaceAll("'",'&#39;');
    }


    function getMapQuery(){
      if(!picked) return '';
      return firstNonEmpty(
        picked.jibunAddress,
        picked.autoJibunAddress,
        picked.roadAddress,
        picked.autoRoadAddress,
        picked.lookupAddress
      );
    }

    function getNaverMapUrl(){
      var q = getMapQuery();
      if(!q) return '';
      return 'https://map.naver.com/p/search/' + encodeURIComponent(q);
    }

    function renderMapLink(){
      var q = getMapQuery();
      if(!q){
        els.mapLinkSection.style.display = 'none';
        els.naverMapBtn.disabled = true;
        els.mapLinkCaption.textContent = '선택한 주소를 네이버 지도 검색 결과로 새창에서 엽니다.';
        return;
      }
      els.mapLinkSection.style.display = 'block';
      els.naverMapBtn.disabled = false;
      els.mapLinkCaption.textContent = q;
    }

    function openNaverMap(){
      var url = getNaverMapUrl();
      if(!url) return;
      window.open(url, '_blank', 'noopener');
    }

    function renderAddressDisplay(){
      if(picked && picked.bcode){
        els.addressDisplay.textContent = joinValues([
          picked.sido,
          picked.sigungu,
          picked.bname
        ], ' ');
        els.addressDisplay.classList.remove('placeholder');
      }else{
        els.addressDisplay.textContent = '법정동을 검색하세요';
        els.addressDisplay.classList.add('placeholder');
      }

      if(addressLocked){
        els.addressSearchTrigger.classList.add('locked');
      }else{
        els.addressSearchTrigger.classList.remove('locked');
      }
    }

    function resetAddressOnly(){
      picked = null;
      addressLocked = false;
      renderAddressDisplay();
      els.pickedLine.textContent = '';
      if(els.useAprDayInput) els.useAprDayInput.value = '';
      setStatus('', '');
      els.summaryGrid.style.display = 'none';
      els.mapLinkSection.style.display = 'none';
      els.overviewSection.style.display = 'none';
      els.sourcesSection.style.display = 'none';
      els.emptyState.style.display = 'block';
      window.lastResultData = null;
    }

    function jsonpCall(params){
      return new Promise(function(resolve, reject){
        var cb = 'cb_' + Date.now() + '_' + Math.floor(Math.random()*1000);
        var script = document.createElement('script');
        var done = false;
        var timer = null;

        function cleanup(){
          try{ delete window[cb]; }catch(e){}
          if(timer) clearTimeout(timer);
          if(script.parentNode) script.parentNode.removeChild(script);
        }

        window[cb] = function(payload){
          if(done) return;
          done = true;
          cleanup();
          resolve(payload);
        };

        script.onerror = function(){
          if(done) return;
          done = true;
          cleanup();
          reject(new Error('JSONP 요청 실패'));
        };

        params.callback = cb;
        params._ts = Date.now();

        var q = new URLSearchParams();
        Object.keys(params || {}).forEach(function(k){
          q.set(k, params[k] == null ? '' : String(params[k]));
        });

        script.src = GAS_URL + '?' + q.toString();
        document.body.appendChild(script);

        timer = setTimeout(function(){
          if(done) return;
          done = true;
          cleanup();
          reject(new Error('JSONP 타임아웃'));
        }, 15000);
      });
    }

    function openAddressSearch(initialQuery){
      try{
        new daum.Postcode({
          q: String(initialQuery || '').trim(),
          autoClose: true,
          oncomplete:function(data){
            picked = {
              jibunAddress: data.jibunAddress || data.autoJibunAddress || '',
              roadAddress: data.roadAddress || data.autoRoadAddress || '',
              lookupAddress: (data.jibunAddress || data.autoJibunAddress || data.roadAddress || data.autoRoadAddress || ''),
              bcode: data.bcode || '',
              sido: data.sido || '',
              sigungu: data.sigungu || '',
              bname: data.bname || '',
              buildingName: data.buildingName || '',
              zonecode: data.zonecode || '',
              apartment: data.apartment || '',
              autoJibunAddress: data.autoJibunAddress || '',
              autoRoadAddress: data.autoRoadAddress || '',
              addressType: data.addressType || ''
            };
            addressLocked = true;
            renderAddressDisplay();
            els.pickedLine.textContent = joinValues([
              picked.bcode ? ('법정동코드: ' + picked.bcode) : '',
              picked.lookupAddress ? ('선택주소: ' + picked.lookupAddress) : ''
            ], '\n');
            setStatus('사용승인일을 입력한 뒤 조회하세요.', '');
            renderMapLink();
          }
        }).open();
      }catch(e){
        setStatus('주소검색 오류', 'err');
      }
    }

    
    function areaText(v){
      if(v == null || v === '') return '-';
      var n = Number(v);
      if(!isFinite(n) || n <= 0) return '-';
      var py = n / 3.305785;
      return numberText(n) + '㎡ / ' + numberText(py) + '평';
    }
    function textOrDash(v){
      v = String(v == null ? '' : v).trim();
      return v || '-';
    }
    function uniqueNonEmpty(arr){
      var out = [];
      (arr || []).forEach(function(v){
        v = String(v == null ? '' : v).trim();
        if(v && out.indexOf(v) === -1) out.push(v);
      });
      return out;
    }
    function findPositive(items, key){
      var best = null;
      (items || []).forEach(function(it){
        var n = Number(it && it[key]);
        if(isFinite(n) && n > 0 && (best == null || n > best)) best = n;
      });
      return best;
    }
    function buildingSortKey(name){
      var m = String(name || '').match(/(\d+)/);
      return m ? parseInt(m[1],10) : 9999;
    }
    function floorSortKey(name){
      var s = String(name || '').trim();
      var m = s.match(/-?\d+/);
      if(!m) return 9999;
      return parseInt(m[0],10);
    }
    function joinAreaPurpose(area, purpose, struct){
      var parts = [];
      if(area && area !== '-') parts.push(area);
      if(purpose && purpose !== '-') parts.push(purpose);
      if(struct && struct !== '-') parts.push(struct);
      return parts.length ? parts.join(' / ') : '-';
    }

    function getBuildingArchArea(buildingSource, flrItemsForBuilding){
      var direct = Number(buildingSource && buildingSource.archArea);
      if(isFinite(direct) && direct > 0) return direct;

      var firstFloorArea = null;

      (flrItemsForBuilding || []).forEach(function(f){
        var floorName = String(f.flrNoNm || '').trim();
        var floorGb = String(f.flrGbCdNm || '').trim();
        var floorNo = String(f.flrNo == null ? '' : f.flrNo).trim();
        var area = Number(f && f.area);

        if(!isFinite(area) || area <= 0) return;

        var isFirstFloor =
          floorName === '1층' ||
          (floorGb === '지상' && floorNo === '1');

        if(isFirstFloor){
          firstFloorArea = area;
        }
      });

      return firstFloorArea;
    }
    function buildResultTable(rows){
      return '<div class="result-table-wrap"><table class="result-table"><tbody>'
        + rows.map(function(row){
          return '<tr><th>' + escapeHtml(row[0]) + '</th><td>' + escapeHtml(row[1]) + '</td></tr>';
        }).join('')
        + '</tbody></table></div>';
    }
    function extractIntegratedData(data){
      var apis = data.apis || {};
      var titleItems = ((apis.title || {}).items || []).slice();
      var recapItems = ((apis.recap || {}).items || []).slice();
      var basisItems = ((apis.basis || {}).items || []).slice();
      var jijiguItems = ((apis.jijigu || {}).items || []).slice();
      var flrItems = ((apis.flr || {}).items || []).slice();
      var titleFirst = ((apis.title || {}).firstItem || {});
      var recapFirst = ((apis.recap || {}).firstItem || {});

      var zoningParts = uniqueNonEmpty(
        basisItems.map(function(it){ return it.jiyukCdNm; })
          .concat(basisItems.map(function(it){ return it.jiguCdNm; }))
          .concat(basisItems.map(function(it){ return it.guyukCdNm; }))
          .concat(jijiguItems.map(function(it){ return it.jiyukCdNm; }))
          .concat(jijiguItems.map(function(it){ return it.jiguCdNm; }))
          .concat(jijiguItems.map(function(it){ return it.guyukCdNm; }))
          .concat(jijiguItems.map(function(it){ return it.jijigu; }))
      ).join(' / ');

      var landArea = Number(recapFirst.platArea);
      if(!isFinite(landArea) || landArea <= 0) landArea = findPositive(recapItems, 'platArea');
      if(!isFinite(landArea) || landArea <= 0) landArea = findPositive(titleItems, 'platArea');

      var archArea = Number(recapFirst.archArea);
      if(!isFinite(archArea) || archArea <= 0) archArea = findPositive(recapItems, 'archArea');
      if(!isFinite(archArea) || archArea <= 0) {
        archArea = titleItems.reduce(function(sum, it){
          var n = Number(it.archArea);
          return sum + (isFinite(n) && n > 0 ? n : 0);
        }, 0);
      }

      var totArea = Number(recapFirst.totArea);
      if(!isFinite(totArea) || totArea <= 0) totArea = findPositive(recapItems, 'totArea');
      if(!isFinite(totArea) || totArea <= 0) {
        totArea = titleItems.reduce(function(sum, it){
          var n = Number(it.totArea);
          return sum + (isFinite(n) && n > 0 ? n : 0);
        }, 0);
      }

      var mainCnt = titleItems.filter(function(it){ return String(it.mainAtchGbCd || '').trim() === '0'; }).length;
      var atchCnt = titleItems.filter(function(it){ return String(it.mainAtchGbCd || '').trim() && String(it.mainAtchGbCd || '').trim() !== '0'; }).length;
      if(!mainCnt && recapFirst.mainBldCnt) mainCnt = Number(recapFirst.mainBldCnt) || 0;
      if(!atchCnt && recapFirst.atchBldCnt) atchCnt = Number(recapFirst.atchBldCnt) || 0;
      var totalCnt = titleItems.length || (mainCnt + atchCnt);
      var compText = '-';
      if(totalCnt){
        compText = '총 ' + totalCnt + '동';
        if(mainCnt || atchCnt) compText += ' (주건축물 ' + (mainCnt || 0) + '동, 부속건축물 ' + (atchCnt || 0) + '동)';
      }

      var summaryRows = [
        ['주소', firstNonEmpty(data.normalized && data.normalized.jibunAddress, data.address, titleFirst.platPlc, recapFirst.platPlc, '-')],
        ['도로명주소', firstNonEmpty(data.normalized && data.normalized.roadAddress, titleFirst.newPlatPlc, recapFirst.newPlatPlc, '-')],
        ['건축물구성', compText],
        ['건물용도', firstNonEmpty(recapFirst.mainPurpsCdNm, titleFirst.mainPurpsCdNm, recapFirst.etcPurps, titleFirst.etcPurps, '-')],
        ['용도지역', textOrDash(zoningParts)],
        ['사용승인일', formatDate(firstNonEmpty(recapFirst.useAprDay, titleFirst.useAprDay)) || '-'],
        ['대지면적', areaText(landArea)],
        ['건축면적', areaText(archArea)],
        ['연면적', areaText(totArea)],
        ['건폐율', formatPercent(firstNonEmpty(recapFirst.bcRat, titleFirst.bcRat)) || '-'],
        ['용적률', formatPercent(firstNonEmpty(recapFirst.vlRat, titleFirst.vlRat)) || '-'],
        ['주차대수', (function(){
          var n = Number(firstNonEmpty(recapFirst.totPkngCnt, ''));
          return (isFinite(n) && n > 0) ? (String(Math.round(n)) + '대') : '-';
        })()]
      ];

      var basisByPk = {};
      basisItems.forEach(function(it){
        var pk = String(it.mgmBldrgstPk || '').trim();
        if(!pk) return;
        if(!basisByPk[pk]) basisByPk[pk] = [];
        basisByPk[pk].push(it);
      });

      var floorsByDong = {};
      flrItems.forEach(function(it){
        var dk = String(it.dongNm || '').trim();
        if(!dk) return;
        if(!floorsByDong[dk]) floorsByDong[dk] = [];
        floorsByDong[dk].push(it);
      });

      var buildings = titleItems.slice().sort(function(a,b){
        return buildingSortKey(a.dongNm) - buildingSortKey(b.dongNm);
      }).map(function(it){
        var pk = String(it.mgmBldrgstPk || '').trim();
        var basisList = basisByPk[pk] || [];
        var floorList = (floorsByDong[String(it.dongNm || '').trim()] || []).slice().sort(function(a,b){
          return floorSortKey(a.flrNoNm || a.flrGbCdNm) - floorSortKey(b.flrNoNm || b.flrGbCdNm);
        });
        var isMainBuilding = String(it.mainAtchGbCd || '').trim() === '0';
        var isResidentialApartmentDong = isMainBuilding && /공동주택|아파트/.test(
          firstNonEmpty(it.mainPurpsCdNm, '') + ' ' + firstNonEmpty(it.etcPurps, '')
        ) && /(\d+동)$/.test(firstNonEmpty(it.dongNm, ''));
        var floorSummary = isResidentialApartmentDong
          ? '-'
          : (floorList.length ? floorList.map(function(f){
              var fname = firstNonEmpty(f.flrNoNm, f.flrGbCdNm, '층정보');
              var fpurpose = firstNonEmpty(f.mainPurpsCdNm, f.etcPurps, '-');
              var fstruct = firstNonEmpty(f.strctCdNm, f.etcStrct, '-');
              return fname + ': ' + joinAreaPurpose(areaText(f.area), fpurpose, fstruct);
            }).join('\n') : '-');

        var bRows = [
          ['동명', firstNonEmpty(it.dongNm, '-')],
          ['구분', firstNonEmpty(it.mainAtchGbCdNm, '-')],
          ['용도', firstNonEmpty(it.mainPurpsCdNm, it.etcPurps, '-')],
          ['구조', firstNonEmpty(it.strctCdNm, it.etcStrct, '-')],
          ['지붕', firstNonEmpty(it.roofCdNm, it.etcRoof, '-')],
          ['층수', buildFloorText(it) || '-'],
          ['층고', formatHeight(it.heit) || '-'],
          ['건축면적', areaText(getBuildingArchArea(it, floorList))],
          ['연면적', areaText(it.totArea)],
          ['사용승인일', formatDate(it.useAprDay) || '-'],
          ['층별요약', floorSummary]
        ];
        return { title: firstNonEmpty(it.dongNm, '건물'), rows: bRows };
      });

      var hsprcItems = ((apis.hsprc || {}).items || []).slice();
      var hsprcFirst = ((apis.hsprc || {}).firstItem || {});
      var priceItem = hsprcItems.find(function(it){
        return firstNonEmpty(it.stdrYear, it.housePc, it.pblntfPc, it.officialLandPrice);
      }) || hsprcFirst || {};

      var priceRows = [
        ['기준연도', firstNonEmpty(formatDate(priceItem.stdrYear), priceItem.stdrYear, '-')],
        ['공시가격', firstNonEmpty(priceItem.housePc, priceItem.pblntfPc, priceItem.officialLandPrice, '-')]
      ];

      return { summaryRows: summaryRows, buildings: buildings, priceRows: priceRows };
    }


    function maskJibunAddress(addr){
      var s = String(addr == null ? '' : addr).replace(/\s+/g, ' ').trim();
      if(!s) return '-';
      s = s.replace(/\s산?\d+(?:-\d+)?(?:번지)?$/,'').trim();
      return s || '-';
    }

    function buildExportRows(data, extracted){
      var rows = [];
      var base = extracted && extracted.summaryRows ? extracted.summaryRows.slice() : [];
      base.forEach(function(row){
        var label = row[0];
        var value = row[1];
        if(label === '주소'){
          rows.push(['주소', maskJibunAddress(firstNonEmpty(
            data && data.normalized && data.normalized.jibunAddress,
            data && data.address,
            value
          ))]);
        }else if(label === '도로명주소'){
          rows.push(['도로명주소', maskJibunAddress(value)]);
        }else{
          rows.push([label, value]);
        }
      });
      return rows;
    }

    function buildCaptureSheetHtml(data, extracted){
      var rows = buildExportRows(data, extracted);
      return ''
        + '<div class="capture-card">'
        +   '<div class="capture-head">'
        +     '<h1 class="capture-title">부동산 기본정보</h1>'
        +   '</div>'
        +   '<div class="capture-body">'
        +     '<table class="capture-table"><tbody>'
        +       rows.map(function(row){
                  return '<tr><th>' + escapeHtml(row[0]) + '</th><td>' + escapeHtml(row[1]) + '</td></tr>';
                }).join('')
        +     '</tbody></table>'
        +   '</div>'
        + '</div>';
    }

    function downloadBlob(blob, filename){
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){
        URL.revokeObjectURL(url);
        if(a.parentNode) a.parentNode.removeChild(a);
      }, 100);
    }

    async function saveSummaryImage(){
      if(!window.lastResultData){
        setStatus('먼저 조회를 완료해주세요.', 'err');
        return;
      }
      var extracted = extractIntegratedData(window.lastResultData);
      return saveRowsAsImage('부동산 기본정보', extracted.summaryRows, 'maslow-summary.png');
    }


    function sanitizeRowsForImage(rows){
      return (rows || []).map(function(row){
        var label = row[0];
        var value = row[1];
        if(label === '주소' || label === '도로명주소'){
          return [label, maskJibunAddress(value)];
        }
        return [label, value];
      });
    }

    function buildRowsCopyText(title, rows){
      var lines = [String(title || '부동산 기본정보').trim()];
      (rows || []).forEach(function(row){
        var label = String(row[0] == null ? '' : row[0]).trim();
        var value = String(row[1] == null ? '' : row[1]).trim();
        if(!label) return;
        lines.push(label + ': ' + (value || '-'));
      });
      return lines.join('\n');
    }

    async function copyRowsText(title, rows){
      if(!rows || !rows.length){
        setStatus('복사할 내용이 없습니다.', 'err');
        return;
      }
      try{
        var text = buildRowsCopyText(title, rows);
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(text);
        }else{
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          if(ta.parentNode) ta.parentNode.removeChild(ta);
        }
        setStatus('텍스트 복사 완료', 'ok');
      }catch(err){
        setStatus('텍스트 복사 실패', 'err');
      }
    }

    async function saveRowsAsImage(title, rows, filename){
      if(!rows || !rows.length){
        setStatus('이미지 저장 실패', 'err');
        return;
      }

      try{
        setStatus('', '');

        function splitLines(ctx, text, maxWidth){
          var raw = String(text == null ? '' : text).split('\n');
          var lines = [];
          raw.forEach(function(block){
            var words = block.split(' ');
            var line = '';
            for(var i=0;i<words.length;i++){
              var test = line ? (line + ' ' + words[i]) : words[i];
              if(ctx.measureText(test).width <= maxWidth){
                line = test;
              }else{
                if(line) lines.push(line);
                line = words[i];
                while(ctx.measureText(line).width > maxWidth && line.length > 1){
                  var cut = line.length - 1;
                  while(cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--;
                  lines.push(line.slice(0, cut));
                  line = line.slice(cut);
                }
              }
            }
            lines.push(line || '');
          });
          return lines.length ? lines : [''];
        }

        function roundRect(ctx, x, y, w, h, r){
          var radius = Math.min(r, w/2, h/2);
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.arcTo(x + w, y, x + w, y + h, radius);
          ctx.arcTo(x + w, y + h, x, y + h, radius);
          ctx.arcTo(x, y + h, x, y, radius);
          ctx.arcTo(x, y, x + w, y, radius);
          ctx.closePath();
        }

        var safeRows = sanitizeRowsForImage(rows);
        var dpr = 2;
        var paddingLeft = 20;
        var paddingRight = 12;
        var paddingTop = 20;
        var paddingBottom = 18;
        var titleH = 58;
        var labelW = 132;

        var probe = document.createElement('canvas');
        var pctx = probe.getContext('2d');

        pctx.font = '900 17px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR","Apple SD Gothic Neo",sans-serif';
        var maxLabelW = labelW;
        safeRows.forEach(function(row){
          maxLabelW = Math.max(maxLabelW, Math.ceil(pctx.measureText(String(row[0] || '')).width) + 26);
        });
        labelW = maxLabelW;

        pctx.font = '900 20px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR","Apple SD Gothic Neo",sans-serif';
        var valueW = 220;
        safeRows.forEach(function(row){
          String(row[1] == null ? '' : row[1]).split('\n').forEach(function(line){
            valueW = Math.max(valueW, Math.ceil(pctx.measureText(line).width) + 34);
          });
        });
        valueW = Math.min(valueW, 540);

        var tableW = labelW + valueW;
        var fullW = paddingLeft + tableW + paddingRight;

        var rowHeights = [];
        safeRows.forEach(function(row){
          var lines = splitLines(pctx, row[1], valueW - 24);
          var lineCount = Math.max(1, lines.length);
          rowHeights.push(Math.max(52, 18 + lineCount * 24));
        });

        var totalRowsH = rowHeights.reduce(function(a,b){ return a+b; }, 0);
        var fullH = paddingTop + titleH + totalRowsH + paddingBottom;

        var canvas = document.createElement('canvas');
        canvas.width = Math.ceil(fullW * dpr);
        canvas.height = Math.ceil(fullH * dpr);

        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, fullW, fullH);

        ctx.strokeStyle = '#dfe7f3';
        ctx.lineWidth = 1;
        roundRect(ctx, 0.5, 0.5, fullW - 1, fullH - 1, 14);
        ctx.stroke();

        ctx.fillStyle = '#f8fbff';
        roundRect(ctx, 0.5, 0.5, fullW - 1, titleH + 10, 14);
        ctx.fillRect(1, titleH, fullW - 2, 10);
        ctx.fill();

        ctx.fillStyle = '#111827';
        ctx.font = '900 24px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR","Apple SD Gothic Neo",sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(title || '부동산 기본정보', paddingLeft, paddingTop + titleH / 2 - 2);

        var startY = paddingTop + titleH;
        var xLabel = paddingLeft;
        var xValue = paddingLeft + labelW;

        for(var i=0;i<safeRows.length;i++){
          var row = safeRows[i];
          var rh = rowHeights[i];
          var y = startY;

          ctx.fillStyle = '#f8fbff';
          ctx.fillRect(xLabel, y, labelW, rh);

          ctx.strokeStyle = '#e7edf5';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(xLabel, y);
          ctx.lineTo(xLabel + tableW, y);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(xValue, y);
          ctx.lineTo(xValue, y + rh);
          ctx.stroke();

          ctx.fillStyle = '#344054';
          ctx.font = '900 17px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR","Apple SD Gothic Neo",sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(row[0] || ''), xLabel + 14, y + rh / 2);

          ctx.fillStyle = '#111827';
          ctx.font = '900 20px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR","Apple SD Gothic Neo",sans-serif';
          ctx.textBaseline = 'top';
          var lines = splitLines(ctx, row[1], valueW - 24);
          var textY = y + 14;
          lines.forEach(function(line){
            ctx.fillText(String(line || ''), xValue + 14, textY);
            textY += 24;
          });

          startY += rh;
        }

        ctx.beginPath();
        ctx.moveTo(xLabel, startY);
        ctx.lineTo(xLabel + tableW, startY);
        ctx.strokeStyle = '#e7edf5';
        ctx.stroke();

        canvas.toBlob(function(blob){
          if(!blob){
            setStatus('이미지 저장 실패', 'err');
            return;
          }
          downloadBlob(blob, filename || 'maslow-summary.png');
        }, 'image/png');
      }catch(err){
        setStatus('이미지 저장 실패', 'err');
      }
    }

    function buildOverviewCards(data){
      var extracted = extractIntegratedData(data);
      var html = '<div class="result-stack">';
      html += '<div class="result-block">'
        + '<div class="result-block-head">통합요약 <span style="font-size:12px;font-weight:800;color:#667085;vertical-align:middle;margin-left:6px;">총괄표제부값</span></div>'
        + buildResultTable(extracted.summaryRows)
        + '<div class="table-download-wrap">'
        + '<div class="table-action-row">'
        + '<button class="table-download-btn" data-kind="summary" data-title="부동산 기본정보">⬇️ 이미지 내려받기</button>'
        + '<button class="table-copy-btn" data-copy-kind="summary" data-title="부동산 기본정보">📋 텍스트 복사</button>'
        + '</div>'
        + '<div class="table-download-note">주소가 있으면 뒤 숫자는 보이지 않게 저장됩니다.</div>'
        + '</div>'
        + '</div>';

      extracted.buildings.forEach(function(b){
        html += '<div class="result-block">'
          + '<div class="result-block-head">' + escapeHtml(b.title) + '</div>'
          + buildResultTable(b.rows)
          + '<div class="table-download-wrap">'
          + '<div class="table-action-row">'
          + '<button class="table-download-btn" data-kind="building" data-title="' + escapeHtml(b.title) + '">⬇️ 이미지 내려받기</button>'
          + '<button class="table-copy-btn" data-copy-kind="building" data-title="' + escapeHtml(b.title) + '">📋 텍스트 복사</button>'
          + '</div>'
          + '<div class="table-download-note">주소가 있으면 뒤 숫자는 보이지 않게 저장됩니다.</div>'
          + '</div>'
          + '</div>';
      });

      html += '<div class="result-block">'
        + '<div class="result-block-head">공시지가 주택 가격 조회</div>'
        + '<div class="table-download-wrap">'
        + '<div class="table-action-row">'
        + '<button class="table-download-btn" data-kind="price-link" data-title="공시지가 주택 가격 조회">조회하기</button>'
        + '</div>'
        + '</div>'
        + '</div>';

      html += '</div>';
      els.overviewGrid.innerHTML = html;

      document.querySelectorAll('.table-download-btn').forEach(function(btn){
        btn.addEventListener('click', function(){
          var kind = btn.getAttribute('data-kind');
          var title = btn.getAttribute('data-title') || '부동산 기본정보';

          if(kind === 'summary'){
            saveRowsAsImage(title, extracted.summaryRows, 'maslow-summary.png');
            return;
          }
          if(kind === 'price-link'){
            window.open('https://www.realtyprice.kr/notice/m/main/main.do', '_blank', 'noopener');
            return;
          }

          var found = extracted.buildings.find(function(b){
            return b.title === title;
          });
          if(found){
            saveRowsAsImage(title, found.rows, title + '.png');
          }
        });
      });

      document.querySelectorAll('.table-copy-btn').forEach(function(btn){
        btn.addEventListener('click', function(){
          var kind = btn.getAttribute('data-copy-kind');
          var title = btn.getAttribute('data-title') || '부동산 기본정보';

          if(kind === 'summary'){
            copyRowsText(title, extracted.summaryRows);
            return;
          }

          var found = extracted.buildings.find(function(b){
            return b.title === title;
          });
          if(found){
            copyRowsText(title, found.rows);
          }
        });
      });
    }

    function buildSourceCard(key, source){
      return '';
    }

    function renderResult(data){
      window.lastResultData = data;
      els.emptyState.style.display = 'none';
      els.summaryGrid.style.display = 'none';
      renderMapLink();
      els.overviewSection.style.display = 'block';
      els.sourcesSection.style.display = 'none';
      buildOverviewCards(data);
    }

    async function lookup(){
      try{
        if(!picked || !picked.bcode){
          openAddressSearch('');
          return;
        }

        var useAprDay = String((els.useAprDayInput && els.useAprDayInput.value) || '').replace(/\D/g, '');
        if(useAprDay.length !== 8){
          setStatus('사용승인일을 선택해주세요.', 'err');
          if(els.useAprDayInput) els.useAprDayInput.focus();
          return;
        }

        setLoading(true);
        setStatus('', '');
        var params = {
          action:'fetchBuildingsByDongAndUseAprDay',
          bcode: picked.bcode,
          sido: picked.sido || '',
          sigungu: picked.sigungu || '',
          bname: picked.bname || '',
          useAprDay: useAprDay
        };

        var res = await jsonpCall(params);
        if(!(res && res.ok)){
          setStatus((res && res.message) ? res.message : '조회 실패 · 서버가 혼잡합니다. 다시 조회 버튼을 눌러주세요.', 'err');
          return;
        }

        if(!(((res.apis || {}).title || {}).items || []).length){
          setStatus('일치하는 건축물이 없습니다.', 'err');
        }else{
          setStatus('조회 완료 · ' + (((res.apis || {}).title || {}).items || []).length + '건', '');
        }

        renderResult(res);
      }catch(e){
        setStatus('조회 실패 · 서버가 혼잡합니다. 다시 조회 버튼을 눌러주세요.', 'err');
      }finally{
        setLoading(false);
      }
    }

    els.addressSearchTrigger.addEventListener('click', function(){
      if(addressLocked) return;
      openAddressSearch('');
    });

    els.refreshAddressBtn.addEventListener('click', function(e){
      e.stopPropagation();
      resetAddressOnly();
    });

    els.lookupBtn.addEventListener('click', function(){
      lookup();
    });

    if(els.useAprDayInput){
      els.useAprDayInput.addEventListener('keydown', function(e){
        if(e.key === 'Enter') lookup();
      });
    }

    els.naverMapBtn.addEventListener('click', function(){
      openNaverMap();
    });


    renderAddressDisplay();
    renderMapLink();
  