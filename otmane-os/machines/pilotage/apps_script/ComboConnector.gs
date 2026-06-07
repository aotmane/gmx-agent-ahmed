// ════════════════════════════════════════════════════════════════════════════
// MAKI ONE — Connecteur Combo (API partenaire ComboHR) → table RH_COMBO
// ────────────────────────────────────────────────────────────────────────────
// Source : GET /api/v1/plannings (un shift porte le PRÉVU starts_at/ends_at/break
// ET le RÉALISÉ real_starts_at/real_ends_at/real_break). Le taux horaire vient de
// /api/v1/contracts (hourly_gross_rate). On agrège par mois → RH_COMBO.
//
// 🔐 Script Properties :  COMBO_TOKEN  +  COMBO_LOCATION_ID
//    (liste tes location_id via comboListLocations())
// ⚙️  Auth : confirme le schéma via le bouton « Autoriser » du Swagger ; par défaut
//    Authorization: Bearer <token>.
// ════════════════════════════════════════════════════════════════════════════

var COMBO = {
  BASE: 'https://partner.combohr.com',
  AUTH_HEADER: 'Authorization',
  AUTH_PREFIX: 'Bearer ',                 // à confirmer (schéma « Autoriser » du Swagger)
  EP_PLANNINGS: '/api/v1/plannings',
  EP_CONTRACTS: '/api/v1/contracts',
  EP_LOCATIONS: '/api/v1/locations',

  RATE_FIELD: 'hourly_gross_rate',        // taux horaire brut (sinon hourly_gross_salary)
  BREAK_UNIT_MINUTES: true,               // break_duration en minutes (sinon secondes)
  CHARGE_MULTIPLIER: 1.0,                 // ×coeff. charges patronales (ex. 1.42) pour le coût employeur

  PILOTAGE_SS_ID: '16LNpH29uvMFQQDE3WFBEgK_oyqi1YvoM2G6DsAh_Y7A',
  RH_TAB: 'RH_COMBO',
  TZ: 'Europe/Paris'
};

var RH_HEADERS = ['Mois', 'heures_planifiees', 'heures_pointees', 'masse_salariale', 'MAJ'];

// ── HTTP ──────────────────────────────────────────────────────────────────────
function comboFetch_(path, params) {
  var token = PropertiesService.getScriptProperties().getProperty('COMBO_TOKEN');
  if (!token) throw new Error('COMBO_TOKEN manquant (Propriétés du script).');
  var url = COMBO.BASE + path + (params ? '?' + cQuery_(params) : '');
  var headers = {}; headers[COMBO.AUTH_HEADER] = COMBO.AUTH_PREFIX + token;
  var res = UrlFetchApp.fetch(url, { method: 'get', headers: headers, muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Combo HTTP ' + code + ' : ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}
function comboLocation_() {
  var loc = PropertiesService.getScriptProperties().getProperty('COMBO_LOCATION_ID');
  if (!loc) throw new Error('COMBO_LOCATION_ID manquant (Propriétés du script).');
  return loc;
}

// ── Pull mensuel → RH_COMBO ───────────────────────────────────────────────────
function pullCombo(yyyymm) {
  var ym = yyyymm || Utilities.formatDate(new Date(), COMBO.TZ, 'yyyy-MM');
  var loc = comboLocation_();
  var start = ym + '-01', end = monthEnd_(ym);

  var shifts = cArray_(comboFetch_(COMBO.EP_PLANNINGS, { start_date: start, end_date: end, location_id: loc }));
  var rates = contractRates_(loc, start);

  var hPlan = 0, hPoint = 0, masse = 0;
  shifts.forEach(function (s) {
    var planned = Math.max(0, hrs_(s.starts_at, s.ends_at) - brk_(s.break_duration));
    var worked  = (s.real_starts_at && s.real_ends_at)
      ? Math.max(0, hrs_(s.real_starts_at, s.real_ends_at) - brk_(s.real_break_duration)) : 0;
    hPlan += planned; hPoint += worked;
    var basis = worked > 0 ? worked : planned;        // réalisé si pointé, sinon prévu
    masse += basis * (rates[s.contract_id] || 0) * COMBO.CHARGE_MULTIPLIER;
  });

  upsertRh_({ mois: ym, hplan: cRound_(hPlan), hpoint: cRound_(hPoint), masse: cRound_(masse) });
  Logger.log('✅ Combo ' + ym + ' : planif ' + cRound_(hPlan) + ' h · pointé ' + cRound_(hPoint)
    + ' h · masse ' + cRound_(masse) + ' € (' + shifts.length + ' shifts)');
  return { mois: ym, heures_planifiees: hPlan, heures_pointees: hPoint, masse_salariale: masse };
}

// contract_id → taux horaire (depuis /contracts actifs au jour donné)
function contractRates_(loc, day) {
  var rows = cArray_(comboFetch_(COMBO.EP_CONTRACTS, { location_id: loc, day: day }));
  var map = {};
  rows.forEach(function (c) {
    var rate = cNum_(c[COMBO.RATE_FIELD]) || cNum_(c.hourly_gross_salary);
    if (c.id) map[c.id] = rate;
    if (c.original_contract_id) map[c.original_contract_id] = rate; // fallback
  });
  return map;
}

function upsertRh_(r) {
  var ss = SpreadsheetApp.openById(COMBO.PILOTAGE_SS_ID);
  var sheet = ss.getSheetByName(COMBO.RH_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(COMBO.RH_TAB);
    sheet.appendRow(RH_HEADERS); sheet.getRange(1, 1, 1, RH_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var row = [r.mois, r.hplan, r.hpoint, r.masse, new Date()];
  var last = sheet.getLastRow(), at = 0;
  if (last > 1) {
    var keys = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) if (String(keys[i][0]) === r.mois) { at = 2 + i; break; }
  }
  if (at) sheet.getRange(at, 1, 1, row.length).setValues([row]); else sheet.appendRow(row);
}

// ── Outils ────────────────────────────────────────────────────────────────────
function comboListLocations() {                  // pour trouver ton location_id
  cArray_(comboFetch_(COMBO.EP_LOCATIONS, null)).forEach(function (l) {
    Logger.log(l.id + '  ·  ' + l.name + '  (équipes: ' + (l.teams || []).map(function (t) { return t.name; }).join(', ') + ')');
  });
}
function comboDryRun() {
  var ym = Utilities.formatDate(new Date(), COMBO.TZ, 'yyyy-MM');
  var data = comboFetch_(COMBO.EP_PLANNINGS, { start_date: ym + '-01', end_date: monthEnd_(ym), location_id: comboLocation_() });
  Logger.log(JSON.stringify(cArray_(data).slice(0, 3), null, 2));
}
function installComboTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pullCombo') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('pullCombo').timeBased().everyDays(1).atHour(6).create();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function hrs_(a, b) { if (!a || !b) return 0; var t = (new Date(b) - new Date(a)) / 3600000; return t > 0 ? t : 0; }
function brk_(x) { var m = cNum_(x); return COMBO.BREAK_UNIT_MINUTES ? m / 60 : m / 3600; }
function monthEnd_(ym) { var y = Number(ym.split('-')[0]), m = Number(ym.split('-')[1]); var d = new Date(y, m, 0); return Utilities.formatDate(d, COMBO.TZ, 'yyyy-MM-dd'); }
function cArray_(d) { return Array.isArray(d) ? d : (d && d.data && Array.isArray(d.data) ? d.data : (d && d.results) || []); }
function cQuery_(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
function cNum_(v) { var x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(x) ? 0 : x; }
function cRound_(x) { return Math.round(x * 100) / 100; }
