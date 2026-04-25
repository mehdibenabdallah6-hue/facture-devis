import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, CreditCard, CheckCircle2, AlertCircle, ArrowUpRight, Upload, X, FileSpreadsheet, Package, Edit2, Trash2, Plus, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlan } from '../hooks/usePlan';
import { compressImageToDataURL } from '../services/imageUtils';
import * as XLSX from 'xlsx';
import ReferralCard from '../components/ReferralCard';
import { PLAN_DISPLAY_NAMES } from '../lib/billing';

export default function Settings() {
  const { company, saveCompany, importCatalog, articles, addArticle, updateArticle, deleteArticle } = useData();
  const { user } = useAuth();
  const { plan, hasPaidAccess, isPendingActivation } = usePlan();
  const letterheadRef = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{success?: string, error?: string} | null>(null);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editArticleData, setEditArticleData] = useState<Partial<any>>({});
  const [isAddingArticle, setIsAddingArticle] = useState(false);
  const [newArticleData, setNewArticleData] = useState({ description: '', unitPrice: 0, vatRate: 20 });

  const [formData, setFormData] = useState({
    name: '',
    profession: '',
    address: '',
    siret: '',
    vatNumber: '',
    legalForm: '',
    capital: 0,
    vatRegime: 'standard' as 'standard' | 'franchise' | 'autoliquidation',
    decennale: '',
    rcPro: '',
    invoicePrefix: 'F-',
    defaultPaymentTerms: 30,
    defaultCurrency: 'EUR',
    defaultVat: 20,
    letterheadUrl: '',
    hideCompanyInfo: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        profession: company.profession || '',
        address: company.address || '',
        siret: company.siret || '',
        vatNumber: company.vatNumber || '',
        legalForm: company.legalForm || '',
        capital: company.capital || 0,
        vatRegime: company.vatRegime || 'standard',
        decennale: company.decennale || '',
        rcPro: company.rcPro || '',
        invoicePrefix: company.invoicePrefix || 'F-',
        defaultPaymentTerms: company.defaultPaymentTerms || 30,
        defaultCurrency: company.defaultCurrency || 'EUR',
        defaultVat: company.defaultVat || 20,
        letterheadUrl: company.letterheadUrl || '',
        hideCompanyInfo: company.hideCompanyInfo || false
      });
    }
  }, [company]);

  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataURL(file, 2000, 0.75); // high res for A4
      setFormData(prev => ({ ...prev, letterheadUrl: dataUrl }));
    } catch (err) {
      console.error("Erreur logo:", err);
    }
  };

  const handleCatalogImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);
        
        let validItems = [];
        for (const row of json) {
          // Attempt to find description and price columns generically
          const keys = Object.keys(row);
          const descKey = keys.find(k => k.toLowerCase().includes('desc') || k.toLowerCase().includes('nom') || k.toLowerCase().includes('art') || k.toLowerCase().includes('prod'));
          const priceKey = keys.find(k => k.toLowerCase().includes('prix') || k.toLowerCase().includes('tarif') || k.toLowerCase().includes('ht') || k.toLowerCase().includes('amount'));
          const vatKey = keys.find(k => k.toLowerCase().includes('tva') || k.toLowerCase().includes('tax'));
          
          if (descKey && row[descKey]) {
            validItems.push({
              description: String(row[descKey]),
              unitPrice: priceKey ? parseFloat(String(row[priceKey]).replace(',','.')) || 0 : 0,
              vatRate: vatKey ? parseFloat(String(row[vatKey]).replace(',','.')) || 20 : 20
            });
          }
        }

        if (validItems.length > 0) {
          await importCatalog(validItems);
          setImportResult({ success: `${validItems.length} articles importés avec succès !` });
        } else {
          setImportResult({ error: "Aucun article trouvé. Vérifiez les colonnes (Description, Prix)." });
        }
      } catch (err) {
         setImportResult({ error: "Erreur lors de la lecture du fichier." });
      } finally {
         setIsImporting(false);
         if (catalogRef.current) catalogRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await saveCompany(formData);
    setIsSaving(false);
    setSaved(true);
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  };

  const handleAddArticle = async () => {
    if (!newArticleData.description.trim()) return;
    try {
      await addArticle(newArticleData as any);
      setNewArticleData({ description: '', unitPrice: 0, vatRate: 20 });
      setIsAddingArticle(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateArticle = async (id: string) => {
    try {
      await updateArticle(id, editArticleData);
      setEditingArticleId(null);
      setEditArticleData({});
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditArticle = (article: any) => {
    setEditingArticleId(article.id);
    setEditArticleData({
      description: article.description,
      unitPrice: article.unitPrice,
      vatRate: article.vatRate
    });
  };

  const handleDeleteArticle = async (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer cet article de votre catalogue ?")) {
      await deleteArticle(id);
    }
  };

  const calculateTrialDaysLeft = () => {
    if (!company?.trialStartedAt) return 0;
    const start = new Date(company.trialStartedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, 14 - diffDays);
  };

  const trialDaysLeft = calculateTrialDaysLeft();

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="animate-fade-in-up">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight mb-1">Paramètres</h1>
        <p className="text-on-surface-variant font-medium text-lg">Gérez les informations de votre entreprise et vos préférences.</p>
      </header>

      <div className="animate-fade-in-up animation-delay-100 bg-primary-container/30 border-2 border-primary/20 p-6 rounded-2xl flex flex-col md:flex-row items-center md:items-start gap-4">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center md:text-left">
          <h3 className="font-bold text-primary text-lg mb-1 font-headline">Facturation électronique 2026</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">Photofacto génère des factures au format Factur-X (standard officiel 2026). <span className="text-primary font-medium">Connexion directe Chorus Pro / PPF : Bientôt disponible.</span></p>
        </div>
      </div>

      <div className="animate-fade-in-up animation-delay-200 card-hover bg-surface-container-lowest border border-outline-variant/10 p-6 md:p-8 rounded-2xl flex flex-col items-start gap-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${plan !== 'free' ? 'bg-tertiary/10 text-tertiary' : 'bg-surface-container-high text-on-surface-variant'}`}>
              <CreditCard className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-on-surface mb-1 text-lg font-headline">Abonnement</h3>
              {hasPaidAccess ? (
                <p className="text-sm text-on-surface-variant flex items-center justify-center sm:justify-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-tertiary" /> 
                  <span className="font-bold text-tertiary">Actif</span> Plan {PLAN_DISPLAY_NAMES[plan]}
                </p>
              ) : isPendingActivation ? (
                <p className="text-sm text-on-surface-variant flex items-center justify-center sm:justify-start gap-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  <span className="font-bold text-primary">Activation en cours</span>
                </p>
              ) : (
                <p className="text-sm text-on-surface-variant">Plan actuel : <span className="font-bold text-on-surface text-base">Gratuit</span></p>
              )}
            </div>
          </div>
          {!hasPaidAccess && !isPendingActivation ? (
            <Link to="/app/upgrade" className="btn-glow bg-secondary text-on-secondary px-8 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-secondary/20 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all w-full sm:w-auto text-center">
              Voir les offres
            </Link>
          ) : (
            <Link
              to="/app/abonnement"
              className="bg-surface-container hover:bg-surface-container-highest text-on-surface px-6 py-3 rounded-xl font-medium text-sm transition-all w-full sm:w-auto inline-flex items-center justify-center gap-2"
            >
              Gérer mon abonnement
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          )}
        </div>
        
        {hasPaidAccess && (
          <div className="w-full bg-surface-container-low p-4 rounded-xl flex items-start gap-3 mt-2 border border-outline-variant/20">
            <AlertCircle className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5" />
            <div className="text-sm text-on-surface-variant">
              <p className="font-bold text-on-surface mb-1">Pour annuler ou modifier votre carte bancaire :</p>
              <p>Un lien de gestion sécurisé vous a été envoyé par e-mail (via Paddle) lors de votre paiement. Vous pouvez l'utiliser à tout moment pour gérer votre abonnement, ou contacter notre support.</p>
            </div>
          </div>
        )}
      </div>

      {/* Referral Section */}
      {user && (
        <div className="animate-fade-in-up animation-delay-200">
          <ReferralCard userId={user.uid} company={company} referralCount={company?.referralCount || 0} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in-up animation-delay-300">
        <section className="bg-surface-container-lowest rounded-2xl p-6 md:p-10 shadow-sm border border-outline-variant/10 space-y-6">
          <h2 className="text-2xl font-extrabold font-headline text-on-surface">Entreprise</h2>
          
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Nom de l'entreprise *</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Métier</label>
                <input 
                  type="text" 
                  value={formData.profession}
                  onChange={e => setFormData({...formData, profession: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Adresse complète</label>
              <textarea 
                rows={3}
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm resize-none font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">SIRET</label>
                <input 
                  type="text" 
                  value={formData.siret}
                  onChange={e => setFormData({...formData, siret: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium uppercase font-sans tracking-wide"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">N° TVA Intracommunautaire</label>
                <input 
                  type="text" 
                  value={formData.vatNumber}
                  onChange={e => setFormData({...formData, vatNumber: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium uppercase font-sans tracking-wide"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Forme juridique</label>
                <input 
                  type="text" 
                  placeholder="ex: SASU, SARL, Auto-entrepreneur"
                  value={formData.legalForm}
                  onChange={e => setFormData({...formData, legalForm: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Capital social (€)</label>
                <input 
                  type="number" 
                  value={formData.capital || ''}
                  onChange={e => setFormData({...formData, capital: parseFloat(e.target.value) || 0})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Assurance Décennale</label>
                <input 
                  type="text" 
                  placeholder="Compagnie, contrat..."
                  value={formData.decennale}
                  onChange={e => setFormData({...formData, decennale: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Assurance RC Pro</label>
                <input 
                  type="text" 
                  placeholder="Compagnie, contrat..."
                  value={formData.rcPro}
                  onChange={e => setFormData({...formData, rcPro: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-6 md:p-10 shadow-sm border border-outline-variant/10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold font-headline text-on-surface mb-1">Design & Personnalisation</h2>
              <p className="text-sm text-on-surface-variant font-medium">Ajoutez un papier d'en-tête (logo, bordures) pour vos exports PDF.</p>
            </div>
            {formData.letterheadUrl && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, letterheadUrl: '' }))}
                className="text-error bg-error/10 hover:bg-error/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors self-start md:self-auto"
              >
                <X className="w-4 h-4" />
                Supprimer le design
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <input
                type="file"
                accept="image/jpeg, image/png, image/webp"
                className="hidden"
                ref={letterheadRef}
                onChange={handleLetterheadUpload}
              />
              <button
                type="button"
                onClick={() => letterheadRef.current?.click()}
                className="w-full border-2 border-dashed border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-colors text-primary"
              >
                <Upload className="w-8 h-8" />
                <div className="text-center">
                  <p className="font-bold mb-1">Importer un papier d'en-tête</p>
                  <p className="text-xs opacity-80 font-medium">Format image (JPG, PNG). Résolution A4 conseillée.</p>
                </div>
              </button>

              {formData.letterheadUrl && (
                <label className="flex items-center gap-3 p-4 bg-surface-container-high rounded-xl cursor-pointer hover:bg-surface-container-highest transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.hideCompanyInfo}
                    onChange={(e) => setFormData(prev => ({ ...prev, hideCompanyInfo: e.target.checked }))}
                    className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/20"
                  />
                  <span className="text-sm font-medium text-on-surface">Masquer mes informations textuelles d'entreprise (mon papier à en-tête contient déjà mon nom, adresse et SIRET).</span>
                </label>
              )}
            </div>

            {formData.letterheadUrl && (
              <div className="bg-surface-container-high rounded-2xl p-2 aspect-[1/1.414] shadow-inner relative overflow-hidden group max-w-[200px] mx-auto w-full border border-outline-variant/20">
                <img 
                  src={formData.letterheadUrl} 
                  alt="Paper preview" 
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>
            )}
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-6 md:p-10 shadow-sm border border-outline-variant/10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold font-headline text-on-surface mb-1 flex items-center gap-2">
                <Package className="w-6 h-6 text-primary" />
                Catalogue Produits & IA
              </h2>
              <p className="text-sm text-on-surface-variant font-medium">Importez votre catalogue Excel. L'IA reconnaîtra vos produits selon le nom et récupèrera vos tarifs quand vous dictez !</p>
            </div>
            <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 self-start md:self-auto shrink-0">
              {articles.length} articles en base
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                ref={catalogRef}
                onChange={handleCatalogImport}
              />
              <button
                type="button"
                disabled={isImporting}
                onClick={() => catalogRef.current?.click()}
                className="w-full border-2 border-dashed border-secondary/30 hover:border-secondary bg-secondary/5 hover:bg-secondary/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-colors text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-8 h-8" />
                <div className="text-center">
                  <p className="font-bold mb-1">{isImporting ? 'Importation en cours...' : 'Importer un fichier Excel (.xlsx)'}</p>
                  <p className="text-xs opacity-80 font-medium">Le fichier doit contenir au minimum une colonne "Description" et une colonne "Prix".</p>
                </div>
              </button>

              {importResult?.success && (
                <div className="p-4 bg-tertiary/10 text-tertiary rounded-xl text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  {importResult.success}
                </div>
              )}
              {importResult?.error && (
                <div className="p-4 bg-error/10 text-error rounded-xl text-sm font-bold flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  {importResult.error}
                </div>
              )}
            </div>
            
            <div className="bg-surface-container-high rounded-2xl p-5 border border-outline-variant/10 text-sm h-full flex flex-col">
              <h3 className="font-bold text-on-surface mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-secondary" /> Comment ça marche ?
              </h3>
              <ul className="space-y-3 text-on-surface-variant flex-1 list-disc pl-4">
                <li>Uploadez votre tarifaire Excel ou CSV.</li>
                <li>Créez une facture avec la <strong>dictée vocale</strong> ou <strong>par photo</strong>.</li>
                <li>Si vous dites <span className="italic text-on-surface bg-surface-container-highest px-1 py-0.5 rounded">"Ajoute la Peinture Tollens"</span>, l'IA va instantanément chercher dans votre catalogue le prix unitaire et la TVA exacte correspondants !</li>
              </ul>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-on-surface">Vos articles enregistrés</h3>
              <button 
                type="button"
                onClick={() => setIsAddingArticle(true)}
                className="btn-glow flex items-center gap-2 bg-primary text-on-primary font-bold px-4 py-2 rounded-xl text-sm shadow-sm shadow-primary/20 hover:shadow-md transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>

            <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-surface-container border-b border-outline-variant/10 text-on-surface-variant font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Description</th>
                    <th className="p-4 w-24">Prix (HT)</th>
                    <th className="p-4 w-20">TVA (%)</th>
                    <th className="p-4 w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {isAddingArticle && (
                    <tr className="bg-primary/5">
                      <td className="p-3">
                        <input type="text" placeholder="Ex: Peinture..." value={newArticleData.description} onChange={e => setNewArticleData({...newArticleData, description: e.target.value})} className="w-full bg-surface-container-high rounded-lg px-3 py-2 text-sm border-none focus:ring-1 focus:ring-primary/50" />
                      </td>
                      <td className="p-3">
                        <input type="number" value={newArticleData.unitPrice} onChange={e => setNewArticleData({...newArticleData, unitPrice: parseFloat(e.target.value) || 0})} className="w-full bg-surface-container-high rounded-lg px-2 py-2 text-sm border-none focus:ring-1 focus:ring-primary/50 text-right" />
                      </td>
                      <td className="p-3">
                        <input type="number" value={newArticleData.vatRate} onChange={e => setNewArticleData({...newArticleData, vatRate: parseFloat(e.target.value) || 0})} className="w-full bg-surface-container-high rounded-lg px-2 py-2 text-sm border-none focus:ring-1 focus:ring-primary/50 text-right" />
                      </td>
                      <td className="p-3 text-right flex justify-end gap-2">
                        <button type="button" onClick={handleAddArticle} className="min-touch bg-tertiary/10 text-tertiary hover:bg-tertiary/20 rounded-lg transition-colors flex items-center justify-center"><Save className="w-4 h-4" /></button>
                        <button type="button" onClick={() => setIsAddingArticle(false)} className="min-touch bg-error/10 text-error hover:bg-error/20 rounded-lg transition-colors flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  )}
                  {articles.length === 0 && !isAddingArticle ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-on-surface-variant text-sm">
                        Aucun article dans votre catalogue pour le moment.
                      </td>
                    </tr>
                  ) : (
                    articles.map(article => (
                      <tr key={article.id} className="hover:bg-surface-container/50 transition-colors">
                        <td className="p-3">
                          {editingArticleId === article.id ? (
                            <input type="text" value={editArticleData.description} onChange={e => setEditArticleData({...editArticleData, description: e.target.value})} className="w-full bg-surface-container-highlight rounded-lg px-3 py-1.5 text-sm border-none focus:ring-1 focus:ring-primary" />
                          ) : (
                            <span className="font-medium text-on-surface">{article.description}</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {editingArticleId === article.id ? (
                            <input type="number" value={editArticleData.unitPrice} onChange={e => setEditArticleData({...editArticleData, unitPrice: parseFloat(e.target.value) || 0})} className="w-full bg-surface-container-highlight rounded-lg px-2 py-1.5 text-sm border-none focus:ring-1 focus:ring-primary text-right" />
                          ) : (
                            <span className="text-on-surface-variant font-mono">{article.unitPrice}€</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {editingArticleId === article.id ? (
                            <input type="number" value={editArticleData.vatRate} onChange={e => setEditArticleData({...editArticleData, vatRate: parseFloat(e.target.value) || 0})} className="w-full bg-surface-container-highlight rounded-lg px-2 py-1.5 text-sm border-none focus:ring-1 focus:ring-primary text-right" />
                          ) : (
                            <span className="text-on-surface-variant">{(article.vatRate || 0)}%</span>
                          )}
                        </td>
                        <td className="p-3 flex justify-end gap-2">
                          {editingArticleId === article.id ? (
                            <>
                              <button type="button" onClick={() => handleUpdateArticle(article.id)} className="min-touch bg-tertiary/10 text-tertiary hover:bg-tertiary/20 rounded-lg transition-colors flex items-center justify-center"><Save className="w-4 h-4" /></button>
                              <button type="button" onClick={() => setEditingArticleId(null)} className="min-touch bg-surface-container-high text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors flex items-center justify-center"><X className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => handleStartEditArticle(article)} className="min-touch bg-surface-container text-on-surface-variant hover:text-on-surface rounded-lg transition-colors flex items-center justify-center"><Edit2 className="w-4 h-4" /></button>
                              <button type="button" onClick={() => handleDeleteArticle(article.id)} className="min-touch bg-error/5 text-error/70 hover:text-error hover:bg-error/10 rounded-lg transition-colors flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-6 md:p-10 shadow-sm border border-outline-variant/10 space-y-6">
          <h2 className="text-2xl font-extrabold font-headline text-on-surface">Facturation</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Régime de TVA</label>
              <select 
                value={formData.vatRegime}
                onChange={e => setFormData({...formData, vatRegime: e.target.value as any})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
              >
                <option value="standard">Standard (assujetti à la TVA)</option>
                <option value="franchise">Franchise en base de TVA (Auto-entrepreneur)</option>
                <option value="autoliquidation">Autoliquidation (Sous-traitance BTP)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Préfixe des factures</label>
              <input 
                type="text" 
                value={formData.invoicePrefix}
                onChange={e => setFormData({...formData, invoicePrefix: e.target.value})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium text-center md:text-left tracking-widest"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Délai par défaut (jours)</label>
              <input 
                type="number" 
                value={formData.defaultPaymentTerms}
                onChange={e => setFormData({...formData, defaultPaymentTerms: parseInt(e.target.value) || 0})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Devise par défaut</label>
              <select 
                value={formData.defaultCurrency}
                onChange={e => setFormData({...formData, defaultCurrency: e.target.value})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
              >
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar ($)</option>
                <option value="CHF">Franc Suisse (CHF)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">TVA par défaut (%)</label>
              <select 
                value={formData.defaultVat}
                onChange={e => setFormData({...formData, defaultVat: parseFloat(e.target.value) || 0})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
              >
                <option value="20">20%</option>
                <option value="10">10%</option>
                <option value="5.5">5.5%</option>
                <option value="0">0%</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse sm:flex-row items-center gap-4 pt-4">
          {saved && (
             <span className="animate-fade-in flex items-center gap-2 text-tertiary font-bold text-sm bg-tertiary-container px-4 py-2 rounded-xl">
               <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
               Paramètres sauvegardés
             </span>
          )}
          <button 
            type="submit" 
            disabled={isSaving}
            className="btn-glow sm:ml-auto w-full sm:w-auto bg-primary text-on-primary px-10 py-4 rounded-xl font-bold text-base shadow-spark-cta hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:transform-none"
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
