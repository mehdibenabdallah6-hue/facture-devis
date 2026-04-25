import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, Plus, FileText, Edit, Trash2, Send, Euro, RefreshCw, Filter, Share2, Link, Check, CheckCircle2, FileSpreadsheet, MessageCircle, Archive } from 'lucide-react';
import { Invoice } from '../contexts/DataContext';
import { usePlan } from '../hooks/usePlan';
import { EmptySearchState } from '../components/EmptyStates';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InvoicesList() {
  const { invoices, clients, company, deleteInvoice, updateInvoice, shareQuoteForSignature } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'invoice' | 'quote'>('invoice');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const { isPro } = usePlan();

  const exportCSV = () => {
    if (!isPro) {
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
        getStatusLabel(inv.status),
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

    for (const inv of monthInvoices) {
      try {
        const doc = new jsPDF();
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

  const handleShare = async (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSharing(invoiceId);
    try {
      const shareUrl = await shareQuoteForSignature(invoiceId);
      const text = encodeURIComponent(`Bonjour, voici le devis pour le chantier.\nVous pouvez le consulter et le signer directement en ligne en cliquant ici :\n${shareUrl}`);
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const waUrl = isMobile ? `whatsapp://send?text=${text}` : `https://web.whatsapp.com/send?text=${text}`;
      
      window.open(waUrl, '_blank');
      
      // Fallback copy to clipboard just in case
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(invoiceId);
      setTimeout(() => setCopiedLink(null), 3000);
    } catch (err) {
      console.error('Error sharing:', err);
    } finally {
      setIsSharing(null);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inv.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesType = typeFilter === 'invoice' ? (inv.type === 'invoice' || inv.type === 'deposit' || inv.type === 'credit') : inv.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: company?.defaultCurrency || 'EUR' }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-tertiary-container text-on-tertiary-container border border-tertiary/20';
      case 'sent': return 'bg-secondary-container text-on-secondary-container border border-secondary/20';
      case 'overdue': return 'bg-error-container text-on-error-container border border-error/20';
      case 'draft': return 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30';
      case 'accepted': return 'bg-primary-container text-on-primary-container border border-primary/20';
      case 'converted': return 'bg-tertiary-container text-tertiary border border-tertiary/20 opacity-70';
      default: return 'bg-surface-container-high text-on-surface-variant';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Payée';
      case 'sent': return 'Envoyée';
      case 'overdue': return 'En retard';
      case 'draft': return 'Brouillon';
      case 'cancelled': return 'Annulée';
      case 'accepted': return 'Accepté';
      case 'converted': return 'Converti';
      default: return status;
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteModalOpen(id);
  };

  const confirmDelete = async () => {
    if (!deleteModalOpen) return;
    setIsDeleting(deleteModalOpen);
    try {
      await deleteInvoice(deleteModalOpen);
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
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="animate-fade-in-up flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight mb-1">Documents</h1>
          <p className="text-on-surface-variant font-medium text-sm">Factures, devis et relances — tout au même endroit.</p>
        </div>
      </header>

      {/* Toolbar */}
      <div className="animate-fade-in-up animation-delay-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        
        {/* Type Tabs */}
        <div className="flex bg-surface-container-high p-1.5 rounded-2xl w-full sm:w-auto overflow-x-auto shadow-sm">
          <button 
            onClick={() => {setTypeFilter('invoice'); setStatusFilter('all');}}
            className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
              typeFilter === 'invoice' 
                ? 'bg-surface-container-lowest text-primary shadow-sm' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Factures
          </button>
          <button 
            onClick={() => {setTypeFilter('quote'); setStatusFilter('all');}}
            className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
              typeFilter === 'quote' 
                ? 'bg-surface-container-lowest text-primary shadow-sm' 
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Devis
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input 
              type="text" 
              placeholder={`Rechercher un ${typeFilter === 'invoice' ? 'client ou n°' : 'devis'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium shadow-sm"
            />
          </div>
          
          
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              title="Export Liste CSV (PRO)"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-tertiary-container text-on-tertiary-container rounded-2xl font-bold shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all outline-none"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="hidden sm:inline">CSV</span>
              {!isPro && <span className="text-[9px] bg-tertiary text-on-tertiary px-1.5 py-0.5 rounded-full ml-1">PRO</span>}
            </button>
            <button
              onClick={exportFEC}
              title="Export Comptable FEC (PRO)"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-secondary-container text-on-secondary-container rounded-2xl font-bold shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all outline-none"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="hidden sm:inline">FEC</span>
              {!isPro && <span className="text-[9px] bg-secondary text-on-secondary px-1.5 py-0.5 rounded-full ml-1">PRO</span>}
            </button>
            <button
              onClick={exportZIP}
              title="Export ZIP Comptable (PDFs + FEC)"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-container text-on-primary-container rounded-2xl font-bold shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all outline-none"
            >
              <Archive className="w-5 h-5" />
              <span className="hidden sm:inline">ZIP</span>
              {!isPro && <span className="text-[9px] bg-primary text-on-primary px-1.5 py-0.5 rounded-full ml-1">PRO</span>}
            </button>
          </div>

          <button 
            onClick={() => navigate(typeFilter === 'quote' ? '/app/invoices/new?type=quote' : '/app/invoices/new')}
            className="btn-glow flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold shadow-spark-cta hover:-translate-y-0.5 active:scale-95 transition-all w-full sm:w-auto whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Nouveau {typeFilter === 'invoice' ? 'document' : 'devis'}
          </button>
        </div>
      </div>

      {/* Status Filters */}
      <div className="animate-fade-in-up animation-delay-200 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex items-center text-on-surface-variant/50 pr-2">
          <Filter className="w-4 h-4" />
        </div>
        {['all', 'paid', 'sent', 'overdue', 'draft', 'accepted'].map(filter => {
          if (typeFilter === 'invoice' && filter === 'accepted') return null;
          if (typeFilter === 'quote' && (filter === 'paid' || filter === 'overdue')) return null;
          
          return (
            <button 
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all border whitespace-nowrap ${
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
          <div className="p-16">
            <EmptySearchState message={`Aucun document ne correspond à "${searchTerm}"`} onClear={() => { setSearchTerm(''); setTypeFilter('invoice'); setStatusFilter('all'); }} />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-24 h-24 bg-surface-container-low rounded-full flex items-center justify-center mb-6">
              <FileText className="w-10 h-10 text-outline" />
            </div>
            <h3 className="font-headline text-2xl font-bold text-on-surface mb-2 tracking-tight">Aucun document trouvé</h3>
            <p className="text-on-surface-variant max-w-md mx-auto mb-8 text-lg">Vos factures et devis apparaîtront ici. Créez-en un nouveau avec notre IA ou manuellement.</p>
            <button 
              onClick={() => navigate('/app/invoices/new')}
              className="btn-glow flex items-center gap-2 px-8 py-4 bg-primary text-on-primary rounded-xl font-bold shadow-spark-cta hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" />
              Créer mon premier document
            </button>
          </div>
        ) : (
          <>
          <div className="md:hidden divide-y divide-surface-container-low">
            {filteredInvoices.map((invoice) => (
              <article
                key={invoice.id}
                onClick={() => navigate(`/app/invoices/${invoice.id}`)}
                className="bg-surface-container-lowest p-4 active:bg-surface-container-low/60 transition-colors"
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
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-headline font-extrabold text-primary text-lg">
                      {formatCurrency(invoice.totalTTC)}
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getStatusColor(invoice.status)}`}>
                      {getStatusLabel(invoice.status)}
                    </span>
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

                <div className="mt-4 grid grid-cols-2 gap-2">
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
                      Envoyé
                    </button>
                  )}
                  {invoice.type === 'quote' && (invoice.status === 'sent' || invoice.status === 'draft') && (
                    <button
                      disabled={isSharing === invoice.id}
                      onClick={(e) => handleShare(invoice.id, e)}
                      className="min-touch flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary px-3 py-2.5 text-xs font-bold disabled:opacity-50"
                    >
                      {copiedLink === invoice.id ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                      {copiedLink === invoice.id ? 'Copié' : 'Signer'}
                    </button>
                  )}
                  {invoice.type === 'invoice' && invoice.status === 'sent' && (
                    <button
                      disabled={isUpdating === invoice.id}
                      onClick={(e) => handleStatusChange(invoice.id, 'paid', e)}
                      className="min-touch flex items-center justify-center gap-2 rounded-xl bg-tertiary-container text-tertiary px-3 py-2.5 text-xs font-bold disabled:opacity-50"
                    >
                      <Euro className="w-4 h-4" />
                      Payée
                    </button>
                  )}
                  {invoice.type === 'invoice' && invoice.status === 'overdue' && (
                    <button
                      onClick={(e) => handleWhatsAppReminder(invoice, e)}
                      className="min-touch flex items-center justify-center gap-2 rounded-xl bg-green-500/10 text-green-700 px-3 py-2.5 text-xs font-bold"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Relancer
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/app/invoices/${invoice.id}`); }}
                    className="min-touch flex items-center justify-center gap-2 rounded-xl bg-surface-container-high text-on-surface px-3 py-2.5 text-xs font-bold"
                  >
                    <Edit className="w-4 h-4" />
                    Ouvrir
                  </button>
                  <button
                    disabled={isDeleting === invoice.id}
                    onClick={(e) => handleDeleteClick(invoice.id, e)}
                    className="min-touch flex items-center justify-center gap-2 rounded-xl bg-error-container text-error px-3 py-2.5 text-xs font-bold disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
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
                  <tr key={invoice.id} onClick={() => navigate(`/app/invoices/${invoice.id}`)} className="group hover:bg-surface-container-low/50 transition-colors cursor-pointer bg-surface-container-lowest">
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
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-headline font-extrabold text-on-surface text-lg">
                        {formatCurrency(invoice.totalTTC)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest ${getStatusColor(invoice.status)}`}>
                          {getStatusLabel(invoice.status)}
                        </span>
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
                      <div className="flex justify-end gap-2 transition-opacity">
                        {invoice.type === 'quote' && (invoice.status === 'accepted' || invoice.status === 'sent') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/app/invoices/new?fromQuote=${invoice.id}`); }} 
                            className="p-2.5 bg-primary-container text-primary hover:bg-primary hover:text-on-primary rounded-xl transition-colors" 
                            title="Convertir en facture"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        {invoice.status === 'draft' && (
                          <button disabled={isUpdating === invoice.id} onClick={(e) => handleStatusChange(invoice.id, 'sent', e)} className="p-2.5 bg-secondary-container text-secondary hover:bg-secondary hover:text-on-secondary rounded-xl transition-colors disabled:opacity-50" title="Marquer comme envoyé">
                            <Send className="w-4 h-4 translate-y-px -translate-x-0.5" />
                          </button>
                        )}
                        {invoice.type === 'quote' && (invoice.status === 'sent' || invoice.status === 'draft') && (
                          <button 
                            disabled={isSharing === invoice.id} 
                            onClick={(e) => handleShare(invoice.id, e)} 
                            className={`p-2.5 rounded-xl transition-colors disabled:opacity-50 ${
                              copiedLink === invoice.id 
                                ? 'bg-tertiary-container text-tertiary' 
                                : 'bg-primary/10 text-primary hover:bg-primary hover:text-on-primary'
                            }`}
                            title={copiedLink === invoice.id ? 'Lien copié !' : 'Partager pour signature'}
                          >
                            {isSharing === invoice.id ? (
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : copiedLink === invoice.id ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {invoice.type === 'invoice' && invoice.status === 'sent' && (
                          <button disabled={isUpdating === invoice.id} onClick={(e) => handleStatusChange(invoice.id, 'paid', e)} className="p-2.5 bg-tertiary-container text-tertiary hover:bg-tertiary hover:text-on-tertiary rounded-xl transition-colors disabled:opacity-50" title="Marquer comme payée">
                            <Euro className="w-4 h-4" />
                          </button>
                        )}
                        {invoice.type === 'quote' && invoice.status === 'sent' && (
                          <button disabled={isUpdating === invoice.id} onClick={(e) => handleStatusChange(invoice.id, 'accepted', e)} className="p-2.5 bg-primary-container text-primary hover:bg-primary hover:text-on-primary rounded-xl transition-colors disabled:opacity-50" title="Marquer comme accepté">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {invoice.type === 'invoice' && invoice.status === 'overdue' && (
                          <button 
                            onClick={(e) => handleWhatsAppReminder(invoice, e)} 
                            className="p-2.5 bg-green-500/10 text-green-600 hover:bg-green-600 hover:text-white rounded-xl transition-colors" 
                            title="Relancer sur WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/app/invoices/${invoice.id}`); }} className="p-2.5 bg-surface-container-high text-on-surface-variant hover:text-on-surface rounded-xl transition-colors" title="Modifier">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button disabled={isDeleting === invoice.id} onClick={(e) => handleDeleteClick(invoice.id, e)} className="p-2.5 bg-error-container text-error hover:bg-error hover:text-on-error rounded-xl transition-colors disabled:opacity-50" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
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
