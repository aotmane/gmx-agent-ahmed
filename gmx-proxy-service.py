#!/usr/bin/env python3
from flask import Flask, request, jsonify
import imaplib
import email
import json
from datetime import datetime, timedelta

app = Flask(__name__)

GMX_CONFIG = {
    'email': 'a.otmane@gmx.fr',
    'password': '@Le*2022*',
    'imap_host': 'mail.gmx.com',
    'imap_port': 993
}

class GMXProxy:
    def __init__(self):
        self.config = GMX_CONFIG
        
    def connect_imap(self):
        try:
            mail = imaplib.IMAP4_SSL(self.config['imap_host'], self.config['imap_port'])
            mail.login(self.config['email'], self.config['password'])
            return mail
        except Exception as e:
            raise Exception(f"Connexion GMX échouée: {e}")
    
    def scan_inbox(self, days_back=7):
        try:
            mail = self.connect_imap()
            mail.select('INBOX')
            
            date_limit = (datetime.now() - timedelta(days=days_back)).strftime('%d-%b-%Y')
            status, messages = mail.search(None, f'SINCE {date_limit}')
            
            if status != 'OK':
                return {'error': 'Erreur recherche emails'}
            
            email_ids = messages[0].split()
            emails_data = []
            
            for email_id in email_ids[-20:]:
                status, msg_data = mail.fetch(email_id, '(RFC822)')
                if status == 'OK':
                    email_message = email.message_from_bytes(msg_data[0][1])
                    email_info = {
                        'id': email_id.decode(),
                        'subject': email_message.get('Subject', 'Sans sujet'),
                        'sender': email_message.get('From', 'Inconnu'),
                        'date': email_message.get('Date', ''),
                        'priority': self.classify_priority(email_message)
                    }
                    emails_data.append(email_info)
            
            mail.logout()
            return {
                'status': 'success',
                'total_emails': len(emails_data),
                'emails': emails_data,
                'scan_time': datetime.now().isoformat()
            }
        except Exception as e:
            return {'error': str(e)}
    
    def classify_priority(self, email_message):
        subject = email_message.get('Subject', '').lower()
        urgent_keywords = ['urgent', 'facture', 'impot', 'taxe', 'assurance', 'echeance']
        important_keywords = ['reservation', 'commande', 'client', 'banque', 'licence']
        spam_keywords = ['gagnez', 'gratuit', 'offre', 'promo', '!!!']
        
        if any(keyword in subject for keyword in urgent_keywords):
            return 'urgent'
        elif any(keyword in subject for keyword in important_keywords):
            return 'important'
        elif any(keyword in subject for keyword in spam_keywords):
            return 'spam'
        return 'normal'

proxy = GMXProxy()

@app.route('/health')
def health_check():
    return jsonify({
        'status': 'running',
        'service': 'GMX Proxy Agent',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/scan', methods=['GET'])
def scan_emails():
    days_back = request.args.get('days', 7, type=int)
    result = proxy.scan_inbox(days_back)
    return jsonify(result)

@app.route('/test-connection', methods=['GET'])
def test_connection():
    try:
        mail = proxy.connect_imap()
        mail.select('INBOX')
        status, count = mail.select('INBOX')
        mail.logout()
        
        return jsonify({
            'status': 'success',
            'message': f'Connexion réussie - {count[0].decode()} messages',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
