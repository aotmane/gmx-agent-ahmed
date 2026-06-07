// ════════════════════════════════════════════════════════════════════════════
// MAKI ONE — Connecteur Combo (RH/planning) → table RH_COMBO
// ────────────────────────────────────────────────────────────────────────────
// Tire de l'API Combo : heures planifiées, heures pointées (réalisées) et masse
// salariale du mois → upsert dans RH_COMBO (Sheet Pilotage). Le cockpit lit cette
// table pour le labor cost et l'écart d'heures (repli : catégorie Salaires des DÉPENSES).
//
// 🔐 Secret en Script Property (jamais en dur / git) :
//     Paramètres du projet ▸ Propriétés du script ▸  COMBO_TOKEN = <ta clé API Combo>
// ⚙️  base URL / chemins / noms de champs = à CONFIRMER via comboDryRun() (cf. README).
// ════════════════════════════════════════════════════════════════════════════

var COMBO = {
  BASE: 'https://api.combohr.com/v1',          // À CONFIRMER (portail Combo)
  AUTH_HEADER: 'Authorization',
  AUTH_PREFIX: 'Bearer ',                       // ex. "Bearer <token>"
  EP_SHIFTS: '/shifts',                         // planning prévu       (À CONFIRMER)
  EP_TIMECLOCK: '/time_clockings',              // pointages réalisés   (À CONFIRMER)

  // Noms de champs dans la réponse JSON — à ajuster après comboDryRun().
  F_DATE: 'date',
  F_PLANNED_HOURS: 'planned_hours',
  F_WORKED_HOURS: 'worked_hours',
  F_COST: 'cost',                               // coût chargé de la ligne (si fourni)

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

// ── Pull mensuel → RH_COMBO ───────────────────────────────────────────────────
function pullCombo(yyyymm) {
  var ym = yyyymm || Utilities.formatDate(new Date(), COMBO.TZ, 'yyyy-MM');
  var from = ym + '-01', to = ym + '-31';

  var shifts = cArray_(comboFetch_(COMBO.EP_SHIFTS, { from: from, to: to }));
  var clocks = cArray_(comboFetch_(COMBO.EP_TIMECLOCK, { from: from, to: to }));

  var hPlan = 0, hPoint = 0, masse = 0;
  shifts.forEach(function (s) { hPlan += cNum_(s[COMBO.F_PLANNED_HOURS]); masse += cNum_(s[COMBO.F_COST]); });
  clocks.forEach(function (c) { hPoint += cNum_(c[COMBO.F_WORKED_HOURS]); });

  upsertRh_({ mois: ym, hplan: cRound_(hPlan), hpoint: cRound_(hPoint), masse: cRound_(masse) });
  Logger.log('✅ Combo ' + ym + ' : planif ' + hPlan + ' h · pointé ' + hPoint + ' h · masse ' + masse + ' €');
  return { mois: ym, heures_planifiees: hPlan, heures_pointees: hPoint, masse_salariale: masse };
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

// ── Calibrage / planif ────────────────────────────────────────────────────────
// Affiche la réponse brute d'un endpoint pour caler les noms de champs (F_*).
function comboDryRun() {
  var ym = Utilities.formatDate(new Date(), COMBO.TZ, 'yyyy-MM');
  var data = comboFetch_(COMBO.EP_SHIFTS, { from: ym + '-01', to: ym + '-31' });
  Logger.log(JSON.stringify(data, null, 2).slice(0, 3000));
}
function installComboTrigger() {                 // 1×/jour
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pullCombo') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('pullCombo').timeBased().everyDays(1).atHour(6).create();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function cArray_(d) { return Array.isArray(d) ? d : (d && d.data && Array.isArray(d.data) ? d.data : (d && d.results) || []); }
function cQuery_(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
function cNum_(v) { var x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(x) ? 0 : x; }
function cRound_(x) { return Math.round(x * 100) / 100; }
