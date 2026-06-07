// ════════════════════════════════════════════════════════════════════════════
// MAKI ONE — Ingestion Factures (NATIF, sans Make)   [P6 — Claude Max only]
// ────────────────────────────────────────────────────────────────────────────
// Remplace le scénario Make + le « Webhook Factures v3 ».
// Un déclencheur HORAIRE (time-driven) scanne Gmail, dépose les pièces jointes
// dans le bon dossier mensuel, et empile chaque facture dans une file d'attente
// (onglet INBOX_FACTURES) que Claude vient ensuite enrichir/valider.
//
// Aucune dépendance payante : 100 % Google Apps Script (gratuit).
// ════════════════════════════════════════════════════════════════════════════

var CONFIG = {
  // Recherche Gmail des factures non encore traitées.
  // Adapter à ta réalité (label dédié recommandé, ex: "Factures").
  GMAIL_QUERY: 'has:attachment newer_than:30d (facture OR invoice OR "bon de commande") -label:MAKI-traité',

  // Label posé sur les messages traités (créé automatiquement s'il n'existe pas).
  PROCESSED_LABEL: 'MAKI-traité',

  // Dossier Drive racine où sont rangées les factures (sous-dossiers AAAA-MM auto).
  // (= DOSSIER_FACTURES_RACINE de l'ancien webhook v3)
  ROOT_FOLDER_ID: '1dLqM-kjJDZpfDjRxgsNxzHtzyghMMSX5',

  // Sheet de pilotage des dépenses (file d'attente dans l'onglet INBOX_FACTURES).
  QUEUE_SHEET_ID: '1vzCam67Bf4p5NsFX2XDom3GOD2LB8ziDaHlvqcrCph0',
  QUEUE_TAB: 'INBOX_FACTURES',

  // Extensions acceptées.
  VALID_EXT: ['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls'],

  TZ: 'Europe/Paris', // C5 — l'activité est en France (avant: Africa/Casablanca)

  // Référentiel fournisseurs : motif (dans expéditeur/sujet) → nom canonique.
  // Étendre au fil de l'eau (Claude peut compléter automatiquement).
  SUPPLIERS: [
    { match: ['oceane', 'j\'oceane', 'joceane'], name: "J'OCEANE SAS" },
    { match: ['comptoirs oceaniques', 'comptoir oceanique'], name: 'COMPTOIRS OCEANIQUES' },
    { match: ['pomona', 'ta provence', 'terre azur'], name: 'TA Provence Languedoc (Pomona)' },
    { match: ['eat sushi', 'esf', 'eatsushi'], name: 'SAS ESF - EAT SUSHI' },
    { match: ['bulletin', 'paie', 'fiche de paie'], name: 'BULLETIN PAIE' },
    { match: ['edf', 'engie', 'total energies'], name: 'ÉNERGIE' },
    { match: ['orange', 'sfr', 'free', 'bouygues'], name: 'TÉLÉCOM' }
  ]
};

// ── Entrée principale (à brancher sur le déclencheur horaire) ──────────────────
function ingestFactures() {
  var label = ensureLabel_(CONFIG.PROCESSED_LABEL);
  var threads = GmailApp.search(CONFIG.GMAIL_QUERY, 0, 50);
  var totalFiles = 0, totalThreads = 0;

  threads.forEach(function (thread) {
    var processedSomething = false;
    thread.getMessages().forEach(function (message) {
      var res = processMessage_(message);
      totalFiles += res.filed;
      if (res.filed > 0) processedSomething = true;
    });
    if (processedSomething) {
      thread.addLabel(label); // évite de retraiter au prochain run
      totalThreads++;
    }
  });

  Logger.log('✅ Ingestion : ' + totalFiles + ' fichier(s) sur ' + totalThreads + ' thread(s).');
  return { threads: totalThreads, files: totalFiles };
}

// ── Traite un message : dépose chaque PJ valide + empile dans la file ─────────
function processMessage_(message) {
  var attachments = message.getAttachments();
  if (!attachments.length) return { filed: 0 };

  var msgDate = message.getDate();
  var fournisseur = guessFournisseur_(message);
  var numFacture = guessNumFacture_(message);
  var folder = monthFolder_(msgDate);          // C3/P8 — dossier mensuel dynamique
  var filed = 0;

  for (var i = 0; i < attachments.length; i++) {
    var att = attachments[i];
    var ext = (att.getName().split('.').pop() || '').toLowerCase();
    if (CONFIG.VALID_EXT.indexOf(ext) === -1) continue;

    var dateFr = Utilities.formatDate(msgDate, CONFIG.TZ, 'dd-MM-yyyy');
    var nom = fournisseur + ' - ' + dateFr + ' - Facture n° ' + numFacture + '.' + ext;

    // Dédoublonnage par nom dans le dossier cible.
    if (folder.getFilesByName(nom).hasNext()) continue;

    var file = folder.createFile(att.copyBlob()).setName(nom);
    appendToQueue_({
      messageId: message.getId(),
      from: message.getFrom(),
      subject: message.getSubject(),
      fournisseur: fournisseur,
      dateEmail: dateFr,
      fichier: nom,
      url: file.getUrl()
    });
    filed++;
    Logger.log('✅ ' + nom + ' → ' + folder.getName());
  }
  return { filed: filed };
}

// ── Devine le fournisseur depuis expéditeur + sujet via le référentiel ────────
function guessFournisseur_(message) {
  var hay = ((message.getFrom() || '') + ' ' + (message.getSubject() || '')).toLowerCase();
  for (var i = 0; i < CONFIG.SUPPLIERS.length; i++) {
    var s = CONFIG.SUPPLIERS[i];
    for (var j = 0; j < s.match.length; j++) {
      if (hay.indexOf(s.match[j]) !== -1) return s.name;
    }
  }
  return 'À-IDENTIFIER'; // Claude complétera depuis le contenu du PDF
}

// ── Tente d'extraire un n° de facture du sujet/PJ (best effort) ───────────────
function guessNumFacture_(message) {
  var subject = message.getSubject() || '';
  var m = subject.match(/(?:facture|invoice|n°|no|num|fac)[\s:°#-]*([A-Z0-9][A-Z0-9\-\/]{3,})/i);
  return m ? m[1].replace(/[\/]/g, '-') : 'À-COMPLÉTER';
}

// ── Dossier mensuel AAAA-MM sous la racine (créé si absent) — fin du bug mois ──
function monthFolder_(date) {
  var root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  var name = Utilities.formatDate(date, CONFIG.TZ, 'yyyy-MM');
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

// ── File d'attente pour Claude (onglet INBOX_FACTURES) ────────────────────────
function appendToQueue_(row) {
  var ss = SpreadsheetApp.openById(CONFIG.QUEUE_SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.QUEUE_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.QUEUE_TAB);
    sheet.appendRow(['Horodatage', 'messageId', 'Expéditeur', 'Sujet',
      'Fournisseur_devine', 'Date_email', 'Fichier', 'Drive_URL', 'Statut']);
  }
  sheet.appendRow([new Date(), row.messageId, row.from, row.subject,
    row.fournisseur, row.dateEmail, row.fichier, row.url, 'À_TRAITER']);
}

function ensureLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

// ── Helpers d'installation (à lancer UNE fois depuis l'éditeur) ───────────────
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

// ── Test à blanc (ne pose pas le label, log seulement) ────────────────────────
function dryRun() {
  var threads = GmailApp.search(CONFIG.GMAIL_QUERY, 0, 10);
  Logger.log('🔍 ' + threads.length + ' thread(s) correspondant à la requête.');
  threads.forEach(function (t) {
    var m = t.getMessages()[0];
    Logger.log(' • ' + m.getDate() + ' | ' + guessFournisseur_(m) + ' | ' + m.getSubject());
  });
}
