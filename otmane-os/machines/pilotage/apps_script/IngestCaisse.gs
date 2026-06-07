// ════════════════════════════════════════════════════════════════════════════
// MAKI ONE — Ingestion Caisse (feuille de caisse mensuelle → CA_CAISSE)
// ────────────────────────────────────────────────────────────────────────────
// Saisie du CA AUTOMATISÉE : tu déposes l'export de caisse (CSV/Excel) dans
//   /MAKI ONE/<exercice>/CAISSE/
// Un déclencheur HORAIRE parse le fichier (format clé/valeur « Feuille de caisse »,
// séparé par ';', décimales à virgule), écrit/maj la ligne du mois dans la table
// CA_CAISSE (Sheet Pilotage), puis déplace le fichier dans CAISSE/TRAITEES/.
//
// 100 % déterministe (pas besoin de Claude par fichier) et gratuit.
// Pour les .xlsx : activer le « Service avancé Drive » (Services ▸ Drive API).
// ════════════════════════════════════════════════════════════════════════════

var CC = {
  MAKI_ONE_FOLDER_ID: '1QuKDG5_kjR7eMxhXGBclgy6fPJWQj8gq',
  EXERCICE_START_MONTH: 7,
  CAISSE_SUBFOLDER: 'CAISSE',
  TRAITEES_SUBFOLDER: 'TRAITEES',

  PILOTAGE_SS_ID: '16LNpH29uvMFQQDE3WFBEgK_oyqi1YvoM2G6DsAh_Y7A',
  CA_TAB: 'CA_CAISSE',

  AGGREGATORS: ['uber eats', 'uber', 'deliveroo', 'just eat', 'justeat'],
  TZ: 'Europe/Paris'
};

var CA_HEADERS = ['Mois', 'Periode', 'CA_HT', 'CA_TTC', 'CA_agregateurs', 'CA_CB',
  'CA_especes', 'CA_en_ligne', 'CA_ticket_resto', 'Commandes_retirees', 'Fichier', 'MAJ'];

var MOIS_ABBR = { 'janv': 1, 'jan': 1, 'févr': 2, 'fevr': 2, 'fev': 2, 'mars': 3, 'avr': 4,
  'mai': 5, 'juin': 6, 'juil': 7, 'août': 8, 'aout': 8, 'sept': 9, 'sep': 9, 'oct': 10,
  'nov': 11, 'déc': 12, 'dec': 12 };

// ── Entrée principale (déclencheur horaire) ───────────────────────────────────
function ingestCaisse() {
  var caisse = caisseFolder_();
  var traitees = child_(caisse, CC.TRAITEES_SUBFOLDER);
  var done = 0;

  var files = caisse.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    var mt = f.getMimeType();
    var name = f.getName();
    var ext = (name.split('.').pop() || '').toLowerCase();
    var isCaisse = ['csv', 'xlsx', 'xls'].indexOf(ext) !== -1 ||
                   mt === 'text/csv' || mt.indexOf('spreadsheet') !== -1;
    if (!isCaisse) continue;

    try {
      var rows = readRows_(f, ext, mt);
      var rec = parseFeuille_(rows);
      rec.fichier = name;
      if (rec.mois) {
        upsertCa_(rec);
        traitees.addFile(f);
        caisse.removeFile(f);
        done++;
        Logger.log('✅ ' + name + ' → CA_CAISSE ' + rec.mois + ' (CA HT ' + rec.ca_ht + ')');
      } else {
        Logger.log('⚠️ Période illisible : ' + name);
      }
    } catch (e) {
      Logger.log('❌ ' + name + ' : ' + e);
    }
  }
  Logger.log('Terminé : ' + done + ' feuille(s) de caisse intégrée(s).');
  return { processed: done };
}

// ── Lecture du fichier → tableau de lignes [colA, colB, …] ────────────────────
function readRows_(file, ext, mt) {
  if (ext === 'csv' || mt === 'text/csv') {
    var txt = file.getBlob().getDataAsString('UTF-8');
    return Utilities.parseCsv(txt, ';');
  }
  // xlsx/xls → conversion temporaire en Google Sheet (Service avancé Drive requis)
  var temp = Drive.Files.copy({ title: '__tmp_caisse', mimeType: 'application/vnd.google-apps.spreadsheet' }, file.getId());
  try {
    var values = SpreadsheetApp.openById(temp.id).getSheets()[0].getDataRange().getValues();
    return values.map(function (r) { return r.map(function (c) { return String(c); }); });
  } finally {
    DriveApp.getFileById(temp.id).setTrashed(true);
  }
}

// ── Parse le format « Feuille de caisse » (clé/valeur) ────────────────────────
function parseFeuille_(rows) {
  var rec = { mois: '', periode: '', ca_ht: 0, ca_ttc: 0, ca_agregateurs: 0, ca_cb: 0,
    ca_especes: 0, ca_en_ligne: 0, ca_ticket_resto: 0, commandes_retirees: 0 };
  var section = '';
  var gotTtc = false, gotHt = false;

  rows.forEach(function (r) {
    var key = String(r[0] || '').trim();
    var val = num_(r[1]);
    var low = key.toLowerCase();

    if (low.indexOf('feuilles de caisse') === 0) { rec.periode = String(r[2] || '').trim(); return; }
    if (low === 'moyens de paiement') { section = 'paiement'; return; }
    if (low.indexOf('ca + tva') === 0) { section = 'ca'; return; }
    if (low.indexOf('débits de caisse') === 0 || low.indexOf('debits de caisse') === 0) return;

    if (low.indexOf('moyen de paiement ') === 0) {
      var moyen = low.replace('moyen de paiement ', '');
      if (CC.AGGREGATORS.some(function (a) { return moyen.indexOf(a) !== -1; })) rec.ca_agregateurs += val;
      else if (moyen.indexOf('cb tr') !== -1) rec.ca_cb += val;
      else if (moyen === 'cb') rec.ca_cb += val;
      else if (moyen.indexOf('espece') !== -1) rec.ca_especes += val;
      else if (moyen.indexOf('en ligne') !== -1) rec.ca_en_ligne += val;
      else if (moyen.indexOf('ticket restaurant') !== -1) rec.ca_ticket_resto += val;
      return;
    }
    if (section === 'ca') {
      if (key === 'CA TTC' && !gotTtc) { rec.ca_ttc = val; gotTtc = true; return; }
      if (key === 'CA HT' && !gotHt)  { rec.ca_ht = val;  gotHt = true; return; }
      if (low.indexOf('commandes clients retirées') !== -1 || low.indexOf('commandes clients retirees') !== -1)
        rec.commandes_retirees = val;
    }
  });

  rec.mois = periodToYm_(rec.periode);
  return rec;
}

// "sept-25" → "2025-09"
function periodToYm_(p) {
  var m = String(p || '').toLowerCase().replace(/\./g, '').match(/([a-zûéè]+)\s*[-\/ ]\s*(\d{2,4})/);
  if (!m) return '';
  var mois = MOIS_ABBR[m[1]] || MOIS_ABBR[m[1].slice(0, 4)] || MOIS_ABBR[m[1].slice(0, 3)];
  if (!mois) return '';
  var y = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  return y + '-' + (mois < 10 ? '0' + mois : mois);
}

// ── Upsert dans CA_CAISSE (clé = Mois) ────────────────────────────────────────
function upsertCa_(rec) {
  var ss = SpreadsheetApp.openById(CC.PILOTAGE_SS_ID);
  var sheet = ss.getSheetByName(CC.CA_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(CC.CA_TAB);
    sheet.appendRow(CA_HEADERS);
    sheet.getRange(1, 1, 1, CA_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var row = [rec.mois, rec.periode, rec.ca_ht, rec.ca_ttc, rec.ca_agregateurs, rec.ca_cb,
    rec.ca_especes, rec.ca_en_ligne, rec.ca_ticket_resto, rec.commandes_retirees, rec.fichier, new Date()];

  var last = sheet.getLastRow();
  var at = 0;
  if (last > 1) {
    var keys = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) if (String(keys[i][0]) === rec.mois) { at = 2 + i; break; }
  }
  if (at) sheet.getRange(at, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

// ── Dossier /MAKI ONE/<exercice>/CAISSE ───────────────────────────────────────
function caisseFolder_() {
  var maki = DriveApp.getFolderById(CC.MAKI_ONE_FOLDER_ID);
  var exo = child_(maki, exerciceLabelNow_());
  return child_(exo, CC.CAISSE_SUBFOLDER);
}
function exerciceLabelNow_() {
  var d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1;
  var start = (m >= CC.EXERCICE_START_MONTH) ? y : y - 1;
  return start + ' - ' + (start + 1);
}
function child_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function num_(v) {
  var x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(x) ? 0 : x;
}

// ── Outils ────────────────────────────────────────────────────────────────────
function installCaisseTrigger() {
  removeCaisseTrigger();
  ScriptApp.newTrigger('ingestCaisse').timeBased().everyHours(1).create();
  Logger.log('⏰ Déclencheur caisse installé.');
}
function removeCaisseTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'ingestCaisse') ScriptApp.deleteTrigger(t);
  });
}
// Test : parse une feuille sans rien écrire (passe un fileId).
function dryRunCaisse(fileId) {
  var f = DriveApp.getFileById(fileId);
  var ext = (f.getName().split('.').pop() || '').toLowerCase();
  var rec = parseFeuille_(readRows_(f, ext, f.getMimeType()));
  Logger.log(JSON.stringify(rec, null, 2));
  return rec;
}
