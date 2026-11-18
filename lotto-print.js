/* 로또 번호 인쇄 (2026-11-18)
   - 판매점 구매 용지(슬립)를 프린터에 넣고 번호 칸에 표시를 찍는다. 5게임마다 용지 1장.
   - 칸 위치는 자로 잰 값으로 맞추고(이 기기에 저장), 일반 종이 시험 인쇄로 확인한다.
   - 웹페이지는 프린터를 고를 수 없어서 기기의 기본 프린터 + 용지 크기·여백 0·100% 를 미리 정해 인쇄 창을 연다. */
(function(){
  var KEY='lp_cfg_v2';
  // 기본값: 동행복권 로또 6/45 구매 용지 스캔(2026-11-18, A4 300dpi 상당)에서 잰 값. 용지 190.8×82.3mm, A게임 1번 칸 가운데 (41.3, 11.9)mm,
  // 칸 간격 가로 3.43mm(1→7번 20.6mm)·세로 6.38mm(1→43번 38.3mm), 게임 간격 27.5mm. 프린터마다 급지 위치가 달라 보정(dx·dy)은 시험 인쇄로 맞춘다.
  var DEF={w:190.8,h:82.3,ax:41.3,ay:11.9,d17:20.6,d143:38.3,gab:27.5,lay:'row',mw:2.4,mh:3.0,dx:0,dy:0,rot:0};
  var cfg=load();
  function load(){try{var c=JSON.parse(localStorage.getItem(KEY));if(c&&typeof c==='object'){var o={};for(var k in DEF)o[k]=(k in c)?c[k]:DEF[k];return o}}catch(e){}return JSON.parse(JSON.stringify(DEF))}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(cfg))}catch(e){}}
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function cell(g,n){ // g: 0~4 (A~E), n: 1~45 → 용지 위 칸 가운데 (mm)
    var i=n-1,r=Math.floor(i/7),c=i%7,p1=cfg.d17/6,p2=cfg.d143/6;
    var x=cfg.ax+g*cfg.gab+cfg.dx,y=cfg.ay+cfg.dy;
    if(cfg.lay==='row'){x+=c*p1;y+=r*p2}else{y+=c*p1;x+=r*p2}
    return [x,y];
  }
  var css=`
#lpDlg{position:fixed;inset:0;z-index:90;background:rgba(15,20,30,.5);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px}
#lpDlg[hidden]{display:none}
#lpDlg .box{background:#fff;color:#141a26;border-radius:16px;max-width:640px;width:100%;padding:18px 18px 22px;box-shadow:0 20px 60px -20px #0008;font-size:14px;line-height:1.55}
#lpDlg h2{margin:0;font-size:18px}#lpDlg h3{font-size:15px;margin:18px 0 6px}
#lpDlg .top{display:flex;justify-content:space-between;align-items:center;gap:8px}
#lpDlg .x{border:1px solid #d5dae4;background:#f5f7fb;border-radius:10px;padding:6px 12px;font:inherit;cursor:pointer}
#lpDlg .acts{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
#lpDlg .acts button{flex:1 1 180px;border:0;border-radius:12px;padding:12px 10px;font:inherit;font-weight:700;cursor:pointer;background:#eef1f6;color:#141a26}
#lpDlg .acts .main{background:#ff5a36;color:#fff}
#lpDlg .sum{background:#f5f7fb;border-radius:10px;padding:8px 12px;font-size:13px}
#lpDlg .grid{display:grid;grid-template-columns:1fr 92px;gap:6px 10px;align-items:center}
#lpDlg .grid label{font-size:13px}
#lpDlg .grid input,#lpDlg .grid select{width:100%;box-sizing:border-box;border:1px solid #d5dae4;border-radius:8px;padding:6px;font:inherit}
#lpDlg details{border-top:1px solid #e2e6ee;margin-top:12px;padding-top:6px}
#lpDlg summary{cursor:pointer;font-weight:700;padding:6px 0}
#lpDlg ol,#lpDlg ul{margin:4px 0;padding-left:20px}#lpDlg li{margin:3px 0}
#lpDlg .warn{background:#fff6e5;border:1px solid #f5d38a;border-radius:10px;padding:8px 12px;font-size:13px;margin-top:10px}
#lpDlg .row2{display:flex;gap:8px;margin-top:10px}#lpDlg .row2 button{flex:1;border:1px solid #d5dae4;background:#fff;border-radius:10px;padding:8px;font:inherit;cursor:pointer}
#lpArea{display:none}
@media print{
  body>*:not(#lpArea){display:none!important}
  #lpArea{display:block!important}
  html,body{background:#fff!important;margin:0!important;padding:0!important}
  body::before,body::after{display:none!important}
  #lpArea .pg{position:relative;overflow:hidden;page-break-after:always;break-after:page}
  #lpArea .pg:last-child{page-break-after:auto;break-after:auto}
  #lpArea *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  var pageSt=document.createElement('style');pageSt.id='lpPage';document.head.appendChild(pageSt);
  var area=document.createElement('div');area.id='lpArea';document.body.appendChild(area);

  var dlg=document.createElement('div');dlg.id='lpDlg';dlg.hidden=true;dlg.setAttribute('role','dialog');dlg.setAttribute('aria-modal','true');dlg.setAttribute('aria-labelledby','lpTitle');
  dlg.innerHTML=`<div class="box">
<div class="top"><h2 id="lpTitle">번호 인쇄</h2><button class="x" id="lpClose" type="button">닫기</button></div>
<p class="sum" id="lpSum"></p>
<div class="acts">
 <button class="main" id="lpSlip" type="button">구매 용지에 인쇄</button>
 <button id="lpSheet" type="button">번호표 인쇄 (A4 종이)</button>
</div>
<p style="font-size:13px;margin:0">구매 용지 인쇄: 판매점에서 받은 로또 6/45 구매 용지를 프린터 수동 급지대(뒤쪽·앞쪽 한 장 넣는 곳)에 넣고 누르세요. 5게임마다 용지 1장이 필요합니다.<br>
번호표 인쇄: 일반 종이에 번호와 칸 그림을 뽑아 판매점에서 용지에 직접 표시할 때 씁니다.</p>
<div class="warn">인쇄한 용지는 판매점 단말기가 읽을 때만 쓸 수 있습니다. 처음에는 아래 <b>용지 맞추기</b>로 칸 위치를 맞추고, 판매점에서 단말기가 번호를 맞게 읽는지 영수증(복권)으로 꼭 확인하세요. 구매 용지는 복권이 아니며, 확인된 복권만 유효합니다.</div>
<details id="lpSet"><summary>용지 맞추기 (처음 한 번 · 이 기기에 저장)</summary>
<p style="font-size:13px">실제 구매 용지를 자로 재서 mm로 넣으세요. 칸은 네모의 <b>가운데</b>를 잽니다.</p>
<div class="grid">
 <label for="lp_w">용지 가로 길이</label><input id="lp_w" type="number" step="0.1">
 <label for="lp_h">용지 세로 길이</label><input id="lp_h" type="number" step="0.1">
 <label for="lp_ax">왼쪽 끝 → A게임 1번 칸</label><input id="lp_ax" type="number" step="0.1">
 <label for="lp_ay">위쪽 끝 → A게임 1번 칸</label><input id="lp_ay" type="number" step="0.1">
 <label for="lp_lay">번호 1~7이 놓인 방향</label><select id="lp_lay"><option value="row">가로 한 줄</option><option value="col">세로 한 줄</option></select>
 <label for="lp_d17">A게임 1번 → 7번 칸 거리</label><input id="lp_d17" type="number" step="0.1">
 <label for="lp_d143">A게임 1번 → 43번 칸 거리</label><input id="lp_d143" type="number" step="0.1">
 <label for="lp_gab">A게임 1번 → B게임 1번 칸 거리</label><input id="lp_gab" type="number" step="0.1">
 <label for="lp_mw">표시 가로 크기</label><input id="lp_mw" type="number" step="0.1">
 <label for="lp_mh">표시 세로 크기</label><input id="lp_mh" type="number" step="0.1">
 <label for="lp_dx">프린터 보정 → 오른쪽(+)/왼쪽(−)</label><input id="lp_dx" type="number" step="0.1">
 <label for="lp_dy">프린터 보정 → 아래(+)/위(−)</label><input id="lp_dy" type="number" step="0.1">
 <label for="lp_rot">용지 넣는 방향</label><select id="lp_rot"><option value="0">가로로 눕혀 넣음</option><option value="90">세로 · 로고 쪽 먼저</option><option value="270">세로 · E게임 쪽 먼저</option></select>
</div>
<div class="row2"><button id="lpTestPlain" type="button">시험 인쇄 (일반 종이)</button><button id="lpTestSlip" type="button">시험 인쇄 (구매 용지)</button><button id="lpReset" type="button">처음 값으로</button></div>
<ol style="font-size:13px">
 <li><b>일반 종이 시험</b>: 용지 크기로 칸 위치(+ 표시와 번호)가 찍힙니다. 찍힌 종이 위에 구매 용지를 겹쳐 창문 빛에 비춰 보고, 어긋난 만큼 위 값을 고칩니다.</li>
 <li><b>구매 용지 시험</b>: 실제 용지에 A~E게임의 1·7·43·45번 칸만 찍습니다. 네 귀퉁이가 칸 안에 들어오면 맞춘 것입니다.</li>
 <li>전체가 한쪽으로 밀리면 <b>프린터 보정</b>만 고치면 됩니다(급지대가 용지를 가운데로 맞추는 프린터가 많습니다).</li>
</ol>
<p style="font-size:12px;color:#6b7487">처음 값은 동행복권 로또 6/45 구매 용지(190.8×82.3mm)를 스캔해 잰 값입니다. 프린터가 용지를 잡는 위치만 다르므로 보통 '프린터 보정'만 고치면 됩니다.</p>
</details>
<details><summary>프린터 연결·설정 (PC·휴대폰)</summary>
<p style="font-size:13px">인쇄 버튼을 누르면 이 페이지가 <b>용지 크기, 여백 0, 실제 크기(100%)</b>를 미리 정해 인쇄 창을 엽니다. 프린터는 기기에 연결된 <b>기본 프린터</b>가 자동으로 고릅니다. 인쇄 창에서 아래만 확인하세요.</p>
<ul style="font-size:13px">
 <li><b>윈도우 PC</b>: 프린터를 USB·와이파이로 연결하면 윈도우가 드라이버를 자동으로 설치합니다(설정 → 블루투스 및 장치 → 프린터 및 스캐너 → 장치 추가). 쓰는 프린터를 '기본값으로 설정'해 두세요. 인쇄 창에서 배율 <b>기본값/100%</b>, 여백 <b>없음</b>, '머리글과 바닥글' 끄기, 용지 공급 <b>수동 급지</b>를 고릅니다.</li>
 <li><b>맥</b>: 시스템 설정 → 프린터 및 스캐너에서 추가(AirPrint 프린터는 자동 인식). 배율 100%.</li>
 <li><b>안드로이드 휴대폰</b>: 프린터와 같은 와이파이에 연결하면 기본 인쇄 서비스가 프린터를 찾습니다(설정 → 연결된 기기 → 인쇄 → 기본 인쇄 서비스 켜기). 인쇄 창 위쪽에서 프린터를 고르고 용지 크기·100% 를 확인합니다.</li>
 <li><b>아이폰·아이패드</b>: AirPrint 프린터와 같은 와이파이면 자동으로 보입니다. 인쇄 옵션에서 프린터를 고르고 배율 100%로 둡니다.</li>
 <li>용지 크기 목록에 구매 용지 크기가 없으면 프린터 설정에서 '사용자 지정 크기'를 용지 크기(위 '용지 맞추기'의 가로·세로)로 하나 만들어 두세요.</li>
</ul>
</details>
</div>`;
  document.body.appendChild(dlg);
  var games=[],meta={},prevFocus=null;
  var F=['w','h','ax','ay','lay','d17','d143','gab','mw','mh','dx','dy','rot'];
  function fill(){F.forEach(function(k){var e=$('lp_'+k);e.value=k==='rot'?String(+cfg.rot||0):cfg[k]})}
  F.forEach(function(k){$('lp_'+k).addEventListener('change',function(){var v=this.value;if(k==='lay')cfg.lay=v;else if(k==='rot')cfg.rot=+v;else{var n=parseFloat(v);if(isFinite(n))cfg[k]=n;else this.value=cfg[k]}save()})});
  $('lpReset').onclick=function(){cfg=JSON.parse(JSON.stringify(DEF));save();fill()};
  $('lpClose').onclick=close;
  dlg.addEventListener('click',function(e){if(e.target===dlg)close()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!dlg.hidden)close()});
  function close(){dlg.hidden=true;document.documentElement.style.overflow='';if(prevFocus&&prevFocus.focus)prevFocus.focus()}

  function slipPage(inner){
    var W=cfg.w,H=cfg.h;
    var r=+cfg.rot||0,tf=r===90?'transform-origin:0 0;transform:translateX('+H+'mm) rotate(90deg);':r===270?'transform-origin:0 0;transform:translateY('+W+'mm) rotate(-90deg);':'';
    return '<div class="pg" style="width:'+(r?H:W)+'mm;height:'+(r?W:H)+'mm"><div style="position:absolute;left:0;top:0;width:'+W+'mm;height:'+H+'mm;'+tf+'">'+inner+'</div></div>';
  }
  function mark(g,n){var p=cell(g,n);return '<i style="position:absolute;left:'+(p[0]-cfg.mw/2).toFixed(2)+'mm;top:'+(p[1]-cfg.mh/2).toFixed(2)+'mm;width:'+cfg.mw+'mm;height:'+cfg.mh+'mm;background:#000"></i>'}
  function setPage(size){pageSt.textContent='@page{size:'+size+';margin:0}'}
  function slipSize(){return +cfg.rot?(cfg.h+'mm '+cfg.w+'mm'):(cfg.w+'mm '+cfg.h+'mm')}
  function go(){setTimeout(function(){window.print()},60)}

  function printSlips(){
    if(!games.length)return;
    var html='';
    for(var s=0;s<games.length;s+=5){
      var inner='';games.slice(s,s+5).forEach(function(nums,g){nums.forEach(function(n){inner+=mark(g,n)})});
      html+=slipPage(inner);
    }
    area.innerHTML=html;setPage(slipSize());go();
  }
  function testPlain(){
    var inner='<div style="position:absolute;inset:0;border:0.3mm solid #000;box-sizing:border-box"></div>';
    for(var g=0;g<5;g++)for(var n=1;n<=45;n++){var p=cell(g,n);
      inner+='<i style="position:absolute;left:'+(p[0]-1.2).toFixed(2)+'mm;top:'+p[1].toFixed(2)+'mm;width:2.4mm;height:0.2mm;background:#000"></i><i style="position:absolute;left:'+p[0].toFixed(2)+'mm;top:'+(p[1]-1.2).toFixed(2)+'mm;width:0.2mm;height:2.4mm;background:#000"></i>';
      if(n===1||n===7||n===43||n===45)inner+='<b style="position:absolute;left:'+(p[0]+0.6).toFixed(2)+'mm;top:'+(p[1]+0.4).toFixed(2)+'mm;font:600 1.8mm sans-serif;color:#000">'+'ABCDE'[g]+n+'</b>';}
    area.innerHTML=slipPage(inner);setPage(slipSize());go();
  }
  function testSlip(){var inner='';for(var g=0;g<5;g++)[1,7,43,45].forEach(function(n){inner+=mark(g,n)});area.innerHTML=slipPage(inner);setPage(slipSize());go()}
  function color(n){return n<=10?'#fbc400':n<=20?'#69c8f2':n<=30?'#ff7272':n<=40?'#aaa':'#b0d840'}
  function printSheet(){
    if(!games.length)return;
    var rows=games.map(function(nums,i){
      var grid='';for(var n=1;n<=45;n++){var on=nums.indexOf(n)>=0;grid+='<span style="display:inline-flex;align-items:center;justify-content:center;width:7mm;height:5mm;margin:0.4mm;border:0.2mm solid '+(on?'#000':'#e05a5a')+';font-size:2.6mm;color:'+(on?'#fff':'#e05a5a')+';background:'+(on?'#000':'#fff')+'">'+n+'</span>'+(n%7===0?'<br>':'')}
      var balls=nums.map(function(n){return '<span style="display:inline-flex;align-items:center;justify-content:center;width:9mm;height:9mm;border-radius:50%;background:'+color(n)+';color:#fff;font:700 4mm sans-serif;margin-right:1.5mm">'+n+'</span>'}).join('');
      return '<div style="display:flex;gap:6mm;align-items:center;padding:3mm 0;border-bottom:0.2mm solid #ccc;break-inside:avoid"><b style="font:800 7mm sans-serif;width:10mm">'+String.fromCharCode(65+(i%5))+'</b><div style="flex:1"><div>'+balls+'</div><div style="font-size:3mm;color:#555;margin-top:1.5mm">'+(Math.floor(i/5)+1)+'번째 용지 · '+'ABCDE'[i%5]+'게임</div></div><div style="line-height:0">'+grid+'</div></div>';
    }).join('');
    area.innerHTML='<div class="pg" style="width:190mm;padding:10mm;box-sizing:border-box;font-family:sans-serif;color:#000"><h1 style="font-size:6mm;margin:0 0 2mm">로또 6/45 번호표</h1><div style="font-size:3.2mm;margin-bottom:3mm">'+esc(meta.label||'')+' · 판매점 구매 용지의 같은 칸에 표시해 주세요 (5게임마다 용지 1장)</div>'+rows+'<p style="font-size:2.8mm;color:#555;margin-top:4mm">csh2020.com/lotto · 이 종이는 복권이 아닙니다.</p></div>';
    setPage('A4 portrait');go();
  }
  $('lpSlip').onclick=printSlips;$('lpSheet').onclick=printSheet;$('lpTestPlain').onclick=testPlain;$('lpTestSlip').onclick=testSlip;
  window.addEventListener('afterprint',function(){area.innerHTML='';pageSt.textContent=''});

  window.LottoPrint={open:function(list,info){
    games=(list||[]).filter(function(a){return a&&a.length===6}).map(function(a){return a.slice().sort(function(x,y){return x-y})});
    meta=info||{};
    if(!games.length)return;
    $('lpSum').innerHTML='<b>'+games.length+'게임</b> · 구매 용지 <b>'+Math.ceil(games.length/5)+'장</b>'+(meta.label?' · '+esc(meta.label):'');
    fill();prevFocus=document.activeElement;dlg.hidden=false;document.documentElement.style.overflow='hidden';$('lpSlip').focus();
  },config:function(){return JSON.parse(JSON.stringify(cfg))}};
})();
