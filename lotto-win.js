/* 로또 번호 생성기 · 주간 당첨 확인 (csh2020.com)
   - 번호는 이 기기(휴대폰·PC 브라우저)에만 저장된 생성 기록으로 확인합니다. 서버로 보내지 않습니다.
   - 생성한 번호는 "생성한 시각 기준으로 다음에 추첨하는 회차" 하나와만 대조합니다.
     (토요일 20:00 판매 마감 전 생성 → 그 주 회차, 마감 뒤 생성 → 다음 주 회차)
     다른 회차의 당첨번호와는 절대 대조하지 않습니다.
   - 3등 이상이면 홈페이지에 들어올 때 축하 폭죽과 당첨 안내를 띄웁니다. */
(function () {
  "use strict";
  var KEY = "lotto_v3_";
  var MIRRORS = ["https://raw.githubusercontent.com/smok95/lotto/main/results/", "https://cdn.jsdelivr.net/gh/smok95/lotto@main/results/"];
  var WEEK = 7 * 864e5;
  var CLOSE1 = Date.UTC(2002, 11, 7, 11, 0);   // 제1회 판매 마감 2002-12-07 20:00 KST
  var DRAW1 = Date.UTC(2002, 11, 7, 11, 35);   // 제1회 추첨 20:35 KST
  var READY_AFTER = 40 * 60e3;                 // 추첨 40분 뒤부터 결과 확인

  function load(k) { try { return JSON.parse(localStorage.getItem(k)) } catch (e) { return null } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
  function pad(n) { return String(n).padStart(2, "0") }

  /* 생성 시각(ms) → 그 번호가 참여하는 회차 */
  function drawFor(ts) { return ts < CLOSE1 ? 1 : Math.floor((ts - CLOSE1) / WEEK) + 2 }
  /* 회차 → 추첨일(한국 날짜) */
  function drawDate(no) { var d = new Date(Date.UTC(2002, 11, 7) + (no - 1) * WEEK); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) }
  function drawTime(no) { return DRAW1 + (no - 1) * WEEK }
  function isDrawn(no) { return Date.now() >= drawTime(no) + READY_AFTER }

  /* 기록 한 건의 생성 시각과 대상 회차 */
  function recTs(r) {
    if (r.ts) return Number(r.ts);
    var t = new Date(r.date + "T" + (r.time || "12:00:00"));
    return isNaN(t) ? 0 : t.getTime();
  }
  function recDraw(r) { return Number(r.drawNo) || drawFor(recTs(r)) }
  function recId(r) { return [recDraw(r), r.nums.join(","), r.date, r.run, r.game].join("|") }

  /* 당첨번호: 생성기가 저장해 둔 자료 → 없으면 공개 자료에서 그 회차만 받기 */
  var cache = null;
  function known() {
    if (cache) return cache;
    cache = {};
    var add = function (rows) { (rows || []).forEach(function (r) { if (Array.isArray(r) && r.length >= 9) cache[Number(r[0])] = { no: Number(r[0]), date: String(r[1]), nums: r.slice(2, 8).map(Number).sort(function (a, b) { return a - b }), bonus: Number(r[8]) } }) };
    add(load(KEY + "draws_all")); add(load(KEY + "draws_win"));
    return cache;
  }
  function getJSON(url) {
    var c = new AbortController(), t = setTimeout(function () { c.abort() }, 8000);
    return fetch(url, { signal: c.signal, cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json() }).finally(function () { clearTimeout(t) });
  }
  function fetchDraw(no) {
    var i = 0;
    function next() {
      if (i >= MIRRORS.length) return Promise.resolve(null);
      return getJSON(MIRRORS[i++] + no + ".json").then(function (j) {
        if (Number(j.draw_no) !== no) return next();   // 다른 회차 자료는 쓰지 않음
        var row = [no, String(j.date).slice(0, 10)].concat(j.numbers).concat([j.bonus_no]);
        var saved = load(KEY + "draws_win") || []; saved = saved.filter(function (r) { return r[0] !== no }); saved.push(row); store(KEY + "draws_win", saved.slice(-80));
        cache = null; return known()[no] || null;
      }).catch(next);
    }
    return next();
  }

  function rankOf(m, b) { return m === 6 ? 1 : m === 5 && b ? 2 : m === 5 ? 3 : m === 4 ? 4 : m === 3 ? 5 : 0 }

  /* 기록 목록 → 회차별 대조 결과 (추첨이 끝난 회차만) */
  function check(records) {
    records = (records || []).filter(function (r) { return r && Array.isArray(r.nums) && r.nums.length === 6 });
    var need = {};
    records.forEach(function (r) { var n = recDraw(r); if (isDrawn(n) && !known()[n]) need[n] = 1 });
    var list = Object.keys(need).map(Number).sort(function (a, b) { return b - a }).slice(0, 30);
    return Promise.all(list.map(fetchDraw)).then(function () {
      var K = known(), out = [];
      records.forEach(function (r) {
        var no = recDraw(r), w = K[no];
        if (!w || w.no !== no || !isDrawn(no)) return;   // 그 주 회차 결과만 사용
        var hit = r.nums.filter(function (n) { return w.nums.indexOf(n) >= 0 });
        var b = r.nums.indexOf(w.bonus) >= 0;
        out.push({ rec: r, id: recId(r), drawNo: no, drawDate: w.date || drawDate(no), win: w, hit: hit, match: hit.length, bonusHit: b, rank: rankOf(hit.length, b) });
      });
      return out;
    });
  }
  function label(res) { return res.rank ? res.rank + "등" : res.match + "개 일치" }

  /* ===== 축하 화면 ===== */
  var CSS = ".lw-ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,12,30,.72);font-family:Pretendard,-apple-system,'Malgun Gothic',sans-serif}" +
    ".lw-ov canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}" +
    ".lw-card{position:relative;width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow:auto;background:#fff;color:#1e1b4b;border-radius:22px;padding:26px 22px 20px;box-shadow:0 30px 80px -20px #000a;text-align:center;animation:lwpop .5s cubic-bezier(.2,1.4,.4,1)}" +
    "@keyframes lwpop{from{transform:scale(.7);opacity:0}to{transform:none;opacity:1}}" +
    ".lw-card h2{margin:4px 0 6px;font-size:26px;letter-spacing:-.5px;color:#b45309}.lw-card .lw-sub{margin:0 0 16px;font-size:14px;color:#475569}" +
    ".lw-win{border:2px solid #fde68a;background:#fffbeb;border-radius:16px;padding:12px;margin:0 0 10px;text-align:left}" +
    ".lw-win .lw-h{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:14px;color:#334155;margin-bottom:8px}.lw-win .lw-rk{background:#dc2626;color:#fff;font-weight:800;border-radius:999px;padding:3px 12px;font-size:15px}" +
    ".lw-balls{display:flex;flex-wrap:wrap;gap:5px;align-items:center}.lw-b{width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;text-shadow:0 1px 1px #0005;opacity:.35}.lw-b.on{opacity:1;box-shadow:0 0 0 3px #f59e0b}" +
    ".lw-w{font-size:12px;color:#64748b;margin-top:8px}" +
    ".lw-note{font-size:12.5px;line-height:1.55;color:#475569;background:#f1f5f9;border-radius:12px;padding:10px 12px;margin:12px 0 14px;text-align:left}" +
    ".lw-btns{display:flex;gap:8px}.lw-btns button{flex:1;border:0;border-radius:12px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}.lw-ok{background:#4f46e5;color:#fff}.lw-later{background:#e2e8f0;color:#334155}";
  function ballColor(n) { return n <= 10 ? "#f5b700" : n <= 20 ? "#3ba5d9" : n <= 30 ? "#ef5350" : n <= 40 ? "#8a8f98" : "#7cb342" }
  function ball(n, on) { return '<span class="lw-b' + (on ? " on" : "") + '" style="background:' + ballColor(n) + '">' + n + "</span>" }

  function fireworks(cv) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return function () {};
    var ctx = cv.getContext("2d"), P = [], dpr = Math.min(2, window.devicePixelRatio || 1), W, H, stop = false, t0 = performance.now(), lastBurst = 0;
    function size() { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    size(); window.addEventListener("resize", size);
    var COLORS = ["#fde047", "#f472b6", "#60a5fa", "#34d399", "#fb923c", "#c084fc", "#ffffff"];
    function burst() {
      var x = W * (0.15 + Math.random() * 0.7), y = H * (0.12 + Math.random() * 0.4), c = COLORS[Math.random() * COLORS.length | 0], n = 70 + (Math.random() * 40 | 0);
      for (var i = 0; i < n; i++) { var a = Math.PI * 2 * i / n, s = 2 + Math.random() * 4.5; P.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: Math.random() < .25 ? "#fff" : c }) }
    }
    function frame(now) {
      if (stop) return;
      var el = now - t0;
      if (el < 9000 && now - lastBurst > 380) { burst(); if (Math.random() < .4) burst(); lastBurst = now }
      ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (var i = P.length - 1; i >= 0; i--) {
        var p = P[i]; p.vx *= .985; p.vy = p.vy * .985 + .06; p.x += p.vx; p.y += p.vy; p.life -= .012;
        if (p.life <= 0) { P.splice(i, 1); continue }
        ctx.globalAlpha = p.life; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (el < 9000 || P.length) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    }
    requestAnimationFrame(frame);
    return function () { stop = true; window.removeEventListener("resize", size) };
  }

  function ackList() { return load(KEY + "win_ack") || [] }
  function seen(id) { try { return (sessionStorage.getItem(KEY + "win_seen") || "").split("\n").indexOf(id) >= 0 } catch (e) { return false } }
  function markSeen(ids) { try { var s = (sessionStorage.getItem(KEY + "win_seen") || "").split("\n"); sessionStorage.setItem(KEY + "win_seen", s.concat(ids).join("\n")) } catch (e) {} }

  function celebrate(results) {
    var ack = ackList();
    var wins = (results || []).filter(function (r) { return r.rank >= 1 && r.rank <= 3 && ack.indexOf(r.id) < 0 && !seen(r.id) && Date.now() - drawTime(r.drawNo) < 366 * 864e5 })
      .sort(function (a, b) { return a.rank - b.rank || b.drawNo - a.drawNo });
    if (!wins.length || document.querySelector(".lw-ov")) return false;
    markSeen(wins.map(function (w) { return w.id }));
    if (!document.getElementById("lw-css")) { var st = document.createElement("style"); st.id = "lw-css"; st.textContent = CSS; document.head.appendChild(st) }
    var top = wins[0], ov = document.createElement("div");
    ov.className = "lw-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "lw-title");
    var where = top.rank === 1 ? "1등은 NH농협은행 본점" : "2·3등은 NH농협은행 지점";
    ov.innerHTML = '<canvas aria-hidden="true"></canvas><div class="lw-card">' +
      '<div style="font-size:40px" aria-hidden="true">🎉</div>' +
      '<h2 id="lw-title">축하합니다! ' + top.rank + "등 당첨</h2>" +
      '<p class="lw-sub">이 기기에서 생성한 번호가 그 주 추첨 결과와 일치했습니다.</p>' +
      wins.map(function (w) {
        return '<div class="lw-win"><div class="lw-h"><span><b>제' + w.drawNo + "회</b> (" + w.drawDate + " 추첨)</span><span class=\"lw-rk\">" + w.rank + "등</span></div>" +
          '<div class="lw-balls">' + w.rec.nums.map(function (n) { return ball(n, w.hit.indexOf(n) >= 0 || (w.rank === 2 && n === w.win.bonus)) }).join("") + "</div>" +
          '<div class="lw-w">생성 ' + w.rec.date + (w.rec.time ? " " + w.rec.time.slice(0, 5) : "") + (w.rec.game ? " · " + (w.rec.run ? w.rec.run + "회차 " : "") + w.rec.game + "게임" : "") +
          " · 당첨번호 " + w.win.nums.join(" ") + " + 보너스 " + w.win.bonus + "</div></div>";
      }).join("") +
      '<div class="lw-note">이 안내는 생성기로 만든 번호 기준입니다. <b>실제로 구입한 복권 용지의 번호와 꼭 비교해</b> 확인하세요. 당첨금은 ' + where + "에서 신분증과 복권을 가지고 받을 수 있으며, 지급 개시일부터 1년 안에 받아야 합니다.</div>" +
      '<div class="lw-btns"><button class="lw-later" type="button">나중에 다시 보기</button><button class="lw-ok" type="button">확인했어요</button></div></div>';
    document.body.appendChild(ov);
    var stopFx = fireworks(ov.querySelector("canvas")), prev = document.activeElement;
    function close(ok) {
      if (ok) { var a = ackList(); wins.forEach(function (w) { if (a.indexOf(w.id) < 0) a.push(w.id) }); store(KEY + "win_ack", a.slice(-200)) }
      stopFx(); ov.remove(); document.removeEventListener("keydown", onKey); if (prev && prev.focus) prev.focus();
    }
    function onKey(e) { if (e.key === "Escape") close(false) }
    document.addEventListener("keydown", onKey);
    ov.querySelector(".lw-ok").onclick = function () { close(true) };
    ov.querySelector(".lw-later").onclick = function () { close(false) };
    ov.querySelector(".lw-ok").focus();
    return true;
  }

  function run(records) {
    return check(records || load(KEY + "records") || []).then(function (res) { celebrate(res); return res }).catch(function () { return [] });
  }

  window.LottoWin = { drawFor: drawFor, drawDate: drawDate, isDrawn: isDrawn, recDraw: recDraw, check: check, celebrate: celebrate, label: label, run: run };

  // 홈페이지(생성기를 직접 다루지 않는 페이지)는 들어올 때 바로 확인
  if (!window.LOTTO_WIN_MANUAL) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { run() }); else run();
  }
})();
