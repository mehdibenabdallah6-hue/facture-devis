import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import SignatureCanvas from '../components/SignatureCanvas';
import PhotofactoWordmark from '../components/PhotofactoWordmark';
import { CheckCircle2, FileText, AlertCircle, ShieldCheck, Building2, PenLine, UserRound } from 'lucide-react';

type SharedQuote = {
  // Original invoice data
  number: string;
  clientName: string;
  clientEmail: string;
  date: string;
  dueDate: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
  }>;
  totalHT: number;
  totalTTC: number;
  totalVAT: number;
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  companySiret: string;
  notes: string;
  vatRegime: string;
  // Signature fields
  signature?: string;
  signedAt?: string;
  signedByName?: string;
  status: string;
  // Link back
  originalInvoiceId: string;
  ownerId: string;
};

export default function PublicSignature() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [quote, setQuote] = useState<SharedQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signed, setSigned] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    document.title = "Signer le devis — Photofacto";
  }, []);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!quoteId || !token) {
        setError('Ce lien de signature est incomplet.');
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/quote-public?shareId=${encodeURIComponent(quoteId)}&token=${encodeURIComponent(token)}`);
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          setError(payload?.error || 'Ce lien de signature est invalide ou a expiré.');
          return;
        }
        const data = payload.quote as SharedQuote;
        setQuote(data);
        if (data.signature || data.status === 'accepted') {
          setSigned(true);
        }
      } catch (err) {
        console.error(err);
        setError('Impossible de charger le devis. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
  }, [quoteId, token]);

  const handleSign = async (signatureDataUrl: string) => {
    if (!quoteId || !token || !quote || !signerName.trim()) return;
    setSigning(true);

    try {
      const response = await fetch('/api/quote-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          token,
          signerName: signerName.trim(),
          signatureDataUrl,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Signature API failed');
      }

      setQuote(prev => prev ? {
        ...prev,
        signature: signatureDataUrl,
        signedAt: data?.signedAt || new Date().toISOString(),
        signedByName: signerName.trim(),
        status: 'accepted',
      } : prev);

      setSigned(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement de la signature. Veuillez réessayer.");
    } finally {
      setSigning(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(232,98,26,0.12),transparent_32%),linear-gradient(135deg,#fffaf5_0%,#f7f2ec_48%,#eef7f4_100%)] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shadow-sm">
            <PenLine className="w-8 h-8 text-primary" />
          </div>
          <p className="text-on-surface-variant font-medium">Chargement du devis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#fffaf5_0%,#f7f2ec_55%,#eef7f4_100%)] flex items-center justify-center px-6">
        <div className="bg-surface-container-lowest rounded-3xl p-8 md:p-10 text-center max-w-md shadow-xl border border-outline-variant/10">
          <div className="w-16 h-16 bg-error-container rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-error" />
          </div>
          <h1 className="font-headline font-extrabold text-2xl text-on-surface mb-3">Lien invalide</h1>
          <p className="text-on-surface-variant">{error}</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#fffaf5_0%,#f7f2ec_55%,#eef7f4_100%)] flex items-center justify-center px-6">
        <div className="bg-surface-container-lowest rounded-3xl p-8 md:p-10 text-center max-w-md shadow-xl border border-outline-variant/10 animate-scale-in">
          <div className="w-20 h-20 bg-tertiary-container rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-tertiary" />
          </div>
          <h1 className="font-headline font-extrabold text-3xl text-on-surface mb-3">Devis signé !</h1>
          <p className="text-on-surface-variant text-lg mb-2">
            L'entreprise <strong>{quote?.companyName}</strong> a été notifiée.
          </p>
          <p className="text-on-surface-variant text-sm">
            Devis n°{quote?.number} — {formatCurrency(quote?.totalTTC || 0)}
          </p>
          {quote?.signature && (
            <div className="mt-6 pt-6 border-t border-outline-variant/10">
              <p className="text-xs text-on-surface-variant mb-2">Votre signature</p>
              <img src={quote.signature} alt="Signature" className="mx-auto max-h-20 opacity-70" />
              <p className="text-xs text-on-surface-variant mt-2">
                Signé par {quote.signedByName} le {new Date(quote.signedAt!).toLocaleDateString('fr-FR')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(232,98,26,0.14),transparent_34%),linear-gradient(135deg,#fffaf5_0%,#f7f2ec_48%,#eef7f4_100%)] font-body">
      {/* Header */}
      <nav className="sticky top-0 z-10 flex items-center justify-center gap-2.5 border-b border-white/60 bg-white/80 p-4 backdrop-blur-xl">
        <img src="/icons/icon-192.png" alt="Photofacto" className="h-10 w-10 rounded-xl object-contain shadow-sm" />
        <PhotofactoWordmark className="text-xl" />
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-5 md:space-y-6">
        {/* Title */}
        <div className="text-center animate-fade-in-up">
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/70 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            Signature sécurisée
          </div>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl text-on-surface mb-2 tracking-tight">
            Devis à signer
          </h1>
          <p className="text-sm md:text-base text-on-surface-variant">
            De <strong>{quote?.companyName}</strong> pour <strong>{quote?.clientName}</strong>
          </p>
        </div>

        {/* Quote Details */}
        <section className="bg-white/90 rounded-[2rem] p-5 md:p-8 shadow-xl shadow-black/5 border border-white/70 space-y-6 backdrop-blur-sm animate-fade-in-up animation-delay-100">
          {/* Header info */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pb-4 border-b border-outline-variant/10">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Devis N°</p>
              <p className="font-headline font-extrabold text-xl text-on-surface">{quote?.number}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Date</p>
              <p className="font-bold text-on-surface">
                {quote?.date ? new Date(quote.date).toLocaleDateString('fr-FR') : ''}
              </p>
            </div>
          </div>

          {/* Company info */}
          <div className="grid sm:grid-cols-2 gap-6 pb-4 border-b border-outline-variant/10">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Émetteur</p>
              <p className="font-bold text-on-surface inline-flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                {quote?.companyName}
              </p>
              <p className="text-sm text-on-surface-variant">{quote?.companyAddress}</p>
              {quote?.companySiret && <p className="text-xs text-on-surface-variant mt-1">SIRET: {quote.companySiret}</p>}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Client</p>
              <p className="font-bold text-on-surface">{quote?.clientName}</p>
              {quote?.clientEmail && <p className="text-sm text-on-surface-variant">{quote.clientEmail}</p>}
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">Prestations</p>
            <div className="space-y-2">
              {quote?.items.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 py-3 px-4 rounded-2xl bg-surface-container-low/60 border border-outline-variant/5">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-on-surface break-words">{item.description}</p>
                    <p className="text-xs text-on-surface-variant">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                      {quote.vatRegime === 'standard' && ` (TVA ${item.vatRate}%)`}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold text-primary">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="pt-4 border-t border-outline-variant/10 flex flex-col items-end space-y-2">
            <div className="flex justify-between w-full sm:w-64 text-sm">
              <span className="text-on-surface-variant">Total HT</span>
              <span className="font-bold text-on-surface">{formatCurrency(quote?.totalHT || 0)}</span>
            </div>
            {quote?.vatRegime === 'standard' && (
              <div className="flex justify-between w-full sm:w-64 text-sm">
                <span className="text-on-surface-variant">TVA</span>
                <span className="font-bold text-on-surface">{formatCurrency(quote?.totalVAT || 0)}</span>
              </div>
            )}
            <div className="flex justify-between w-full sm:w-72 text-xl md:text-2xl font-headline font-extrabold text-primary bg-primary/5 p-4 rounded-2xl border border-primary/10">
              <span>TOTAL TTC</span>
              <span>{formatCurrency(quote?.totalTTC || 0)}</span>
            </div>
          </div>

          {/* Notes */}
          {quote?.notes && (
            <div className="pt-4 border-t border-outline-variant/10">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Notes</p>
              <p className="text-sm text-on-surface-variant whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </section>

        {/* Signature Section */}
        <section className="bg-white/95 rounded-[2rem] p-5 md:p-8 shadow-xl shadow-primary/5 border-2 border-primary/20 space-y-5 backdrop-blur-sm animate-fade-in-up animation-delay-200">
          <div className="rounded-3xl bg-primary text-on-primary p-4 md:p-5 shadow-spark-cta">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <PenLine className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">Dernière étape</p>
                <h2 className="font-headline text-2xl font-extrabold leading-tight">Entrez votre nom pour signer le devis</h2>
                <p className="mt-1 text-sm font-medium text-white/80">
                  Le cadre de signature apparaît juste après votre nom.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary text-on-primary rounded-2xl flex items-center justify-center shadow-spark-cta">
              <FileText className="w-5 h-5 text-on-primary" />
            </div>
            <div>
              <h2 className="font-headline font-extrabold text-xl text-on-surface">Accepter et signer</h2>
              <p className="text-xs text-on-surface-variant">En signant, vous acceptez les termes de ce devis</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-primary uppercase tracking-widest mb-2 block">1. Votre nom complet</label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Ex : Jean Dupont"
                autoComplete="name"
                className="w-full bg-primary/5 border-2 border-primary/25 rounded-2xl pl-12 pr-4 py-4 text-base focus:ring-4 focus:ring-primary/15 focus:border-primary font-bold text-on-surface placeholder:text-on-surface-variant/60 transition-all"
              />
            </div>
          </div>

          {signerName.trim() ? (
            <div className="animate-fade-in">
              <label className="text-xs font-bold text-primary uppercase tracking-widest mb-2 block">2. Votre signature</label>
              <SignatureCanvas
                onSave={handleSign}
                width={Math.min(500, window.innerWidth - 80)}
                height={180}
              />
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4 text-sm text-on-surface">
              <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p>
                <strong>Commencez par écrire votre nom complet.</strong>
                <br />
                La zone de signature apparaîtra ensuite automatiquement.
              </p>
            </div>
          )}

          {signing && (
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-on-surface-variant">Enregistrement de la signature...</span>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center py-6">
          <p className="text-xs text-on-surface-variant/50">
            Propulsé par <strong>Photofacto</strong> — Facturation IA pour artisans
          </p>
        </footer>
      </main>
    </div>
  );
}
