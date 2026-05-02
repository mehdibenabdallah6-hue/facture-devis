import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeft, Send, Mail, MessageSquare, Bug, Lightbulb, HelpCircle } from 'lucide-react';

const SUBJECT_OPTIONS = [
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'question', label: 'Question', icon: HelpCircle },
  { value: 'feature', label: 'Demande de fonctionnalité', icon: Lightbulb },
  { value: 'other', label: 'Autre', icon: MessageSquare },
];

export default function Contact() {
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !subject || !message.trim()) {
      error('Champ manquant', 'Veuillez remplir tous les champs.');
      return;
    }

    setSending(true);

    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'contact',
          name,
          email,
          subject: SUBJECT_OPTIONS.find((o) => o.value === subject)?.label || 'Contact',
          message,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to send email');
      }

      success('Message envoyé', 'Nous vous répondrons dans les plus brefs délais.');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch {
      error(
        'Échec de l\'envoi',
        'Une erreur est survenue. Contactez-nous directement à contact@photofacto.fr',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body">
      <nav className="flex items-center gap-4 p-5 md:px-12 max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-surface-container-high transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-on-surface" />
        </button>
        <h1 className="font-headline font-extrabold text-xl text-on-surface">Contact</h1>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pb-20">
        <section className="bg-surface-container-lowest rounded-2xl p-8 md:p-12 shadow-sm border border-outline-variant/10 space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-headline font-bold text-2xl text-on-surface">
              Contactez-nous
            </h2>
            <p className="text-on-surface-variant leading-relaxed max-w-md mx-auto">
              Une question, un bug ou une idée d'amélioration ? Écrivez-nous et nous vous répondrons rapidement.
            </p>
            <a
              href="mailto:contact@photofacto.fr"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Mail className="w-4 h-4" />
              contact@photofacto.fr
            </a>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label
                htmlFor="contact-name"
                className="block text-sm font-semibold text-on-surface mb-2"
              >
                Nom
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/20 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="contact-email"
                className="block text-sm font-semibold text-on-surface mb-2"
              >
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/20 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
              />
            </div>

            {/* Subject */}
            <div>
              <label
                htmlFor="contact-subject"
                className="block text-sm font-semibold text-on-surface mb-2"
              >
                Sujet
              </label>
              <select
                id="contact-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/20 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all appearance-none"
              >
                <option value="" disabled>
                  Sélectionnez un sujet
                </option>
                {SUBJECT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="contact-message"
                className="block text-sm font-semibold text-on-surface mb-2"
              >
                Message
              </label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Décrivez votre demande..."
                rows={5}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/20 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all resize-none"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={sending}
              className="btn-glow w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-on-surface bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {sending ? (
                <>
                  <svg
                    className="animate-spin w-5 h-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Envoi en cours…
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Envoyer le message
                </>
              )}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
