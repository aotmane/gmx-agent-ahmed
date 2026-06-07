// ════════════════════════════════════════════════════════════════════════════
// MAKI ONE — WriteDepense : point d'écriture DÉPENSES pour l'étape Claude
// ────────────────────────────────────────────────────────────────────────────
// Endpoint Web App SÉCURISÉ (secret en Script Property, pas en dur) qui :
//   1. valide le secret
//   2. dédoublonne sur la clé interne c0 (colonne A)
//   3. insère la ligne dans DÉPENSES (mêmes 15 colonnes/formats que l'existant)
//   4. marque la ligne correspondante de INBOX_FACTURES en « TRAITÉ »
//
// Claude appelle cet endpoint après avoir lu le PDF et extrait les champs.
// Contrat de colonnes identique au Web App « Extraction Factures » (HEADER_ROW 5).
//
// ⚙️  AVANT DÉPLOIEMENT : Projet ▸ Paramètres du projet ▸ Propriétés du script
//     → ajouter  WRITE_SECRET = <un secret long et aléatoire>
// ════════════════════════════════════════════════════════════════════════════

var SS_ID      = '1vzCam67Bf4p5NsFX2XDom3GOD2LB8ziDaHlvqcrCph0';
var SHEET      = 'DÉPENSES';
var HEADER_ROW = 5;
var QUEUE_TAB  = 'INBOX_FACTURES';

function doPost(e) { return handle_(e); }
function doGet(e)  { return handle_(e); } // GET accepté (URL-params) pour les clients HTTP simples

function handle_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var out = { status: 'pending' };
  try {
    // 1. Sécurité
    var expected = PropertiesService.getScriptProperties().getProperty('WRITE_SECRET');
    if (!expected || p.secret !== expected) {
      return json_({ status: 'error', msg: 'Unauthorized' });
    }

    var c0 = dec_(p.c0);
    if (!c0) return json_({ status: 'error', msg: 'c0 (clé interne) obligatoire' });

    var ss    = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName(SHEET);
    if (!sheet) return json_({ status: 'error', msg: 'Onglet DÉPENSES introuvable' });

    // 2. Dédoublonnage sur c0 (colonne A)
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

    // 3. Insertion (après la dernière ligne non vide de la colonne A)
    var at = nextRow_(sheet);
    sheet.getRange(at, 1, 1, 15).setValues([[
      c0, dec_(p.c1), dec_(p.c2), dec_(p.c3), normCat_(dec_(p.c4)),
      dec_(p.c5), dec_(p.c6),
      num_(p.c7), num_(p.c8), num_(p.c9), num_(p.c10),
      dec_(p.c11), '', dec_(p.c13), dec_(p.c14)
    ]]);
    sheet.getRange(at, 8).setNumberFormat('#,##0.00\\ "€"');
    sheet.getRange(at, 9).setNumberFormat('0.00" %"');
    sheet.getRange(at, 10).setNumberFormat('#,##0.00\\ "€"');
    sheet.getRange(at, 11).setNumberFormat('#,##0.00\\ "€"');
    SpreadsheetApp.flush();

    // 4. Marquer la file
    markQueue_(ss, p.messageId, 'TRAITÉ');

    return json_({ status: 'ok', row: at, c0: c0, fournisseur: dec_(p.c2) });
  } catch (err) {
    out.status = 'error'; out.msg = err.toString();
    return json_(out);
  }
}

// Ligne d'insertion = juste après la dernière clé renseignée en colonne A.
function nextRow_(sheet) {
  var last = sheet.getLastRow();
  if (last <= HEADER_ROW) return HEADER_ROW + 1;
  var col = sheet.getRange(HEADER_ROW + 1, 1, last - HEADER_ROW, 1).getValues();
  for (var i = col.length - 1; i >= 0; i--) {
    if (col[i][0] !== '' && col[i][0] !== null) return HEADER_ROW + 1 + i + 1;
  }
  return HEADER_ROW + 1;
}

// Met à jour le Statut de la ligne INBOX_FACTURES correspondant au messageId.
function markQueue_(ss, messageId, statut) {
  if (!messageId) return;
  var q = ss.getSheetByName(QUEUE_TAB);
  if (!q) return;
  var last = q.getLastRow();
  if (last < 2) return;
  var ids = q.getRange(2, 2, last - 1, 1).getValues();   // col B = messageId
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '') === String(messageId)) {
      q.getRange(2 + i, 10).setValue(statut);             // col J = Statut
      return;
    }
  }
}

// Catégories — mêmes valeurs que le Sheet (Claude renvoie sans accents).
function normCat_(c) {
  var map = {
    'Matieres premieres': 'Matières premières', 'Loyer et Charges': 'Loyer & Charges',
    'Loyer & Charges': 'Loyer & Charges', 'Equipements': 'Equipements', 'Entretien': 'Entretien',
    'IT et Logiciels': 'IT et Logiciels', 'Livraison': 'Livraison', 'Boissons': 'Boissons',
    'Emballages': 'Emballages', 'Marketing': 'Marketing', 'Honoraires': 'Honoraires',
    'Transport': 'Transport', 'Salaires': 'Salaires', 'Divers': 'Divers'
  };
  return map[c] || c;
}

function dec_(v) { try { return decodeURIComponent(v || ''); } catch (e) { return v || ''; } }
function num_(v) { return (v !== undefined && v !== '') ? Number(v) : ''; }
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
