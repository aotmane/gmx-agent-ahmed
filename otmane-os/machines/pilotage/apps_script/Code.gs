// ════════════════════════════════════════════════════════════════════════════
// MAKI ONE — Cockpit de pilotage (Web App Apps Script, gratuit)
// ────────────────────────────────────────────────────────────────────────────
// • SAISIE du CA quotidien (ventilé) + couverts/tickets/heures  → Sheet Pilotage
// • COCKPIT mensuel : CA, panier moyen, food cost %, labor cost %, prime cost %,
//   avec alertes vs objectifs. Le food/labor cost est calculé en lisant les
//   achats par catégorie dans « SUIVI DES DÉPENSES ».
// 100 % Claude Max compatible : aucun service payant.
//
// Déploiement : Déployer ▸ Application Web ▸ Exécuter en tant que MOI ▸ Accès = Moi.
// ════════════════════════════════════════════════════════════════════════════

var CFG = {
  PILOTAGE_SS_ID: '16LNpH29uvMFQQDE3WFBEgK_oyqi1YvoM2G6DsAh_Y7A', // Pilotage Eat Sushi Manosque
  SAISIE_TAB: 'SAISIE_JOURNALIERE',

  DEPENSES_SS_ID: '1vzCam67Bf4p5NsFX2XDom3GOD2LB8ziDaHlvqcrCph0', // SUIVI DES DÉPENSES
  DEPENSES_TAB: 'DÉPENSES',
  DEP_HEADER_ROW: 5,         // données à partir de la ligne 6
  DEP_COL_DATE: 2,           // B
  DEP_COL_CAT: 5,            // E
  DEP_COL_HT: 8,             // H

  FOOD_CATS: ['Matières premières', 'Boissons'],
  LABOR_CAT: 'Salaires',

  // Objectifs (rules of thumb resto — ajustables)
  TARGET_FOOD: 0.30, TARGET_LABOR: 0.35, TARGET_PRIME: 0.65,

  TZ: 'Europe/Paris'
};

var SAISIE_HEADERS = ['Date', 'CA_HT_total', 'CA_sur_place', 'CA_emporter',
  'CA_livraison_propre', 'CA_agregateurs', 'couverts', 'tickets', 'panier_moyen',
  'offerts_ht', 'heures_planifiees', 'heures_pointees', 'notes'];

// ── Web App ───────────────────────────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('MAKI ONE — Pilotage')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── SAISIE ────────────────────────────────────────────────────────────────────
function saveDaily(d) {
  var sheet = ensureSaisie_();
  var date = String(d.date || '').trim();           // JJ/MM/AAAA
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) throw new Error('Date attendue au format JJ/MM/AAAA');

  var ca = n_(d.ca_sur_place) + n_(d.ca_emporter) + n_(d.ca_livraison) + n_(d.ca_agregateurs);
  var couverts = n_(d.couverts);
  var panier = couverts > 0 ? round2_(ca / couverts) : '';
  var row = [date, round2_(ca), n_(d.ca_sur_place), n_(d.ca_emporter), n_(d.ca_livraison),
    n_(d.ca_agregateurs), couverts, n_(d.tickets), panier, n_(d.offerts),
    n_(d.heures_planifiees), n_(d.heures_pointees), String(d.notes || '')];

  // upsert : remplace la ligne du jour si elle existe, sinon ajoute
  var r = findDateRow_(sheet, date);
  if (r > 0) sheet.getRange(r, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  SpreadsheetApp.flush();
  return { ok: true, date: date, ca_ht: round2_(ca), panier_moyen: panier, updated: r > 0 };
}

function ensureSaisie_() {
  var ss = SpreadsheetApp.openById(CFG.PILOTAGE_SS_ID);
  var sheet = ss.getSheetByName(CFG.SAISIE_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(CFG.SAISIE_TAB);
    sheet.appendRow(SAISIE_HEADERS);
    sheet.getRange(1, 1, 1, SAISIE_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findDateRow_(sheet, date) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var vals = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (fmtDate_(vals[i][0]) === date) return 2 + i;
  return -1;
}

// ── COCKPIT ───────────────────────────────────────────────────────────────────
// yyyymm optionnel ("2026-04") ; défaut = mois courant.
function getCockpit(yyyymm) {
  var ym = yyyymm || Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM');

  // Sources CA (priorité) : Apitic (jour) > feuille de caisse (mois) > saisie manuelle.
  var ca = 0, couverts = 0, tickets = 0, hPlan = 0, hPoint = 0, jours = 0;
  var agregateurs = 0, sourceCa = 'saisie', sourceLabor = 'depenses';
  var sheet = ensureSaisie_();
  var last = sheet.getLastRow();
  if (last > 1) {
    var rows = sheet.getRange(2, 1, last - 1, SAISIE_HEADERS.length).getValues();
    rows.forEach(function (rr) {
      if (ymOf_(rr[0]) === ym) {
        ca += n_(rr[1]); couverts += n_(rr[6]); tickets += n_(rr[7]);
        hPlan += n_(rr[10]); hPoint += n_(rr[11]); jours++;
      }
    });
  }
  var caisse = readCaCaisse_(ym);          // feuille de caisse mensuelle (HT)
  if (caisse) { ca = caisse.ca_ht; agregateurs = caisse.ca_agregateurs; sourceCa = 'caisse'; }
  var api = readApiticMonth_(ym);          // Apitic (journalier agrégé) — prioritaire
  if (api) { ca = api.ca_ht; couverts = api.couverts || couverts; tickets = api.tickets || tickets;
             agregateurs = api.agregateurs || agregateurs; sourceCa = 'apitic'; }

  // Achats du mois par catégorie (depuis DÉPENSES, HT)
  var food = 0, labor = 0;
  var dss = SpreadsheetApp.openById(CFG.DEPENSES_SS_ID).getSheetByName(CFG.DEPENSES_TAB);
  if (dss) {
    var dlast = dss.getLastRow();
    if (dlast > CFG.DEP_HEADER_ROW) {
      var data = dss.getRange(CFG.DEP_HEADER_ROW + 1, 1, dlast - CFG.DEP_HEADER_ROW, 15).getValues();
      data.forEach(function (rr) {
        if (ymOf_(rr[CFG.DEP_COL_DATE - 1]) !== ym) return;
        var cat = String(rr[CFG.DEP_COL_CAT - 1] || '');
        var ht = n_(rr[CFG.DEP_COL_HT - 1]);
        if (CFG.FOOD_CATS.indexOf(cat) !== -1) food += ht;
        if (cat === CFG.LABOR_CAT) labor += ht;
      });
    }
  }

  var rh = readComboMonth_(ym);            // Combo (RH) — prioritaire sur la catégorie Salaires
  if (rh) { labor = rh.masse_salariale || labor; hPlan = rh.heures_planifiees || hPlan;
            hPoint = rh.heures_pointees || hPoint; sourceLabor = 'combo'; }

  var foodPct  = ca > 0 ? food / ca : 0;
  var laborPct = ca > 0 ? labor / ca : 0;
  var primePct = foodPct + laborPct;

  return {
    mois: ym, jours_saisis: jours, source_ca: sourceCa, source_labor: sourceLabor,
    ca_agregateurs: round2_(agregateurs), tickets: tickets,
    ca_ht: round2_(ca), couverts: couverts,
    panier_moyen: couverts > 0 ? round2_(ca / couverts) : 0,
    heures_planifiees: hPlan, heures_pointees: hPoint, ecart_heures: round2_(hPoint - hPlan),
    food_eur: round2_(food), food_pct: pct_(foodPct),
    labor_eur: round2_(labor), labor_pct: pct_(laborPct),
    prime_pct: pct_(primePct),
    alertes: {
      food:  flag_(foodPct,  CFG.TARGET_FOOD),
      labor: flag_(laborPct, CFG.TARGET_LABOR),
      prime: flag_(primePct, CFG.TARGET_PRIME)
    },
    objectifs: { food: pct_(CFG.TARGET_FOOD), labor: pct_(CFG.TARGET_LABOR), prime: pct_(CFG.TARGET_PRIME) }
  };
}

// CA mensuel depuis la feuille de caisse (table CA_CAISSE alimentée par IngestCaisse).
function readCaCaisse_(ym) {
  var sh = SpreadsheetApp.openById(CFG.PILOTAGE_SS_ID).getSheetByName('CA_CAISSE');
  if (!sh) return null;
  var last = sh.getLastRow();
  if (last < 2) return null;
  var vals = sh.getRange(2, 1, last - 1, 5).getValues(); // Mois, Periode, CA_HT, CA_TTC, CA_agregateurs
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === ym) return { ca_ht: n_(vals[i][2]), ca_ttc: n_(vals[i][3]), ca_agregateurs: n_(vals[i][4]) };
  }
  return null;
}

// CA + couverts + tickets du mois depuis Apitic (table CA_APITIC, journalier).
function readApiticMonth_(ym) {
  var sh = SpreadsheetApp.openById(CFG.PILOTAGE_SS_ID).getSheetByName('CA_APITIC');
  if (!sh) return null;
  var last = sh.getLastRow();
  if (last < 2) return null;
  var v = sh.getRange(2, 1, last - 1, 9).getValues(); // Date,CA_HT,CA_TTC,couverts,tickets,...,CA_agregateurs
  var ca = 0, couv = 0, tick = 0, agg = 0, found = false;
  v.forEach(function (r) {
    if (ymOf_(r[0]) !== ym) return;
    found = true; ca += n_(r[1]); couv += n_(r[3]); tick += n_(r[4]); agg += n_(r[8]);
  });
  return found ? { ca_ht: ca, couverts: couv, tickets: tick, agregateurs: agg } : null;
}

// Heures + masse salariale du mois depuis Combo (table RH_COMBO, mensuel).
function readComboMonth_(ym) {
  var sh = SpreadsheetApp.openById(CFG.PILOTAGE_SS_ID).getSheetByName('RH_COMBO');
  if (!sh) return null;
  var last = sh.getLastRow();
  if (last < 2) return null;
  var v = sh.getRange(2, 1, last - 1, 4).getValues(); // Mois, hplan, hpoint, masse
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]) === ym) return { heures_planifiees: n_(v[i][1]), heures_pointees: n_(v[i][2]), masse_salariale: n_(v[i][3]) };
  }
  return null;
}

// 7 derniers jours saisis (pour le tableau du cockpit)
function getRecentDays() {
  var sheet = ensureSaisie_();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var n = Math.min(7, last - 1);
  var rows = sheet.getRange(last - n + 1, 1, n, SAISIE_HEADERS.length).getValues();
  return rows.map(function (r) {
    return { date: fmtDate_(r[0]), ca: n_(r[1]), couverts: n_(r[6]), panier: n_(r[8]) };
  }).reverse();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function flag_(val, target) {                 // vert / orange / rouge
  if (val <= target) return 'ok';
  if (val <= target * 1.1) return 'warn';
  return 'bad';
}
function ymOf_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'yyyy-MM');
  var m = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? (m[3] + '-' + (m[2].length < 2 ? '0' + m[2] : m[2])) : '';
}
function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'dd/MM/yyyy');
  return String(v || '');
}
function n_(v) { var x = parseFloat(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; }
function round2_(x) { return Math.round(x * 100) / 100; }
function pct_(x) { return Math.round(x * 1000) / 10; } // 0.305 -> 30.5
