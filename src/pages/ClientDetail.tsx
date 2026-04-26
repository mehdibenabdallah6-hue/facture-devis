import React from 'react';
import { useData } from '../contexts/DataContext';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, Plus, FileText, Euro, Clock, CheckCircle, AlertCircle, Mail, Phone, MapPin, Briefcase, User, ArrowRight } from 'lucide-react';
import { InvoiceStatusBadge, getEffectiveInvoiceStatus } from '../components/InvoiceStatusBadge';

export default function ClientDetail() {
  const { id } = useParams();
  const { clients, invoices, company } = useData();
  const navigate = useNavigate();

  const client = clients.find(c => c.id === id);
  const clientInvoices = id
    ? invoices
        .filter(inv => inv.clientId === id)
        .map(inv => ({ ...inv, status: getEffectiveInvoiceStatus(inv) }))
    : [];

  const totalInvoiced = clientInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);
  const totalPaid = clientInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.totalTTC, 0);
  const totalPending = clientInvoices.filter(inv => inv.status === 'sent' || inv.status === 'accepted').reduce((sum, inv) => sum + inv.totalTTC, 0);
  const totalOverdue = clientInvoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.totalTTC, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: company?.defaultCurrency || 'EUR' }).format(amount);
  };

  if (!client) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <h2 className="text-2xl font-headline font-extrabold text-on-surface mb-3">Client introuvé</h2>
        <p className="text-on-surface-variant mb-6">Ce client n'existe pas ou a été supprimé.</p>
        <button
          onClick={() => navigate('/app/clients')}
          className="btn-glow inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-xl font-bold shadow-spark-cta active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux clients
        </button>
      </div>
    );
  }

  const sortedInvoices = [...clientInvoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Back + Header */}
      <button onClick={() => navigate('/app/clients')} className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface text-sm font-bold transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Retour aux clients
      </button>

      {/* Client Info Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 shadow-sm border border-outline-variant/10">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            {client.type === 'B2B' ? (
              <Briefcase className="w-8 h-8 text-primary" />
            ) : (
              <User className="w-8 h-8 text-primary" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
              <h1 className="text-2xl md:text-3xl font-headline font-extrabold text-on-surface truncate">{client.name}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                client.type === 'B2B' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'
              }`}>
                {client.type === 'B2B' ? 'Professionnel' : 'Particulier'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {client.email && (
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Mail className="w-4 h-4 shrink-0" />
                  <a href={`mailto:${client.email}`} className="text-primary hover:underline truncate">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Phone className="w-4 h-4 shrink-0" />
                  <a href={`tel:${client.phone}`} className="hover:underline">{client.phone}</a>
                </div>
              )}
              {client.address && (
                <div className="flex items-start gap-2 text-on-surface-variant sm:col-span-2">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{client.address}</span>
                </div>
              )}
              {client.siren && (
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Briefcase className="w-4 h-4 shrink-0" />
                  <span className="font-mono text-xs">SIREN: {client.siren}</span>
                </div>
              )}
              {client.vatNumber && (
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="font-mono text-xs">TVA: {client.vatNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-on-surface-variant" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total facturé</span>
          </div>
          <p className="text-2xl font-headline font-extrabold text-on-surface">{formatCurrency(totalInvoiced)}</p>
          <p className="text-xs text-on-surface-variant mt-1">{clientInvoices.length} document{clientInvoices.length > 1 ? 's' : ''}</p>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-tertiary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Encaissé</span>
          </div>
          <p className="text-2xl font-headline font-extrabold text-tertiary">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-secondary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">En attente</span>
          </div>
          <p className="text-2xl font-headline font-extrabold text-secondary">{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-error" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">En retard</span>
          </div>
          <p className="text-2xl font-headline font-extrabold text-error">{formatCurrency(totalOverdue)}</p>
        </div>
      </div>

      {/* New Invoice Button */}
      <button
        onClick={() => navigate(`/app/invoices/new?clientId=${client.id}`)}
        className="btn-glow w-full bg-primary text-on-primary px-6 py-4 rounded-2xl font-bold text-lg shadow-spark-cta hover:shadow-xl active:scale-[0.99] transition-all flex items-center justify-center gap-3"
      >
        <Plus className="w-6 h-6" />
        Nouvelle facture pour {client.name}
      </button>

      {/* Invoices List */}
      {sortedInvoices.length > 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10">
          <div className="px-5 py-4 border-b border-outline-variant/10">
            <h2 className="font-headline font-bold text-on-surface">Historique des documents</h2>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {sortedInvoices.map(invoice => (
              <div
                key={invoice.id}
                onClick={() => navigate(`/app/invoices/${invoice.id}`)}
                className="flex items-center justify-between px-5 py-4 hover:bg-surface-container-low/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-xs font-bold text-on-surface-variant shrink-0">
                    {invoice.number.substring(0, 3).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm text-on-surface">{invoice.number}</span>
                      <InvoiceStatusBadge invoice={invoice} compact />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span>{format(new Date(invoice.date), 'dd MMM yyyy', { locale: fr })}</span>
                      {invoice.dueDate && (
                        <>
                          <span>•</span>
                          <span>Échéance {format(new Date(invoice.dueDate), 'dd MMM', { locale: fr })}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="font-headline font-extrabold text-on-surface text-sm">
                    {formatCurrency(invoice.totalTTC)}
                  </span>
                  <ArrowRight className="w-4 h-4 text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity inline-block ml-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl p-8 md:p-12 text-center border border-outline-variant/10">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-headline font-extrabold text-on-surface mb-2">Aucun document</h3>
          <p className="text-on-surface-variant mb-6 max-w-sm mx-auto">
            Vous n'avez encore créé aucun document pour {client.name}.
          </p>
          <button
            onClick={() => navigate(`/app/invoices/new?clientId=${client.id}`)}
            className="btn-glow inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-xl font-bold shadow-spark-cta active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
            Créer une facture
          </button>
        </div>
      )}
    </div>
  );
}
