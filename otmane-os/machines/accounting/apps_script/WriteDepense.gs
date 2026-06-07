// ════════════════════════════════════════════════════════════════════════════
// MAKI ONE — WriteDepense : point d'écriture DÉPENSES pour l'étape Claude
// ────────────────────────────────────────────────────────────────────────────
// Endpoint Web App SÉCURISÉ (secret en Script Property, pas en dur) qui :
//   1. valide le secret
//   2. dédoublonne sur la clé interne c0 (colonne A)
//   3. insère la ligne dans DÉPENSES (mêmes 15 colonnes/formats que l'existant)
//   4. DÉPLACE le PDF de FACTURES → TRAITEES/<AAAA-MM - mois AAAA> (date de facture)
//   5. marque la ligne INBOX_FACTURES en « TRAITÉ »
//
// Contrat de colonnes identique au Web App « Extraction Factures » (HEADER_ROW 5).
//
// ⚙️  AVANT DÉPLOIEMENT : Projet ▸ Paramètres ▸ Propriétés du script
//     → WRITE_SECRET = <secret long et aléatoire>
// ════════════════════════════════════════════════════════════════════════════

var SS_ID              = '1vzCam67Bf4p5NsFX2XDom3GOD2LB8ziDaHlvqcrCph0';
var SHEET              = 'DÉPENSES';
var HEADER_ROW         = 5;
var QUEUE_TAB          = 'INBOX_FACTURES';
var MAKI_ONE_FOLDER_ID = '1QuKDG5_kjR7eMxhXGBclgy6fPJWQj8gq';
var EXERCICE_START_MONTH = 7;

function doPost(e) { return handle_(e); }
function doGet(e)  { return handle_(e); }

function handle_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  try {
    // 1. Sécurité
    var expected = PropertiesService.getScriptProperties().getProperty('WRITE_SECRET');
    if (!expected || p.secret !== expected) return json_({ status: 'error', msg: 'Unauthorized' });

    var c0 = dec_(p.c0);
    if (!c0) return json_({ status: 'error', msg: 'c0 (clé interne) obligatoire' });

    var ss = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName(SHEET);
    if (!sheet) return json_({ status: 'error', msg: 'Onglet DÉPENSES introuvable' });

    // 2. Dédoublonnage sur c0
    var last = sheet.getLastRow();
    if (last > HEADER_ROW) {
      var keys = sheet.getRange(HEADER_ROW + 1, 1, last - HEADER_ROW, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i][0] || '').trim() === c0) {
          markQueue_(ss, p.messageId, 'DOUBLON');
          return json_({ status: 'skipped_duplicate', c0: c0, row: HEADER_ROW + 1 + i });
        }
      }
    }

    // 3. Insertion DÉPENSES
    var at = nextRow_(sheet);
    sheet.getRange(at, 1, 1, 15).setValues([[
      c0, dec_(p.c1), dec_(p.c2), dec_(p.c3), normCat_(dec_(p.c4)),
      dec_(p.c5), dec_(p.c6), num_(p.c7), num_(p.c8), num_(p.c9), num_(p.c10),
      dec_(p.c11), '', dec_(p.c13), dec_(p.c14)
    ]]);
    sheet.getRange(at, 8).setNumberFormat('#,##0.00\\ "€"');
    sheet.getRange(at, 9).setNumberFormat('0.00" %"');
    sheet.getRange(at, 10).setNumberFormat('#,##0.00\\ "€"');
    sheet.getRange(at, 11).setNumberFormat('#,##0.00\\ "€"');
    SpreadsheetApp.flush();

    // 4. Déplacer + renommer le PDF → TRAITEES/<AAAA-MM - mois AAAA> (date de facture c1)
    var moved = '';
    if (p.fileId) {
      try {
        var d = parseFrDate_(dec_(p.c1)) || new Date();
        var dest = traiteesMonth_(d);
        var file = DriveApp.getFileById(p.fileId);
        if (p.newName) file.setName(dec_(p.newName));
        dest.addFile(file);
        file.getParents().forEach(function (par) {
          if (par.getId() !== dest.getId()) { try { par.removeFile(file); } catch (x) {} }
        });
        moved = dest.getName();
      } catch (em) { moved = 'ERREUR_DEPLACEMENT: ' + em; }
    }

    // 5. Marquer la file
    markQueue_(ss, p.messageId, 'TRAITÉ');

    return json_({ status: 'ok', row: at, c0: c0, fournisseur: dec_(p.c2), traitees: moved });
  } catch (err) {
    return json_({ status: 'error', msg: err.toString() });
  }
}

function nextRow_(sheet) {
  var last = sheet.getLastRow();
  if (last <= HEADER_ROW) return HEADER_ROW + 1;
  var col = sheet.getRange(HEADER_ROW + 1, 1, last - HEADER_ROW, 1).getValues();
  for (var i = col.length - 1; i >= 0; i--) if (col[i][0] !== '' && col[i][0] !== null) return HEADER_ROW + 1 + i + 1;
  return HEADER_ROW + 1;
}

// /MAKI ONE/<exercice>/FACTURES/TRAITEES/<AAAA-MM - mois AAAA>/
function traiteesMonth_(date) {
  var maki = DriveApp.getFolderById(MAKI_ONE_FOLDER_ID);
  var exo  = child_(maki, wdExercice_(date));
  var fac  = child_(exo, 'FACTURES');
  var tr   = child_(fac, 'TRAITEES');
  return child_(tr, moisDossier_(date));
}
function child_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function wdExercice_(date) {
  var y = date.getFullYear(), m = date.getMonth() + 1;
  var start = (m >= EXERCICE_START_MONTH) ? y : y - 1;
  return start + ' - ' + (start + 1);
}
// Convention existante : "2026-04 - avril 2026" (mois calendaire, minuscules sans accent).
function moisDossier_(date) {
  var noms = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
  var y = date.getFullYear(), m = date.getMonth() + 1;
  return y + '-' + (m < 10 ? '0' : '') + m + ' - ' + noms[m - 1] + ' ' + y;
}
function parseFrDate_(s) {
  var m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

function markQueue_(ss, messageId, statut) {
  if (!messageId) return;
  var q = ss.getSheetByName(QUEUE_TAB);
  if (!q) return;
  var last = q.getLastRow();
  if (last < 2) return;
  var ids = q.getRange(2, 2, last - 1, 1).getValues();        // col B = messageId
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '') === String(messageId)) {
      q.getRange(2 + i, 11).setValue(statut);                  // col K = Statut
      return;
    }
  }
}

function normCat_(c) {
  var map = {
    'Matieres premieres': 'Matières premières', 'Loyer et Charges': 'Loyer & Charges',
    'Loyer & Charges': 'Loyer & Charges', 'Equipements': 'Equipements', 'Entretien': 'Entretien',
    'IT et Logiciels': 'IT et Logiciels', 'Livraison': 'Livraison', 'Boissons': 'Boissons',
    'Emballages': 'Emballages', 'Marketing': 'Marketing', 'Honoraires': 'Honoraires',
    'Transport': 'Transport', 'Salaires': 'Salaires', 'Divers': 'Divers',
    'Commissions': 'Commissions', 'Commissions paiement': 'Commissions'
  };
  return map[c] || c;
}
function dec_(v) { try { return decodeURIComponent(v || ''); } catch (e) { return v || ''; } }
function num_(v) { return (v !== undefined && v !== '') ? Number(v) : ''; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
