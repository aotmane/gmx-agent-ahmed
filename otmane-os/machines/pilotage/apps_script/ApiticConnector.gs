// ════════════════════════════════════════════════════════════════════════════
// MAKI ONE — Connecteur Apitic / web-caisse (BI data API) → table CA_APITIC
// ────────────────────────────────────────────────────────────────────────────
// Auth : POST /api/v1/token { email, password } → token Bearer (mis en cache).
// Puis pull du CA quotidien ventilé + couverts + tickets → CA_APITIC (par jour).
// Le cockpit lit CA_APITIC en priorité (repli : caisse CSV puis saisie manuelle).
//
// 🔐 Script Properties :  APITIC_EMAIL  +  APITIC_PASSWORD
// ⚙️  Confirmé : token endpoint. À caler via apiticAuthTest_() puis apiticDryRun() :
//    le champ du token dans la réponse, l'endpoint des ventes (EP_SALES) et les F_*.
// ════════════════════════════════════════════════════════════════════════════

var APITIC = {
  BASE: 'https://bi-data-api.web-caisse.com/api/v1',
  TOKEN_PATH: '/token',                         // ✅ POST { email, password }
  EP_SALES: '/sales',                           // ventes/CA par jour — À CONFIRMER (Swagger bi-data-api)

  // Noms de champs JSON — à ajuster après apiticDryRun().
  F_DATE: 'date',
  F_CA_HT: 'turnover_ht', F_CA_TTC: 'turnover_ttc',
  F_COUVERTS: 'covers',   F_TICKETS: 'tickets',
  F_SUR_PLACE: 'dine_in', F_EMPORTER: 'take_away',
  F_LIVRAISON: 'delivery', F_AGREGATEURS: 'platforms',

  PILOTAGE_SS_ID: '16LNpH29uvMFQQDE3WFBEgK_oyqi1YvoM2G6DsAh_Y7A',
  CA_TAB: 'CA_APITIC',
  TZ: 'Europe/Paris'
};

var CA_APITIC_HEADERS = ['Date', 'CA_HT', 'CA_TTC', 'couverts', 'tickets',
  'CA_sur_place', 'CA_emporter', 'CA_livraison', 'CA_agregateurs', 'MAJ'];

// ── Auth (login → token, mis en cache 50 min) ─────────────────────────────────
function apiticToken_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('apitic_token');
  if (cached) return cached;

  var props = PropertiesService.getScriptProperties();
  var email = props.getProperty('APITIC_EMAIL'), pwd = props.getProperty('APITIC_PASSWORD');
  if (!email || !pwd) throw new Error('APITIC_EMAIL / APITIC_PASSWORD manquants (Propriétés du script).');

  var res = UrlFetchApp.fetch(APITIC.BASE + APITIC.TOKEN_PATH, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ email: email, password: pwd }), muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error('Apitic /token HTTP ' + res.getResponseCode() + ' : ' + res.getContentText().slice(0, 200));
  var b = JSON.parse(res.getContentText());
  var token = b.token || b.access_token || b.jwt || (b.data && (b.data.token || b.data.access_token));
  if (!token) throw new Error('Token introuvable dans la réponse /token : ' + res.getContentText().slice(0, 200));
  cache.put('apitic_token', token, 3000);
  return token;
}

function apiticFetch_(path, params) {
  var url = APITIC.BASE + path + (params ? '?' + apQuery_(params) : '');
  var res = UrlFetchApp.fetch(url, {
    method: 'get', headers: { Authorization: 'Bearer ' + apiticToken_() }, muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Apitic HTTP ' + code + ' : ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}

// ── Pull du mois → CA_APITIC (une ligne par jour) ─────────────────────────────
function pullApitic(yyyymm) {
  var ym = yyyymm || Utilities.formatDate(new Date(), APITIC.TZ, 'yyyy-MM');
  var rows = apArray_(apiticFetch_(APITIC.EP_SALES, { from: ym + '-01', to: ym + '-31' }));
  var n = 0;
  rows.forEach(function (d) {
    var date = apDate_(d[APITIC.F_DATE]);
    if (!date) return;
    upsertApitic_({
      date: date,
      ca_ht: apNum_(d[APITIC.F_CA_HT]), ca_ttc: apNum_(d[APITIC.F_CA_TTC]),
      couverts: apNum_(d[APITIC.F_COUVERTS]), tickets: apNum_(d[APITIC.F_TICKETS]),
      sur_place: apNum_(d[APITIC.F_SUR_PLACE]), emporter: apNum_(d[APITIC.F_EMPORTER]),
      livraison: apNum_(d[APITIC.F_LIVRAISON]), agregateurs: apNum_(d[APITIC.F_AGREGATEURS])
    });
    n++;
  });
  Logger.log('✅ Apitic ' + ym + ' : ' + n + ' jour(s) intégré(s).');
  return { mois: ym, jours: n };
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

// ── Calibrage ─────────────────────────────────────────────────────────────────
// 1) Vérifie le login + montre la forme de la réponse /token (nom du champ token).
function apiticAuthTest_() {
  var props = PropertiesService.getScriptProperties();
  var res = UrlFetchApp.fetch(APITIC.BASE + APITIC.TOKEN_PATH, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ email: props.getProperty('APITIC_EMAIL'), password: props.getProperty('APITIC_PASSWORD') }),
    muteHttpExceptions: true
  });
  Logger.log('HTTP ' + res.getResponseCode() + ' : ' + res.getContentText().slice(0, 600));
}
// 2) Une fois EP_SALES connu : montre la réponse brute pour caler les F_*.
function apiticDryRun() {
  var ym = Utilities.formatDate(new Date(), APITIC.TZ, 'yyyy-MM');
  Logger.log(JSON.stringify(apiticFetch_(APITIC.EP_SALES, { from: ym + '-01', to: ym + '-31' }), null, 2).slice(0, 3000));
}
function installApiticTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pullApitic') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('pullApitic').timeBased().everyDays(1).atHour(6).create();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function apArray_(d) { return Array.isArray(d) ? d : (d && d.data && Array.isArray(d.data) ? d.data : (d && d.results) || []); }
function apQuery_(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
function apNum_(v) { var x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(x) ? 0 : x; }
function apDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, APITIC.TZ, 'dd/MM/yyyy');
  var s = String(v || '');
  var iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];
  var fr = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return fr ? fr[0] : '';
}
