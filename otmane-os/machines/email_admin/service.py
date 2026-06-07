#!/usr/bin/env python3
"""Machine 1 — Email & Admin.

Refactor sécurisé de l'agent GMX d'origine : tri de la boîte par priorité et
exposition d'une API HTTP. Les identifiants viennent de l'environnement (.env),
plus aucun secret en dur.
"""
import os
import email
import imaplib
from datetime import datetime, timedelta

from flask import Flask, jsonify, request

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:  # dotenv est optionnel en production (vraies env vars)
    pass

app = Flask(__name__)


def gmx_config():
    """Charge la config GMX depuis l'environnement. Lève une erreur si incomplète."""
    cfg = {
        "email": os.environ.get("GMX_EMAIL"),
        "password": os.environ.get("GMX_PASSWORD"),
        "imap_host": os.environ.get("GMX_IMAP_HOST", "mail.gmx.com"),
        "imap_port": int(os.environ.get("GMX_IMAP_PORT", 993)),
    }
    if not cfg["email"] or not cfg["password"]:
        raise RuntimeError(
            "GMX_EMAIL / GMX_PASSWORD manquants. Copie .env.example en .env et remplis-les."
        )
    return cfg


# Mots-clés de classification (fr). Modifiables sans toucher au code de tri.
PRIORITY_RULES = {
    "urgent": ["urgent", "facture", "impot", "taxe", "assurance", "echeance", "relance"],
    "important": ["reservation", "commande", "client", "banque", "licence", "devis", "contrat"],
    "spam": ["gagnez", "gratuit", "offre", "promo", "!!!", "casino", "loterie"],
}


class GMXProxy:
    def connect_imap(self):
        cfg = gmx_config()
        try:
            mail = imaplib.IMAP4_SSL(cfg["imap_host"], cfg["imap_port"])
            mail.login(cfg["email"], cfg["password"])
            return mail
        except Exception as e:
            raise Exception(f"Connexion GMX échouée: {e}")

    def classify_priority(self, subject: str) -> str:
        subject = (subject or "").lower()
        for level in ("urgent", "important", "spam"):
            if any(kw in subject for kw in PRIORITY_RULES[level]):
                return level
        return "normal"

    def scan_inbox(self, days_back: int = 7, limit: int = 20):
        try:
            mail = self.connect_imap()
            mail.select("INBOX")

            date_limit = (datetime.now() - timedelta(days=days_back)).strftime("%d-%b-%Y")
            status, messages = mail.search(None, f"SINCE {date_limit}")
            if status != "OK":
                return {"error": "Erreur recherche emails"}

            email_ids = messages[0].split()
            emails_data = []
            for email_id in email_ids[-limit:]:
                status, msg_data = mail.fetch(email_id, "(RFC822)")
                if status != "OK":
                    continue
                msg = email.message_from_bytes(msg_data[0][1])
                subject = msg.get("Subject", "Sans sujet")
                emails_data.append({
                    "id": email_id.decode(),
                    "subject": subject,
                    "sender": msg.get("From", "Inconnu"),
                    "date": msg.get("Date", ""),
                    "priority": self.classify_priority(subject),
                })

            mail.logout()
            return {
                "status": "success",
                "total_emails": len(emails_data),
                "by_priority": _counts(emails_data),
                "emails": emails_data,
                "scan_time": datetime.now().isoformat(),
            }
        except Exception as e:
            return {"error": str(e)}


def _counts(emails):
    out = {"urgent": 0, "important": 0, "normal": 0, "spam": 0}
    for e in emails:
        out[e["priority"]] = out.get(e["priority"], 0) + 1
    return out


proxy = GMXProxy()


@app.route("/health")
def health_check():
    return jsonify({
        "status": "running",
        "service": "OTMANE OS — Email & Admin",
        "timestamp": datetime.now().isoformat(),
    })


@app.route("/scan", methods=["GET"])
def scan_emails():
    days_back = request.args.get("days", 7, type=int)
    limit = request.args.get("limit", 20, type=int)
    return jsonify(proxy.scan_inbox(days_back, limit))


@app.route("/test-connection", methods=["GET"])
def test_connection():
    try:
        mail = proxy.connect_imap()
        status, count = mail.select("INBOX")
        mail.logout()
        return jsonify({
            "status": "success",
            "message": f"Connexion réussie - {count[0].decode()} messages",
            "timestamp": datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e),
                        "timestamp": datetime.now().isoformat()})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
