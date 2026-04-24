import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import SignatureCanvas from '../components/SignatureCanvas';
import { Camera, CheckCircle2, FileText, AlertCircle } from 'lucide-react';

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
      if (!quoteId) return;
      try {
        const docSnap = await getDoc(doc(db, 'sharedQuotes', quoteId));
        if (docSnap.exists()) {
          const data = docSnap.data() as SharedQuote;
          setQuote(data);
          if (data.signature) {
            setSigned(true);
          }
        } else {
          setError('Ce lien de signature est invalide ou a expiré.');
        }
      } catch (err) {
        console.error(err);
        setError('Impossible de charger le devis. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
  }, [quoteId]);

  const handleSign = async (signatureDataUrl: string) => {
    if (!quoteId || !quote || !signerName.trim()) return;
    setSigning(true);

    try {
      const now = new Date().toISOString();

      // Update shared quote
      await updateDoc(doc(db, 'sharedQuotes', quoteId), {
        signature: signatureDataUrl,
        signedAt: now,
        signedByName: signerName.trim(),
        status: 'accepted',
      });

      // Update original invoice
      await updateDoc(doc(db, 'invoices', quote.originalInvoiceId), {
        status: 'accepted',
        signature: signatureDataUrl,
        signedAt: now,
        signedByName: signerName.trim(),
        updatedAt: now,
      });

      setSigned(true);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'enregistrement de la signature. Veuillez réessayer.");
    } finally {
      setSigning(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Camera className="w-8 h-8 text-primary" />
          </div>
          <p className="text-on-surface-variant font-medium">Chargement du devis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="bg-surface-container-lowest rounded-3xl p-10 text-center max-w-md shadow-lg border border-outline-variant/10">
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
      <div className="min-h-screen bg-surface flex items-center justify-center px-6">
        <div className="bg-surface-container-lowest rounded-3xl p-10 text-center max-w-md shadow-lg border border-outline-variant/10 animate-scale-in">
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
    <div className="min-h-screen bg-surface font-body">
      {/* Header */}
      <nav className="flex items-center justify-center gap-2.5 p-5 border-b border-outline-variant/10">
        <div className="w-10 h-10 bg-primary text-on-primary rounded-xl flex items-center justify-center shadow-md">
          <Camera className="w-5 h-5" />
        </div>
        <span className="wordmark-photofacto text-xl">
          <span className="wm-photo">PHOTO</span><span className="wm-facto">FACTO</span>
        </span>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="font-headline font-extrabold text-2xl md:text-3xl text-on-surface mb-2">
            Devis à signer
          </h1>
          <p className="text-on-surface-variant">
            De <strong>{quote?.companyName}</strong> pour <strong>{quote?.clientName}</strong>
          </p>
        </div>

        {/* Quote Details */}
        <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-sm border border-outline-variant/10 space-y-6">
          {/* Header info */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pb-4 border-b border-outline-variant/10">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Devis N°</p>
              <p className="font-headline font-extrabold text-xl text-on-surface">{quote?.number}</p>
            </div>
            <div className="text-right">
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
              <p className="font-bold text-on-surface">{quote?.companyName}</p>
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
                <div key={idx} className="flex items-center justify-between py-3 px-4 rounded-xl bg-surface-container-low/50">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-on-surface truncate">{item.description}</p>
                    <p className="text-xs text-on-surface-variant">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                      {quote.vatRegime === 'standard' && ` (TVA ${item.vatRate}%)`}
                    </p>
                  </div>
                  <span className="font-bold text-primary ml-4">
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
            <div className="flex justify-between w-full sm:w-72 text-2xl font-headline font-extrabold text-primary bg-primary/5 p-4 rounded-2xl border border-primary/10">
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
        <section className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-sm border border-primary/20 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-headline font-extrabold text-lg text-on-surface">Accepter et signer</h2>
              <p className="text-xs text-on-surface-variant">En signant, vous acceptez les termes de ce devis</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Votre nom complet</label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Prénom Nom"
              className="w-full bg-white border border-outline-variant/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 font-medium transition-all"
            />
          </div>

          {signerName.trim() ? (
            <div className="animate-fade-in">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Votre signature</label>
              <SignatureCanvas
                onSave={handleSign}
                width={Math.min(500, window.innerWidth - 80)}
                height={180}
              />
            </div>
          ) : (
            <p className="text-center text-sm text-on-surface-variant py-6 bg-surface-container-low/50 rounded-xl">
              Entrez votre nom pour afficher le cadre de signature
            </p>
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
