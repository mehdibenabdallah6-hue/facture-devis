import React, { useState } from 'react';
import { useData, InvoiceLockedError } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, Plus, FileText, Edit, Trash2, Send, Euro, RefreshCw, Filter, Share2, Link, Check, CheckCircle2, FileSpreadsheet, MessageCircle, Archive, Lock, FilePlus2, Mail } from 'lucide-react';
import { Invoice } from '../contexts/DataContext';
import { usePlan } from '../hooks/usePlan';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { EmptyInvoicesState, EmptySearchState } from '../components/EmptyStates';
import { UpsellBanner } from '../components/UpsellBanner';
import { InvoiceStatusBadge, getEffectiveInvoiceStatus, getInvoiceStatusLabel } from '../components/InvoiceStatusBadge';
import { CreditNoteButton } from '../components/CreditNoteButton';
import { getTypedStatusLabel } from '../lib/documentLabels';
import JSZip from 'jszip';
import { track } from '../services/analytics';
// jsPDF + jspdf-autotable are heavy (~960KB combined) and only needed when
// the user clicks "Export ZIP". We import them on demand inside the
// handler so they're code-split out of the initial bundle.
import type { default as JsPDFType } from 'jspdf';

export default function InvoicesList() {
  const { invoices, clients, company, deleteInvoice, updateInvoice, shareQuoteForSignature, logInvoiceEvent } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'invoice' | 'quote'>('invoice');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [isSendingReminder, setIsSendingReminder] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [signatureShareUrls, setSignatureShareUrls] = useState<Record<string, string>>({});
  const [activeSignatureShareId, setActiveSignatureShareId] = useState<string | null>(null);
  const { isPro } = usePlan();

  const exportCSV = () => {
    if (!isPro) {
      showError('Les exports comptables CSV/FEC sont disponibles avec le plan Pro.');
      navigate('/app/upgrade');
      return;
    }
    const headers = ["Numéro", "Type", "Statut", "Client", "TVA Régime", "Date d'émission", "Échéance", "Montant HT", "TVA", "Montant TTC"];
    const rows = filteredInvoices.map(inv => {
      const totalHT = (inv.items || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      let totalVAT = 0;
      if (inv.vatRegime === 'standard') {
         totalVAT = (inv.items || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice * ((item.vatRate || 20) / 100)), 0);
      }
      const totalTTC = totalHT + totalVAT;
      
      const typeStr = inv.type === 'quote' ? 'Devis' : inv.type === 'deposit' ? 'Acompte' : inv.type === 'credit' ? 'Avoir' : 'Facture';
      
      return [
        inv.number,
        typeStr,
        getInvoiceStatusLabel(inv),
        inv.clientName,
        inv.vatRegime || 'standard',
        inv.date,
        inv.dueDate || '',
        totalHT.toFixed(2),
        totalVAT.toFixed(2),
        totalTTC.toFixed(2)
      ].map(val => `"${val}"`).join(",");
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `export_comptable_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const exportFEC = () => {
    if (!isPro) {
      showError('Les exports comptables CSV/FEC sont disponibles avec le plan Pro.');
      navigate('/app/upgrade');
      return;
    }
    const headers = [
      "JournalCode", "JournalLib", "EcritureNum", "EcritureDate", 
      "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib", 
      "PieceRef", "PieceDate", "PieceLib", "Debit", "Credit"
    ];
    
    let rows: string[] = [];
    
    filteredInvoices.forEach((inv, index) => {
      // Only export finalized/sent/paid invoices
      if (inv.status === 'draft') return;
      if (inv.type !== 'invoice' && inv.type !== 'credit') return;

      const totalHT = (inv.items || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      let totalVAT = 0;
      if (inv.vatRegime === 'standard') {
         totalVAT = (inv.items || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice * ((item.vatRate || 20) / 100)), 0);
      }
      const totalTTC = totalHT + totalVAT;
      
      const dateStr = inv.date.replace(/-/g, ''); // Format YYYYMMDD if stored as YYYY-MM-DD
      const ecrNum = `${dateStr.substring(0,6)}${index.toString().padStart(4, '0')}`;
      const isCredit = inv.type === 'credit';
      
      // Line 1: Client
      rows.push([
        "VT", "Ventes", ecrNum, dateStr,
        "411000", "Clients", "C" + inv.clientName.replace(/\W/g, '').substring(0,8).toUpperCase(), inv.clientName,
        inv.number, dateStr, `Facture ${inv.number}`,
        isCredit ? "0" : totalTTC.toFixed(2), isCredit ? totalTTC.toFixed(2) : "0"
      ].map(val => `"${val}"`).join("\t"));

      // Line 2: Sales
      rows.push([
        "VT", "Ventes", ecrNum, dateStr,
        "706000", "Prestations de services", "", "",
        inv.number, dateStr, `Facture ${inv.number}`,
        isCredit ? totalHT.toFixed(2) : "0", isCredit ? "0" : totalHT.toFixed(2)
      ].map(val => `"${val}"`).join("\t"));

      // Line 3: VAT (if any)
      if (totalVAT > 0) {
        rows.push([
          "VT", "Ventes", ecrNum, dateStr,
          "445710", "TVA collectée", "", "",
          inv.number, dateStr, `Facture ${inv.number}`,
          isCredit ? totalVAT.toFixed(2) : "0", isCredit ? "0" : totalVAT.toFixed(2)
        ].map(val => `"${val}"`).join("\t"));
      }
    });

    const fecContent = headers.join("\t") + "\n" + rows.join("\n");
    const blob = new Blob([fecContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `FEC_${format(new Date(), 'yyyyMMdd')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportZIP = async () => {
    if (!isPro) {
      showError('Les exports comptables CSV/FEC sont disponibles avec le plan Pro.');
      navigate('/app/upgrade');
      return;
    }
    const zip = new JSZip();
    const monthFolder = format(new Date(), 'yyyy-MM');
    const invoicesFolder = zip.folder(`${monthFolder}/factures`);
    const fecFolder = zip.folder(`${monthFolder}/comptabilite`);

    // Generate PDFs for all invoices of current month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthInvoices = invoices.filter(inv => {
      const d = new Date(inv.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // Lazy-load the PDF stack only when the export is actually run.
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    for (const inv of monthInvoices) {
      try {
        const doc: JsPDFType = new jsPDF();
        autoTable(doc, {
          head: [[inv.number, inv.clientName, format(new Date(inv.date), 'dd/MM/yyyy'), `${inv.totalTTC.toFixed(2)} EUR`]],
          theme: 'grid',
        });
        const pdfBytes = doc.output('arraybuffer');
        invoicesFolder?.file(`${inv.number}.pdf`, pdfBytes);
      } catch (e) {
        console.error(`Failed to generate PDF for ${inv.number}:`, e);
      }
    }

    // Also generate FEC
    const headers = ["JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate", "PieceLib", "Debit", "Credit"];
    let rows: string[] = [];
    monthInvoices.forEach((inv, index) => {
      if (inv.status === 'draft') return;
      const totalHT = (inv.items || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const totalTTC = inv.totalTTC;
      const dateStr = inv.date.replace(/-/g, '');
      rows.push([
        "VT", "Ventes", `${dateStr}${index.toString().padStart(4, '0')}`, dateStr,
        "411000", "Clients", `C${inv.clientName.replace(/\W/g, '').substring(0,8).toUpperCase()}`, inv.clientName,
        inv.number, dateStr, `Facture ${inv.number}`, totalTTC.toFixed(2), "0"
      ].map(v => `"${v}"`).join("\t"));
    });
    fecFolder?.file(`FEC_${format(new Date(), 'yyyyMMdd')}.txt`, headers.join("\t") + "\n" + rows.join("\n"));

    // Generate ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Photofacto_Export_${monthFolder}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleWhatsAppReminder = (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    const client = clients.find(c => c.id === invoice.clientId);
    const text = encodeURIComponent(`Bonjour ${client?.name || invoice.clientName},\n\nSauf erreur de notre part, le règlement de la facture ${invoice.number} d'un montant de ${formatCurrency(invoice.totalTTC)} ne nous est pas encore parvenu.\n\nVous pouvez la consulter sur votre espace client ou nous contacter pour toute question.\n\nMerci d'avance,\n${company?.name || 'Mon Entreprise'}`);
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const waUrl = isMobile ? `whatsapp://send?text=${text}` : `https://web.whatsapp.com/send?text=${text}`;
    
    window.open(waUrl, '_blank');
  };

  const handleEmailReminder = async (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    track('clicked_send_email', {
      surface: 'invoices_list',
      document_type: invoice.type || 'invoice',
    });
    const client = clients.find(c => c.id === invoice.clientId);
    const email = client?.email || invoice.clientEmail;
    if (!email) {
      showError('Email manquant', "Ajoutez un email au client avant d'envoyer une relance.");
      return;
    }

    setIsSendingReminder(invoice.id);
    try {
      if (!user) {
        showError('Connexion requise', "Reconnectez-vous avant d'envoyer une relance.");
        return;
      }
      const token = await user.getIdToken();
      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'send-invoice',
          invoiceId: invoice.id,
          kind: 'reminder',
          to: email,
          message: `Sauf erreur de notre part, la facture ${invoice.number} d'un montant de ${formatCurrency(invoice.totalTTC)} reste en attente de règlement. Merci de procéder au règlement ou de nous contacter si vous avez déjà effectué le paiement.`,
        }),
      });
      const sendResult = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(sendResult?.error || sendResult?.detail || "Erreur lors de l'envoi de la relance");
      }
      await logInvoiceEvent(invoice.id, 'send', { channel: 'email_reminder', to: email });
      success('Relance envoyée', `Email envoyé à ${email}.`);
      track('email_sent', {
        source: 'email_reminder',
        document_type: invoice.type || 'invoice',
      });
    } catch (err: any) {
      console.error(err);
      track('email_failed', {
        source: 'email_reminder',
        document_type: invoice.type || 'invoice',
        error_type: 'send_email_failed',
      });
      showError('Relance impossible', err?.message || "L'email de relance n'a pas pu être envoyé.");
    } finally {
      setIsSendingReminder(null);
    }
  };

  const getSignatureShareUrl = async (invoice: Invoice) => {
    if (signatureShareUrls[invoice.id]) return signatureShareUrls[invoice.id];

    setIsSharing(invoice.id);
    try {
      const shareUrl = await shareQuoteForSignature(invoice.id);
      setSignatureShareUrls(prev => ({ ...prev, [invoice.id]: shareUrl }));
      return shareUrl;
    } finally {
      setIsSharing(null);
    }
  };

  const buildSignatureShareMessage = (invoice: Invoice, shareUrl: string) => {
    const client = clients.find(c => c.id === invoice.clientId);
    return `Bonjour${client?.name || invoice.clientName ? ` ${client?.name || invoice.clientName}` : ''},\n\nVoici le devis ${invoice.number} à consulter et signer en ligne :\n${shareUrl}\n\nCordialement,\n${company?.name || 'Votre artisan'}`;
  };

  const handleShare = async (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await getSignatureShareUrl(invoice);
      setActiveSignatureShareId(activeSignatureShareId === invoice.id ? null : invoice.id);
    } catch (err) {
      console.error('Error sharing:', err);
      showError("Impossible de préparer le lien de signature.");
    }
  };

  const handleCopySignatureLink = async (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const shareUrl = await getSignatureShareUrl(invoice);
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(invoice.id);
      success('Lien de signature copié');
      setTimeout(() => setCopiedLink(null), 3000);
    } catch (err) {
      console.error('Error copying signature link:', err);
      showError("Impossible de copier le lien de signature.");
    }
  };

  const handleEmailSignatureLink = async (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    track('clicked_send_email', {
      surface: 'invoices_list',
      document_type: 'quote',
      source: 'signature_link',
    });
    const client = clients.find(c => c.id === invoice.clientId);
    const clientEmail = client?.email || invoice.clientEmail || '';

    try {
      const shareUrl = await getSignatureShareUrl(invoice);
      const subject = encodeURIComponent(`Devis ${invoice.number} à signer`);
      const body = encodeURIComponent(buildSignatureShareMessage(invoice, shareUrl));
      window.location.href = `mailto:${clientEmail}?subject=${subject}&body=${body}`;
    } catch (err) {
      console.error('Error opening signature email:', err);
      showError("Impossible d'ouvrir l'email de signature.");
    }
  };

  const handleWhatsAppSignatureLink = async (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const shareUrl = await getSignatureShareUrl(invoice);
      const text = encodeURIComponent(buildSignatureShareMessage(invoice, shareUrl));
      window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Error opening WhatsApp signature link:', err);
      showError("Impossible d'ouvrir WhatsApp.");
    } finally {
      setIsSharing(null);
    }
  };

  const invoicesWithEffectiveStatus = invoices.map(inv => ({
    ...inv,
    status: getEffectiveInvoiceStatus(inv),
  }));

  const filteredInvoices = invoicesWithEffectiveStatus.filter(inv => {
    const matchesSearch = inv.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inv.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesType = typeFilter === 'invoice' ? (inv.type === 'invoice' || inv.type === 'deposit' || inv.type === 'credit') : inv.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: company?.defaultCurrency || 'EUR' }).format(amount);
  };

  const getElapsedDays = (dateValue?: string) => {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000));
  };

  const pluralDays = (days: number) => `${days} jour${days > 1 ? 's' : ''}`;

  const getPaymentFollowUpLabel = (invoice: Invoice) => {
    if (invoice.type !== 'invoice') return null;
    if (invoice.status === 'paid') return 'Règlement reçu';
    if (invoice.status === 'overdue') {
      const days = getElapsedDays(invoice.dueDate);
      return days == null ? 'En retard' : `En retard depuis ${pluralDays(days)}`;
    }
    if (invoice.status === 'sent') {
      const days = getElapsedDays(invoice.updatedAt || invoice.date);
      return days === 0 ? "Envoyée aujourd'hui" : days == null ? 'Envoyée' : `Envoyée il y a ${pluralDays(days)}`;
    }
    return null;
  };

  const getPaymentFollowUpClass = (invoice: Invoice) => {
    if (invoice.status === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (invoice.status === 'overdue') return 'bg-red-50 text-red-700 border-red-200';
    if (invoice.status === 'sent') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-surface-container-high text-on-surface-variant border-outline-variant/30';
  };

  const canSendReminder = (invoice: Invoice) =>
    invoice.type === 'invoice' && ['sent', 'overdue'].includes(invoice.status);

  const getStatusLabel = (status: string) =>
    getTypedStatusLabel(typeFilter === 'quote' ? 'quote' : 'invoice', status as Invoice['status'], status as Invoice['status']);

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const inv = invoices.find(i => i.id === id);
    if (inv?.isLocked) {
      // Pas de modal : la suppression d'une facture validée est interdite
      // par la loi (numéros continus). On guide l'utilisateur vers l'avoir.
      alert('Cette facture est validée et ne peut plus être supprimée. Pour l\'annuler, créez un avoir.');
      return;
    }
    setDeleteModalOpen(id);
  };

  const confirmDelete = async () => {
    if (!deleteModalOpen) return;
    setIsDeleting(deleteModalOpen);
    try {
      await deleteInvoice(deleteModalOpen);
    } catch (err) {
      if (err instanceof InvoiceLockedError) {
        alert(err.message);
      } else {
        console.error(err);
      }
    } finally {
      setIsDeleting(null);
      setDeleteModalOpen(null);
    }
  };

  const handleStatusChange = async (id: string, newStatus: Invoice['status'], e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating(id);
    try {
      await updateInvoice(id, { status: newStatus });
      if (newStatus === 'paid') {
        await logInvoiceEvent(id, 'mark_paid');
        success('Facture marquée payée');
      }
    } catch (err) {
      if (err instanceof InvoiceLockedError) {
        alert(err.message);
      } else {
        console.error(err);
      }
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="space-y-5 md:space-y-8 min-w-0 w-full">
      <header className="animate-fade-in-up flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-6 min-w-0">
        <div className="min-w-0">
          <h1 className="font-headline text-[26px] md:text-4xl font-extrabold text-on-surface tracking-tight mb-1 leading-tight">Documents</h1>
          <p className="text-on-surface-variant font-medium text-sm">Factures, devis et relances — tout au même endroit.</p>
        </div>
      </header>

      {/* Soft-upsell — surfaces invoice quota progress for free users right
          where they create new documents, before they hit the wall. */}
      <UpsellBanner surface="invoices_list" resource="invoice" />

      {/* Toolbar */}
      <div className="animate-fade-in-up animation-delay-100 flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center justify-between min-w-0 w-full">

        {/* Type Tabs */}
        <div className="flex bg-surface-container-high p-1 rounded-2xl w-full sm:w-auto overflow-x-auto shadow-sm min-w-0">
          <button 
            onClick={() => {setTypeFilter('invoice'); setStatusFilter('all');}}
            className={`flex-1 sm:flex-none px-4 md:px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
              typeFilter === 'invoice' 
                ? 'bg-surface-container-lowest text-primary shadow-sm' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Factures
          </button>
          <button 
            onClick={() => {setTypeFilter('quote'); setStatusFilter('all');}}
            className={`flex-1 sm:flex-none px-4 md:px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
              typeFilter === 'quote' 
                ? 'bg-surface-container-lowest text-primary shadow-sm' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Devis
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 md:gap-3 w-full md:w-auto min-w-0">
          <div className="relative w-full sm:w-64 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              type="text"
              placeholder={`Rechercher un ${typeFilter === 'invoice' ? 'client ou n°' : 'devis'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-w-0 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium shadow-sm"
            />
          </div>


          <div className="grid grid-cols-3 gap-2 w-full sm:flex sm:w-auto min-w-0">
            <button
              onClick={exportCSV}
              title="Export Liste CSV (PRO)"
              className="min-touch min-w-0 flex items-center justify-center gap-1.5 px-2 md:px-4 py-2.5 md:py-3 bg-tertiary-container text-on-tertiary-container rounded-xl md:rounded-2xl font-bold shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all outline-none"
            >
              <FileSpreadsheet className="w-5 h-5 shrink-0" />
              <span className="hidden sm:inline">CSV</span>
              {!isPro && <span className="text-[9px] bg-tertiary text-on-tertiary px-1.5 py-0.5 rounded-full ml-1">PRO</span>}
            </button>
            <button
              onClick={exportFEC}
              title="Export Comptable FEC (PRO)"
              className="min-touch min-w-0 flex items-center justify-center gap-1.5 px-2 md:px-4 py-2.5 md:py-3 bg-secondary-container text-on-secondary-container rounded-xl md:rounded-2xl font-bold shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all outline-none"
            >
              <FileSpreadsheet className="w-5 h-5 shrink-0" />
              <span className="hidden sm:inline">FEC</span>
              {!isPro && <span className="text-[9px] bg-secondary text-on-secondary px-1.5 py-0.5 rounded-full ml-1">PRO</span>}
            </button>
            <button
              onClick={exportZIP}
              title="Export ZIP Comptable (PDFs + FEC)"
              className="min-touch min-w-0 flex items-center justify-center gap-1.5 px-2 md:px-4 py-2.5 md:py-3 bg-primary-container text-on-primary-container rounded-xl md:rounded-2xl font-bold shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all outline-none"
            >
              <Archive className="w-5 h-5 shrink-0" />
              <span className="hidden sm:inline">ZIP</span>
              {!isPro && <span className="text-[9px] bg-primary text-on-primary px-1.5 py-0.5 rounded-full ml-1">PRO</span>}
            </button>
          </div>

          <button
            onClick={() => navigate(typeFilter === 'quote' ? '/app/invoices/new?type=quote' : '/app/invoices/new')}
            className="btn-glow min-touch min-w-0 flex items-center justify-center gap-2 px-4 md:px-6 py-3 bg-primary text-on-primary rounded-xl font-bold shadow-spark-cta hover:-translate-y-0.5 active:scale-95 transition-all w-full sm:w-auto whitespace-nowrap text-sm"
          >
            <Plus className="w-5 h-5 shrink-0" />
            <span className="truncate">Nouveau {typeFilter === 'invoice' ? 'document' : 'devis'}</span>
          </button>
        </div>
      </div>

      {/* Status Filters */}
      <div className="animate-fade-in-up animation-delay-200 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-center text-on-surface-variant/50 pr-2">
          <Filter className="w-4 h-4" />
        </div>
        {['all', 'draft', 'validated', 'sent', 'paid', 'overdue', 'cancelled', 'accepted'].map(filter => {
          if (typeFilter === 'invoice' && filter === 'accepted') return null;
          if (typeFilter === 'quote' && (filter === 'paid' || filter === 'overdue')) return null;
          
          return (
            <button 
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 md:px-4 py-1.5 text-[11px] md:text-xs font-bold rounded-full transition-all border whitespace-nowrap ${
                statusFilter === filter 
                  ? 'bg-surface-container-high border-outline-variant text-on-surface shadow-sm' 
                  : 'bg-surface-container-lowest border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {filter === 'all' ? 'Tous les statuts' : getStatusLabel(filter)}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="animate-fade-in-up animation-delay-300 bg-surface rounded-2xl overflow-hidden shadow-spark-md border-spark">
        {filteredInvoices.length === 0 && searchTerm ? (
          <div className="p-5 md:p-16">
            <EmptySearchState message={`Aucun document ne correspond à "${searchTerm}"`} onClear={() => { setSearchTerm(''); setTypeFilter('invoice'); setStatusFilter('all'); }} />
          </div>
        ) : filteredInvoices.length === 0 ? (
          // Rich empty state with dual-CTA (dicter ou photographier · saisir
          // manuellement) — much higher activation than a single button.
          <div className="p-5 md:p-12">
            <EmptyInvoicesState />
          </div>
        ) : (
          <>
          <div className="md:hidden divide-y divide-surface-container-low">
            {filteredInvoices.map((invoice) => (
              <article
                key={invoice.id}
                onClick={() => navigate(`/app/invoices/${invoice.id}`)}
                className={`bg-surface-container-lowest p-3.5 active:bg-surface-container-low/60 transition-colors ${
                  invoice.status === 'overdue' ? 'border-l-4 border-red-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-headline font-extrabold text-on-surface tracking-wide truncate">
                      {invoice.number}
                    </div>
                    <div className="mt-1 font-bold text-on-surface truncate">
                      {invoice.clientName}
                    </div>
                    <div className="mt-1 text-xs font-medium text-on-surface-variant">
                      {format(new Date(invoice.date), 'dd MMM yyyy', { locale: fr })}
                      {typeFilter === 'invoice' && invoice.dueDate
                        ? ` · Éch. ${format(new Date(invoice.dueDate), 'dd MMM', { locale: fr })}`
                        : ''}
                    </div>
                    {getPaymentFollowUpLabel(invoice) && (
                      <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-bold ${getPaymentFollowUpClass(invoice)}`}>
                        <span>{getPaymentFollowUpLabel(invoice)}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-headline font-extrabold text-primary text-base">
                      {formatCurrency(invoice.totalTTC)}
                    </div>
                    <InvoiceStatusBadge invoice={invoice} compact />
                  </div>
                </div>

                {invoice.type === 'invoice' && invoice.vatRegime !== 'franchise' && (
                  <div className="mt-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                      invoice.chorusStatus === 'submitted'
                        ? 'bg-tertiary-container/60 text-tertiary border border-tertiary/20'
                        : invoice.chorusStatus === 'error'
                        ? 'bg-error-container/60 text-error border border-error/20'
                        : 'bg-amber-100 text-amber-700 border border-amber-300/40'
                    }`}>
                      {invoice.chorusStatus === 'submitted' ? 'Déposée Chorus'
                        : invoice.chorusStatus === 'error' ? 'Erreur Chorus'
                        : 'À déposer Chorus'}
                    </span>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {invoice.type === 'quote' && (invoice.status === 'accepted' || invoice.status === 'sent') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/app/invoices/new?fromQuote=${invoice.id}`); }}
                      className="min-touch flex items-center justify-center gap-2 rounded-xl bg-primary-container text-primary px-3 py-2.5 text-xs font-bold"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Convertir
                    </button>
                  )}
                  {invoice.status === 'draft' && (
                    <button
                      disabled={isUpdating === invoice.id}
                      onClick={(e) => handleStatusChange(invoice.id, 'sent', e)}
                      className="min-touch flex items-center justify-center gap-2 rounded-xl bg-secondary-container text-secondary px-3 py-2.5 text-xs font-bold disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      Envoyer
                    </button>
                  )}
                  {invoice.type === 'quote' && (invoice.status === 'sent' || invoice.status === 'draft') && (
                    <div className="col-span-2 space-y-2">
                      <button
                        disabled={isSharing === invoice.id}
                        onClick={(e) => handleShare(invoice, e)}
                        className="min-touch flex w-full items-center justify-center gap-2 rounded-xl bg-primary text-on-primary px-3 py-2.5 text-xs font-bold shadow-sm disabled:opacity-50"
                      >
                        {isSharing === invoice.id ? (
                          <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                        ) : copiedLink === invoice.id ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                        {copiedLink === invoice.id ? 'Lien copié' : 'Envoyer pour signature'}
                      </button>
                      {activeSignatureShareId === invoice.id && signatureShareUrls[invoice.id] && (
                        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-2">
                          <button onClick={(e) => handleCopySignatureLink(invoice, e)} className="min-touch flex items-center justify-center gap-1.5 rounded-xl bg-surface-container-high px-2 py-2 text-[11px] font-bold text-on-surface">
                            <Link className="w-3.5 h-3.5" />
                            Copier
                          </button>
                          <button onClick={(e) => handleEmailSignatureLink(invoice, e)} className="min-touch flex items-center justify-center gap-1.5 rounded-xl bg-secondary-container px-2 py-2 text-[11px] font-bold text-secondary">
                            <Mail className="w-3.5 h-3.5" />
                            Email
                          </button>
                          <button onClick={(e) => handleWhatsAppSignatureLink(invoice, e)} className="min-touch flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-2 py-2 text-[11px] font-bold text-amber-800">
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {invoice.type === 'invoice' && ['validated', 'sent', 'overdue'].includes(invoice.status) && (
                    <button
                      disabled={isUpdating === invoice.id}
                      onClick={(e) => handleStatusChange(invoice.id, 'paid', e)}
                      className="min-touch flex items-center justify-center gap-2 rounded-xl bg-tertiary-container text-tertiary px-3 py-2.5 text-xs font-bold disabled:opacity-50"
                    >
                      <Euro className="w-4 h-4" />
                      Marquer payée
                    </button>
                  )}
                  {canSendReminder(invoice) && (
                    <>
                      <div className="col-span-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-bold text-amber-800">
                        Client non payé
                      </div>
                      <button
                        disabled={isSendingReminder === invoice.id}
                        onClick={(e) => handleEmailReminder(invoice, e)}
                        className="min-touch flex items-center justify-center gap-2 rounded-xl bg-amber-500 text-white px-3 py-2.5 text-xs font-bold shadow-sm disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        Relancer client
                      </button>
                      <button
                        onClick={(e) => handleWhatsAppReminder(invoice, e)}
                        className="min-touch flex items-center justify-center gap-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2.5 text-xs font-bold"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/app/invoices/${invoice.id}`); }}
                    className="min-touch flex items-center justify-center gap-2 rounded-xl bg-surface-container-high text-on-surface px-3 py-2.5 text-xs font-bold"
                  >
                    {invoice.isLocked ? <Lock className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                    {invoice.isLocked ? 'Voir' : 'Ouvrir'}
                  </button>
                  {invoice.isLocked && invoice.type === 'invoice' && !invoice.creditedBy ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <CreditNoteButton
                        invoice={invoice}
                        className="w-full justify-center"
                      />
                    </div>
                  ) : (
                    <button
                      disabled={isDeleting === invoice.id || invoice.isLocked}
                      onClick={(e) => handleDeleteClick(invoice.id, e)}
                      className="min-touch flex items-center justify-center gap-2 rounded-xl bg-error-container text-error px-3 py-2.5 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                      title={invoice.isLocked ? 'Facture verrouillée — créez un avoir pour corriger' : 'Supprimer'}
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[980px]">
              <thead>
                <tr className="bg-surface-container-low/30 border-b border-outline-variant/10 text-on-surface-variant">
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest pl-8"># N°</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest">Client</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest">Date / Échéance</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest">Montant</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest">Statut</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-right pr-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() => navigate(`/app/invoices/${invoice.id}`)}
                    className={`group hover:bg-surface-container-low/50 transition-colors cursor-pointer ${
                      invoice.status === 'overdue'
                        ? 'bg-red-50/45 border-l-4 border-red-500'
                        : 'bg-surface-container-lowest'
                    }`}
                  >
                    <td className="px-6 py-5 pl-8">
                      <span className="font-headline font-extrabold text-on-surface tracking-wide">{invoice.number}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center text-xs font-extrabold text-primary shrink-0 shadow-inner">
                          {invoice.clientName.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-on-surface truncate max-w-[200px]">{invoice.clientName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-semibold text-on-surface">
                        {format(new Date(invoice.date), 'dd MMM yyyy', { locale: fr })}
                      </div>
                      <div className="text-xs font-medium text-on-surface-variant mt-0.5">
                        {typeFilter === 'invoice' ? `Éch. ${format(new Date(invoice.dueDate), 'dd MMM', { locale: fr })}` : ''}
                      </div>
                      {getPaymentFollowUpLabel(invoice) && (
                        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-bold ${getPaymentFollowUpClass(invoice)}`}>
                          {getPaymentFollowUpLabel(invoice)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-headline font-extrabold text-on-surface text-lg">
                        {formatCurrency(invoice.totalTTC)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <InvoiceStatusBadge invoice={invoice} />
                        {canSendReminder(invoice) && (
                          <span className="text-[11px] font-bold text-amber-700">Client non payé</span>
                        )}
                        {invoice.type === 'invoice' && invoice.vatRegime !== 'franchise' && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                            invoice.chorusStatus === 'submitted' 
                              ? 'bg-tertiary-container/60 text-tertiary border border-tertiary/20'
                              : invoice.chorusStatus === 'error'
                              ? 'bg-error-container/60 text-error border border-error/20'
                              : 'bg-amber-100 text-amber-700 border border-amber-300/40'
                          }`}>
                            {invoice.chorusStatus === 'submitted' ? '🏛 Déposée ✓' 
                              : invoice.chorusStatus === 'error' ? '🏛 Erreur' 
                              : '🏛 À déposer'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 pr-8 text-right">
                      <div className="flex justify-end gap-2.5 transition-opacity flex-wrap min-w-[310px]">
                        {invoice.type === 'quote' && (invoice.status === 'accepted' || invoice.status === 'sent') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/app/invoices/new?fromQuote=${invoice.id}`); }} 
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-primary-container text-primary hover:bg-primary hover:text-on-primary rounded-xl transition-colors text-xs font-bold min-h-[44px]"
                            title="Convertir en facture"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Convertir
                          </button>
                        )}
                        {invoice.status === 'draft' && (
                          <button disabled={isUpdating === invoice.id} onClick={(e) => handleStatusChange(invoice.id, 'sent', e)} className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-secondary-container text-secondary hover:bg-secondary hover:text-on-secondary rounded-xl transition-colors disabled:opacity-50 text-xs font-bold min-h-[44px]" title="Envoyer la facture">
                            <Send className="w-4 h-4 translate-y-px -translate-x-0.5" />
                            Envoyer
                          </button>
                        )}
                        {invoice.type === 'quote' && (invoice.status === 'sent' || invoice.status === 'draft') && (
                          <div className="relative inline-flex">
                            <button
                              disabled={isSharing === invoice.id}
                              onClick={(e) => handleShare(invoice, e)}
                              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition-colors disabled:opacity-50 text-xs font-bold min-h-[44px] ${
                              copiedLink === invoice.id 
                                ? 'bg-tertiary-container text-tertiary'
                                : 'bg-primary text-on-primary hover:opacity-90 shadow-sm'
                            }`}
                              title={copiedLink === invoice.id ? 'Lien copié !' : 'Envoyer pour signature'}
                            >
                              {isSharing === invoice.id ? (
                                <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                              ) : copiedLink === invoice.id ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Share2 className="w-4 h-4" />
                              )}
                              {copiedLink === invoice.id ? 'Copié' : 'Signature'}
                            </button>
                            {activeSignatureShareId === invoice.id && signatureShareUrls[invoice.id] && (
                              <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-3 shadow-xl">
                                <p className="mb-2 text-xs font-semibold text-on-surface-variant">Envoyer le lien par :</p>
                                <div className="grid grid-cols-3 gap-2">
                                  <button onClick={(e) => handleCopySignatureLink(invoice, e)} className="min-touch inline-flex items-center justify-center gap-1.5 rounded-xl bg-surface-container-high px-2 py-2 text-xs font-bold text-on-surface">
                                    <Link className="w-3.5 h-3.5" />
                                    Copier
                                  </button>
                                  <button onClick={(e) => handleEmailSignatureLink(invoice, e)} className="min-touch inline-flex items-center justify-center gap-1.5 rounded-xl bg-secondary-container px-2 py-2 text-xs font-bold text-secondary">
                                    <Mail className="w-3.5 h-3.5" />
                                    Email
                                  </button>
                                  <button onClick={(e) => handleWhatsAppSignatureLink(invoice, e)} className="min-touch inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-2 py-2 text-xs font-bold text-amber-800">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    WhatsApp
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {invoice.type === 'invoice' && ['validated', 'sent', 'overdue'].includes(invoice.status) && (
                          <button disabled={isUpdating === invoice.id} onClick={(e) => handleStatusChange(invoice.id, 'paid', e)} className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-tertiary text-on-tertiary hover:opacity-90 rounded-xl transition-colors disabled:opacity-50 text-xs font-bold min-h-[44px]" title="Marquer comme payée">
                            <Euro className="w-4 h-4" />
                            Marquer payée
                          </button>
                        )}
                        {invoice.type === 'quote' && invoice.status === 'sent' && (
                          <button disabled={isUpdating === invoice.id} onClick={(e) => handleStatusChange(invoice.id, 'accepted', e)} className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-primary-container text-primary hover:bg-primary hover:text-on-primary rounded-xl transition-colors disabled:opacity-50 text-xs font-bold min-h-[44px]" title="Marquer comme accepté">
                            <CheckCircle2 className="w-4 h-4" />
                            Accepter
                          </button>
                        )}
                        {canSendReminder(invoice) && (
                          <button
                            disabled={isSendingReminder === invoice.id}
                            onClick={(e) => handleEmailReminder(invoice, e)}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-amber-500 text-white hover:bg-amber-600 rounded-xl transition-colors disabled:opacity-50 shadow-sm text-xs font-bold min-h-[44px]"
                            title="Relancer par email — client non payé"
                          >
                            <Send className="w-4 h-4" />
                            Relancer client
                          </button>
                        )}
                        {canSendReminder(invoice) && (
                          <button 
                            onClick={(e) => handleWhatsAppReminder(invoice, e)} 
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl transition-colors text-xs font-bold min-h-[44px]"
                            title="Relancer sur WhatsApp — client non payé"
                          >
                            <MessageCircle className="w-4 h-4" />
                            WhatsApp
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/app/invoices/${invoice.id}`); }} className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-surface-container-high text-on-surface-variant hover:text-on-surface rounded-xl transition-colors text-xs font-bold min-h-[44px]" title={invoice.isLocked ? 'Voir (verrouillée)' : 'Modifier'}>
                          {invoice.isLocked ? <Lock className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                          {invoice.isLocked ? 'Voir' : 'Modifier'}
                        </button>
                        {invoice.isLocked && invoice.type === 'invoice' && !invoice.creditedBy && (
                          <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); navigate(`/app/invoices/${invoice.id}?action=credit`); }}
                              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-tertiary-container text-on-tertiary-container hover:opacity-90 rounded-xl transition-colors text-xs font-bold min-h-[44px]"
                              title="Créer un avoir"
                            >
                              <FilePlus2 className="w-4 h-4" />
                              Avoir
                            </button>
                          </span>
                        )}
                        <button
                          disabled={isDeleting === invoice.id || invoice.isLocked}
                          onClick={(e) => handleDeleteClick(invoice.id, e)}
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-error-container text-error hover:bg-error hover:text-on-error rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold min-h-[44px]"
                          title={invoice.isLocked ? 'Facture verrouillée — créez un avoir' : 'Supprimer'}
                        >
                          {invoice.isLocked ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-inverse-surface/40 backdrop-blur-xl animate-fade-in">
          <div className="bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-5 sm:p-8 text-center border border-outline-variant/10 animate-scale-in pb-safe">
            <div className="w-20 h-20 bg-error-container text-error rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Trash2 className="w-10 h-10" />
            </div>
            <h3 className="font-headline text-2xl font-extrabold text-on-surface mb-3 tracking-tight">Supprimer ce document ?</h3>
            <p className="text-on-surface-variant text-base mb-8">
              Cette action est irréversible. Le document sera définitivement supprimé.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
              <button 
                onClick={() => setDeleteModalOpen(null)} 
                className="flex-1 min-touch py-3.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={confirmDelete} 
                disabled={!!isDeleting}
                className="flex-1 min-touch py-3.5 bg-error text-on-error rounded-xl font-bold shadow-lg shadow-error/20 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
