import React, { useState } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, FileText, 
  Calendar, Clock, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import type { Note } from '../db/db';

interface NotesViewProps {
  notes: Note[];
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'branchId'>) => Promise<any>;
  updateNote: (id: string, note: Partial<Omit<Note, 'id' | 'createdAt' | 'branchId'>>) => Promise<any>;
  deleteNote: (id: string) => Promise<any>;
}

export function NotesView({ notes, addNote, updateNote, deleteNote }: NotesViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form States
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // UI Notification State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenAddModal = () => {
    setEditingNote(null);
    setTitle('');
    setContent('');
    setShowModal(true);
  };

  const handleOpenEditModal = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setTitle('');
    setContent('');
    setEditingNote(null);
    setShowModal(false);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('error', 'Title is required.');
      return;
    }

    try {
      if (editingNote) {
        await updateNote(editingNote.id!, {
          title: title.trim(),
          content: content.trim(),
        });
        showToast('success', 'Note updated successfully!');
      } else {
        await addNote({
          title: title.trim(),
          content: content.trim(),
        });
        showToast('success', 'Note created successfully!');
      }
      handleCloseModal();
    } catch (err) {
      console.error('Error saving note:', err);
      showToast('error', 'Failed to save note.');
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      try {
        await deleteNote(id);
        showToast('success', 'Note deleted successfully.');
      } catch (err) {
        console.error('Error deleting note:', err);
        showToast('error', 'Failed to delete note.');
      }
    }
  };

  const formatDateTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    const timeStr = d.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return `${dateStr} at ${timeStr}`;
  };

  // Filter notes by search query
  const filteredNotes = notes.filter(note => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  });

  // Sort notes by updatedAt descending (newest/most recently updated first)
  const sortedNotes = [...filteredNotes].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative pb-16">
      
      {/* 1. Header Toast alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-xl border text-xs font-semibold shadow-lg animate-scale-up ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-805 dark:text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-808 dark:text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* 2. Top search bar & add note controls */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
          <input
            type="text"
            placeholder="Search notes by title or content..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 text-xs rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-55 dark:bg-darkSecondary/35 text-stone-850 dark:text-stone-205 focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Add Note Button */}
        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-sm transition-all shrink-0"
        >
          <Plus size={15} />
          Create Note
        </button>
      </div>

      {/* 3. Action headers: Count */}
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
          My Notes ({sortedNotes.length})
        </span>
      </div>

      {/* 4. Notes Grid List */}
      {sortedNotes.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-2.5 border border-stone-200/30 dark:border-stone-800/30">
          <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-darkSecondary/40 text-stone-400 flex items-center justify-center">
            <FileText size={20} />
          </div>
          <span className="text-xs font-semibold text-stone-850 dark:text-stone-200">No Notes Found</span>
          <span className="text-3xs text-stone-450 dark:text-stone-500 max-w-xs leading-relaxed">
            Record task updates, shop design remarks, delivery specifications, or general staff details.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedNotes.map(note => (
            <div 
              key={note.id}
              className="glass-card rounded-2xl border border-stone-200/35 dark:border-stone-800/30 overflow-hidden shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group"
            >
              {/* Note Content Panel */}
              <div className="p-5 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-3">
                  <h4 className="text-xs font-bold text-stone-850 dark:text-stone-100 line-clamp-1 flex-1">
                    {note.title}
                  </h4>
                  <div className="flex gap-1 shrink-0 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEditModal(note)}
                      className="p-1.5 text-stone-450 hover:text-accent rounded-lg hover:bg-stone-105 dark:hover:bg-stone-800"
                      title="Edit Note"
                      aria-label="Edit Note"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id!)}
                      className="p-1.5 text-stone-450 hover:text-red-500 rounded-lg hover:bg-stone-105 dark:hover:bg-stone-800"
                      title="Delete Note"
                      aria-label="Delete Note"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <p className="text-2xs text-stone-550 dark:text-stone-400 whitespace-pre-wrap leading-relaxed line-clamp-6 min-h-[100px]">
                  {note.content}
                </p>
              </div>

              {/* Note Footer Panel (Timestamps info) */}
              <div className="px-5 py-3 bg-stone-50/50 dark:bg-darkSecondary/20 border-t border-stone-200/20 dark:border-stone-850/40 flex items-center justify-between text-4xs font-semibold text-stone-450 dark:text-stone-500">
                <span className="flex items-center gap-1">
                  <Calendar size={10} />
                  <span>Updated</span>
                </span>
                <span className="flex items-center gap-1 font-bold text-stone-600 dark:text-stone-400">
                  <Clock size={10} />
                  {formatDateTime(note.updatedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Create / Edit Note popup Dialog */}
      {showModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs overflow-y-auto">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/35 dark:border-stone-800/20">
              <h4 className="text-base font-bold text-primary dark:text-accent flex items-center gap-2">
                <FileText size={16} />
                {editingNote ? 'Edit Note' : 'Create New Note'}
              </h4>
              <button
                onClick={handleCloseModal}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-450 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40 transition-colors shrink-0"
                title="Close Dialog"
                aria-label="Close Dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="flex flex-col gap-4">
              
              {/* Note Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Note Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Polish mix ratio, Client contact notes..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                  autoFocus
                />
              </div>

              {/* Note Content */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Note Content
                </label>
                <textarea
                  placeholder="Type notes descriptions, specifications details..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent min-h-[180px]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-end mt-1 pb-1">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-stone-250/50 dark:border-stone-800/60 rounded-xl text-xs font-semibold text-stone-650 dark:text-stone-305 hover:bg-stone-105 dark:hover:bg-stone-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  {editingNote ? 'Save Changes' : 'Create Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
