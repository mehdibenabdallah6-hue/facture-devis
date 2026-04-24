import React, { useState } from 'react';
import { useData, Client } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Edit, Trash2, X, Users, Briefcase, User as UserIcon, ArrowRight } from 'lucide-react';
import { EmptySearchState } from '../components/EmptyStates';

export default function ClientsList() {
  const { clients, addClient, updateClient, deleteClient } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    type: 'B2C' as 'B2B' | 'B2C',
    name: '',
    email: '',
    phone: '',
    address: '',
    siren: '',
    vatNumber: '',
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        type: client.type || 'B2C',
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        siren: client.siren || '',
        vatNumber: client.vatNumber || '',
        notes: client.notes || ''
      });
    } else {
      setEditingClient(null);
      setFormData({ type: 'B2C', name: '', email: '', phone: '', address: '', siren: '', vatNumber: '', notes: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingClient) {
        await updateClient(editingClient.id, formData);
      } else {
        await addClient(formData);
      }
      handleCloseModal();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteModalOpen(id);
  };

  const confirmDelete = async () => {
    if (!deleteModalOpen) return;
    setIsDeleting(deleteModalOpen);
    try {
      await deleteClient(deleteModalOpen);
    } finally {
      setIsDeleting(null);
      setDeleteModalOpen(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="animate-fade-in-up flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight mb-1">Clients</h1>
          <p className="text-on-surface-variant font-medium text-sm">Votre carnet d'adresses professionnel.</p>
        </div>
      </header>

      {/* Toolbar */}
      <div className="animate-fade-in-up animation-delay-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input 
            type="text" 
            placeholder="Rechercher par nom, email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium shadow-sm"
          />
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="btn-glow flex items-center justify-center gap-2 w-full sm:w-auto bg-primary text-on-primary px-6 py-3.5 rounded-2xl font-bold shadow-spark-cta hover:-translate-y-0.5 active:scale-95 transition-all whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Nouveau client
        </button>
      </div>

      <div className="animate-fade-in-up animation-delay-200 bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10">
        {filteredClients.length === 0 && searchTerm ? (
          <div className="p-16">
            <EmptySearchState message={`Aucun client ne correspond à "${searchTerm}"`} onClear={() => setSearchTerm('')} />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-24 h-24 bg-surface-container-low rounded-full flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-outline" />
            </div>
            <h3 className="font-headline text-2xl font-bold text-on-surface mb-2 tracking-tight">Aucun client</h3>
            <p className="text-on-surface-variant max-w-sm mb-8 text-lg">Vous n'avez pas encore ajouté de client. Commencez dès maintenant pour fluidifier vos devis.</p>
            <button 
              onClick={() => handleOpenModal()}
              className="btn-glow px-8 py-4 bg-primary text-on-primary rounded-xl font-bold shadow-spark-cta hover:scale-105 active:scale-95 transition-all"
            >
              + Ajouter un client
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-surface-container-low/30 border-b border-outline-variant/10 text-on-surface-variant">
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest pl-8">Nom & Type</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest">Coordonnées</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest">Adresse</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-right pr-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="group hover:bg-surface-container-low/50 transition-colors bg-surface-container-lowest">
                    <td className="px-6 py-5 pl-8">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => navigate(`/app/clients/${client.id}`)}
                          className={`w-12 h-12 rounded-[14px] flex items-center justify-center font-bold text-sm shadow-inner shrink-0 hover:scale-105 transition-transform ${client.type === 'B2B' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}
                        >
                          {client.type === 'B2B' ? <Briefcase className="w-5 h-5"/> : <UserIcon className="w-5 h-5"/>}
                        </button>
                        <div className="flex flex-col">
                          <button onClick={() => navigate(`/app/clients/${client.id}`)} className="font-bold text-on-surface text-base hover:text-primary transition-colors text-left">{client.name}</button>
                          <span className={`text-[10px] uppercase font-bold tracking-widest ${client.type === 'B2B' ? 'text-secondary' : 'text-primary'}`}>
                            {client.type === 'B2B' ? 'Pro' : 'Particulier'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-semibold text-on-surface">{client.email || '—'}</div>
                      <div className="text-sm font-medium text-on-surface-variant mt-1">{client.phone || '—'}</div>
                    </td>
                    <td className="px-6 py-5 text-sm font-medium text-on-surface-variant max-w-xs leading-relaxed">
                      {client.address ? (
                        <span className="line-clamp-2" title={client.address}>{client.address}</span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-5 pr-8 text-right">
                      <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(client)} className="p-2.5 bg-surface-container-high text-on-surface-variant hover:text-on-surface rounded-xl transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button disabled={isDeleting === client.id} onClick={() => handleDeleteClick(client.id)} className="p-2.5 bg-error-container text-error hover:bg-error hover:text-on-error rounded-xl transition-colors disabled:opacity-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-xl animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-8 text-center border border-outline-variant/10 animate-scale-in">
            <div className="w-20 h-20 bg-error-container text-error rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Trash2 className="w-10 h-10" />
            </div>
            <h3 className="font-headline text-2xl font-extrabold text-on-surface mb-3 tracking-tight">Supprimer ce client ?</h3>
            <p className="text-on-surface-variant text-base mb-8">
              Cette action est irréversible. Le client sera définitivement supprimé de votre carnet.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setDeleteModalOpen(null)} 
                className="flex-1 py-3.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={confirmDelete} 
                disabled={!!isDeleting}
                className="flex-1 py-3.5 bg-error text-on-error rounded-xl font-bold shadow-lg shadow-error/20 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-xl animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-outline-variant/10 animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-8 py-6 border-b border-surface-container-low shrink-0 bg-surface-container-lowest z-10">
              <h2 className="text-2xl font-extrabold font-headline text-on-surface">{editingClient ? 'Modifier le client' : 'Nouveau client'}</h2>
              <button onClick={handleCloseModal} className="p-2.5 bg-surface-container-high hover:bg-surface-container-highest rounded-full transition-colors">
                <X className="w-5 h-5 text-on-surface" />
              </button>
            </div>
            
            <div className="overflow-y-auto px-8 py-6">
              <form id="client-form" onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Type de client *</label>
                  <div className="flex bg-surface-container-high p-1.5 rounded-xl w-full sm:w-auto">
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, type: 'B2C'})}
                      className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-lg transition-all ${
                        formData.type === 'B2C' 
                          ? 'bg-surface-container-lowest text-primary shadow-sm' 
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <UserIcon className="w-4 h-4"/> Particulier (B2C)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, type: 'B2B'})}
                      className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-lg transition-all ${
                        formData.type === 'B2B' 
                          ? 'bg-surface-container-lowest text-secondary shadow-sm' 
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <Briefcase className="w-4 h-4"/> Entreprise (B2B)
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Nom / Raison sociale *</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                    placeholder="Dupont Jean / Menuiserie Tremblay"
                  />
                </div>
                
                {formData.type === 'B2B' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">SIREN</label>
                      <input 
                        type="text" 
                        value={formData.siren}
                        onChange={e => setFormData({...formData, siren: e.target.value})}
                        className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium uppercase tracking-wide"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">N° TVA Intra</label>
                      <input 
                        type="text" 
                        value={formData.vatNumber}
                        onChange={e => setFormData({...formData, vatNumber: e.target.value})}
                        className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium uppercase tracking-wide"
                      />
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Email</label>
                    <input 
                      type="email" 
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                      placeholder="jean@exemple.fr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Téléphone</label>
                    <input 
                      type="tel" 
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Adresse de facturation</label>
                    <textarea 
                      rows={3}
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm resize-none font-medium"
                      placeholder="12 rue des lilas, 75000 Paris"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="px-8 py-5 border-t border-surface-container-low shrink-0 bg-surface-container-lowest z-10 flex flex-col-reverse sm:flex-row justify-end gap-4 rounded-b-[2rem]">
              <button type="button" onClick={handleCloseModal} className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors">
                Annuler
              </button>
              <button 
                form="client-form" 
                disabled={isSaving} 
                type="submit" 
                className="btn-glow w-full sm:w-auto px-8 py-3.5 bg-primary text-on-primary rounded-xl font-bold shadow-spark-cta hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:transform-none"
              >
                {isSaving ? 'Enregistrement...' : (editingClient ? 'Enregistrer les modifications' : 'Créer le client')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
