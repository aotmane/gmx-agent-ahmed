// ════════════════════════════════════════════════════════════════════════════
// MAKI ONE — Connecteur Apitic / web-caisse (BI data API) → table CA_APITIC
// ────────────────────────────────────────────────────────────────────────────
// Auth : POST /api/v1/token {email,password} → { access_token } (Bearer, en cache).
// Ventes : GET /accounts/{id}/sales/{date} — UNE entrée par ticket. On agrège par
// jour : CA HT/TTC (lignes), couverts (guests_number), tickets (count), ventilation
// par canal (sale_type / platform) → CA_APITIC. Le cockpit lit CA_APITIC en priorité.
//
// 🔐 Script Properties : APITIC_EMAIL, APITIC_PASSWORD, APITIC_ACCOUNT_ID
//    (liste les comptes via apiticListAccounts()).
// ⏰ Fenêtres API interdites (CET) : 05–06h, 11h30–14h30, 18h30–22h30. 10 req/s max.
// ════════════════════════════════════════════════════════════════════════════

var APITIC = {
  BASE: 'https://bi-data-api.web-caisse.com/api/v1',
  AGGREGATOR_PLATFORMS: ['webcaisse'],          // platform NON listée ici = agrégateur (Uber, etc.)
  SALE_LINE_TYPES: ['vente', 'sale', ''],        // types de ligne comptés dans le CA
  PILOTAGE_SS_ID: '16LNpH29uvMFQQDE3WFBEgK_oyqi1YvoM2G6DsAh_Y7A',
  CA_TAB: 'CA_APITIC',
  TZ: 'Europe/Paris'
};

var CA_APITIC_HEADERS = ['Date', 'CA_HT', 'CA_TTC', 'couverts', 'tickets',
  'CA_sur_place', 'CA_emporter', 'CA_livraison', 'CA_agregateurs', 'MAJ'];

// ── Auth (login → access_token, en cache 50 min) ──────────────────────────────
function apiticToken_() {
  var cache = CacheService.getScriptCache(), cached = cache.get('apitic_token');
  if (cached) return cached;
  var props = PropertiesService.getScriptProperties();
  var email = props.getProperty('APITIC_EMAIL'), pwd = props.getProperty('APITIC_PASSWORD');
  if (!email || !pwd) throw new Error('APITIC_EMAIL / APITIC_PASSWORD manquants.');
  var res = UrlFetchApp.fetch(APITIC.BASE + '/token', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ email: email, password: pwd }), muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error('Apitic /token HTTP ' + res.getResponseCode() + ' : ' + res.getContentText().slice(0, 200));
  var b = JSON.parse(res.getContentText());
  var token = b.access_token || b.token || (b.data && b.data.access_token);
  if (!token) throw new Error('access_token introuvable : ' + res.getContentText().slice(0, 200));
  cache.put('apitic_token', token, 3000);
  return token;
}
function apiticFetch_(path, params) {
  var url = APITIC.BASE + path + (params ? '?' + apQuery_(params) : '');
  var res = UrlFetchApp.fetch(url, { method: 'get', headers: { Authorization: 'Bearer ' + apiticToken_() }, muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Apitic HTTP ' + code + ' : ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}
function apiticAccount_() {
  var a = PropertiesService.getScriptProperties().getProperty('APITIC_ACCOUNT_ID');
  if (!a) throw new Error('APITIC_ACCOUNT_ID manquant (lance apiticListAccounts()).');
  return a;
}

// ── Pull ──────────────────────────────────────────────────────────────────────
// Une journée fiscale (YYYY-MM-DD) → 1 ligne CA_APITIC.
function pullApiticDay(date, account) {
  var acc = account || apiticAccount_();
  var sales = apiticSalesDay_(acc, date);
  var agg = { date: apDate_(date), ca_ht: 0, ca_ttc: 0, couverts: 0, tickets: 0,
    sur_place: 0, emporter: 0, livraison: 0, agregateurs: 0 };

  sales.forEach(function (s) {
    agg.tickets += 1;
    agg.couverts += apNum_(s.guests_number);
    var ht = 0, ttc = 0;
    (s.lines || []).forEach(function (l) {
      var lt = String(l.line_type || '').toLowerCase();
      if (APITIC.SALE_LINE_TYPES.indexOf(lt) === -1) return;
      ht += apNum_(l.excl_tax_price); ttc += apNum_(l.ati_price);
    });
    agg.ca_ht += ht; agg.ca_ttc += ttc;

    var plat = String(s.platform || '').toLowerCase();
    var stype = String(s.sale_type || '').toLowerCase();
    if (plat && APITIC.AGGREGATOR_PLATFORMS.indexOf(plat) === -1) agg.agregateurs += ttc;
    else if (stype.indexOf('emporter') !== -1 || stype.indexOf('take') !== -1) agg.emporter += ttc;
    else if (stype.indexOf('livr') !== -1 || stype.indexOf('deliver') !== -1) agg.livraison += ttc;
    else agg.sur_place += ttc;
  });

  ['ca_ht', 'ca_ttc', 'sur_place', 'emporter', 'livraison', 'agregateurs'].forEach(function (k) { agg[k] = apRound_(agg[k]); });
  upsertApitic_(agg);
  return agg;
}

// Tout un mois (jusqu'à aujourd'hui).
function pullApitic(yyyymm) {
  var ym = yyyymm || Utilities.formatDate(new Date(), APITIC.TZ, 'yyyy-MM');
  var acc = apiticAccount_();
  var y = Number(ym.split('-')[0]), m = Number(ym.split('-')[1]);
  var lastDay = new Date(y, m, 0).getDate(), today = new Date(), n = 0;
  for (var dd = 1; dd <= lastDay; dd++) {
    if (new Date(y, m - 1, dd) > today) break;
    pullApiticDay(ym + '-' + (dd < 10 ? '0' + dd : dd), acc); n++;
  }
  Logger.log('✅ Apitic ' + ym + ' : ' + n + ' jour(s).');
  return { mois: ym, jours: n };
}

// Déclencheur quotidien : la veille (journée fiscale clôturée).
function pullApiticYesterday() {
  var d = new Date(); d.setDate(d.getDate() - 1);
  pullApiticDay(Utilities.formatDate(d, APITIC.TZ, 'yyyy-MM-dd'));
}

// Pagination des ventes d'un jour.
function apiticSalesDay_(acc, date) {
  var all = [], page = 1, total = -1;
  while (page <= 200) {
    var r = apiticFetch_('/accounts/' + acc + '/sales/' + date, { page: page, size: 100 });
    var d = apArray_(r); if (total < 0) total = (r.total != null) ? r.total : d.length;
    all = all.concat(d);
    if (!d.length || all.length >= total) break;
    page++;
  }
  return all;
}

function upsertApitic_(r) {
  var ss = SpreadsheetApp.openById(APITIC.PILOTAGE_SS_ID);
  var sheet = ss.getSheetByName(APITIC.CA_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(APITIC.CA_TAB);
    sheet.appendRow(CA_APITIC_HEADERS); sheet.getRange(1, 1, 1, CA_APITIC_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var row = [r.date, r.ca_ht, r.ca_ttc, r.couverts, r.tickets, r.sur_place, r.emporter, r.livraison, r.agregateurs, new Date()];
  var last = sheet.getLastRow(), at = 0;
  if (last > 1) {
    var keys = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) if (apDate_(keys[i][0]) === r.date) { at = 2 + i; break; }
  }
  if (at) sheet.getRange(at, 1, 1, row.length).setValues([row]); else sheet.appendRow(row);
}

// ── Outils / calibrage ────────────────────────────────────────────────────────
function apiticListAccounts() {                  // trouve ton APITIC_ACCOUNT_ID
  apArray_(apiticFetch_('/accounts', { page: 1, size: 200 })).forEach(function (a) {
    Logger.log(a.id + '  ·  ' + a.name + '  (' + a.shop_code + ', ' + a.country + ')');
  });
}
function apiticAuthTest_() {
  var p = PropertiesService.getScriptProperties();
  var res = UrlFetchApp.fetch(APITIC.BASE + '/token', { method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ email: p.getProperty('APITIC_EMAIL'), password: p.getProperty('APITIC_PASSWORD') }), muteHttpExceptions: true });
  Logger.log('HTTP ' + res.getResponseCode() + ' : ' + res.getContentText().slice(0, 400));
}
function installApiticTrigger() {                // 03h (hors fenêtres interdites)
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pullApiticYesterday') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('pullApiticYesterday').timeBased().everyDays(1).atHour(3).create();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function apArray_(d) { return Array.isArray(d) ? d : (d && d.data && Array.isArray(d.data) ? d.data : (d && d.results) || []); }
function apQuery_(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
function apNum_(v) { var x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(x) ? 0 : x; }
function apRound_(x) { return Math.round(x * 100) / 100; }
function apDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, APITIC.TZ, 'dd/MM/yyyy');
  var s = String(v || ''), iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];
  var fr = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return fr ? fr[0] : '';
}
