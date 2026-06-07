// ════════════════════════════════════════════════════════════════════════════
// MAKI ONE — Contrôle de conformité DÉPENSES (P2)
// ────────────────────────────────────────────────────────────────────────────
// Remplit la colonne « Conformité » (N) de l'onglet DÉPENSES :
//   • Conforme / Conforme (paie) / « À vérifier — <raisons> »
// Règles : HT+TVA=TTC (tol. 0,02), TVA mixte tolérée, catégorie du référentiel,
// taux TVA plausible, montants présents. Les bulletins de paie (sans TVA) à part.
//
//   runConformite()      → écrit la colonne N
//   conformiteReport()   → simulation (log seulement, n'écrit pas)
// ════════════════════════════════════════════════════════════════════════════

var CONF_SS_ID      = '1vzCam67Bf4p5NsFX2XDom3GOD2LB8ziDaHlvqcrCph0';
var CONF_SHEET      = 'DÉPENSES';
var CONF_HEADER_ROW = 5;

var CONF_VALID_CATS = ['Matières premières', 'Boissons', 'Emballages', 'Loyer & Charges',
  'Equipements', 'Entretien', 'Marketing', 'Honoraires', 'Transport', 'IT et Logiciels',
  'Livraison', 'Salaires', 'Divers', 'Commissions', 'Commissions paiement'];
var CONF_STD_RATES = [0, 2.1, 5.5, 10, 20];

function runConformite()    { return conformite_(true); }
function conformiteReport()  { return conformite_(false); }

function conformite_(write) {
  var sh = SpreadsheetApp.openById(CONF_SS_ID).getSheetByName(CONF_SHEET);
  var last = sh.getLastRow();
  if (last <= CONF_HEADER_ROW) return { conforme: 0, averif: 0 };

  var data = sh.getRange(CONF_HEADER_ROW + 1, 1, last - CONF_HEADER_ROW, 15).getValues();
  var out = [], stats = { conforme: 0, averif: 0, vides: 0 };

  data.forEach(function (r) {
    var key = String(r[0] || '').trim();
    var four = String(r[2] || '').trim();
    var cat = String(r[4] || '').trim();
    if (!key && !four) { out.push([r[13]]); stats.vides++; return; }   // ligne vide → inchangée

    var ht = cn_(r[7]), rate = cn_(r[8]), tva = cn_(r[9]), ttc = cn_(r[10]);
    var payroll = (cat === 'Salaires') || /^bulletin\s*paie/i.test(four);
    var reasons = [];

    if (!four) reasons.push('fournisseur manquant');
    if (!payroll) {
      if (ht !== null && tva !== null && ttc !== null && Math.abs(ht + tva - ttc) > 0.02)
        reasons.push('HT+TVA≠TTC');
      if ((ht === null || ht === 0) && ttc !== null && ttc > 0)
        reasons.push('montants HT/TVA manquants');
      if (rate !== null && CONF_STD_RATES.indexOf(rate) === -1)
        reasons.push('taux TVA ' + rate + '%');
    }
    if (cat && CONF_VALID_CATS.indexOf(cat) === -1) reasons.push('catégorie hors liste');

    var verdict = reasons.length ? ('À vérifier — ' + reasons.join('; '))
                                 : (payroll ? 'Conforme (paie)' : 'Conforme');
    if (reasons.length) stats.averif++; else stats.conforme++;
    out.push([verdict]);
  });

  if (write) { sh.getRange(CONF_HEADER_ROW + 1, 14, out.length, 1).setValues(out); SpreadsheetApp.flush(); }
  Logger.log('Conformité : ' + stats.conforme + ' conformes · ' + stats.averif + ' à vérifier · '
    + stats.vides + ' vides' + (write ? ' (colonne N mise à jour)' : ' (simulation)'));
  return stats;
}

// Parse un nombre FR ("1 234,56 €", "5,5", "0,0%") → float ou null.
function cn_(v) {
  var s = String(v == null ? '' : v).replace(/ /g, '').replace(/\s/g, '')
    .replace('€', '').replace('%', '').replace(',', '.').trim();
  if (s === '' || s === '-') return null;
  var x = parseFloat(s);
  return isNaN(x) ? null : x;
}
