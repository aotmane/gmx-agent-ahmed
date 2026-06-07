// ════════════════════════════════════════════════════════════════════════════
// MAKI ONE — Ingestion Factures (NATIF, sans Make)   [P6 — Claude Max only]
// ────────────────────────────────────────────────────────────────────────────
// Remplace le scénario Make + le « Webhook Factures v3 ».
// Déclencheur HORAIRE : scanne Gmail et DÉPOSE les PJ dans la boîte de réception
//   /MAKI ONE/<exercice>/FACTURES/        (= zone "à traiter")
// puis empile chaque facture dans l'onglet INBOX_FACTURES (file pour Claude).
//
// Le classement final dans  …/FACTURES/TRAITEES/<AAAA-MM - mois AAAA>/  se fait
// à l'étape Claude, d'après la DATE DE FACTURE (pas la date d'email).
// 100 % Google Apps Script (gratuit), aucune dépendance payante.
// ════════════════════════════════════════════════════════════════════════════

var CONFIG = {
  // ── Rangement Drive (Mon Drive / MAKI ONE) ──────────────────────────────────
  MAKI_ONE_FOLDER_ID: '1QuKDG5_kjR7eMxhXGBclgy6fPJWQj8gq', // /MAKI ONE/
  EXERCICE_START_MONTH: 7,   // exercice décalé : commence en JUILLET (2025-2026 = juil.25→juin.26)
  FACTURES_SUBFOLDER: 'FACTURES', // boîte "à traiter" sous l'exercice

  // ── Gmail ───────────────────────────────────────────────────────────────────
  PROCESSED_LABEL: 'MAKI-traite', // label sur les messages traités (sans accent = recherche fiable)
  LOOKBACK_DAYS: 30,
  MAX_THREADS: 50,

  // ── File d'attente (Sheet « SUIVI DES DÉPENSES ») ───────────────────────────
  QUEUE_SHEET_ID: '1vzCam67Bf4p5NsFX2XDom3GOD2LB8ziDaHlvqcrCph0',
  QUEUE_TAB: 'INBOX_FACTURES',

  VALID_EXT: ['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls'],
  TZ: 'Europe/Paris', // C5 — activité en France (avant: Africa/Casablanca)

  SUPPLIERS: [
    { match: ['oceane', "j'oceane", 'joceane'],              name: "J'OCEANE SAS" },
    { match: ['comptoirs oceaniques', 'comptoir oceanique'], name: 'COMPTOIRS OCEANIQUES' },
    { match: ['pomona', 'ta provence', 'terre azur', 'terreazur'], name: 'TA Provence Languedoc (Pomona)', from: 'pomona.fr' },
    { match: ['eat sushi', 'esf', 'eatsushi'],               name: 'SAS ESF - EAT SUSHI', from: 'eatsushi.fr' },
    { match: ['groupon'],                                    name: 'Groupon France', from: 'groupon.com' },
    { match: ['snapshift', 'combo'],                         name: 'Combo (Snapshift SAS)' },
    { match: ['bouygues', 'keyyo'],                          name: 'Bouygues Telecom Pro' },
    { match: ['bulletin', 'paie', 'fiche de paie'],          name: 'BULLETIN PAIE' }
  ]
};

// ── Requête Gmail optimisée ───────────────────────────────────────────────────
function buildQuery_() {
  var ext = 'filename:(' + CONFIG.VALID_EXT.join(' OR ') + ')';
  var kw  = '(facture OR factures OR invoice OR avoir OR "bon de commande" OR '
          + '"bon de livraison" OR bulletin OR paie OR commission)';
  var froms = CONFIG.SUPPLIERS.filter(function (s) { return s.from; }).map(function (s) { return s.from; });
  var senderClause = froms.length ? ' OR from:(' + froms.join(' OR ') + ')' : '';
  return 'has:attachment ' + ext + ' newer_than:' + CONFIG.LOOKBACK_DAYS + 'd'
       + ' -label:' + CONFIG.PROCESSED_LABEL + ' (' + kw + senderClause + ')';
}

// ── Entrée principale (déclencheur horaire) ───────────────────────────────────
function ingestFactures() {
  var label = ensureLabel_(CONFIG.PROCESSED_LABEL);
  var threads = GmailApp.search(buildQuery_(), 0, CONFIG.MAX_THREADS);
  var totalFiles = 0, totalThreads = 0;

  threads.forEach(function (thread) {
    var processed = false;
    thread.getMessages().forEach(function (message) {
      var res = processMessage_(message);
      totalFiles += res.filed;
      if (res.filed > 0) processed = true;
    });
    if (processed) { thread.addLabel(label); totalThreads++; }
  });

  Logger.log('✅ Ingestion : ' + totalFiles + ' fichier(s) déposé(s) dans FACTURES sur ' + totalThreads + ' thread(s).');
  return { threads: totalThreads, files: totalFiles };
}

// ── Dépose les PJ valides dans la boîte FACTURES + empile dans la file ────────
function processMessage_(message) {
  var attachments = message.getAttachments();
  if (!attachments.length) return { filed: 0 };

  var msgDate = message.getDate();
  var fournisseur = guessFournisseur_(message);
  var numFacture = guessNumFacture_(message);
  var inbox = facturesInbox_(msgDate);   // /MAKI ONE/<exercice>/FACTURES  (zone à traiter)
  var filed = 0;

  for (var i = 0; i < attachments.length; i++) {
    var att = attachments[i];
    var ext = (att.getName().split('.').pop() || '').toLowerCase();
    if (CONFIG.VALID_EXT.indexOf(ext) === -1) continue;

    var dateFr = Utilities.formatDate(msgDate, CONFIG.TZ, 'dd-MM-yyyy');
    var nom = fournisseur + ' - ' + dateFr + ' - Facture n° ' + numFacture + '.' + ext;

    if (inbox.getFilesByName(nom).hasNext()) continue; // dédoublonnage dans la boîte

    var file = inbox.createFile(att.copyBlob()).setName(nom);
    appendToQueue_({
      messageId: message.getId(), from: message.getFrom(), subject: message.getSubject(),
      fournisseur: fournisseur, dateEmail: dateFr, exercice: exerciceLabel_(msgDate),
      fichier: nom, fileId: file.getId(), url: file.getUrl()
    });
    filed++;
    Logger.log('✅ ' + nom + ' → FACTURES (' + exerciceLabel_(msgDate) + ')');
  }
  return { filed: filed };
}

// ════════════════════════════════════════════════════════════════════════════
//  RANGEMENT — /MAKI ONE/<exercice>/FACTURES   (exercice décalé juillet→juin)
// ════════════════════════════════════════════════════════════════════════════

function facturesInbox_(date) {
  var maki = DriveApp.getFolderById(CONFIG.MAKI_ONE_FOLDER_ID);
  var exo  = ensureChild_(maki, exerciceLabel_(date));     // "2025 - 2026"
  return ensureChild_(exo, CONFIG.FACTURES_SUBFOLDER);     // "FACTURES"
}

// "2025 - 2026" pour un mois entre juillet 2025 et juin 2026 (format des dossiers existants).
function exerciceLabel_(date) {
  var y = date.getFullYear(), m = date.getMonth() + 1;
  var start = (m >= CONFIG.EXERCICE_START_MONTH) ? y : y - 1;
  return start + ' - ' + (start + 1);
}

function ensureChild_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ── Extraction best effort (le reste = Claude depuis le contenu du PDF) ────────
function guessFournisseur_(message) {
  var hay = ((message.getFrom() || '') + ' ' + (message.getSubject() || '')).toLowerCase();
  for (var i = 0; i < CONFIG.SUPPLIERS.length; i++) {
    var s = CONFIG.SUPPLIERS[i];
    for (var j = 0; j < s.match.length; j++) if (hay.indexOf(s.match[j]) !== -1) return s.name;
  }
  return 'À-IDENTIFIER';
}
function guessNumFacture_(message) {
  var m = (message.getSubject() || '').match(/(?:facture|invoice|n°|no|num|fac)[\s:°#-]*([A-Z0-9][A-Z0-9\-\/]{3,})/i);
  return m ? m[1].replace(/\//g, '-') : 'À-COMPLÉTER';
}

// ── File d'attente pour Claude ────────────────────────────────────────────────
function appendToQueue_(row) {
  var ss = SpreadsheetApp.openById(CONFIG.QUEUE_SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.QUEUE_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.QUEUE_TAB);
    sheet.appendRow(['Horodatage', 'messageId', 'Expéditeur', 'Sujet', 'Fournisseur_devine',
                     'Date_email', 'Exercice', 'Fichier', 'fileId', 'Drive_URL', 'Statut']);
  }
  sheet.appendRow([new Date(), row.messageId, row.from, row.subject, row.fournisseur,
                   row.dateEmail, row.exercice, row.fichier, row.fileId, row.url, 'À_TRAITER']);
}

function ensureLabel_(name) { return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name); }

// ── Installation / désinstallation du déclencheur ─────────────────────────────
function installTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('ingestFactures').timeBased().everyHours(1).create();
  Logger.log('⏰ Déclencheur horaire installé.');
}
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'ingestFactures') ScriptApp.deleteTrigger(t);
  });
}

// ── Test à blanc : log la requête + ce qui serait traité, sans rien écrire ────
function dryRun() {
  var q = buildQuery_();
  Logger.log('🔎 Requête : ' + q);
  var threads = GmailApp.search(q, 0, 10);
  Logger.log('🔍 ' + threads.length + ' thread(s).');
  threads.forEach(function (t) {
    var m = t.getMessages()[0];
    Logger.log(' • ' + Utilities.formatDate(m.getDate(), CONFIG.TZ, 'dd-MM-yyyy')
             + ' | exercice ' + exerciceLabel_(m.getDate())
             + ' | ' + guessFournisseur_(m) + ' | ' + m.getSubject());
  });
}
