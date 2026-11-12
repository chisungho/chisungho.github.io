// csh2020.com 게시판 서버 (Google Apps Script 웹 앱)
// 글 저장: 구글 시트 / 새 글 알림: 관리자 메일 / 관리자 확인: GitHub 저장소 쓰기 권한 토큰

var ADMIN_EMAIL = 'hgy671001@gmail.com';
var REPO_API = 'https://api.github.com/repos/chisungho/chisungho.github.io';
var SITE = 'https://csh2020.com';
var HEAD = ['id', 'ts', 'date', 'title', 'body', 'author', 'private', 'salt', 'hash', 'deleted'];

function sheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('csh2020 게시판 글');
    props.setProperty('SHEET_ID', ss.getId());
    ss.getSheets()[0].setName('posts').appendRow(HEAD);
  }
  return ss.getSheetByName('posts');
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function rows_() {
  var v = sheet_().getDataRange().getValues();
  var list = [];
  for (var i = 1; i < v.length; i++) {
    var o = {};
    HEAD.forEach(function (k, j) { o[k] = v[i][j]; });
    o.row = i + 1;
    o.private = o.private === true || o.private === 'TRUE';
    o.deleted = o.deleted === true || o.deleted === 'TRUE';
    if (!o.deleted) list.push(o);
  }
  return list.reverse();
}

function hash_(salt, pw) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8);
  return d.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function clip_(s, n) { return String(s == null ? '' : s).replace(/\r/g, '').trim().slice(0, n); }

function maskName_(s) { s = String(s || '익명'); return s.length <= 1 ? s : s.charAt(0) + '*'.repeat(Math.min(s.length - 1, 3)); }

function isAdmin_(token) {
  token = String(token || '').trim();
  if (!token) return false;
  var key = 'adm_' + hash_('k', token).slice(0, 40);
  var cache = CacheService.getScriptCache();
  if (cache.get(key) === '1') return true;
  try {
    var r = UrlFetchApp.fetch(REPO_API, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, muteHttpExceptions: true });
    var j = JSON.parse(r.getContentText());
    if (r.getResponseCode() === 200 && j.permissions && j.permissions.push) { cache.put(key, '1', 1800); return true; }
  } catch (e) {}
  return false;
}

function pub_(p, full) {
  var o = { id: p.id, ts: Number(p.ts), date: Utilities.formatDate(new Date(Number(p.ts)), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), private: p.private };
  if (p.private && !full) {
    o.title = '비공개 글입니다';
    o.author = maskName_(p.author);
  } else {
    o.title = p.title; o.author = full ? p.author : maskName_(p.author); o.body = p.body;
  }
  return o;
}

function doGet(e) {
  var a = (e.parameter || {}).a || 'list';
  if (a === 'list') return out_({ ok: true, items: rows_().map(function (p) { return pub_(p, false); }) });
  if (a === 'rates') {
    var r = loadRates_();
    return out_(r.ok ? r : { ok: false });
  }
  return out_({ ok: false, error: 'unknown' });
}

// ===== 은행금리·환율: 매일 오전 9시(KST) 갱신 =====
var FX_CODES = { USD: 1, JPY: 100, EUR: 1, CNY: 1, GBP: 1, AUD: 1 };
var NET_BANKS = /카카오뱅크|토스뱅크|케이뱅크/;

function fetchFx_() {
  var j = JSON.parse(UrlFetchApp.fetch('https://open.er-api.com/v6/latest/KRW').getContentText());
  if (j.result !== 'success') throw new Error('fx');
  var props = PropertiesService.getScriptProperties();
  var hist = JSON.parse(props.getProperty('FX_HIST') || '{}');
  var day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var today = {};
  Object.keys(FX_CODES).forEach(function (c) { today[c] = Math.round(FX_CODES[c] / j.rates[c] * 100) / 100; });
  hist[day] = today;
  var days = Object.keys(hist).sort().slice(-7);
  var kept = {}; days.forEach(function (d) { kept[d] = hist[d]; });
  props.setProperty('FX_HIST', JSON.stringify(kept));
  return Object.keys(FX_CODES).map(function (c) {
    var h = days.map(function (d) { return kept[d][c]; });
    var prev = h.length > 1 ? h[h.length - 2] : h[0];
    return { code: c, baseRate: today[c], change: Math.round((today[c] - prev) * 100) / 100, history: h };
  });
}

// 금융감독원 금융상품통합비교공시 오픈API (인증키는 스크립트 속성 FSS_KEY)
function fetchFss_(kind, key) {
  // 020000: 은행, 030300: 저축은행
  return fetchFssGroup_(kind, key, '020000').concat(fetchFssGroup_(kind, key, '030300'));
}

function fetchFssGroup_(kind, key, grp) {
  var url = 'https://finlife.fss.or.kr/finlifeapi/' + (kind === 'deposit' ? 'depositProductsSearch' : 'savingProductsSearch') + '.json?auth=' + key + '&topFinGrpNo=' + grp + '&pageNo=1';
  var res = JSON.parse(UrlFetchApp.fetch(url).getContentText()).result;
  var byCode = {};
  res.optionList.forEach(function (o) {
    if (kind === 'saving' && o.rsrv_type_nm && o.rsrv_type_nm.indexOf('자유') < 0) return;
    var m = Number(o.save_trm), b = Number(o.intr_rate) || 0, x = Number(o.intr_rate2) || b;
    var r = (byCode[o.fin_prdt_cd] = byCode[o.fin_prdt_cd] || {});
    if (!r[m] || x > r[m][1]) r[m] = [b, x];
  });
  return res.baseList.filter(function (p) { return byCode[p.fin_prdt_cd]; }).map(function (p) {
    var rates = byCode[p.fin_prdt_cd], terms = Object.keys(rates).map(Number).sort(function (a, b) { return a - b; });
    var ref = rates[12] || rates[terms[0]];
    return {
      id: kind + '_' + p.fin_prdt_cd, bank: p.kor_co_nm, sector: grp === '030300' ? 'savings_bank' : NET_BANKS.test(p.kor_co_nm) ? 'internet' : 'commercial', type: kind,
      productName: p.fin_prdt_nm, rateBase: ref[0], rateMax: ref[1], periodMonths: terms, rates: rates,
      preferentialCond: String(p.spcl_cnd || '없음').replace(/\s+/g, ' ').slice(0, 160), joinTarget: String(p.join_member || '').slice(0, 60),
      maxLimit: p.max_limit ? Number(p.max_limit).toLocaleString('ko-KR') + '원' : '제한없음'
    };
  });
}

// 금리 데이터는 시트 'rates'에 나눠 저장 (속성은 9KB 한도라 부족)
function ratesSheet_() {
  var ss = sheet_().getParent();
  return ss.getSheetByName('rates') || ss.insertSheet('rates');
}
function loadRates_() {
  var sh = ratesSheet_(), n = sh.getLastRow();
  if (!n) return {};
  try { return JSON.parse(sh.getRange(1, 1, n, 1).getValues().map(function (r) { return r[0]; }).join('')); } catch (e) { return {}; }
}
function saveRates_(o) {
  var s = JSON.stringify(o), parts = [];
  for (var i = 0; i < s.length; i += 40000) parts.push(["'" + s.slice(i, i + 40000)]);
  var sh = ratesSheet_();
  sh.clear();
  sh.getRange(1, 1, parts.length, 1).setValues(parts);
}

function updateRates() {
  var props = PropertiesService.getScriptProperties();
  var old = loadRates_();
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy.MM.dd HH:mm');
  var out = { ok: true, updated: now, fx: old.fx || null, fxDate: old.fxDate || null, products: old.products || null, productsDate: old.productsDate || null };
  try { out.fx = fetchFx_(); out.fxDate = now; } catch (e) { out.fxError = String(e); }
  var key = props.getProperty('FSS_KEY');
  if (key) {
    try { out.products = fetchFss_('deposit', key).concat(fetchFss_('saving', key)); out.productsDate = now; } catch (e) { out.productsError = String(e); }
  }
  saveRates_(out);
  return out;
}

// 처음 한 번 실행: 매일 오전 9시 자동 갱신 예약
function installDailyRates() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'updateRates') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('updateRates').timeBased().atHour(0).nearMinute(1).everyDays(1).inTimezone('Asia/Seoul').create();
  updateRates();
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: '잘못된 요청입니다.' }); }
  switch (d.a) {
    case 'write': return out_(write_(d));
    case 'view': return out_(view_(d));
    case 'admin': return out_(admin_(d));
    case 'del': return out_(del_(d));
  }
  return out_({ ok: false, error: 'unknown' });
}

function write_(d) {
  if (d.hp) return { ok: true }; // 자동 등록 방지용 숨은 칸
  var title = clip_(d.title, 80), body = clip_(d.body, 3000), author = clip_(d.author, 20) || '익명';
  var priv = !!d.private, pw = String(d.pw || '');
  if (!title || !body) return { ok: false, error: '제목과 내용을 입력해 주세요.' };
  if (priv && pw.length < 4) return { ok: false, error: '비공개 글은 비밀번호를 4자 이상 넣어 주세요.' };
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('rate') || 0);
  if (n >= 10) return { ok: false, error: '잠시 뒤에 다시 올려 주세요.' };
  cache.put('rate', String(n + 1), 60);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var id, now = new Date();
  try {
    id = 'p' + now.getTime().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    var salt = Utilities.getUuid(), h = priv ? hash_(salt, pw) : '';
    sheet_().appendRow([id, now.getTime(), Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), title, body, author, priv, priv ? salt : '', h, false]);
  } finally { lock.releaseLock(); }

  try {
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: '[csh2020 게시판] ' + (priv ? '(비공개) ' : '') + title,
      htmlBody: '<p><b>' + esc(author) + '</b>님이 게시판에 ' + (priv ? '<b>비공개</b> ' : '') + '글을 올렸습니다.</p>' +
        '<p><b>제목:</b> ' + esc(title) + '</p><div style="white-space:pre-line;border-left:3px solid #22d3ee;padding:8px 12px;background:#f1f5f9">' + esc(body) + '</div>' +
        '<p><a href="' + SITE + '/board-admin">관리자 게시판에서 보기 →</a></p>'
    });
  } catch (x) {}
  return { ok: true, id: id };
}

function find_(id) { return rows_().filter(function (p) { return p.id === id; })[0]; }

function view_(d) {
  var p = find_(String(d.id || ''));
  if (!p) return { ok: false, error: '글을 찾을 수 없습니다.' };
  if (!p.private) return { ok: true, item: pub_(p, false) };
  if (isAdmin_(d.token)) return { ok: true, item: pub_(p, true) };
  if (hash_(p.salt, String(d.pw || '')) !== p.hash) return { ok: false, error: '비밀번호가 맞지 않습니다.' };
  var o = pub_(p, true); o.author = maskName_(p.author);
  return { ok: true, item: o };
}

function admin_(d) {
  if (!isAdmin_(d.token)) return { ok: false, error: '관리자 확인에 실패했습니다.' };
  return { ok: true, items: rows_().map(function (p) { return pub_(p, true); }) };
}

function del_(d) {
  if (!isAdmin_(d.token)) return { ok: false, error: '관리자 확인에 실패했습니다.' };
  var p = find_(String(d.id || ''));
  if (!p) return { ok: false, error: '글을 찾을 수 없습니다.' };
  sheet_().getRange(p.row, HEAD.indexOf('deleted') + 1).setValue(true);
  return { ok: true };
}

// 처음 한 번 실행해서 시트를 만들고 권한을 허용합니다.
function setup() {
  sheet_();
  MailApp.getRemainingDailyQuota();
  UrlFetchApp.fetch('https://api.github.com/zen', { muteHttpExceptions: true });
}
