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
  return out_({ ok: false, error: 'unknown' });
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
