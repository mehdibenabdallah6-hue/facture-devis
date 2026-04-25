import React, { useState, useEffect, useRef } from 'react';
import { useData, Invoice, InvoiceItem } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import PaddlePaywall from '../components/PaddlePaywall';
import CameraGuide from '../components/CameraGuide';
import LegalInfoModal from '../components/LegalInfoModal';

// Rest of imports...
import { PlusCircle, Trash2, ZoomIn, Printer, Send, Download, Camera, UploadCloud, Loader2, Image as ImageIcon, Sparkles, FileText, AlertCircle, Mic, MicOff, CheckCircle2, ArrowRight, ArrowLeft, Share2, Check, UserPlus, X, WifiOff, ImagePlus, Calculator, RefreshCw, Mail, CloudUpload, Shield, FileSpreadsheet, Plus } from 'lucide-react';
import { usePlan } from '../hooks/usePlan';
import { compressImageToDataURL } from '../services/imageUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { extractInvoiceData, extractDataFromText, extractFromDocument } from '../services/ai';
import { generateFacturXPDF, generateFacturXXML } from '../services/facturx';
import * as XLSX from 'xlsx';
import PDFPreview from '../components/PDFPreview';

/**
 * Returns the most frequently used items from previous invoices for a specific client.
 * Useful for suggesting the same services the artisan usually provides to this client.
 */
const getClientHistorySuggestions = (clientId: string, allInvoices: Invoice[]): InvoiceItem[] => {
  if (!clientId || !allInvoices) return [];

  const clientInvoices = allInvoices.filter(inv => inv.clientId === clientId && inv.items?.length > 0);
  if (clientInvoices.length === 0) return [];

  // Aggregate items by description and count frequency
  const itemMap = new Map<string, { item: InvoiceItem; count: number }>();

  clientInvoices.forEach(inv => {
    inv.items.forEach(item => {
      const key = item.description.toLowerCase().trim();
      const existing = itemMap.get(key);
      if (existing) {
        existing.count++;
        // Keep the most recent price
        existing.item = item;
      } else {
        itemMap.set(key, { item, count: 1 });
      }
    });
  });

  // Sort by frequency and return top 5
  return Array.from(itemMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(entry => entry.item);
};

const getSuggestions = (profession: string) => {
  const p = profession.toLowerCase();
  if (p.includes('plombier')) {
    return [
      { description: "Débouchage canalisation manuel", price: 120 },
      { description: "Remplacement robinet évier", price: 150 },
      { description: "Fourniture et pose chauffe-eau 200L", price: 850 },
      { description: "Recherche et réparation de fuite", price: 180 },
      { description: "Pose radiateur eau chaude", price: 250 },
      { description: "Remplacement mécanisme chasse d'eau", price: 130 },
      { description: "Installation salle de bain complète", price: 3500 },
      { description: "Pose receveur de douche", price: 400 },
      { description: "Installation WC suspendu", price: 650 },
      { description: "Détartrage tuyauterie", price: 200 }
    ];
  } else if (p.includes('électricien') || p.includes('electricien')) {
    return [
      { description: "Recherche de panne tableau", price: 120 },
      { description: "Pose prise de courant 16A", price: 85 },
      { description: "Remplacement tableau électrique complet", price: 1200 },
      { description: "Installation spot LED encastré", price: 60 },
      { description: "Mise aux normes (forfait habitation)", price: 2500 },
      { description: "Installation borne de recharge VE", price: 1100 },
      { description: "Pose radiateur électrique inertie", price: 350 },
      { description: "Pose VMC simple flux", price: 450 },
      { description: "Tirage de ligne spécialisée", price: 150 },
      { description: "Remplacement disjoncteur différentiel", price: 160 }
    ];
  } else if (p.includes('maçon') || p.includes('macon')) {
    return [
      { description: "Coulage dalle béton (m²)", price: 80 },
      { description: "Montage mur parpaings (m²)", price: 120 },
      { description: "Ouverture mur porteur avec IPN", price: 2800 },
      { description: "Création chape liquide (m²)", price: 45 },
      { description: "Rebouchage fissures et enduit", price: 350 },
      { description: "Démolition mur non porteur (ml)", price: 150 },
      { description: "Fondations superficielles (ml)", price: 180 },
      { description: "Pose de clôture rigide (ml)", price: 45 },
      { description: "Ravalement de façade (m²)", price: 65 },
      { description: "Création escalier béton", price: 1500 }
    ];
  } else if (p.includes('peintre')) {
    return [
      { description: "Peinture murs blanc mat (m²)", price: 25 },
      { description: "Préparation support complet (m²)", price: 18 },
      { description: "Pose papier peint intissé (m²)", price: 22 },
      { description: "Peinture boiseries (portes/fenêtres)", price: 60 },
      { description: "Lessivage murs (m²)", price: 12 },
      { description: "Enduit de lissage 2 passes (m²)", price: 28 },
      { description: "Peinture plafond finition sans trace (m²)", price: 30 },
      { description: "Peinture radiateur fonte", price: 90 },
      { description: "Vernissage escalier bois", price: 450 },
      { description: "Pose de toile de verre (m²)", price: 20 }
    ];
  } else if (p.includes('carreleur')) {
    return [
      { description: "Pose carrelage sol classique (m²)", price: 45 },
      { description: "Pose faïence murale (m²)", price: 55 },
      { description: "Préparation sol (ragréage) (m²)", price: 22 },
      { description: "Réalisation joints époxy (m²)", price: 18 },
      { description: "Pose plinthes carrelage (ml)", price: 12 },
      { description: "Pose carrelage grand format (m²)", price: 60 },
      { description: "Création douche à l'italienne", price: 1200 },
      { description: "Dépose ancien carrelage (m²)", price: 25 },
      { description: "Pose mosaïque (m²)", price: 80 },
      { description: "Chape traditionnelle (m²)", price: 40 }
    ];
  } else if (p.includes('couvreur')) {
    return [
      { description: "Remplacement tuiles cassées (m²)", price: 90 },
      { description: "Nettoyage toiture et démoussage (m²)", price: 35 },
      { description: "Pose gouttière zinc (ml)", price: 55 },
      { description: "Pose gouttière PVC (ml)", price: 35 },
      { description: "Traitement hydrofuge toiture (m²)", price: 28 },
      { description: "Réparation faîtage au mortier", price: 250 },
      { description: "Pose fenêtre de toit (Velux)", price: 850 },
      { description: "Réfection zinguerie cheminée", price: 450 },
      { description: "Isolation combles perdus (m²)", price: 45 },
      { description: "Recherche de fuite toiture", price: 180 }
    ];
  } else if (p.includes('menuisier')) {
    return [
      { description: "Pose fenêtre PVC double vitrage", price: 350 },
      { description: "Installation porte d'entrée aluminium", price: 600 },
      { description: "Pose volet roulant électrique", price: 320 },
      { description: "Création dressing sur mesure", price: 1500 },
      { description: "Pose parquet flottant (m²)", price: 35 },
      { description: "Pose parquet massif (m²)", price: 65 },
      { description: "Pose bloc-porte intérieur", price: 180 },
      { description: "Installation verrière atelier", price: 850 },
      { description: "Fabrication meuble TV sur mesure", price: 900 },
      { description: "Pose terrasse bois exotique (m²)", price: 120 }
    ];
  } else if (p.includes('serrurier')) {
    return [
      { description: "Ouverture de porte simple (journée)", price: 120 },
      { description: "Ouverture de porte blindée", price: 220 },
      { description: "Changement cylindre européen haute sécurité", price: 250 },
      { description: "Installation serrure 3 points A2P*", price: 480 },
      { description: "Blindage de porte existante", price: 1400 },
      { description: "Majoration nuit/week-end", price: 100 },
      { description: "Reproduction de clé brevetée", price: 80 },
      { description: "Pose verrou de sécurité", price: 130 },
      { description: "Remplacement garniture de porte", price: 150 },
      { description: "Déblocage rideau métallique", price: 350 }
    ];
  } else if (p.includes('plaquiste')) {
    return [
      { description: "Pose cloison placoplâtre BA13 (m²)", price: 45 },
      { description: "Création faux plafond suspendu (m²)", price: 55 },
      { description: "Doublage thermique murs (m²)", price: 60 },
      { description: "Traitement bandes à joints (ml)", price: 8 },
      { description: "Pose isolant phonique (m²)", price: 25 },
      { description: "Habillage de combles (forfait)", price: 2800 },
      { description: "Rattrapage enduit défectueux (m²)", price: 22 },
      { description: "Dépose cloisons existantes (m²)", price: 15 },
      { description: "Pose placo hydrofuge sdb (m²)", price: 50 },
      { description: "Création caisson cache-tuyaux", price: 180 }
    ];
  } else if (p.includes('chauffagiste') || p.includes('climaticien')) {
    return [
      { description: "Entretien annuel chaudière gaz", price: 140 },
      { description: "Contrat entretien Pompe à Chaleur", price: 220 },
      { description: "Installation chaudière condensation", price: 3500 },
      { description: "Pose Pompe à Chaleur Air/Eau", price: 8500 },
      { description: "Désembouage réseau radiateurs (unité)", price: 80 },
      { description: "Remplacement vase d'expansion", price: 250 },
      { description: "Installation thermostat connecté", price: 320 },
      { description: "Dépannage urgence chauffage", price: 150 },
      { description: "Installation split climatisation", price: 1200 },
      { description: "Recharge gaz frigorigène", price: 280 }
    ];
  } else if (p.includes('paysagiste')) {
    return [
      { description: "Tonte pelouse (forfait au m²)", price: 1 },
      { description: "Taille de haies (ml)", price: 15 },
      { description: "Élagage doux arbre < 10m", price: 250 },
      { description: "Débroussaillage terrain (m²)", price: 2 },
      { description: "Création de massif végétal", price: 450 },
      { description: "Pose gazon en rouleau (m²)", price: 28 },
      { description: "Plantation arbre gros sujet", price: 350 },
      { description: "Évacuation des déchets verts (m³)", price: 45 },
      { description: "Pose clôture panneau rigide (ml)", price: 65 },
      { description: "Engazonnement par semis (m²)", price: 8 }
    ];
  }
  return [];
};

// Signature share button component for quotes
function SignatureShareButton({ invoiceId, shareQuoteForSignature }: { invoiceId: string; shareQuoteForSignature: (id: string) => Promise<string> }) {
  const [isSharing, setIsSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const url = await shareQuoteForSignature(invoiceId);
      setShareUrl(url);
      
      const text = encodeURIComponent(`Bonjour, voici le devis pour le chantier.\nVous pouvez le consulter et le signer directement en ligne en cliquant ici :\n${url}`);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const waUrl = isMobile ? `whatsapp://send?text=${text}` : `https://web.whatsapp.com/send?text=${text}`;
      
      window.open(waUrl, '_blank');
      
      await navigator.clipboard.writeText(url);
      setShared(true);

      setTimeout(() => setShared(false), 5000);
    } catch (err) {
      console.error('Error sharing:', err);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleShare}
        disabled={isSharing}
        className={`w-full min-touch flex items-center justify-center gap-2 md:gap-3 px-4 md:px-6 py-3.5 md:py-5 rounded-2xl font-bold text-sm md:text-lg transition-all active:scale-95 disabled:opacity-50 ${
          shared
            ? 'bg-tertiary-container text-tertiary border-2 border-tertiary/20'
            : 'bg-gradient-to-r from-primary/90 to-secondary text-on-primary shadow-lg shadow-secondary/20 hover:shadow-xl hover:-translate-y-0.5'
        }`}
      >
        {isSharing ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Génération du lien...
          </>
        ) : shared ? (
          <>
            <Check className="w-5 h-5" />
            Lien copié ! Envoyez-le au client
          </>
        ) : (
          <>
            <Share2 className="w-5 h-5" />
            ✍️ Envoyer pour signature
          </>
        )}
      </button>
      {shareUrl && shared && (
        <p className="text-xs text-center text-on-surface-variant bg-surface-container-low/50 rounded-xl px-4 py-2.5 truncate">
          🔗 {shareUrl}
        </p>
      )}
    </div>
  );
}

export default function InvoiceCreate() {
  const { id } = useParams();
  const { company, clients, invoices, articles, addInvoice, updateInvoice, shareQuoteForSignature, addClient, incrementAiUsage } = useData();
  const { success, error: showError, info, warning } = useToast();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(window.location.search);
  const fromQuoteId = searchParams.get('fromQuote');
  const typeParam = searchParams.get('type') as 'invoice' | 'quote' | null;
  const clientIdParam = searchParams.get('clientId');

  const [step, setStep] = useState<'upload' | 'analyzing' | 'edit' | 'paywall' | 'activation_pending'>(id || fromQuoteId ? 'edit' : 'upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isPro, isFree, plan, checkInvoiceLimit, checkAiLimit, limits, hasPaidAccess, isPendingActivation } = usePlan();
  const [showUpsellModal, setShowUpsellModal] = useState<string | null>(null);
  const [showCameraGuide, setShowCameraGuide] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const [isOffline, setIsOffline] = useState(!window.navigator.onLine);
  const [showLegalModal, setShowLegalModal] = useState(false);

  // Check if legal info is complete
  const hasLegalInfo = company?.siret && company.siret.replace(/\s/g, '').length === 14 && company?.address;

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSubmittingChorus, setIsSubmittingChorus] = useState(false);
  const [chorusResult, setChorusResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientType, setNewClientType] = useState<'B2C' | 'B2B'>('B2C');
  const recognitionRef = useRef<any>(null);
  const [dictationText, setDictationText] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [isNumberEditable, setIsNumberEditable] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const [activeCalculatorIndex, setActiveCalculatorIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState<Partial<Invoice>>({
    type: typeParam || 'invoice',
    clientId: '',
    clientName: '',
    number: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    serviceDate: '',
    status: 'draft',
    vatRegime: company?.vatRegime || 'standard',
    items: [{ description: '', quantity: 1, unitPrice: 0, vatRate: company?.defaultVat || 20 }],
    notes: '',
    paymentMethod: ''
  });

  // Click outside to close client dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClientSelect = (client: any) => {
    setFormData(prev => ({ ...prev, clientId: client.id, clientName: client.name }));
    setClientSearch(client.name);
    setShowClientDropdown(false);
  };

  const handleClientSearchChange = (value: string) => {
    setClientSearch(value);
    setShowClientDropdown(true);
    const matches = clients.filter(c => c.name.toLowerCase().includes(value.toLowerCase()));
    if (matches.length === 0 && value.trim()) {
      setFormData(prev => ({ ...prev, clientName: value.trim(), clientId: '' }));
    } else if (matches.length === 1 && value.toLowerCase() === matches[0].name.toLowerCase()) {
      handleClientSelect(matches[0]);
    }
  };

  const filteredClients = clientSearch.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : clients.slice(0, 10);

  // Sync clientSearch when formData.clientName changes from external sources (AI extraction)
  useEffect(() => {
    if (formData.clientName && !clientSearch) {
      setClientSearch(formData.clientName);
    }
  }, [formData.clientName]);

  // Auto-select client from URL param
  useEffect(() => {
    if (clientIdParam && !formData.clientId) {
      const client = clients.find(c => c.id === clientIdParam);
      if (client) {
        setFormData(prev => ({ ...prev, clientId: client.id, clientName: client.name }));
        setClientSearch(client.name);
      }
    }
  }, [clientIdParam]);

  const handleQuickAddClient = async () => {
    if (!formData.clientName) return;
    setIsAddingClient(true);
    try {
      const newClientId = await addClient({
        name: formData.clientName,
        type: 'B2C',
      });
      setFormData(prev => ({ ...prev, clientId: newClientId }));
    } catch (err) {
      console.error('Error adding client:', err);
      showError("Erreur client", "Impossible de créer le client automatiquement.");
    } finally {
      setIsAddingClient(false);
    }
  };

  const handleInlineAddClient = async () => {
    if (!newClientName.trim()) return;
    setIsAddingClient(true);
    try {
      const newClientId = await addClient({
        name: newClientName.trim(),
        type: newClientType,
        email: newClientEmail.trim() || undefined,
        phone: newClientPhone.trim() || undefined,
        address: newClientAddress.trim() || undefined,
      });
      setFormData(prev => ({ ...prev, clientId: newClientId, clientName: newClientName.trim() }));
      setShowNewClientModal(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      setNewClientAddress('');
    } catch (err) {
      console.error('Error adding client:', err);
      showError("Erreur client", "Impossible de créer le client.");
    } finally {
      setIsAddingClient(false);
    }
  };

  /**
   * Gate every AI-powered action (photo extraction, document import, voice
   * dictation) through the same monthly counter:
   *   - Free  : 5 / month   (PLAN_LIMITS.free.monthlyAiUsageLimit)
   *   - Solo  : 50 / month  (PLAN_LIMITS.starter.monthlyAiUsageLimit)
   *   - Pro   : unlimited
   * Returns true if the user can proceed; otherwise pops the upsell modal
   * with a plan-specific message and returns false.
   */
  const tryUseAi = (): boolean => {
    if (checkAiLimit()) return true;
    const cap = limits.monthlyAiUsageLimit;
    if (isFree) {
      setShowUpsellModal(
        `Vous avez atteint la limite de ${cap} utilisations IA / mois du plan Gratuit. Passez au plan Solo pour 50 utilisations / mois.`
      );
    } else {
      setShowUpsellModal(
        `Vous avez atteint la limite de ${cap} utilisations IA / mois du plan Solo. Passez au plan Pro pour un usage illimité.`
      );
    }
    return false;
  };

  const handleDictation = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const text = prompt("Votre navigateur ne gère pas la dictée. Tapez votre texte :");
      if (text) {
        processDictation(text);
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let fullTranscript = '';

    recognition.onstart = () => {
      setIsDictating(true);
      setDictationText('');
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      fullTranscript = final;
      setDictationText(final + interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError("Erreur de dictée: " + event.error + ". Essayez sur Chrome/Safari.");
      }
    };

    recognition.onend = () => {
      setIsDictating(false);
      if (fullTranscript.trim()) {
        processDictation(fullTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const getCatalogContext = () => {
    if (!articles || articles.length === 0) return undefined;
    const topArticles = articles.slice(0, 200);
    return topArticles.map(a => `[Nom: ${a.description}, Prix: ${a.unitPrice}€, TVA: ${a.vatRate}%]`).join(' | ');
  };

  const processDictation = async (text: string) => {
    try {
      setStep('analyzing');
      const data = await extractDataFromText(text, getCatalogContext());
      if (data) {
        setFormData(prev => ({
          ...prev,
          clientName: data.clientName || prev.clientName,
          clientAddress: data.clientAddress || prev.clientAddress,
          items: data.items && data.items.length > 0 ? data.items : prev.items,
          notes: data.notes || prev.notes,
        }));
        incrementAiUsage();
        if (!hasPaidAccess) {
          setStep('paywall');
        } else {
          setStep('edit');
        }
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || String(err);
      const errorMsg = msg.includes('API key') 
        ? "Erreur de configuration serveur. Contactez le support."
        : msg.includes('network') 
          ? "Erreur réseau. Vérifiez votre connexion."
          : "L'IA n'a pas pu traiter votre dictée. Veuillez formuler plus clairement ou saisir manuellement.";
      setError(errorMsg);
      setStep('upload');
    }
  };

  const generateNumber = (type: 'invoice' | 'quote') => {
    const currentYear = new Date().getFullYear();
    const typeInvoices = invoices.filter(inv => inv.type === type && new Date(inv.date).getFullYear() === currentYear);
    let maxNumber = 0;
    typeInvoices.forEach(inv => {
      const parts = inv.number.split('-');
      if (parts.length >= 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    const nextNumber = maxNumber + 1;
    const prefix = type === 'quote' ? 'D' : (company?.invoicePrefix || 'F');
    return `${prefix}-${currentYear}-${nextNumber.toString().padStart(3, '0')}`;
  };

  useEffect(() => {
    if (id) {
      const invoice = invoices.find(inv => inv.id === id);
      if (invoice) {
        setFormData(invoice);
        setStep('edit');
      }
    } else if (fromQuoteId) {
      const quote = invoices.find(inv => inv.id === fromQuoteId);
      if (quote) {
        const { id: _, createdAt: __, updatedAt: ___, ownerId: ____, ...cleanQuote } = quote as any;
        setFormData({
          ...cleanQuote,
          type: 'invoice',
          status: 'draft',
          number: generateNumber('invoice'),
          date: format(new Date(), 'yyyy-MM-dd'),
          dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        });
        setStep('edit');
      }
    } else if (step === 'upload') {
      setFormData(prev => ({ ...prev, number: generateNumber(prev.type || 'invoice') }));
    }
  }, [id, fromQuoteId, invoices, company, step]);

  useEffect(() => {
    if (!id && !fromQuoteId && step === 'edit') {
      setFormData(prev => ({ ...prev, number: generateNumber(prev.type || 'invoice') }));
    }
  }, [formData.type]);

  const handlePhotoChantier = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) return;
    if (!isPro) {
      navigate('/app/upgrade');
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const dataUrl = await compressImageToDataURL(file, 1280, 0.7);
        newPhotos.push(dataUrl);
      }
      setFormData(prev => ({
        ...prev,
        chantierPhotos: [...(prev.chantierPhotos || []), ...newPhotos].slice(0, 4)
      }));
    } catch (err) {
      console.error("Erreur ajout photo chantier:", err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const removeChantierPhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      chantierPhotos: (prev.chantierPhotos || []).filter((_, i) => i !== index)
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    setStep('analyzing');

    try {
      const base64Reader = new FileReader();
      base64Reader.onloadend = async () => {
        const base64Data = (base64Reader.result as string).split(',')[1];
        try {
          const extractedData = await extractInvoiceData(base64Data, file.type, getCatalogContext());
          
          setFormData(prev => {
            const newData = { ...prev };
            if (extractedData.date && /^\d{4}-\d{2}-\d{2}$/.test(extractedData.date)) {
              newData.date = extractedData.date;
            }
            if (extractedData.clientName) {
              newData.clientName = extractedData.clientName;
              const matchedClient = clients.find(c => c.name.toLowerCase().includes(extractedData.clientName.toLowerCase()));
              if (matchedClient) newData.clientId = matchedClient.id;
            }
            if (extractedData.items && extractedData.items.length > 0) {
              newData.items = extractedData.items.map((item: any) => ({
                description: item.description || '',
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || 0,
                vatRate: item.vatRate !== undefined ? item.vatRate : (company?.defaultVat || 20)
              }));
            }
            if (extractedData.notes) newData.notes = extractedData.notes;
            return newData;
          });

          incrementAiUsage();
          if (!hasPaidAccess) {
            setStep('paywall');
          } else {
            setStep('edit');
          }
        } catch (err: any) {
          console.error(err);
          const msg = err?.message || String(err);
          let errorMsg = "L'IA n'a pas réussi à lire ce document. Utilisez une image plus nette ou saisissez manuellement.";
          
          if (msg.includes('API key')) {
            errorMsg = "Erreur de configuration serveur. Contactez le support.";
          } else if (msg.includes('network') || msg.includes('fetch')) {
            errorMsg = "Erreur réseau. Vérifiez votre connexion.";
          } else if (msg.includes('not found') || msg.includes('model')) {
            errorMsg = `Erreur IA: Modèle introuvable ou indisponible. (${msg})`;
          } else if (msg.length < 100) {
            errorMsg = `Erreur: ${msg}`;
          }
          
          setError(errorMsg);
          setStep('upload');
        }
      };
      base64Reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setError("Erreur de format de l'image. Veuillez réessayer.");
      setStep('upload');
    }
  };

  // ---------- Document Upload (PDF / Excel) ----------
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const isPDF = file.type === 'application/pdf';
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      || file.type === 'application/vnd.ms-excel'
      || file.name.endsWith('.xlsx') 
      || file.name.endsWith('.xls') 
      || file.name.endsWith('.csv');

    if (!isPDF && !isExcel) {
      setError('Format non supporté. Envoyez un fichier PDF, Excel (.xlsx/.xls) ou CSV.');
      return;
    }

    // Set a placeholder preview for documents
    setPreviewUrl(null);
    setStep('analyzing');

    try {
      if (isPDF) {
        // PDF: read as base64 and send to Gemini
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          try {
            const extractedData = await extractFromDocument(base64Data, 'application/pdf', undefined, getCatalogContext());
            applyExtractedData(extractedData);
          } catch (err: any) {
            handleExtractionError(err);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // Excel/CSV: parse with SheetJS, convert to text, send to Gemini
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const data = new Uint8Array(reader.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Convert all sheets to text
            let textContent = '';
            workbook.SheetNames.forEach(sheetName => {
              const sheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ' | ', RS: '\n' });
              
              const cleanCsv = csv
                .split('\n')
                .filter(line => line.replace(/\|/g, '').trim().length > 0)
                .join('\n');
                
              if (cleanCsv) {
                textContent += `--- Feuille: ${sheetName} ---\n${cleanCsv}\n\n`;
              }
            });

            if (!textContent.trim()) {
              throw new Error('Le fichier Excel est vide.');
            }

            // Truncate to avoid overloading the AI and causing 503 errors
            const truncatedText = textContent.slice(0, 10000);

            const extractedData = await extractFromDocument(null, file.type, truncatedText, getCatalogContext());
            applyExtractedData(extractedData);
          } catch (err: any) {
            handleExtractionError(err);
          }
        };
        reader.readAsArrayBuffer(file);
      }
    } catch (err: any) {
      handleExtractionError(err);
    }

    // Reset input so the same file can be re-uploaded
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const applyExtractedData = (extractedData: any) => {
    incrementAiUsage();
    setFormData(prev => {
      const newData = { ...prev };
      if (extractedData.date && /^\d{4}-\d{2}-\d{2}$/.test(extractedData.date)) {
        newData.date = extractedData.date;
      }
      if (extractedData.clientName) {
        newData.clientName = extractedData.clientName;
        const matchedClient = clients.find(c => c.name.toLowerCase().includes(extractedData.clientName.toLowerCase()));
        if (matchedClient) newData.clientId = matchedClient.id;
      }
      if (extractedData.items && extractedData.items.length > 0) {
        newData.items = extractedData.items.map((item: any) => ({
          description: item.description || '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          vatRate: item.vatRate !== undefined ? item.vatRate : (company?.defaultVat || 20)
        }));
      }
      if (extractedData.notes) newData.notes = extractedData.notes;
      return newData;
    });
    if (!hasPaidAccess) {
      setStep('paywall');
    } else {
      setStep('edit');
    }
  };

  useEffect(() => {
    if (hasPaidAccess && (step === 'paywall' || step === 'activation_pending')) {
      setStep('edit');
    }
  }, [hasPaidAccess, step]);

  const handleExtractionError = (err: any) => {
    console.error(err);
    const msg = err?.message || String(err);
    let errorMsg = "L'IA n'a pas réussi à lire ce document. Vérifiez le fichier ou saisissez manuellement.";
    if (msg.includes('abort') || msg.includes('timeout')) {
      errorMsg = "L'analyse a pris trop de temps. Réessayez avec une image plus légère (< 5Mo) ou saisissez manuellement.";
    } else if (msg.includes('API key')) {
      errorMsg = "Erreur de configuration serveur. Contactez le support.";
    } else if (msg.includes('network') || msg.includes('fetch')) {
      errorMsg = "Pas de connexion internet. Vérifiez votre réseau ou saisissez manuellement.";
    } else if (msg.includes('not found') || msg.includes('model')) {
      errorMsg = "Service IA temporairement indisponible. Réessayez dans quelques minutes.";
    } else if (msg.includes('No data extracted')) {
      errorMsg = "L'IA n'a rien pu extraire de ce document. Essayez une photo plus nette, ou saisissez manuellement.";
    } else if (msg.length < 100) {
      errorMsg = `Erreur: ${msg}`;
    }
    setError(errorMsg);
    showError('Extraction IA échouée', errorMsg);
    setStep('upload');
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...(formData.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const addItem = (description = '', unitPrice = 0, vatRate?: number) => {
    setFormData({
      ...formData,
      items: [...(formData.items || []), { description, quantity: 1, unitPrice, vatRate: vatRate ?? company?.defaultVat ?? 20 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...(formData.items || [])];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotals = () => {
    let totalHT = 0;
    let totalVAT = 0;
    (formData.items || []).forEach(item => {
      const lineHT = item.quantity * item.unitPrice;
      let lineVAT = 0;
      if (formData.vatRegime === 'standard') {
        lineVAT = lineHT * (item.vatRate / 100);
      }
      totalHT += lineHT;
      totalVAT += lineVAT;
    });
    return { totalHT, totalVAT, totalTTC: totalHT + totalVAT };
  };

  const { totalHT, totalVAT, totalTTC } = calculateTotals();

  const handleSave = async (status: Invoice['status'] = 'draft') => {
    // Check plan invoice limit for new invoices
    if (!id && !checkInvoiceLimit()) {
      setShowUpsellModal('Vous avez atteint la limite de ' + limits.monthlyInvoiceLimit + ' documents/mois du plan Gratuit.');
      return;
    }
    // Require legal info before saving
    if (!hasLegalInfo) {
      setShowLegalModal(true);
      return;
    }
    if (!formData.clientId && !formData.clientName) {
      showError('Client manquant', 'Veuillez sélectionner ou saisir un client');
      return;
    }
    if (!formData.items || formData.items.length === 0 || !formData.items[0].description) {
      showError('Prestations manquantes', 'Veuillez ajouter au moins une ligne de facturation valide');
      return;
    }

    setIsSaving(true);
    try {
      const client = clients.find(c => c.id === formData.clientId);
      
      const cleanFormData = { ...formData } as any;
      delete cleanFormData.id;
      delete cleanFormData.ownerId;
      delete cleanFormData.createdAt;
      delete cleanFormData.updatedAt;

      const invoiceData = {
        ...cleanFormData,
        clientName: client?.name || cleanFormData.clientName || '',
        totalHT,
        totalVAT,
        totalTTC,
        status
      } as Omit<Invoice, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;

      if (id) {
        await updateInvoice(id, invoiceData);
        success('Document mis à jour ✓', 'Vos modifications ont été enregistrées.');
      } else {
        const newInvoiceId = await addInvoice(invoiceData);
        if (fromQuoteId) {
          try {
            await updateInvoice(fromQuoteId, { status: 'converted' });
          } catch (e) {
            console.error("Failed to update quote status: ", e);
          }
        }
        // Navigate to the newly created invoice so Factur-X / Chorus Pro buttons appear
        navigate(`/app/invoices/${newInvoiceId}`, { replace: true });
        success('Facture créée ✓', 'Vous pouvez maintenant la télécharger au format Factur-X.');
      }
      // Only redirect to list if we updated an existing invoice (new ones redirect to their own page above)
      if (id) {
        navigate('/app/invoices');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendEmail = async () => {
    const client = clients.find(c => c.id === formData.clientId);
    const email = client?.email || '';
    
    if (!email) {
      showError('Email manquant', "Le client n'a pas d'adresse e-mail renseignée.");
      return;
    }

    setIsSendingEmail(true);
    try {
      // 1. Generate PDF in memory
      let doc;
      try {
        doc = generatePDF(false);
      } catch (pdfErr: any) {
        console.error('PDF generation error:', pdfErr);
        showError('Erreur PDF', 'Impossible de générer le PDF. Vérifiez vos images/papier en-tête.');
        setIsSendingEmail(false);
        return;
      }
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const docName = formData.type === 'quote' ? 'Devis' : 'Facture';

      // 2. Call our Resend API
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `${docName} ${formData.number} - ${company?.name || 'Photofacto'}`,
          html: `
            <p>Bonjour,</p>
            <p>Veuillez trouver ci-joint votre <strong>${docName.toLowerCase()} ${formData.number}</strong>.</p>
            <p>Vous pouvez également le consulter, le télécharger et le signer en ligne en cliquant sur le lien ci-dessous :</p>
            <p><a href="${window.location.origin}/s/${id || ''}" style="display:inline-block;background:#0d9488;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Voir mon document en ligne</a></p>
            <p>Cordialement,<br/><strong>${company?.name || 'Photofacto'}</strong></p>
          `,
          attachments: [
            {
              filename: `${docName}_${formData.number}.pdf`,
              content: pdfBase64
            }
          ]
        })
      });

      if (!response.ok) throw new Error("Erreur lors de l'envoi");

      success('Email envoyé !', 'Le document a été envoyé avec succès au client.');
      await handleSave('sent');
    } catch (error) {
      console.error(error);
      warning('Envoi alternatif', "L'envoi automatique a échoué. Ouverture de votre logiciel de messagerie...");
      
      const docName = formData.type === 'quote' ? 'Devis' : 'Facture';
      const subject = encodeURIComponent(`${docName} ${formData.number} de ${company?.name || 'Mon Entreprise'}`);
      const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint ${formData.type === 'quote' ? 'le devis' : 'la facture'} ${formData.number}.\n\n⚠️ N'oubliez pas de joindre le PDF !\n\nCordialement,\n${company?.name || 'Mon Entreprise'}`);
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    } finally {
      setIsSendingEmail(false);
    }
  };

  // ---------- Chorus Pro Submission ----------
  const handleChorusSubmit = async () => {
    if (!id) {
      showError('Facture non enregistrée', 'Veuillez d\'abord enregistrer la facture.');
      return;
    }
    if (formData.chorusStatus === 'submitted') {
      warning('Déjà soumis', 'Cette facture a déjà été déposée sur Chorus Pro.');
      return;
    }

    const client = clients.find(c => c.id === formData.clientId);

    setIsSubmittingChorus(true);
    setChorusResult(null);
    try {
      const response = await fetch('/api/chorus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice: {
            ...formData,
            clientSiren: client?.siren,
            clientVatNumber: client?.vatNumber,
            clientAddress: client?.address,
          },
          company,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Erreur inconnue');
      }

      // Update invoice with Chorus status
      await updateInvoice(id, {
        chorusStatus: 'submitted',
        chorusFluxId: data.identifiantFlux,
        chorusSubmittedAt: new Date().toISOString(),
      });

      setFormData(prev => ({
        ...prev,
        chorusStatus: 'submitted',
        chorusFluxId: data.identifiantFlux,
        chorusSubmittedAt: new Date().toISOString(),
      }));

      setChorusResult({ status: 'success', message: `Déposé avec succès ! Flux n°${data.identifiantFlux}` });
    } catch (error: any) {
      console.error('[Chorus Pro]', error);
      setChorusResult({ status: 'error', message: error.message });

      if (id) {
        await updateInvoice(id, {
          chorusStatus: 'error',
          chorusError: error.message,
        });
      }
    } finally {
      setIsSubmittingChorus(false);
    }
  };

  // ---------- Factur-X Download ----------
  const handleFacturXDownload = async () => {
    try {
      const doc = generatePDF(false);
      const client = clients.find(c => c.id === formData.clientId);
      const facturxPdf = await generateFacturXPDF(doc, {
        invoice: formData as Invoice,
        company: company!,
        client: client,
        profile: 'BASIC',
      });

      // Download the Factur-X PDF
      const blob = new Blob([facturxPdf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `FacturX_${formData.number}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Factur-X generation error:', err);
      showError('Erreur Factur-X', 'Le PDF standard a été téléchargé à la place.');
      generatePDF(true);
    }
  };

  const generatePDF = (shouldSave = true) => {
    const doc = new jsPDF();
    const client = clients.find(c => c.id === formData.clientId);
    
    // Insert Letterhead background if present
    if (company?.letterheadUrl) {
      try {
        doc.addImage(company.letterheadUrl, 'JPEG', 0, 0, 210, 297);
      } catch (err) {
        console.error("Erreur ajout papier en-tête:", err);
      }
    }

    let yPos = 30;

    // Draw dark header background ONLY if there's no letterhead
    if (!company?.letterheadUrl) {
      try {
        doc.setFillColor(31, 41, 55); // Slate 800
        doc.rect(0, 0, 210, 45, 'F');
      } catch (e) {
        console.error("Header rendering error:", e);
      }
    }
    
    // Draw Company Info (Top Left)
    if (!company?.hideCompanyInfo) {
      if (!company?.letterheadUrl) {
        // Light text if dark header
        doc.setTextColor(255, 255, 255);
        if (company?.logoUrl) {
          try {
            doc.addImage(company.logoUrl, 'PNG', 14, 12, 20, 20); // Keep size reasonable
          } catch (logoError) {
            console.error("Erreur d'ajout du logo:", logoError);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text(company?.name || 'Facture', 14, 25);
          }
        } else {
          doc.setFontSize(24);
          doc.setFont('helvetica', 'bold');
          doc.text(company?.name || 'Mon Entreprise', 14, 25);
        }
      } else {
        // Dark text if letterhead
        doc.setTextColor(28, 25, 23);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(company?.name || 'Mon Entreprise', 14, 25);
      }

      doc.setFontSize(10);
      doc.setTextColor(company?.letterheadUrl ? 100 : 200); // Lighter text for dark bg
      
      if (company?.address) {
        const addressLines = doc.splitTextToSize(company.address, 80);
        doc.text(addressLines, 14, yPos);
        yPos += addressLines.length * 5;
      }
      
      if (company?.siret) { doc.text(`SIRET: ${company.siret}`, 14, yPos); yPos += 5; }
      if (company?.vatNumber) { doc.text(`TVA: ${company.vatNumber}`, 14, yPos); yPos += 5; }
      if (company?.legalForm) { doc.text(`${company.legalForm}${company.capital ? ` au cap. de ${company.capital}€` : ''}`, 14, yPos); yPos += 5; }
    } else {
      // If hidden, just push yPos down for subsequent elements so they don't overlap the top area
      yPos = 45;
    }
    
    // Draw Document Title & Number (Top Right)
    try {
      const title = formData.type === 'quote' ? 'DEVIS' : formData.type === 'deposit' ? 'ACOMPTE' : formData.type === 'credit' ? 'AVOIR' : 'FACTURE';
      // Use dark text if letterhead, otherwise white text for dark header
      doc.setTextColor(company?.letterheadUrl ? 28 : 255, company?.letterheadUrl ? 25 : 255, company?.letterheadUrl ? 23 : 255);
      doc.setFontSize(20);
      doc.text(title, 140, 22);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`N° ${formData.number}`, 140, 30);
      doc.setFont('helvetica', 'normal');
    } catch (e) {
      console.error("Title rendering error:", e);
    }

    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text('Client:', 140, 48);
    
    doc.setFontSize(11);
    doc.setTextColor(28, 25, 23);
    doc.setFont('helvetica', 'bold');
    doc.text(client?.name || formData.clientName || '', 140, 54);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    
    let clientYPos = 60;
    if (client?.address) {
      const clientAddressLines = doc.splitTextToSize(client.address, 60);
      doc.text(clientAddressLines, 140, clientYPos);
      clientYPos += clientAddressLines.length * 5;
    }
    
    if (client?.type === 'B2B' && client?.siren) {
      doc.text(`SIREN: ${client.siren}`, 140, clientYPos);
      clientYPos += 5;
    }
    if (client?.type === 'B2B' && client?.vatNumber) {
      doc.text(`TVA: ${client.vatNumber}`, 140, clientYPos);
      clientYPos += 5;
    }

    const dateYPos = Math.max(yPos, clientYPos) + 12;
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Date d'émission: ${format(new Date(formData.date || Date.now()), 'dd/MM/yyyy')}`, 14, dateYPos);
    let nextDateYPos = dateYPos + 6;
    if (formData.serviceDate) {
      doc.text(`Date de prestation: ${format(new Date(formData.serviceDate), 'dd/MM/yyyy')}`, 14, nextDateYPos);
      nextDateYPos += 6;
    }
    if (formData.type !== 'quote') {
      doc.text(`Échéance: ${format(new Date(formData.dueDate || Date.now()), 'dd/MM/yyyy')}`, 14, nextDateYPos);
    }

    const tableColumn = formData.vatRegime === 'standard' 
      ? ["Désignation", "Qté", "PU HT", "TVA", "Total HT"]
      : ["Désignation", "Qté", "PU HT", "Total HT"];
      
    const tableRows = (formData.items || []).map(item => {
      const row = [
        item.description,
        item.quantity.toString(),
        `${item.unitPrice.toFixed(2)} €`
      ];
      if (formData.vatRegime === 'standard') {
        row.push(`${item.vatRate}%`);
      }
      row.push(`${(item.quantity * item.unitPrice).toFixed(2)} €`);
      return row;
    });

    autoTable(doc, {
      startY: nextDateYPos + 10,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 244], textColor: [28, 25, 23], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
      styles: { fontSize: 9, cellPadding: 6, textColor: [60, 60, 60], lineColor: [231, 229, 228] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Total HT:', 140, finalY + 12);
    doc.setTextColor(28, 25, 23);
    doc.text(`${totalHT.toFixed(2)} €`, 196, finalY + 12, { align: 'right' });

    if (formData.vatRegime === 'standard') {
      doc.setTextColor(100);
      doc.text('TVA:', 140, finalY + 19);
      doc.setTextColor(28, 25, 23);
      doc.text(`${totalVAT.toFixed(2)} €`, 196, finalY + 19, { align: 'right' });
    }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('NET À PAYER:', 140, finalY + 30);
    doc.setTextColor(13, 148, 136); // Primary Teal
    doc.text(`${totalTTC.toFixed(2)} €`, 196, finalY + 30, { align: 'right' });

    let signatureY = finalY + 45;
    
    // Add Signature if it exists
    if (formData.signature && formData.signedByName && formData.signedAt) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text('Bon pour accord', 140, signatureY);
      
      const sigDate = new Date(formData.signedAt).toLocaleDateString('fr-FR');
      doc.text(`Signé par ${formData.signedByName} le ${sigDate}`, 140, signatureY + 5);
      
      try {
        // signature is a base64 string "data:image/png;base64,..."
        doc.addImage(formData.signature, 'PNG', 140, signatureY + 8, 40, 20);
      } catch (err) {
        console.error("Error adding signature to PDF:", err);
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    
    let footerY = 270;
    
    if (formData.vatRegime === 'franchise') {
      doc.text('TVA non applicable, art. 293 B du CGI.', 105, footerY, { align: 'center' });
      footerY += 5;
    } else if (formData.vatRegime === 'autoliquidation') {
      doc.text('Autoliquidation de la TVA (Art. 283-2 nonies du CGI).', 105, footerY, { align: 'center' });
      footerY += 5;
    }
    
    if (company?.decennale) {
      doc.text(`Assurance Décennale: ${company.decennale}`, 105, footerY, { align: 'center' });
      footerY += 5;
    }
    if (company?.rcPro) {
      doc.text(`Assurance RC Pro: ${company.rcPro}`, 105, footerY, { align: 'center' });
      footerY += 5;
    }

    if (formData.type !== 'quote' && formData.type !== 'credit') {
      doc.setTextColor(150);
      doc.text("Conforme aux exigences de la réforme de facturation électronique 2026.", 105, footerY, { align: 'center' });
      footerY += 5;
    }

    const footerParts = [company?.name, company?.address, company?.siret ? `SIRET: ${company.siret}` : ''].filter(Boolean);
    doc.text(footerParts.join(' — '), 105, footerY, { align: 'center' });
    if (formData.type !== 'quote' && formData.type !== 'credit') {
      doc.text(`En cas de retard de paiement, une indemnité forfaitaire de 40€ sera appliquée.`, 105, footerY + 5, { align: 'center' });
    }

    if (formData.chantierPhotos && formData.chantierPhotos.length > 0) {
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(28, 25, 23);
      doc.text("Photos du chantier", 14, 20);

      let imgX = 14;
      let imgY = 30;
      const imgW = 85; 
      const imgH = (imgW * 9) / 16; 

      formData.chantierPhotos.forEach((photo, idx) => {
        try {
          doc.addImage(photo, 'JPEG', imgX, imgY, imgW, imgH);
          if ((idx + 1) % 2 === 0) {
            imgX = 14;
            imgY += imgH + 10;
          } else {
            imgX += imgW + 10;
          }
        } catch (err) {
          console.error("Erreur lors de l'ajout de la photo au PDF:", err);
        }
      });
    }

    // Watermark for Free plan
    if (isFree) {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(180);
        doc.text('Créé avec Photofacto — photofacto.fr', 105, 290, { align: 'center' });
      }
    }

    if (shouldSave) {
      const typeLabel = formData.type === 'quote' ? 'Devis' : 'Facture';
      doc.save(`${typeLabel}_${formData.number || 'brouillon'}.pdf`);
    }
    return doc;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: company?.defaultCurrency || 'EUR' }).format(amount);
  };

  // Upsell modal for Free plan limits
  const UpsellModal = () => showUpsellModal ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-xl animate-fade-in" onClick={() => setShowUpsellModal(null)}>
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-sm shadow-2xl p-5 md:p-8 text-center border border-outline-variant/10 animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
          <Sparkles className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-headline font-extrabold text-on-surface mb-3">Passez à la vitesse supérieure</h3>
        <p className="text-on-surface-variant font-medium mb-8">{showUpsellModal}</p>
        <div className="flex gap-3">
          <button onClick={() => setShowUpsellModal(null)} className="flex-1 px-4 py-3 rounded-xl font-bold text-on-surface-variant bg-surface-container-high transition-colors hover:bg-surface-container-highest">
            Plus tard
          </button>
          <button onClick={() => navigate('/app/upgrade')} className="flex-1 px-4 py-3 rounded-xl font-bold text-on-primary bg-primary shadow-spark-cta transition-all hover:opacity-90 active:scale-95">
            Voir les plans
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (step === 'upload') {
    return (
      <>
      <UpsellModal />
      {showCameraGuide && (
        <CameraGuide 
          onAccept={() => {
            setShowCameraGuide(false);
            fileInputRef.current?.click();
          }}
          onCancel={() => setShowCameraGuide(false)}
        />
      )}
      <div className="max-w-5xl mx-auto py-3 md:py-20 px-0 sm:px-4 line-clamp-none">
        <div className="animate-fade-in-up text-center space-y-2 mb-5 md:mb-14">
          <h1 className="text-2xl md:text-6xl font-headline font-extrabold text-on-surface tracking-tight leading-tight">
            Rapide. Sans effort.
          </h1>
          <p className="text-sm md:text-xl text-on-surface-variant max-w-2xl mx-auto font-medium leading-relaxed">
            10 secondes pour créer votre document. Dictez-le ou prenez en photo un brouillon.
          </p>
        </div>

        {error && (
          <div className="animate-fade-in bg-error-container text-on-error-container p-3 md:p-4 rounded-xl flex items-start gap-3 mb-5 md:mb-8 shadow-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 lg:gap-8 relative">
          {isOffline && (
            <div className="absolute inset-0 z-20 bg-surface-container-lowest/80 backdrop-blur-sm rounded-2xl md:rounded-[3rem] flex flex-col items-center justify-center p-5 md:p-8 text-center border border-outline-variant/20">
              <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-4">
                <WifiOff className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-headline font-extrabold text-on-surface mb-2">IA indisponible hors-ligne</h3>
              <p className="text-on-surface-variant font-medium mb-6">Vous n'avez pas de connexion internet. L'analyse par intelligence artificielle est désactivée.</p>
              <button 
                onClick={() => setStep('edit')}
                className="min-touch bg-primary text-on-primary px-5 md:px-8 py-3 md:py-4 rounded-2xl font-bold shadow-spark-cta hover:opacity-90 active:scale-95 transition-all text-sm flex items-center gap-2"
              >
                <FileText className="w-5 h-5" />
                Créer manuellement
              </button>
            </div>
          )}

          <div 
            className={`animate-fade-in-up animation-delay-100 relative min-h-[104px] md:min-h-[230px] bg-surface-container-lowest border rounded-2xl md:rounded-[2rem] p-4 md:p-8 text-left md:text-center cursor-pointer transition-all overflow-hidden ${
              isDictating 
                ? "border-error shadow-2xl shadow-error/20 bg-error/5 scale-[1.02]" 
                : "border-primary/20 hover:border-primary card-hover group hover:shadow-2xl hover:shadow-primary/10"
            }`}
            onClick={(isDictating || isOffline) ? undefined : () => { if (tryUseAi()) handleDictation(); }}
            style={isOffline ? { opacity: 0.5, pointerEvents: 'none' } : {}}
          >
            {!isDictating && <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>}
            <div className="relative z-10 flex flex-row md:flex-col items-center md:justify-center h-full gap-4 md:gap-0 md:space-y-4 py-0 md:py-4">
              <div className={`w-12 h-12 md:w-24 md:h-24 rounded-2xl md:rounded-full flex items-center justify-center shadow-lg md:shadow-xl transition-all duration-300 shrink-0 ${
                isDictating 
                  ? "bg-error text-white shadow-error/40 scale-110 animate-pulse" 
                  : "bg-primary text-on-primary shadow-primary/30 group-hover:scale-110"
              }`}>
                <Mic className="w-6 h-6 md:w-10 md:h-10" />
              </div>
              <div className="min-w-0 flex-1 space-y-1 md:space-y-2">
                <h3 className={`text-lg md:text-2xl lg:text-3xl font-extrabold font-headline ${
                  isDictating ? "text-error" : "text-on-surface"
                }`}>
                  {isDictating ? "Écoute en cours..." : "Dicter"}
                </h3>
                {isDictating ? (
                  <>
                    <div className="bg-surface-container-high rounded-xl p-3 text-left text-sm text-on-surface min-h-[52px] max-h-[100px] md:max-h-[120px] overflow-y-auto font-medium">
                      {dictationText || <span className="text-on-surface-variant/50 italic">En attente de votre voix...</span>}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); stopDictation(); }}
                      className="mt-2 min-touch bg-error text-white px-6 py-3 rounded-xl font-bold text-sm md:text-base active:scale-95 transition-all shadow-lg shadow-error/30 flex items-center justify-center gap-2 mx-auto"
                    >
                      <MicOff className="w-5 h-5" />
                      J'ai terminé
                    </button>
                  </>
                ) : (
                  <div className="space-y-2 md:space-y-3">
                    <p className="text-xs md:text-base text-on-surface-variant font-medium leading-snug">Parlez, puis appuyez quand c'est fini.</p>
                    <div className="hidden md:block bg-primary/5 border border-primary/10 rounded-xl p-3 text-left space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">💡 Que dire ?</p>
                      <p className="text-xs text-on-surface-variant">• <strong>Client :</strong> "Pour Monsieur Martin"</p>
                      <p className="text-xs text-on-surface-variant">• <strong>Travaux :</strong> "Remplacement chauffe-eau"</p>
                      <p className="text-xs text-on-surface-variant">• <strong>Prix :</strong> "800 euros"</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div 
            className="animate-fade-in-up animation-delay-200 card-hover group relative min-h-[104px] md:min-h-[230px] bg-surface-container-lowest border border-secondary/20 hover:border-secondary rounded-2xl md:rounded-[2rem] p-4 md:p-8 text-left md:text-center cursor-pointer transition-all hover:shadow-2xl hover:shadow-secondary/10 overflow-hidden"
            onClick={() => {
              if (isOffline) return;
              if (!tryUseAi()) return;
              setShowCameraGuide(true);
            }}
            style={isOffline ? { opacity: 0.5, pointerEvents: 'none' } : {}}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*" 
              capture="environment"
              className="hidden" 
            />
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10 flex flex-row md:flex-col items-center md:justify-center h-full gap-4 md:gap-0 md:space-y-4 py-0 md:py-6">
              <div className="w-12 h-12 md:w-24 md:h-24 bg-secondary text-on-secondary rounded-2xl md:rounded-full flex items-center justify-center shadow-lg md:shadow-xl shadow-secondary/30 group-hover:scale-110 transition-transform duration-300 shrink-0">
                <Camera className="w-6 h-6 md:w-10 md:h-10" />
              </div>
              <div className="min-w-0 flex-1 space-y-1 md:space-y-2">
                <h3 className="text-lg md:text-2xl lg:text-3xl font-extrabold font-headline text-on-surface">Photographier</h3>
                <p className="text-xs md:text-base text-on-surface-variant font-medium leading-snug">Devis papier, brouillon, notes chantier</p>
              </div>
            </div>
          </div>

          {/* Third card: Import Document */}
          <div 
            className="animate-fade-in-up animation-delay-300 card-hover group relative min-h-[104px] md:min-h-[230px] bg-surface-container-lowest border border-tertiary/20 hover:border-tertiary rounded-2xl md:rounded-[2rem] p-4 md:p-8 text-left md:text-center cursor-pointer transition-all hover:shadow-2xl hover:shadow-tertiary/10 overflow-hidden md:col-span-2 lg:col-span-1"
            onClick={() => {
              if (isOffline) return;
              if (!tryUseAi()) return;
              docInputRef.current?.click();
            }}
            style={isOffline ? { opacity: 0.5, pointerEvents: 'none' } : {}}
          >
            <input
              type="file"
              ref={docInputRef}
              onChange={handleDocumentUpload} 
              accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" 
              className="hidden" 
            />
            <div className="absolute inset-0 bg-gradient-to-br from-tertiary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10 flex flex-row md:flex-col items-center md:justify-center h-full gap-4 md:gap-0 md:space-y-4 py-0 md:py-6">
              <div className="w-12 h-12 md:w-24 md:h-24 bg-tertiary text-on-tertiary rounded-2xl md:rounded-full flex items-center justify-center shadow-lg md:shadow-xl shadow-tertiary/30 group-hover:scale-110 transition-transform duration-300 shrink-0">
                <FileSpreadsheet className="w-6 h-6 md:w-10 md:h-10" />
              </div>
              <div className="min-w-0 flex-1 space-y-1 md:space-y-2">
                <h3 className="text-lg md:text-2xl lg:text-3xl font-extrabold font-headline text-on-surface">Importer</h3>
                <p className="text-xs md:text-base text-on-surface-variant font-medium leading-snug">PDF, Excel, CSV</p>
              </div>
            </div>
          </div>
        </div>

        <div className="animate-fade-in-up animation-delay-300 text-center pt-4 md:pt-12 pb-4 md:pb-8">
          <button 
            onClick={() => setStep('edit')}
            className="min-touch text-on-surface-variant hover:text-on-surface font-bold text-sm transition-all focus:outline-none px-3"
          >
            Ou remplissez les champs manuellement <ArrowRight className="inline w-4 h-4 ml-1 -mt-0.5" />
          </button>
        </div>
      </div>
      </>
    );
  }

  if (step === 'analyzing') {
    const isPhoto = !!previewUrl;
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center space-y-10">
        <div className="relative">
          <div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden border-4 border-surface-container-lowest shadow-2xl relative bg-surface-container-high">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Mic className="w-16 h-16 text-primary/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/60 to-transparent h-[200%] animate-[scan_1.5s_ease-in-out_infinite]"></div>
          </div>
          <div className="absolute -bottom-5 -right-5 w-14 h-14 bg-secondary text-on-secondary rounded-full flex items-center justify-center shadow-xl">
            <Sparkles className="w-7 h-7 animate-pulse" />
          </div>
        </div>
        <div className="animate-fade-in-up">
          <h2 className="text-3xl font-extrabold font-headline mb-3 text-on-surface">
            {isPhoto ? "Analyse visuelle en cours..." : "L'IA retranscrit votre voix..."}
          </h2>
          <p className="text-lg text-on-surface-variant max-w-sm mx-auto flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-secondary" />
            {isPhoto ? "Extraction du texte et des montants." : "Restitution des lignes de la facture."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <UpsellModal />
      {(step === 'paywall' || step === 'activation_pending') && (
        <PaddlePaywall 
          onSuccess={() => setStep('activation_pending')}
          onCancel={step === 'paywall' ? () => setStep('upload') : undefined}
          pendingActivation={step === 'activation_pending' || isPendingActivation}
        />
      )}
      <div className={`animate-fade-in grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 transition-all duration-700 ${(step === 'paywall' || step === 'activation_pending') ? 'blur-md pointer-events-none opacity-50' : ''}`}>
      {/* Form Column */}
      <div className="lg:col-span-7 space-y-4 md:space-y-8 pb-8">
        <header className="space-y-1.5 md:space-y-2 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 md:gap-4">
          <div>
            <button onClick={() => navigate('/app/invoices')} className="min-touch flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface text-xs md:text-sm font-bold mb-2 md:mb-3 transition-colors group -ml-2 px-2">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Retour à la liste
            </button>
            <h1 className="text-[26px] md:text-5xl font-headline font-extrabold text-on-surface tracking-tight leading-tight">
              {id ? 'Document' : 'Vérification'}
            </h1>
            <p className="text-on-surface-variant font-medium text-sm md:text-lg leading-snug">
              {previewUrl ? "L'IA a fait le plus gros, vérifiez juste les détails." : "Remplissez votre document ci-dessous."}
            </p>
          </div>
          {previewUrl && (
            <div className="bg-tertiary-container/50 text-tertiary px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 border border-tertiary/20 shadow-sm whitespace-nowrap">
              <Sparkles className="w-4 h-4" />
              Pré-rempli par l'IA
            </div>
          )}
        </header>

        {/* Warning banner if legal info is missing */}
        {!hasLegalInfo && (
          <div className="animate-fade-in bg-amber-container/50 text-on-amber-container p-4 rounded-2xl flex flex-col sm:flex-row items-start gap-3 border border-amber/20">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber" />
            <div className="flex-1">
              <p className="font-bold text-sm mb-1">Complétez vos informations légales</p>
              <p className="text-xs leading-relaxed">
                Votre SIRET et adresse sont obligatoires sur chaque facture. Vous pourrez les modifier plus tard dans les paramètres.
              </p>
            </div>
            <button
              onClick={() => setShowLegalModal(true)}
              className="shrink-0 min-touch bg-amber text-on-amber px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
            >
              Compléter maintenant
            </button>
          </div>
        )}

        {/* Factur-X & Chorus Pro — Top banner for invoices (visible early, not hidden at bottom) */}
        {id && formData.type === 'invoice' && company?.vatRegime !== 'franchise' && formData.vatRegime !== 'franchise' && (
          <div className="animate-fade-in-up bg-surface-container-lowest rounded-2xl p-4 md:p-5 shadow-sm border border-primary/10 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm text-on-surface">Conforme facture électronique 2026</p>
                <p className="text-xs text-on-surface-variant">Téléchargez votre facture au format officiel Factur-X</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleFacturXDownload}
                className="min-touch flex items-center justify-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                <Shield className="w-4 h-4" />
                Télécharger Factur-X
              </button>
              {/* Chorus Pro Hidden for now */}
              {/* {formData.chorusStatus !== 'submitted' && (
                <button
                  disabled={isSubmittingChorus}
                  onClick={handleChorusSubmit}
                  className="flex items-center gap-2 bg-surface-container-high text-on-surface px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-surface-container-highest active:scale-95 transition-all border border-outline-variant/10 disabled:opacity-50"
                >
                  {isSubmittingChorus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                  {isSubmittingChorus ? 'Dépôt...' : 'Chorus Pro'}
                </button>
              )}
              {formData.chorusStatus === 'submitted' && (
                <div className="flex items-center gap-2 bg-tertiary-container/50 text-tertiary px-4 py-2.5 rounded-xl text-sm font-bold border border-tertiary/20">
                  <CheckCircle2 className="w-4 h-4" />
                  Déposée ✓ {formData.chorusFluxId && <span className="text-xs opacity-70">({formData.chorusFluxId})</span>}
                </div>
              )} */}
            </div>
            {/* {chorusResult && (
              <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
                chorusResult.status === 'success' ? 'bg-tertiary-container/50 text-tertiary' : 'bg-error-container/50 text-error'
              }`}>
                {chorusResult.message}
              </div>
            )} */}
          </div>
        )}

        {/* Signature button - placed at top for visibility on mobile */}
        {formData.type === 'quote' && id && (
          <div className="animate-fade-in-up animation-delay-100 flex flex-col gap-3">
            <SignatureShareButton invoiceId={id} shareQuoteForSignature={shareQuoteForSignature} />
            {(formData.status === 'accepted' || formData.status === 'sent') && (
              <button 
                onClick={() => navigate(`/app/invoices/new?fromQuote=${id}`)}
                className="btn-glow w-full bg-secondary text-on-secondary px-5 md:px-8 py-3.5 md:py-4 rounded-2xl font-bold text-base md:text-lg shadow-lg shadow-secondary/20 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 md:gap-3"
              >
                <RefreshCw className="w-6 h-6" />
                Convertir ce devis en facture
              </button>
            )}
          </div>
        )}

        <section className="bg-surface-container-lowest rounded-2xl p-3.5 sm:p-6 md:p-10 shadow-sm border border-outline-variant/10 space-y-5 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-2 col-span-full md:col-span-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Type de document</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as any})}
                className="w-full bg-surface-container-high border-[2px] border-transparent focus:border-primary/20 rounded-xl md:rounded-2xl px-4 md:px-5 py-3.5 md:py-4 focus:ring-0 text-sm font-bold text-primary transition-colors cursor-pointer"
              >
                <option value="invoice">Facture</option>
                <option value="quote">Devis</option>
                <option value="deposit">Facture d'acompte</option>
                <option value="credit">Avoir</option>
              </select>
            </div>
            
            <div className="space-y-2 col-span-full md:col-span-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Régime de TVA</label>
              <select 
                value={formData.vatRegime}
                onChange={e => setFormData({...formData, vatRegime: e.target.value as any})}
                className="w-full bg-surface-container-high border-none rounded-xl md:rounded-2xl px-4 md:px-5 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-medium transition-colors"
              >
                <option value="standard">Standard</option>
                <option value="franchise">Franchise en base</option>
                <option value="autoliquidation">Autoliquidation (BTP)</option>
              </select>
            </div>

            <div className="space-y-2 col-span-full relative" ref={clientDropdownRef}>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Client *</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={clientSearch || formData.clientName || ''}
                    onChange={e => handleClientSearchChange(e.target.value)}
                    onFocus={() => setShowClientDropdown(true)}
                    placeholder="Rechercher ou saisir un client..."
                    className="w-full bg-surface-container-high border-none rounded-xl md:rounded-2xl px-4 md:px-5 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-bold text-on-surface transition-colors"
                  />
                  {formData.clientId && clientSearch && (
                    <button
                      type="button"
                      onClick={() => { setFormData(prev => ({ ...prev, clientId: '', clientName: '' })); setClientSearch(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 min-touch text-on-surface-variant/50 hover:text-error transition-colors flex items-center justify-center"
                      aria-label="Effacer le client sélectionné"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(true)}
                  className="shrink-0 min-touch bg-primary text-on-primary px-3.5 md:px-4 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
                  title="Ajouter un nouveau client"
                >
                  <UserPlus className="w-5 h-5" />
                  <span className="hidden sm:inline">Nouveau</span>
                </button>
              </div>

              {/* Client Autocomplete Dropdown */}
              {showClientDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-xl max-h-60 overflow-auto" style={{ maxWidth: 'calc(100% - 64px)' }}>
                  {filteredClients.length > 0 ? (
                    filteredClients.map(client => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleClientSelect(client)}
                        className="w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors flex items-center gap-3 first:rounded-t-2xl last:rounded-b-2xl"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{client.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate">{client.name}</p>
                          {client.email && <p className="text-xs text-on-surface-variant truncate">{client.email}</p>}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3">
                      <p className="text-sm text-on-surface-variant mb-2">Aucun client trouvé pour "{clientSearch}"</p>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, clientName: clientSearch.trim() }));
                          setShowClientDropdown(false);
                          setShowNewClientModal(true);
                        }}
                        className="w-full flex items-center gap-2 bg-primary/10 text-primary font-semibold px-3 py-2 rounded-xl text-sm transition-colors justify-center"
                      >
                        <Plus className="w-4 h-4" />
                        Créer "{clientSearch}"
                      </button>
                    </div>
                  )}
                </div>
              )}

              {formData.clientName && !formData.clientId && (
                <div className="bg-secondary-container/50 text-secondary border border-secondary/20 p-4 rounded-2xl text-sm mt-3 flex flex-col md:flex-row md:items-center gap-4 shadow-sm">
                  <div className="flex items-start gap-3 flex-1">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold mb-1">Client inconnu au bataillon !</p>
                      <p className="text-secondary/80">L'IA a détecté <strong>"{formData.clientName}"</strong>. Sélectionnez-le ci-dessus ou ajoutez-le à votre carnet maintenant.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleQuickAddClient}
                    disabled={isAddingClient}
                    className="shrink-0 min-touch bg-secondary text-on-secondary px-5 py-2.5 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all text-sm disabled:opacity-50"
                  >
                    {isAddingClient ? 'Création...' : 'Créer ce client'}
                  </button>
                </div>
              )}

              {/* Inline New Client Modal */}
              {showNewClientModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-inverse-surface/40 backdrop-blur-xl animate-fade-in">
                  <div className="bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[calc(100dvh-24px)] overflow-y-auto shadow-2xl border border-outline-variant/10 animate-scale-in">
                    <div className="flex items-center justify-between p-5 sm:p-6 pb-0">
                      <h3 className="font-headline text-xl font-extrabold text-on-surface">Nouveau client</h3>
                      <button onClick={() => setShowNewClientModal(false)} className="min-touch rounded-xl hover:bg-surface-container-high transition-colors flex items-center justify-center" aria-label="Fermer la fenêtre nouveau client">
                        <X className="w-5 h-5 text-on-surface-variant" />
                      </button>
                    </div>
                    <div className="p-5 sm:p-6 space-y-4 pb-safe">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setNewClientType('B2C')} className={`flex-1 min-touch py-2.5 rounded-xl text-sm font-bold transition-all ${newClientType === 'B2C' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high text-on-surface-variant'}`}>Particulier</button>
                        <button type="button" onClick={() => setNewClientType('B2B')} className={`flex-1 min-touch py-2.5 rounded-xl text-sm font-bold transition-all ${newClientType === 'B2B' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-high text-on-surface-variant'}`}>Professionnel</button>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Nom <span className="text-error">*</span></label>
                        <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Ex: Martin Jean" className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" autoFocus />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Email</label>
                          <input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="email@" className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Téléphone</label>
                          <input type="tel" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} placeholder="06..." className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Adresse</label>
                        <input type="text" value={newClientAddress} onChange={e => setNewClientAddress(e.target.value)} placeholder="12 rue..." className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20" />
                      </div>
                      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                        <button type="button" onClick={() => setShowNewClientModal(false)} className="flex-1 min-touch py-3.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors">Annuler</button>
                        <button type="button" onClick={handleInlineAddClient} disabled={!newClientName.trim() || isAddingClient} className="flex-1 min-touch bg-primary text-on-primary py-3.5 rounded-xl font-bold shadow-spark-cta hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50">
                          {isAddingClient ? 'Création...' : 'Ajouter'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2 col-span-full md:col-span-1">
              <label className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">
                Numéro *
                <button type="button" onClick={() => setIsNumberEditable(!isNumberEditable)} className="min-h-[32px] text-[10px] text-primary bg-primary/10 hover:bg-primary hover:text-on-primary px-2 py-0.5 rounded shadow-sm transition-colors">
                  {isNumberEditable ? 'Verrouiller' : 'Modifier'}
                </button>
              </label>
              <input 
                type="text" 
                value={formData.number || ''}
                onChange={e => setFormData({...formData, number: e.target.value})}
                readOnly={!isNumberEditable}
                className={`w-full bg-surface-container-high border-[2px] border-transparent focus:border-primary/20 rounded-xl md:rounded-2xl px-4 md:px-5 py-3.5 md:py-4 focus:ring-0 text-sm font-bold text-on-surface transition-colors ${!isNumberEditable ? 'opacity-70 cursor-not-allowed border-none' : ''}`}
                required
              />
            </div>

            <div className="space-y-2 col-span-full md:col-span-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Date d'émission</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full bg-surface-container-high border-none rounded-xl md:rounded-2xl px-4 md:px-5 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-bold text-on-surface transition-colors"
              />
            </div>
            <div className="space-y-2 col-span-full md:col-span-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Date d'échéance</label>
              <input 
                type="date" 
                value={formData.dueDate}
                onChange={e => setFormData({...formData, dueDate: e.target.value})}
                className="w-full bg-surface-container-high border-none rounded-xl md:rounded-2xl px-4 md:px-5 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-bold text-on-surface transition-colors"
              />
            </div>
          </div>

          <div className="space-y-5 pt-4 border-t border-surface-container-high">
            <div className="flex justify-between items-end">
              <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Prestations</label>
            </div>
            
            <div className="space-y-3">
              {(formData.items || []).map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2.5 md:gap-3 items-center bg-surface-container-low/70 p-3.5 md:p-4 pt-5 rounded-2xl relative">
                  {/* Delete Button on top right of the item card for mobile focus */}
                  <button onClick={() => removeItem(index)} className="absolute top-2 right-2 min-touch text-error/60 hover:text-error bg-surface-container-highest/70 hover:bg-error-container rounded-lg transition-colors flex items-center justify-center" aria-label="Supprimer cette ligne">
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="col-span-12 space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-2">Description</label>
                    <input 
                      type="text" 
                      placeholder="Désignation" 
                      value={item.description}
                      onChange={e => handleItemChange(index, 'description', e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3.5 md:px-4 py-3 text-sm focus:ring-2 focus:border-transparent focus:ring-primary/20 font-bold"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-4 lg:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-2 flex items-center justify-between">
                      Qté
                      <button
                        type="button"
                        onClick={() => {
                          if (!limits.canUseAICalculator) {
                            setShowUpsellModal('Le calculateur de surfaces est disponible à partir du plan Solo (14,90€/mois).');
                            return;
                          }
                          setActiveCalculatorIndex(activeCalculatorIndex === index ? null : index);
                        }}
                        className="min-h-[32px] min-w-[32px] text-primary hover:text-primary/70 transition-colors rounded flex items-center justify-center"
                        title={limits.canUseAICalculator ? 'Calculateur (L x l x h)' : 'Calculateur de surfaces — plan Solo'}
                      >
                        <Calculator className="w-3.5 h-3.5" />
                      </button>
                    </label>
                    <input 
                      type="number" 
                      placeholder="1" 
                      value={item.quantity}
                      onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 md:px-4 py-3 text-sm focus:ring-2 focus:border-transparent focus:ring-primary/20 font-medium"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-4 lg:col-span-3 space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-2">Prix U.</label>
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      value={item.unitPrice}
                      onChange={e => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 md:px-4 py-3 text-sm focus:ring-2 focus:border-transparent focus:ring-primary/20 font-medium"
                    />
                  </div>
                  {formData.vatRegime === 'standard' && (
                    <div className="col-span-6 sm:col-span-4 lg:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-2">TVA</label>
                      <select 
                        value={item.vatRate}
                        onChange={e => handleItemChange(index, 'vatRate', parseFloat(e.target.value) || 0)}
                        className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:border-transparent focus:ring-primary/20 font-medium"
                      >
                        <option value="20">20%</option>
                        <option value="10">10%</option>
                        <option value="5.5">5.5%</option>
                        <option value="0">0%</option>
                      </select>
                    </div>
                  )}
                  <div className="col-span-6 sm:col-span-12 lg:col-span-3 lg:mt-5 text-right font-bold text-primary px-2 text-sm self-end pb-1">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </div>

                  {activeCalculatorIndex === index && (
                    <div className="col-span-12 bg-primary/5 rounded-2xl p-4 mt-2 border border-primary/20 animate-scale-in">
                      <div className="flex justify-between items-center mb-4">
                         <span className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-1.5"><Calculator className="w-4 h-4"/> Calcul de surface/volume</span>
                         <button type="button" onClick={() => setActiveCalculatorIndex(null)} className="min-touch text-on-surface-variant hover:text-primary bg-white rounded-full transition-colors flex items-center justify-center"><X className="w-4 h-4"/></button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                         <div>
                           <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Longueur (m)</label>
                           <input type="number" id={`calc-l-${index}`} placeholder="0" className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/30 shadow-sm" />
                         </div>
                         <div>
                           <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Largeur (m)</label>
                           <input type="number" id={`calc-w-${index}`} placeholder="0" className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/30 shadow-sm" />
                         </div>
                         <div>
                           <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Hauteur (m) <span className="opacity-50 lowercase tracking-normal font-normal ml-0.5">(opt.)</span></label>
                           <input type="number" id={`calc-h-${index}`} placeholder="-" className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/30 shadow-sm" />
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 md:gap-3 pt-1 md:pt-2">
              <button 
                type="button" 
                onClick={() => addItem()}
                className="min-touch flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-outline-variant/30 hover:border-primary/40 hover:bg-primary/5 text-on-surface-variant hover:text-primary py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl font-bold transition-all text-sm active:scale-95 group"
              >
                <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                Ajouter une ligne
              </button>
              
              {formData.clientId && (
                <div className="relative flex-1 group">
                   <button 
                    type="button" 
                    className="min-touch w-full flex items-center justify-center gap-2 bg-surface-container-high border border-outline-variant/10 text-on-surface py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl font-bold transition-all text-sm group-hover:bg-surface-container-highest"
                  >
                    <RefreshCw className="w-4 h-4 text-primary" />
                    Prestations habituelles
                  </button>
                  <div className="absolute bottom-full left-0 w-full mb-2 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-xl p-2 hidden group-hover:block animate-fade-in z-50">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest px-3 py-2 border-b border-outline-variant/10 mb-1">Historique client</p>
                    {getClientHistorySuggestions(formData.clientId, invoices).length > 0 ? (
                      getClientHistorySuggestions(formData.clientId, invoices).map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => addItem(item.description, item.unitPrice, item.vatRate)}
                          className="w-full text-left px-3 py-2.5 hover:bg-primary/5 rounded-xl text-xs font-medium flex justify-between items-center transition-colors"
                        >
                          <span className="truncate mr-2">{item.description}</span>
                          <span className="font-bold text-primary shrink-0">{item.unitPrice}€</span>
                        </button>
                      ))
                    ) : (
                      <p className="text-[10px] text-on-surface-variant p-3 italic">Aucun historique pour ce client.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2.5 md:space-y-3 pt-4 md:pt-6">
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Notes & Coordonnées bancaires</label>
            <textarea 
              placeholder="RIB, conditions de règlement, ou message personnalisé..."
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full bg-surface-container-high border-none rounded-xl md:rounded-2xl px-4 md:px-5 py-3.5 md:py-4 focus:ring-2 focus:ring-primary/20 text-sm font-medium min-h-[88px] md:min-h-[100px] transition-colors"
            />
          </div>

          <div className="bg-surface-container-low rounded-2xl p-4 md:p-8 space-y-3 md:space-y-4 shadow-inner">
            <div className="flex justify-between items-center gap-3 text-on-surface-variant">
              <span className="font-bold text-sm">Total HT</span>
              <span className="font-black text-lg">{formatCurrency(totalHT)}</span>
            </div>
            {formData.vatRegime === 'standard' && (
              <div className="flex justify-between items-center gap-3 text-on-surface-variant border-b border-outline-variant/10 pb-4">
                <span className="font-bold text-sm">TVA</span>
                <span className="font-black text-lg">{formatCurrency(totalVAT)}</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 pt-2">
              <span className="text-base md:text-xl font-headline font-black text-on-surface">TOTAL {formData.type === 'quote' ? 'ESTIMÉ' : 'À PAYER'}</span>
              <span className="text-[28px] md:text-3xl font-headline font-black text-primary drop-shadow-sm break-words">{formatCurrency(totalTTC)}</span>
            </div>
          </div>
        </section>

        {/* Action Buttons Footer — Only visible after saving the first time (when id exists) */}
        {id && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleFacturXDownload}
              className="min-touch flex items-center justify-center gap-2 md:gap-3 bg-surface-container-highest text-on-surface py-3.5 md:py-5 px-4 md:px-6 rounded-2xl font-black text-base md:text-lg shadow-xl shadow-surface-container-high/50 hover:-translate-y-1 active:scale-95 transition-all border border-outline-variant/10 group"
            >
              <Shield className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
              Factur-X (Basic)
            </button>

            <button
              onClick={() => generatePDF(true)}
              className="min-touch flex items-center justify-center gap-2 md:gap-3 bg-surface-container-highest text-on-surface py-3.5 md:py-5 px-4 md:px-6 rounded-2xl font-black text-base md:text-lg shadow-xl shadow-surface-container-high/50 hover:-translate-y-1 active:scale-95 transition-all border border-outline-variant/10 group"
            >
              <Printer className="w-6 h-6 text-secondary group-hover:scale-110 transition-transform" />
              Imprimer PDF
            </button>

            <button
              onClick={handleSendEmail}
              disabled={isSendingEmail}
              className="sm:col-span-2 min-touch flex items-center justify-center gap-2 md:gap-3 bg-primary text-on-primary py-4 md:py-6 px-5 md:px-6 rounded-2xl font-black text-base md:text-xl shadow-spark-cta-lg hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50 group btn-glow"
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  Envoyer au client
                </>
              )}
            </button>
          </div>
        )}

        {/* Initial Save Button */}
        {!id && (
          <button
            onClick={() => handleSave('draft')}
            disabled={isSaving}
            className="w-full min-touch flex items-center justify-center gap-2 md:gap-3 bg-primary text-on-primary py-4 sm:py-6 px-5 md:px-6 rounded-2xl font-black text-base sm:text-2xl shadow-spark-cta-xl hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50 btn-glow"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-7 h-7 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-7 h-7" />
                Générer mon document
              </>
            )}
          </button>
        )}
      </div>

      {/* Preview Column (Hidden on mobile) */}
      <div className="hidden lg:block lg:col-span-5 sticky top-8 h-[calc(100vh-4rem)]">
         <div className="bg-surface-container rounded-[3rem] h-full shadow-2xl border border-outline-variant/10 overflow-hidden flex flex-col relative group">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-high/50 backdrop-blur-md z-10">
               <h3 className="font-headline font-black text-on-surface uppercase tracking-widest text-sm flex items-center gap-2">
                 <FileText className="w-5 h-5 text-primary" />
                 Aperçu Temps Réel
               </h3>
               <div className="flex gap-2">
                 <div className="w-3 h-3 rounded-full bg-error/40"></div>
                 <div className="w-3 h-3 rounded-full bg-amber/40"></div>
                 <div className="w-3 h-3 rounded-full bg-primary/40"></div>
               </div>
            </div>
            
            <div className="flex-1 overflow-auto p-8 bg-surface-container-lowest/30 custom-scrollbar">
               {/* Document simulation */}
               <div className="bg-white text-stone-800 shadow-2xl rounded-sm p-10 min-h-[700px] border border-stone-200 transform group-hover:scale-[1.01] transition-transform duration-500 origin-top">
                  <header className="flex justify-between items-start mb-10 border-b-4 border-stone-800 pb-8">
                     <div>
                       <h2 className="text-3xl font-black text-stone-800 mb-2">{company?.name || 'Mon Entreprise'}</h2>
                       <p className="text-xs text-stone-500 font-medium uppercase tracking-tighter">SIRET: {company?.siret || '...'}</p>
                     </div>
                     <div className="text-right">
                       <h3 className="text-lg font-black bg-stone-800 text-white px-3 py-1 inline-block mb-2">
                         {formData.type === 'quote' ? 'DEVIS' : 'FACTURE'}
                       </h3>
                       <p className="text-sm font-bold text-stone-800">N° {formData.number || '...'}</p>
                       <p className="text-xs text-stone-500">{format(new Date(formData.date || Date.now()), 'dd/MM/yyyy')}</p>
                     </div>
                  </header>

                  <div className="mb-10 flex justify-end">
                    <div className="w-1/2 text-right">
                       <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Destinataire</p>
                       <p className="text-lg font-bold text-stone-800">{clients.find(c => c.id === formData.clientId)?.name || formData.clientName || '...'}</p>
                    </div>
                  </div>

                  <table className="w-full text-sm mb-10">
                     <thead className="bg-stone-50 text-stone-500 text-[10px] font-black uppercase tracking-widest border-b border-stone-200">
                        <tr>
                          <th className="py-3 text-left">Désignation</th>
                          <th className="py-3 text-right px-4">Qté</th>
                          <th className="py-3 text-right">Total HT</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-stone-100">
                        {(formData.items || []).map((item, idx) => (
                           <tr key={idx}>
                              <td className="py-4 font-medium text-stone-700">{item.description || '...'}</td>
                              <td className="py-4 text-right px-4 text-stone-500">{item.quantity}</td>
                              <td className="py-4 text-right font-bold text-stone-800">{formatCurrency(item.quantity * item.unitPrice)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>

                  <div className="flex justify-end pt-6 border-t-2 border-stone-800">
                     <div className="w-1/2 space-y-3">
                        <div className="flex justify-between text-xs font-bold text-stone-500">
                           <span>Total HT</span>
                           <span>{formatCurrency(totalHT)}</span>
                        </div>
                        {formData.vatRegime === 'standard' && (
                           <div className="flex justify-between text-xs font-bold text-stone-500">
                              <span>TVA</span>
                              <span>{formatCurrency(totalVAT)}</span>
                           </div>
                        )}
                        <div className="flex justify-between text-lg font-black text-stone-800 border-t border-stone-200 pt-3">
                           <span>Total TTC</span>
                           <span>{formatCurrency(totalTTC)}</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
            
            <div className="p-6 bg-surface-container-high/80 backdrop-blur-md flex flex-col gap-4">
              <div className="flex justify-between items-center">
                 <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Plus d'options</p>
                 <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">PLAN PRO</span>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-secondary" />
                    Photos de chantier (max 4)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(formData.chantierPhotos || []).map((photo, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden group shadow-sm">
                        <img src={photo} alt="Chantier" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeChantierPhoto(idx)}
                          className="absolute inset-0 bg-error/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(formData.chantierPhotos || []).length < 4 && (
                      <button
                        onClick={() => photosInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        className="w-16 h-16 rounded-xl bg-surface-container-lowest border-2 border-dashed border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:border-secondary hover:text-secondary transition-all"
                      >
                        {isUploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
                      </button>
                    )}
                    <input 
                      type="file" 
                      ref={photosInputRef} 
                      onChange={handlePhotoChantier} 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                    />
                  </div>
                </div>

                <div className="p-4 bg-tertiary-container/30 border border-tertiary/20 rounded-2xl">
                   <p className="text-[10px] font-black text-tertiary uppercase tracking-widest mb-1.5 flex items-center gap-2">
                     <Shield className="w-3.5 h-3.5" /> Sécurité Factur-X
                   </p>
                   <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                     Votre facture est protégée avec le standard européen PDF/A-3. Elle est prête pour le contrôle fiscal.
                   </p>
                </div>
              </div>
            </div>
         </div>
      </div>
    </div>

    <LegalInfoModal
      isOpen={showLegalModal}
      onClose={() => setShowLegalModal(false)}
      onComplete={() => setShowLegalModal(false)}
    />
    </div>
  );
}
