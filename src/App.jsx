import { useState, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import Tesseract from 'tesseract.js'

// PDF.js Worker einrichten (EXAKT wie in v6-fixed)
const setupPdfWorker = () => {
  const version = pdfjsLib.version || '3.11.174';
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
};
setupPdfWorker();

// ============================================
// KONFIGURATION
// ============================================

const BOAT_CLASSES = {
  'Optimist': { crew: 1, alias: ['Opti', 'Optimist A', 'Optimist B'] },
  'ILCA 4': { crew: 1, alias: ['Laser 4.7', 'Laser4.7'] },
  'ILCA 6': { crew: 1, alias: ['Laser Radial', 'LaserRadial'] },
  'ILCA 7': { crew: 1, alias: ['Laser Standard', 'Laser', 'LaserStandard'] },
  'Europe': { crew: 1 },
  'Finn': { crew: 1 },
  'Contender': { crew: 1 },
  'OK-Jolle': { crew: 1, alias: ['OK', 'OK Jolle'] },
  'O-Jolle': { crew: 1 },
  'RS Aero': { crew: 1, alias: ['RSAero', 'RS Aero 5', 'RS Aero 7', 'RS Aero 9'] },
  '420er': { crew: 2, alias: ['420', '420er'] },
  '470er': { crew: 2, alias: ['470', '470er'] },
  '29er': { crew: 2 },
  '49er': { crew: 2 },
  '49er FX': { crew: 2, alias: ['49erFX'] },
  'Flying Dutchman': { crew: 2, alias: ['FD'] },
  'Pirat': { crew: 2 },
  'Korsar': { crew: 2 },
  '505er': { crew: 2, alias: ['505'] },
  'Fireball': { crew: 2 },
  'Nacra 17': { crew: 2 },
  'Hobie 16': { crew: 2 },
  'Zugvogel': { crew: 2 },
  'Teeny': { crew: 2 },
  'Cadet': { crew: 2 },
  'Drachen': { crew: 3, alias: ['Dragon'] },
  'H-Boot': { crew: 3, alias: ['HBoot', 'H Boot'] },
  'Soling': { crew: 3 },
  'Yngling': { crew: 3 },
  'Folkeboot': { crew: 3, alias: ['Folke'] },
  'J/70': { crew: 5, alias: ['J70', 'J 70'] },
  'J/24': { crew: 5, alias: ['J24', 'J 24'] },
  'Kielzugvogel': { crew: 3 },
};

// ============================================
// UI KOMPONENTEN (Neues Design)
// ============================================

const GradientOrbs = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div className="absolute w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)', top: '10%', right: '10%', animation: 'float1 20s ease-in-out infinite' }} />
    <div className="absolute w-80 h-80 rounded-full opacity-15 blur-3xl" style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)', bottom: '20%', left: '5%', animation: 'float2 25s ease-in-out infinite' }} />
    <div className="absolute w-64 h-64 rounded-full opacity-10 blur-3xl" style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', top: '50%', left: '50%', animation: 'float3 18s ease-in-out infinite' }} />
    <style>{`
      @keyframes float1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, -30px); } }
      @keyframes float2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-40px, 20px); } }
      @keyframes float3 { 0%, 100% { transform: translate(-50%, -50%); } 50% { transform: translate(-50%, -50%) scale(1.2); } }
    `}</style>
  </div>
);

const GlassCard = ({ children, className = '', warning = false, onClick = null }) => (
  <div 
    className={`relative rounded-2xl p-6 ${className} ${onClick ? 'cursor-pointer' : ''}`}
    style={{
      background: warning ? 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.02) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      border: warning ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
    }}
    onClick={onClick}
  >
    {children}
  </div>
);

// Professionelle SVG Icons
const Icons = {
  boat: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 17h18M5 17l2-8h10l2 8M7 9V6a1 1 0 011-1h8a1 1 0 011 1v3M12 5V3" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  upload: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  list: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  download: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  send: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  mail: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  receipt: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  table: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  archive: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  x: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  trophy: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
};

const IconBadge = ({ icon, children, color = 'slate' }) => {
  const colors = {
    purple: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return (
    <div className={`w-10 h-10 rounded-xl ${colors[color]} border flex items-center justify-center`}>
      {icon || children}
    </div>
  );
};

const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  const colors = { info: 'bg-slate-800 border-slate-700 text-slate-200', success: 'bg-emerald-900/80 border-emerald-700 text-emerald-200', warning: 'bg-amber-900/80 border-amber-700 text-amber-200', error: 'bg-red-900/80 border-red-700 text-red-200' };
  const icons = { info: Icons.info, success: Icons.check, warning: Icons.warning, error: Icons.x };
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl border ${colors[type]} backdrop-blur-sm shadow-lg animate-slideUp`}>
      <div className="flex items-center gap-3"><span className="w-5 h-5">{icons[type]}</span><span>{message}</span><button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100">{Icons.x}</button></div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } } .animate-slideUp { animation: slideUp 0.3s ease-out; }`}</style>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl p-6 max-h-[80vh] overflow-y-auto" style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.95) 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ============================================
// HAUPTKOMPONENTE
// ============================================

function App() {
  // === STATE (wie in v6-fixed) ===
  const [boatData, setBoatData] = useState(() => {
    const saved = localStorage.getItem('tsc-boat-data');
    return saved ? JSON.parse(saved) : {
      segelnummer: '',
      seglername: '',
      bootsklasse: 'Optimist',
      iban: '',
      kontoinhaber: ''
    };
  });
  
  const [regatten, setRegatten] = useState(() => {
    const saved = localStorage.getItem('tsc-regatten-v6');
    return saved ? JSON.parse(saved) : [];
  });
  
  // UI State
  const [activeTab, setActiveTab] = useState('add');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // PDF Upload State (Ergebnisliste)
  const [pdfResult, setPdfResult] = useState(null);
  const [currentPdfData, setCurrentPdfData] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [debugText, setDebugText] = useState('');
  const [ocrProgress, setOcrProgress] = useState(null);
  
  // Rechnungs-Upload State
  const [currentInvoiceData, setCurrentInvoiceData] = useState(null);
  const [currentInvoiceAmount, setCurrentInvoiceAmount] = useState('');
  const [invoiceProcessing, setInvoiceProcessing] = useState(false);
  const [isDraggingInvoice, setIsDraggingInvoice] = useState(false);
  
  // Temporäre PDF-Speicherung für Anhänge (nicht in localStorage!)
  const [pdfAttachments, setPdfAttachments] = useState([]);
  
  // Manuelle Korrektur State
  const [manualPlacement, setManualPlacement] = useState('');
  const [manualTotalParticipants, setManualTotalParticipants] = useState('');
  const [manualRegattaName, setManualRegattaName] = useState('');
  const [manualRaceCount, setManualRaceCount] = useState('');
  
  // Crew-Verwaltung für Mehrpersonenboote
  const [crewMembers, setCrewMembers] = useState([]);
  
  // Einreichungs-State
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Hilfsfunktion: Minimale Crew-Anzahl
  const getMinCrewCount = (boatClass) => {
    const config = BOAT_CLASSES[boatClass];
    if (!config) return 1;
    const maxCrew = config.crew;
    // Bei 4-5 Personen-Booten ist 1 weniger OK
    if (maxCrew >= 4) return maxCrew - 1;
    return maxCrew;
  };
  
  const getMaxCrewCount = (boatClass) => {
    const config = BOAT_CLASSES[boatClass];
    return config ? config.crew : 1;
  };
  
  // Aktuelle Bootsklasse (aus PDF oder Bootsdaten)
  const currentBoatClass = pdfResult?.boatClass || boatData.bootsklasse;
  const maxCrew = getMaxCrewCount(currentBoatClass);
  const minCrew = getMinCrewCount(currentBoatClass);
  
  // Crew initialisieren wenn Bootsklasse sich ändert
  useEffect(() => {
    if (maxCrew > 1 && crewMembers.length === 0) {
      // Ersten Eintrag mit Seglername vorausfüllen
      const initialCrew = [{ name: boatData.seglername || '', verein: 'TSC' }];
      // Restliche Plätze leer
      for (let i = 1; i < minCrew; i++) {
        initialCrew.push({ name: '', verein: '' });
      }
      setCrewMembers(initialCrew);
    }
  }, [maxCrew, minCrew, boatData.seglername]);
  
  // Crew-Mitglied hinzufügen
  const addCrewMember = () => {
    if (crewMembers.length < maxCrew) {
      setCrewMembers(prev => [...prev, { name: '', verein: '' }]);
    }
  };
  
  // Crew-Mitglied entfernen
  const removeCrewMember = (index) => {
    if (crewMembers.length > minCrew) {
      setCrewMembers(prev => prev.filter((_, i) => i !== index));
    }
  };
  
  // Crew-Mitglied aktualisieren
  const updateCrewMember = (index, field, value) => {
    setCrewMembers(prev => prev.map((member, i) => 
      i === index ? { ...member, [field]: value } : member
    ));
  };
  
  // Manuelle Eingabe State
  const [manualData, setManualData] = useState({
    regattaName: '',
    boatClass: '',
    date: '',
    placement: '',
    totalParticipants: '',
    raceCount: '',
    invoiceAmount: ''
  });

  // === PERSISTENZ (OHNE PDF-Daten - die sind zu groß für localStorage) ===
  
  // Einmalig: Alte Daten mit PDFs löschen falls vorhanden
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tsc-regatten-v6');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Prüfen ob alte Daten PDF-Daten enthalten
        if (parsed.some(r => r.resultPdfData || r.invoicePdfData)) {
          console.log('Entferne alte PDF-Daten aus localStorage...');
          const cleaned = parsed.map(r => ({
            ...r,
            resultPdfData: null,
            invoicePdfData: null
          }));
          localStorage.setItem('tsc-regatten-v6', JSON.stringify(cleaned));
          setRegatten(cleaned);
        }
      }
    } catch (e) {
      console.error('Cleanup error:', e);
      localStorage.removeItem('tsc-regatten-v6');
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem('tsc-boat-data', JSON.stringify(boatData));
  }, [boatData]);
  
  useEffect(() => {
    // PDF-Daten entfernen vor dem Speichern (zu groß für localStorage)
    const regattenToSave = regatten.map(r => ({
      ...r,
      resultPdfData: null,  // Nicht speichern
      invoicePdfData: null  // Nicht speichern
    }));
    try {
      localStorage.setItem('tsc-regatten-v6', JSON.stringify(regattenToSave));
    } catch (e) {
      console.error('localStorage error:', e);
      // Falls immer noch zu groß, versuche ohne alte Einträge
      if (e.name === 'QuotaExceededError') {
        console.warn('localStorage voll - lösche alte Daten');
        localStorage.removeItem('tsc-regatten-v6');
      }
    }
  }, [regatten]);

  // Clear messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);
  
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // === OCR FUNKTION (EXAKT wie in v6-fixed) ===
  const performOCR = async (pdf, progressPrefix = '') => {
    let fullText = '';
    const totalPages = pdf.numPages;
    
    for (let i = 1; i <= totalPages; i++) {
      try {
        setOcrProgress({ 
          status: `${progressPrefix}Seite ${i}/${totalPages} wird gescannt...`, 
          percent: Math.round((i - 1) / totalPages * 100) 
        });
        
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        const { data } = await Tesseract.recognize(canvas, 'deu+eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress({ 
                status: `${progressPrefix}Seite ${i}/${totalPages}: Text wird erkannt...`, 
                percent: Math.round(((i - 1) + m.progress) / totalPages * 100) 
              });
            }
          }
        });
        
        fullText += data.text + '\n';
      } catch (pageError) {
        console.error(`OCR error on page ${i}:`, pageError);
      }
    }
    
    return fullText;
  };

  // === PDF TEXT EXTRAKTION (EXAKT wie in v6-fixed) ===
  const extractTextFromPDF = async (arrayBuffer, useOcrFallback = true, progressPrefix = '') => {
    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (e) {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true }).promise;
    }
    
    let fullText = '';
    
    // Direkte Extraktion versuchen
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        for (const item of textContent.items) {
          if (item.str && item.str.trim()) {
            fullText += item.str + ' ';
          }
        }
        fullText += '\n';
      } catch (e) {
        console.error(`Error on page ${i}:`, e);
      }
    }
    
    // OCR falls nötig (weniger als 100 Zeichen = wahrscheinlich gescannte PDF)
    if (fullText.trim().length < 100 && useOcrFallback) {
      console.log('Switching to OCR...');
      fullText = await performOCR(pdf, progressPrefix);
    }
    
    return { text: fullText, pdf };
  };

  // === RECHNUNGSBETRAG EXTRAHIEREN (EXAKT wie in v6-fixed) ===
  const extractInvoiceAmount = (text) => {
    console.log('Extracting invoice amount from:', text.substring(0, 500));
    
    const patterns = [
      /(?:Gesamt|Summe|Total|Betrag|Rechnungsbetrag|Endbetrag|zu zahlen)[:\s]*(\d+[.,]\d{2})\s*(?:€|EUR|Euro)?/gi,
      /(\d+[.,]\d{2})\s*(?:€|EUR|Euro)\s*$/gm,
      /(?:€|EUR|Euro)\s*(\d+[.,]\d{2})/gi,
      /Startgeld[:\s]*(\d+[.,]\d{2})/gi,
      /Meldegeld[:\s]*(\d+[.,]\d{2})/gi,
    ];
    
    const foundAmounts = [];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const amountStr = match[1].replace(',', '.');
        const amount = parseFloat(amountStr);
        if (amount > 0 && amount < 1000) {
          foundAmounts.push(amount);
        }
      }
    }
    
    if (foundAmounts.length > 0) {
      const counts = {};
      foundAmounts.forEach(a => {
        const key = a.toFixed(2);
        counts[key] = (counts[key] || 0) + 1;
      });
      
      const sorted = Object.entries(counts).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return parseFloat(b[0]) - parseFloat(a[0]);
      });
      
      console.log('Found amounts:', counts);
      return parseFloat(sorted[0][0]);
    }
    
    return null;
  };

  // === ERGEBNISLISTE PARSEN (VERBESSERT) ===
  const parseRegattaPDF = (text, sailNumber) => {
    const result = {
      success: false,
      regattaName: '',
      boatClass: '',
      date: '',
      raceCount: 0,
      totalParticipants: 0,
      participant: null,
      allResults: []
    };

    try {
      const normalizedText = text.replace(/\s+/g, ' ');
      
      // Regatta-Name
      const namePatterns = [
        /([A-Za-zäöüÄÖÜß\-]+(?:[\s\-][A-Za-zäöüÄÖÜß\-]+)*[\s\-]*(?:Preis|Pokal|Cup|Trophy|Regatta|Festival)[\s\-]*\d{4})/i,
        /manage2sail\.com\s+([A-Za-zäöüÄÖÜß0-9\s\-]+?)(?:\s+Ergebnisse|\s+Overall|\s+Results)/i,
      ];
      
      for (const pattern of namePatterns) {
        const match = normalizedText.match(pattern);
        if (match) {
          result.regattaName = match[1].trim().replace(/\s+/g, ' ');
          break;
        }
      }
      
      // Bootsklasse
      const classPatterns = [
        /(?:Klasse|Class)[:\s]*([A-Za-z0-9\s]+?)(?:\s+Ergebnisse|\s+Overall|\s+Results|\s+R1)/i,
        /(Optimist\s*[AB]?|ILCA\s*\d|Laser|420er?|470er?|29er|49er|Europe|Finn)/i,
      ];
      
      for (const pattern of classPatterns) {
        const match = normalizedText.match(pattern);
        if (match) {
          result.boatClass = match[1].trim();
          break;
        }
      }
      
      // Datum
      const dateMatch = normalizedText.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/);
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        let year = dateMatch[3];
        if (year.length === 2) year = '20' + year;
        result.date = `${year}-${month}-${day}`;
      }
      
      // Wettfahrten zählen
      const raceMatches = normalizedText.match(/R\d+/g);
      if (raceMatches) {
        const uniqueRaces = [...new Set(raceMatches)];
        result.raceCount = uniqueRaces.length;
      }
      
      // === VERBESSERTE SEGELNUMMER-SUCHE ===
      const lines = text.split('\n');
      const entries = [];
      
      // Normalisiere die gesuchte Segelnummer (entferne Leerzeichen, nur Zahlen extrahieren)
      const normalizedSail = sailNumber.replace(/\s+/g, '').toUpperCase();
      const sailNumberOnly = sailNumber.replace(/[^0-9]/g, ''); // Nur die Ziffern
      
      console.log('Searching for sail number:', normalizedSail, 'digits only:', sailNumberOnly);
      
      for (const line of lines) {
        // Suche nach Segelnummern in verschiedenen Formaten
        // GER 13162, GER13162, 13162, etc.
        const sailPatterns = [
          /([A-Z]{2,3})\s*(\d{3,6})/gi,  // GER 13162 oder GER13162
          /\b(\d{4,6})\b/g,               // Nur Nummern wie 13162
        ];
        
        let foundSailInLine = null;
        let foundSailNumber = null;
        
        for (const pattern of sailPatterns) {
          const matches = [...line.matchAll(pattern)];
          for (const match of matches) {
            const fullMatch = match[0].replace(/\s+/g, '').toUpperCase();
            const numberPart = match[2] || match[1]; // Entweder Gruppe 2 (bei GER 13162) oder Gruppe 1 (bei 13162)
            
            // Prüfe ob diese Segelnummer zur gesuchten passt
            if (fullMatch === normalizedSail || 
                fullMatch.includes(sailNumberOnly) ||
                numberPart === sailNumberOnly) {
              foundSailInLine = fullMatch.includes('GER') ? fullMatch : 'GER' + numberPart;
              foundSailNumber = numberPart;
              break;
            }
          }
          if (foundSailInLine) break;
        }
        
        // Wenn wir die gesuchte Segelnummer in dieser Zeile gefunden haben
        if (foundSailInLine) {
          console.log('Found sail number in line:', line.substring(0, 100));
          
          // Rang am Zeilenanfang oder irgendwo in der Zeile finden
          const rankPatterns = [
            /^\s*(\d{1,3})[\s.)\-]/,           // "5. " am Anfang
            /^\s*(\d{1,3})\s/,                  // "5 " am Anfang
            /Rank[:\s]*(\d{1,3})/i,            // "Rank: 5"
            /Platz[:\s]*(\d{1,3})/i,           // "Platz 5"
          ];
          
          let rank = null;
          for (const rankPattern of rankPatterns) {
            const rankMatch = line.match(rankPattern);
            if (rankMatch) {
              rank = parseInt(rankMatch[1]);
              if (rank > 0 && rank <= 500) {
                console.log('Found rank:', rank);
                break;
              }
            }
          }
          
          // Name finden
          const nameMatch = line.match(/([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][A-ZÄÖÜ]+)/);
          
          if (rank) {
            result.participant = {
              rank,
              sailNumber: foundSailInLine,
              name: nameMatch ? `${nameMatch[2]} ${nameMatch[1]}` : '',
            };
          }
        }
        
        // Alle Einträge sammeln für Gesamtteilnehmerzahl
        const allSailMatches = [...line.matchAll(/([A-Z]{2,3})\s*(\d{3,6})/gi)];
        for (const sailMatch of allSailMatches) {
          const rankMatch = line.match(/^\s*(\d{1,3})[\s.)\-]/);
          if (rankMatch) {
            const rank = parseInt(rankMatch[1]);
            if (rank > 0 && rank <= 500) {
              entries.push({
                rank,
                sailNumber: (sailMatch[1] + sailMatch[2]).toUpperCase(),
              });
            }
          }
        }
      }
      
      result.allResults = entries.sort((a, b) => a.rank - b.rank);
      result.totalParticipants = entries.length > 0 ? Math.max(...entries.map(e => e.rank)) : 0;
      result.success = result.participant !== null || entries.length > 0;
      
      if (!result.regattaName) {
        result.regattaName = result.boatClass ? `Regatta (${result.boatClass})` : 'Regatta';
      }
      
      console.log('Parse result:', { 
        participant: result.participant, 
        totalParticipants: result.totalParticipants,
        regattaName: result.regattaName 
      });
      
    } catch (err) {
      console.error('Parse error:', err);
    }
    
    return result;
  };

  // === ERGEBNISLISTE VERARBEITEN (mit OCR-Fallback) ===
  const processResultPdf = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Bitte eine PDF-Datei auswählen');
      return;
    }
    
    if (!boatData.segelnummer) {
      setError('Bitte zuerst die Segelnummer in den Einstellungen eingeben');
      setActiveTab('settings');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setPdfResult(null);
    setDebugText('');
    setOcrProgress(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      setCurrentPdfData(base64);
      
      // Erst direkte Textextraktion versuchen (OHNE OCR-Fallback)
      let pdf;
      try {
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      } catch (e) {
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true }).promise;
      }
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          for (const item of textContent.items) {
            if (item.str && item.str.trim()) {
              fullText += item.str + ' ';
            }
          }
          fullText += '\n';
        } catch (e) {
          console.error(`Error on page ${i}:`, e);
        }
      }
      
      console.log('Direct extraction text length:', fullText.length);
      
      // Parse mit direkt extrahiertem Text
      let result = parseRegattaPDF(fullText, boatData.segelnummer);
      
      // Wenn keine Platzierung gefunden -> automatisch OCR versuchen
      if (!result.participant && fullText.length < 500) {
        console.log('Keine Platzierung gefunden und wenig Text - starte OCR...');
        setOcrProgress({ status: 'Starte OCR-Texterkennung...', percent: 0 });
        fullText = await performOCR(pdf, 'Ergebnisliste: ');
        result = parseRegattaPDF(fullText, boatData.segelnummer);
      } else if (!result.participant) {
        // Text vorhanden aber keine Platzierung - auch OCR versuchen
        console.log('Text extrahiert aber keine Platzierung gefunden - versuche OCR...');
        setOcrProgress({ status: 'Platzierung nicht gefunden - starte OCR...', percent: 0 });
        const ocrText = await performOCR(pdf, 'Ergebnisliste: ');
        const ocrResult = parseRegattaPDF(ocrText, boatData.segelnummer);
        
        // Wenn OCR bessere Ergebnisse liefert, nutze diese
        if (ocrResult.participant) {
          result = ocrResult;
          fullText = ocrText;
        }
      }
      
      setDebugText(fullText.substring(0, 5000));
      
      if (fullText.trim().length < 50) {
        setError('PDF konnte nicht gelesen werden.');
        return;
      }
      
      // Duplikat-Check
      if (result.success && result.regattaName) {
        const isDuplicate = regatten.some(r => 
          r.regattaName === result.regattaName && r.boatClass === result.boatClass
        );
        if (isDuplicate) {
          setError(`Diese Regatta "${result.regattaName}" ist bereits in deiner Liste!`);
          setPdfResult(result);
          return;
        }
      }
      
      setPdfResult(result);
      
      if (!result.success) {
        setError('PDF konnte nicht vollständig gelesen werden.');
      } else if (!result.participant) {
        setError(`Segelnummer "${boatData.segelnummer}" nicht gefunden - bitte Platzierung manuell eingeben.`);
      } else {
        setSuccess(`${result.participant.name || 'Teilnehmer'} gefunden: Platz ${result.participant.rank} von ${result.totalParticipants}`);
      }
      
    } catch (err) {
      console.error('PDF Error:', err);
      setError('Fehler: ' + err.message);
    } finally {
      setIsProcessing(false);
      setOcrProgress(null);
    }
  };

  // === RECHNUNG VERARBEITEN (EXAKT wie in v6-fixed) ===
  const processInvoicePdf = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Bitte eine PDF-Datei auswählen');
      return;
    }
    
    setInvoiceProcessing(true);
    setError(null);
    setOcrProgress(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      setCurrentInvoiceData(base64);
      
      const { text } = await extractTextFromPDF(arrayBuffer, true, 'Rechnung: ');
      console.log('Invoice text:', text.substring(0, 1000));
      
      const amount = extractInvoiceAmount(text);
      
      if (amount) {
        setCurrentInvoiceAmount(amount.toFixed(2).replace('.', ','));
        setSuccess(`Rechnungsbetrag erkannt: ${amount.toFixed(2).replace('.', ',')} €`);
      } else {
        setError('Rechnungsbetrag konnte nicht automatisch erkannt werden. Bitte manuell eingeben.');
        setCurrentInvoiceAmount('');
      }
      
    } catch (err) {
      console.error('Invoice Error:', err);
      setError('Fehler beim Lesen der Rechnung: ' + err.message);
    } finally {
      setInvoiceProcessing(false);
      setOcrProgress(null);
    }
  };

  // === DRAG & DROP HANDLER ===
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDropResult = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    await processResultPdf(e.dataTransfer.files?.[0]);
  };
  
  const handleDragOverInvoice = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingInvoice(true); };
  const handleDragLeaveInvoice = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingInvoice(false); };
  const handleDropInvoice = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingInvoice(false);
    await processInvoicePdf(e.dataTransfer.files?.[0]);
  };

  // === REGATTA HINZUFÜGEN (mit manueller Korrektur) ===
  const addRegattaFromPdf = () => {
    try {
      if (!pdfResult) {
        setError('Bitte zuerst eine Ergebnisliste hochladen');
        return;
      }
      
      if (!currentInvoiceAmount) {
        setError('Bitte lade eine Rechnung hoch und gib den Betrag ein');
        return;
      }
      
      const amount = parseFloat(currentInvoiceAmount.replace(',', '.'));
      if (isNaN(amount) || amount <= 0) {
        setError('Bitte einen gültigen Rechnungsbetrag eingeben');
        return;
      }
      
      // Platzierung: Manuell eingegeben oder aus PDF
      const placement = manualPlacement ? parseInt(manualPlacement) : pdfResult.participant?.rank;
      const totalParticipants = manualTotalParticipants ? parseInt(manualTotalParticipants) : pdfResult.totalParticipants;
      const raceCount = manualRaceCount ? parseInt(manualRaceCount) : pdfResult.raceCount;
      const regattaName = manualRegattaName.trim() || pdfResult.regattaName || '';
      
      if (!placement) {
        setError('Bitte Platzierung eingeben (wurde nicht automatisch erkannt)');
        return;
      }
      
      if (!regattaName) {
        setError('Bitte Regattanamen eingeben');
        return;
      }
      
      // Crew-Validierung bei Mehrpersonenbooten
      const boatClass = pdfResult.boatClass || boatData.bootsklasse;
      const requiredCrew = getMinCrewCount(boatClass);
      const maxCrewForClass = getMaxCrewCount(boatClass);
      
      if (maxCrewForClass > 1) {
        const filledCrew = crewMembers.filter(m => m.name.trim());
        if (filledCrew.length < requiredCrew) {
          setError(`Bitte mindestens ${requiredCrew} Crewmitglieder angeben (${boatClass} benötigt ${requiredCrew}-${maxCrewForClass} Personen)`);
          return;
        }
      }
      
      const newRegatta = {
        id: Date.now(),
        regattaName: regattaName,
        boatClass: pdfResult.boatClass || boatData.bootsklasse,
        date: pdfResult.date || '',
        placement: placement,
        totalParticipants: totalParticipants || 0,
        raceCount: raceCount || 0,
        sailorName: pdfResult.participant?.name || boatData.seglername,
        // Crew speichern (nur ausgefüllte)
        crew: maxCrewForClass > 1 ? crewMembers.filter(m => m.name.trim()) : [],
        // PDF-Daten werden NICHT mehr gespeichert (localStorage Limit)
        resultPdfData: null,
        invoicePdfData: null,
        invoiceAmount: amount,
        addedAt: new Date().toISOString()
      };
      
      console.log('Adding regatta:', newRegatta);
      
      // PDFs für Anhänge speichern (temporär, nicht in localStorage)
      if (currentPdfData || currentInvoiceData) {
        setPdfAttachments(prev => [...prev, {
          regattaId: newRegatta.id,
          regattaName: regattaName,
          resultPdf: currentPdfData,
          invoicePdf: currentInvoiceData
        }]);
      }
      
      setRegatten(prev => [...prev, newRegatta]);
      
      // Reset alle States
      setPdfResult(null);
      setCurrentPdfData(null);
      setCurrentInvoiceData(null);
      setCurrentInvoiceAmount('');
      setManualPlacement('');
      setManualTotalParticipants('');
      setManualRegattaName('');
      setManualRaceCount('');
      setCrewMembers([]);
      setDebugText('');
      
      setSuccess(`"${regattaName}" wurde hinzugefügt! (${amount.toFixed(2).replace('.', ',')} €)`);
      setActiveTab('list');
      
    } catch (err) {
      console.error('Error adding regatta:', err);
      setError('Fehler beim Hinzufügen: ' + err.message);
    }
  };

  const addRegattaManual = () => {
    const { regattaName, boatClass, date, placement, totalParticipants, raceCount, invoiceAmount } = manualData;
    
    if (!regattaName || !placement || !totalParticipants || !invoiceAmount) {
      setError('Bitte alle Pflichtfelder ausfüllen (Name, Platzierung, Teilnehmer, Rechnungsbetrag)');
      return;
    }
    
    const amount = parseFloat(invoiceAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setError('Bitte einen gültigen Rechnungsbetrag eingeben');
      return;
    }
    
    // Crew-Validierung bei Mehrpersonenbooten
    const usedBoatClass = boatClass || boatData.bootsklasse;
    const requiredCrew = getMinCrewCount(usedBoatClass);
    const maxCrewForClass = getMaxCrewCount(usedBoatClass);
    
    if (maxCrewForClass > 1) {
      const filledCrew = crewMembers.filter(m => m.name.trim());
      if (filledCrew.length < requiredCrew) {
        setError(`Bitte mindestens ${requiredCrew} Crewmitglieder angeben (${usedBoatClass} benötigt ${requiredCrew}-${maxCrewForClass} Personen)`);
        return;
      }
    }
    
    const newRegatta = {
      id: Date.now(),
      regattaName,
      boatClass: usedBoatClass,
      date,
      placement: parseInt(placement),
      totalParticipants: parseInt(totalParticipants),
      raceCount: parseInt(raceCount) || 0,
      sailorName: boatData.seglername,
      // Crew speichern (nur ausgefüllte)
      crew: maxCrewForClass > 1 ? crewMembers.filter(m => m.name.trim()) : [],
      // PDF-Daten werden NICHT mehr gespeichert (localStorage Limit)
      resultPdfData: null,
      invoicePdfData: null,
      invoiceAmount: amount,
      addedAt: new Date().toISOString()
    };
    
    setRegatten(prev => [...prev, newRegatta]);
    setManualData({ regattaName: '', boatClass: '', date: '', placement: '', totalParticipants: '', raceCount: '', invoiceAmount: '' });
    setPdfResult(null);
    setCurrentPdfData(null);
    setCurrentInvoiceData(null);
    setCurrentInvoiceAmount('');
    setCrewMembers([]);
    setSuccess(`"${regattaName}" wurde hinzugefügt!`);
    setActiveTab('list');
  };

  // === BERECHNUNGEN ===
  const totalAmount = regatten.reduce((sum, r) => sum + (r.invoiceAmount || 0), 0);

  // === PDF EXPORT (Gesamtantrag mit Anhängen) ===
  const generatePDF = () => {
    console.log('generatePDF aufgerufen, regatten:', regatten.length);
    
    if (regatten.length === 0) {
      setError('Keine Regatten vorhanden - bitte erst Regatten hinzufügen');
      return null;
    }
    
    try {
      const doc = new jsPDF();
      console.log('jsPDF erstellt');
      
      // === SEITE 1: ANTRAGSFORMULAR ===
      
      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Antrag auf Startgeld-Erstattung', 105, 20, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tegeler Segel-Club e.V. - Saison ${new Date().getFullYear()}`, 105, 28, { align: 'center' });
      
      // Linie
      doc.setDrawColor(139, 92, 246);
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);
      
      // Antragsteller-Box
      doc.setFillColor(248, 250, 252);
      doc.rect(20, 40, 170, 35, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(20, 40, 170, 35, 'S');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Antragsteller:in', 25, 48);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${boatData.seglername || '-'}`, 25, 56);
      doc.text(`Segelnummer: ${boatData.segelnummer || '-'}`, 25, 62);
      doc.text(`Bootsklasse: ${boatData.bootsklasse || '-'}`, 25, 68);
      doc.text(`IBAN: ${boatData.iban || '-'}`, 110, 56);
      doc.text(`Kontoinhaber:in: ${boatData.kontoinhaber || '-'}`, 110, 62);
      
      // Regatten-Tabelle
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Besuchte Regatten', 20, 85);
      
      // AutoTable nur wenn verfügbar
      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          startY: 90,
          head: [['Nr.', 'Regatta', 'Datum', 'Platz', 'Boote', 'Wettf.', 'Startgeld']],
          body: regatten.map((r, i) => [
            (i + 1).toString(),
            r.regattaName || '-',
            r.date ? new Date(r.date).toLocaleDateString('de-DE') : '-',
            r.placement ? `${r.placement}.` : '-',
            r.totalParticipants || '-',
            r.raceCount || '-',
            r.invoiceAmount ? `${r.invoiceAmount.toFixed(2)} €` : '-'
          ]),
          foot: [['', '', '', '', '', 'Gesamt:', `${totalAmount.toFixed(2)} €`]],
          theme: 'grid',
          headStyles: { fillColor: [139, 92, 246], fontStyle: 'bold', halign: 'center' },
          footStyles: { fillColor: [16, 185, 129], fontStyle: 'bold', textColor: [255, 255, 255] },
          columnStyles: {
            0: { halign: 'center', cellWidth: 12 },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'right' }
          },
          styles: { fontSize: 9 }
        });
      } else {
        // Fallback ohne autoTable
        console.warn('autoTable nicht verfügbar, einfache Tabelle');
        let y = 95;
        regatten.forEach((r, i) => {
          doc.setFontSize(9);
          doc.text(`${i+1}. ${r.regattaName}: ${r.invoiceAmount?.toFixed(2) || '0'} € (Platz ${r.placement || '?'})`, 25, y);
          y += 6;
        });
        doc.setFont('helvetica', 'bold');
        doc.text(`Gesamt: ${totalAmount.toFixed(2)} €`, 25, y + 5);
      }
      
      // Crew-Details (falls vorhanden)
      const afterTableY = doc.lastAutoTable?.finalY || 150;
      let currentY = afterTableY + 15;
      
      const regattasWithCrew = regatten.filter(r => r.crew && r.crew.length > 0);
      if (regattasWithCrew.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Crew-Besetzungen:', 20, currentY);
        doc.setFont('helvetica', 'normal');
        currentY += 6;
        
        regattasWithCrew.forEach((r) => {
          const crewList = r.crew.map((c, idx) => {
            const vereinText = c.verein ? ` (${c.verein})` : '';
            return `${idx + 1}. ${c.name}${vereinText}`;
          }).join(', ');
          doc.setFontSize(9);
          doc.text(`${r.regattaName}: ${crewList}`, 25, currentY, { maxWidth: 165 });
          currentY += 8;
        });
      }
      
      // Unterschriften
      const signY = Math.max(currentY + 20, 240);
      doc.setDrawColor(100);
      doc.line(20, signY, 85, signY);
      doc.line(115, signY, 180, signY);
      doc.setFontSize(8);
      doc.text('Ort, Datum, Unterschrift Antragsteller:in', 20, signY + 5);
      doc.text('Genehmigt (Vorstand)', 115, signY + 5);
      
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')}`, 105, 285, { align: 'center' });
      
      console.log('PDF erstellt, starte Download...');
      
      // Download über Blob (robuster)
      const pdfBlob = doc.output('blob');
      const filename = `TSC_Erstattungsantrag_${boatData.seglername?.replace(/\s/g, '_') || 'Antrag'}_${new Date().toISOString().slice(0,10)}.pdf`;
      
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      console.log('PDF Download gestartet:', filename);
      setSuccess('PDF-Antrag wurde erstellt: ' + filename);
      return pdfBlob;
      
    } catch (err) {
      console.error('PDF Error:', err);
      setError('Fehler beim Erstellen des PDFs: ' + err.message);
      return null;
    }
  };

  // === ALLE DOKUMENTE HERUNTERLADEN ===
  const downloadAllDocuments = async () => {
    console.log('downloadAllDocuments aufgerufen');
    
    if (regatten.length === 0) {
      setError('Keine Regatten vorhanden - bitte erst Regatten hinzufügen');
      return;
    }
    
    try {
      setSuccess('Downloads werden vorbereitet...');
      
      // 1. Gesamtantrag PDF
      generatePDF();
      
      // Kurze Verzögerung zwischen Downloads (Browser-Schutz)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 2. CSV
      generateCSV();
      
      // 3. Original-PDFs einzeln herunterladen (mit Verzögerung)
      for (let index = 0; index < pdfAttachments.length; index++) {
        const attachment = pdfAttachments[index];
        const regattaName = attachment.regattaName?.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_') || `Regatta_${index + 1}`;
        
        if (attachment.resultPdf) {
          await new Promise(resolve => setTimeout(resolve, 300));
          const blob = base64ToBlob(attachment.resultPdf, 'application/pdf');
          downloadBlob(blob, `${index + 1}_Ergebnis_${regattaName}.pdf`);
        }
        
        if (attachment.invoicePdf) {
          await new Promise(resolve => setTimeout(resolve, 300));
          const blob = base64ToBlob(attachment.invoicePdf, 'application/pdf');
          downloadBlob(blob, `${index + 1}_Rechnung_${regattaName}.pdf`);
        }
      }
      
      const totalFiles = 2 + pdfAttachments.filter(a => a.resultPdf).length + pdfAttachments.filter(a => a.invoicePdf).length;
      setSuccess(`${totalFiles} Dateien wurden heruntergeladen`);
      
    } catch (err) {
      console.error('Download Error:', err);
      setError('Fehler beim Herunterladen: ' + err.message);
    }
  };

  // Hilfsfunktionen für Downloads
  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // === CSV EXPORT (Ein Buchungssatz) ===
  const generateCSV = () => {
    console.log('generateCSV aufgerufen, regatten:', regatten.length);
    
    if (regatten.length === 0) {
      setError('Keine Regatten vorhanden - bitte erst Regatten hinzufügen');
      return;
    }
    
    try {
      // Ein Buchungssatz für die Buchhaltung
      const datum = new Date().toLocaleDateString('de-DE');
      const verwendungszweck = `Startgeld-Erstattung ${boatData.seglername} - ${regatten.length} Regatta(en): ${regatten.map(r => r.regattaName).join(', ')}`;
      
      const headers = ['Datum', 'Empfänger:in', 'IBAN', 'Betrag', 'Währung', 'Verwendungszweck', 'Bootsklasse', 'Segelnummer'];
      const row = [
        datum,
        boatData.kontoinhaber || boatData.seglername,
        boatData.iban,
        totalAmount.toFixed(2).replace('.', ','),
        'EUR',
        verwendungszweck,
        boatData.bootsklasse,
        boatData.segelnummer
      ];
      
      const csv = [
        headers.join(';'),
        row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(';')
      ].join('\n');
      
      console.log('CSV erstellt, starte Download...');
      
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const filename = `TSC_Buchungssatz_${boatData.seglername?.replace(/\s/g, '_') || 'Export'}_${new Date().toISOString().slice(0,10)}.csv`;
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      console.log('CSV Download gestartet:', filename);
      setSuccess('CSV-Buchungssatz wurde erstellt: ' + filename);
      
    } catch (err) {
      console.error('CSV Error:', err);
      setError('Fehler beim Erstellen der CSV: ' + err.message);
    }
  };

  // === ONLINE EINREICHEN (FormSubmit.co) ===
  const submitOnline = async () => {
    if (regatten.length === 0) {
      setError('Keine Regatten zum Einreichen');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // FormData erstellen
      const formData = new FormData();
      
      // Basis-Daten
      formData.append('_subject', `TSC Startgeld-Erstattung: ${boatData.seglername} - ${totalAmount.toFixed(2)} €`);
      formData.append('Antragsteller', boatData.seglername || '-');
      formData.append('Segelnummer', boatData.segelnummer || '-');
      formData.append('Bootsklasse', boatData.bootsklasse || '-');
      formData.append('IBAN', boatData.iban || '-');
      formData.append('Kontoinhaber', boatData.kontoinhaber || '-');
      formData.append('Gesamtbetrag', `${totalAmount.toFixed(2)} €`);
      formData.append('Anzahl_Regatten', regatten.length.toString());
      
      // Regatten-Details inkl. Crew
      regatten.forEach((r, i) => {
        let details = `${r.regattaName}: ${r.invoiceAmount?.toFixed(2) || '0'} € (Platz ${r.placement || '?'} von ${r.totalParticipants || '?'})`;
        if (r.crew && r.crew.length > 0) {
          const crewList = r.crew.map(c => `${c.name}${c.verein ? ` (${c.verein})` : ''}`).join(', ');
          details += ` | Crew: ${crewList}`;
        }
        formData.append(`Regatta_${i + 1}`, details);
      });
      
      // PDF-Anhänge als Files
      pdfAttachments.forEach((attachment, index) => {
        if (attachment.resultPdf) {
          const blob = base64ToBlob(attachment.resultPdf, 'application/pdf');
          formData.append(`Ergebnis_${index + 1}`, blob, `Ergebnis_${attachment.regattaName?.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
        }
        if (attachment.invoicePdf) {
          const blob = base64ToBlob(attachment.invoicePdf, 'application/pdf');
          formData.append(`Rechnung_${index + 1}`, blob, `Rechnung_${attachment.regattaName?.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
        }
      });
      
      // An FormSubmit.co senden
      const response = await fetch('https://formsubmit.co/ajax/kolja.schumann@aitema.de', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess('Antrag erfolgreich eingereicht! Du erhältst eine Bestätigung per E-Mail.');
        // Optional: Daten zurücksetzen
      } else {
        throw new Error(result.message || 'Einreichung fehlgeschlagen');
      }
      
    } catch (err) {
      console.error('Submit Error:', err);
      // Fallback auf mailto
      setError('Online-Einreichung fehlgeschlagen. Versuche Mail-Variante...');
      setTimeout(() => submitViaEmail(), 1000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // === ANTRAG PER MAIL (Fallback) ===
  const submitViaEmail = () => {
    try {
      // Erst alle Dokumente herunterladen
      downloadAllDocuments();
      
      // Mail-Body erstellen
      const mailTo = 'kolja.schumann@aitema.de';
      const subject = encodeURIComponent(`TSC Startgeld-Erstattung: ${boatData.seglername} - ${totalAmount.toFixed(2)} €`);
      
      const regattaList = regatten.map((r, i) => {
        let line = `${i+1}. ${r.regattaName || 'Regatta'}: ${r.invoiceAmount?.toFixed(2) || '0,00'} € (Platz ${r.placement || '?'} von ${r.totalParticipants || '?'})`;
        if (r.crew && r.crew.length > 0) {
          const crewList = r.crew.map(c => `${c.name}${c.verein ? ` (${c.verein})` : ''}`).join(', ');
          line += `\n   Crew: ${crewList}`;
        }
        return line;
      }).join('\n');
      
      const body = encodeURIComponent(
`Sehr geehrte Damen und Herren,

hiermit beantrage ich die Erstattung meiner Startgelder für die Saison ${new Date().getFullYear()}.

ANTRAGSTELLER:
Name: ${boatData.seglername || '-'}
Segelnummer: ${boatData.segelnummer || '-'}
Bootsklasse: ${boatData.bootsklasse || '-'}
IBAN: ${boatData.iban || '-'}
Kontoinhaber: ${boatData.kontoinhaber || '-'}

REGATTEN (${regatten.length}):
${regattaList}

GESAMTBETRAG: ${totalAmount.toFixed(2)} €

BITTE DIE HERUNTERGELADENEN DATEIEN ALS ANHANG HINZUFÜGEN:
- TSC_Erstattungsantrag_*.pdf (Gesamtantrag)
- TSC_Buchungssatz_*.csv (für Buchhaltung)
- Alle Ergebnis_*.pdf und Rechnung_*.pdf Dateien

Mit freundlichen Grüßen
${boatData.seglername || 'Antragsteller'}

---
Erstellt mit TSC Startgeld-Erstattung App
`);
      
      // Mail-Client öffnen
      window.location.href = `mailto:${mailTo}?subject=${subject}&body=${body}`;
      
      setSuccess('Mail-Programm geöffnet - bitte die heruntergeladenen Dateien anhängen!');
      
    } catch (err) {
      console.error('Email Error:', err);
      setError('Fehler: ' + err.message);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(180deg, #030712 0%, #0a0f1a 50%, #030712 100%)' }}>
      <GradientOrbs />
      
      {/* Toast Notifications */}
      {success && <Toast message={success} type="success" onClose={() => setSuccess(null)} />}
      {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-2xl shadow-lg shadow-violet-500/25">⚓</div>
          <div>
            <div className="font-semibold text-white text-lg">TSC Startgelder</div>
            <div className="text-xs text-slate-500">Tegeler Segel-Club e.V.</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalAmount > 0 && (
            <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold">
              {totalAmount.toFixed(2).replace('.', ',')} €
            </div>
          )}
          <button onClick={() => setShowHelpModal(true)} className="w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors" title="Hilfe">
            {Icons.info}
          </button>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-800/50 border border-slate-700/50 mb-6">
          {[
            { id: 'settings', icon: Icons.boat, label: 'Bootsdaten' },
            { id: 'add', icon: Icons.plus, label: 'Hinzufügen' },
            { id: 'list', icon: Icons.list, label: `Liste (${regatten.length})` },
            { id: 'export', icon: Icons.download, label: 'Export' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
            >
              <span className="w-4 h-4">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 pb-12">
        
        {/* === TAB: BOOTSDATEN === */}
        {activeTab === 'settings' && (
          <GlassCard>
            <div className="flex items-center gap-3 mb-6">
              <IconBadge icon={Icons.boat} color="cyan" />
              <div>
                <h2 className="text-xl font-semibold text-white">Bootsdaten</h2>
                <p className="text-sm text-slate-400">Diese Daten werden für alle Anträge verwendet</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Name Segler:in *</label>
                <input
                  type="text"
                  value={boatData.seglername}
                  onChange={(e) => setBoatData(prev => ({ ...prev, seglername: e.target.value }))}
                  placeholder="Max Mustermann"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Segelnummer *</label>
                <input
                  type="text"
                  value={boatData.segelnummer}
                  onChange={(e) => setBoatData(prev => ({ ...prev, segelnummer: e.target.value.toUpperCase() }))}
                  placeholder="GER 12345"
                  className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-slate-500 focus:outline-none ${boatData.segelnummer ? 'border-emerald-500/50' : 'border-white/10'}`}
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Bootsklasse</label>
                <select
                  value={boatData.bootsklasse}
                  onChange={(e) => setBoatData(prev => ({ ...prev, bootsklasse: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                >
                  {Object.keys(BOAT_CLASSES).map(k => (
                    <option key={k} value={k} className="bg-slate-800">{k} ({BOAT_CLASSES[k].crew} Pers.)</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">IBAN</label>
                <input
                  type="text"
                  value={boatData.iban}
                  onChange={(e) => setBoatData(prev => ({ ...prev, iban: e.target.value.toUpperCase() }))}
                  placeholder="DE89 3704 0044 0532 0130 00"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-2">Kontoinhaber:in</label>
                <input
                  type="text"
                  value={boatData.kontoinhaber}
                  onChange={(e) => setBoatData(prev => ({ ...prev, kontoinhaber: e.target.value }))}
                  placeholder="Max Mustermann"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>
            
            {!boatData.segelnummer && (
              <div className="mt-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 text-sm flex items-start gap-2">
                <span className="w-5 h-5 flex-shrink-0 text-amber-400">{Icons.info}</span>
                <span>Die Segelnummer wird benötigt, um deine Platzierung automatisch zu erkennen.</span>
              </div>
            )}
          </GlassCard>
        )}
        
        {/* === TAB: HINZUFÜGEN === */}
        {activeTab === 'add' && (
          <div className="space-y-6">
            {/* Ergebnisliste Upload */}
            <GlassCard>
              <div className="flex items-center gap-3 mb-6">
                <IconBadge icon={Icons.chart} color="purple" />
                <div>
                  <h2 className="text-xl font-semibold text-white">Schritt 1: Ergebnisliste</h2>
                  <p className="text-sm text-slate-400">PDF von manage2sail hochladen</p>
                </div>
              </div>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDropResult}
                className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${isDragging ? 'border-violet-500 bg-violet-500/10' : pdfResult ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-white/20'}`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => processResultPdf(e.target.files?.[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                
                {isProcessing ? (
                  <div className="text-cyan-400">
                    <div className="text-3xl mb-2 animate-pulse">⏳</div>
                    <div className="text-sm mb-2">{ocrProgress?.status || 'Wird verarbeitet...'}</div>
                    {ocrProgress?.percent !== undefined && (
                      <div className="w-full max-w-xs mx-auto h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all" style={{ width: `${ocrProgress.percent}%` }} />
                      </div>
                    )}
                  </div>
                ) : pdfResult ? (
                  <div className="text-emerald-400">
                    <div className="text-3xl mb-2">✓</div>
                    <div className="font-medium">{pdfResult.regattaName}</div>
                    {pdfResult.participant ? (
                      <div className="text-sm mt-1">Platz {pdfResult.participant.rank} von {pdfResult.totalParticipants}</div>
                    ) : (
                      <div className="text-sm mt-1 text-amber-400">⚠️ Platzierung nicht erkannt - bitte unten eingeben</div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-400">
                    <div className="w-12 h-12 mx-auto mb-3 text-slate-500">{Icons.upload}</div>
                    <div className="text-sm">Ergebnisliste-PDF hierher ziehen oder klicken</div>
                  </div>
                )}
              </div>
              
              {/* Manuelle Korrektur der Platzierung wenn PDF geladen aber nicht erkannt */}
              {pdfResult && (
                <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-sm text-slate-400 mb-3">
                    Daten korrigieren (falls nötig):
                  </div>
                  
                  {/* Regattaname */}
                  <div className="mb-4">
                    <label className="block text-xs text-slate-500 mb-1">Regattaname *</label>
                    <input
                      type="text"
                      value={manualRegattaName || pdfResult.regattaName || ''}
                      onChange={(e) => setManualRegattaName(e.target.value)}
                      placeholder="z.B. Gorch-Fock-Preis 2025"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 text-sm"
                    />
                  </div>
                  
                  {/* Platzierung, Teilnehmer und Wettfahrten */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Platzierung *</label>
                      <input
                        type="number"
                        value={manualPlacement || pdfResult.participant?.rank || ''}
                        onChange={(e) => setManualPlacement(e.target.value)}
                        placeholder={pdfResult.participant?.rank?.toString() || 'z.B. 5'}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Teilnehmer:innen</label>
                      <input
                        type="number"
                        value={manualTotalParticipants || pdfResult.totalParticipants || ''}
                        onChange={(e) => setManualTotalParticipants(e.target.value)}
                        placeholder={pdfResult.totalParticipants?.toString() || 'z.B. 42'}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Gew. Wettfahrten</label>
                      <input
                        type="number"
                        value={manualRaceCount || pdfResult.raceCount || ''}
                        onChange={(e) => setManualRaceCount(e.target.value)}
                        placeholder={pdfResult.raceCount?.toString() || 'z.B. 6'}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <button
                onClick={() => setManualMode(!manualMode)}
                className="mt-4 text-sm text-slate-400 hover:text-white underline"
              >
                {manualMode ? 'Zurück zum PDF-Upload' : 'Manuell eingeben'}
              </button>
            </GlassCard>
            
            {/* Crew-Eingabe für Mehrpersonenboote */}
            {pdfResult && maxCrew > 1 && (
              <GlassCard>
                <div className="flex items-center gap-3 mb-6">
                  <IconBadge icon={Icons.users} color="cyan" />
                  <div>
                    <h2 className="text-xl font-semibold text-white">Crew ({currentBoatClass})</h2>
                    <p className="text-sm text-slate-400">
                      {minCrew === maxCrew 
                        ? `${maxCrew} Personen erforderlich` 
                        : `${minCrew}-${maxCrew} Personen (mindestens ${minCrew})`}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {crewMembers.map((member, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => updateCrewMember(index, 'name', e.target.value)}
                          placeholder={index === 0 ? 'Steuerperson/Skipper:in' : `Crew ${index + 1}`}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 text-sm"
                        />
                        <input
                          type="text"
                          value={member.verein}
                          onChange={(e) => updateCrewMember(index, 'verein', e.target.value)}
                          placeholder="Verein (z.B. TSC)"
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 text-sm"
                        />
                      </div>
                      {crewMembers.length > minCrew && (
                        <button
                          onClick={() => removeCrewMember(index)}
                          className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center"
                          title="Entfernen"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                {crewMembers.length < maxCrew && (
                  <button
                    onClick={addCrewMember}
                    className="mt-4 w-full py-2 rounded-lg border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-white/40 transition-all text-sm"
                  >
                    + Crewmitglied hinzufügen ({crewMembers.length}/{maxCrew})
                  </button>
                )}
                
                {crewMembers.filter(m => m.name.trim()).length < minCrew && (
                  <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    ⚠️ Noch {minCrew - crewMembers.filter(m => m.name.trim()).length} Crewmitglied(er) erforderlich
                  </div>
                )}
              </GlassCard>
            )}
            
            {/* Rechnung Upload */}
            <GlassCard>
              <div className="flex items-center gap-3 mb-6">
                <IconBadge icon={Icons.receipt} color="amber" />
                <div>
                  <h2 className="text-xl font-semibold text-white">Schritt 2: Rechnung</h2>
                  <p className="text-sm text-slate-400">Startgeld-Rechnung als PDF hochladen</p>
                </div>
              </div>
              
              <div
                onDragOver={handleDragOverInvoice}
                onDragLeave={handleDragLeaveInvoice}
                onDrop={handleDropInvoice}
                className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${isDraggingInvoice ? 'border-amber-500 bg-amber-500/10' : currentInvoiceData ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-white/20'}`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => processInvoicePdf(e.target.files?.[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                
                {invoiceProcessing ? (
                  <div className="text-cyan-400">
                    <div className="text-3xl mb-2 animate-pulse">⏳</div>
                    <div className="text-sm mb-2">{ocrProgress?.status || 'Rechnung wird verarbeitet...'}</div>
                    {ocrProgress?.percent !== undefined && (
                      <div className="w-full max-w-xs mx-auto h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all" style={{ width: `${ocrProgress.percent}%` }} />
                      </div>
                    )}
                  </div>
                ) : currentInvoiceData ? (
                  <div className="text-emerald-400">
                    <div className="text-3xl mb-2">✓</div>
                    <div className="font-medium">Rechnung hochgeladen</div>
                  </div>
                ) : (
                  <div className="text-slate-400">
                    <div className="w-12 h-12 mx-auto mb-3 text-slate-500">{Icons.upload}</div>
                    <div className="text-sm">Rechnung-PDF hierher ziehen oder klicken</div>
                  </div>
                )}
              </div>
              
              {/* Betrag Eingabe */}
              <div className="mt-4">
                <label className="block text-sm text-slate-400 mb-2">💰 Rechnungsbetrag (€) *</label>
                <input
                  type="text"
                  value={currentInvoiceAmount}
                  onChange={(e) => setCurrentInvoiceAmount(e.target.value)}
                  placeholder="45,00"
                  className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-slate-500 focus:outline-none ${currentInvoiceAmount ? 'border-emerald-500/50' : 'border-white/10'}`}
                />
              </div>
            </GlassCard>
            
            {/* Manuelle Eingabe (wenn aktiviert) */}
            {manualMode && (
              <GlassCard>
                <div className="flex items-center gap-3 mb-6">
                  <IconBadge icon={Icons.document} color="cyan" />
                  <h2 className="text-xl font-semibold text-white">Manuelle Eingabe</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-400 mb-2">Regattaname *</label>
                    <input
                      type="text"
                      value={manualData.regattaName}
                      onChange={(e) => setManualData(prev => ({ ...prev, regattaName: e.target.value }))}
                      placeholder="Tegeler Herbstregatta 2025"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Bootsklasse</label>
                    <select
                      value={manualData.boatClass || boatData.bootsklasse}
                      onChange={(e) => {
                        setManualData(prev => ({ ...prev, boatClass: e.target.value }));
                        // Crew zurücksetzen bei Klassenwechsel
                        const newMaxCrew = getMaxCrewCount(e.target.value);
                        const newMinCrew = getMinCrewCount(e.target.value);
                        if (newMaxCrew > 1) {
                          const initialCrew = [{ name: boatData.seglername || '', verein: 'TSC' }];
                          for (let i = 1; i < newMinCrew; i++) {
                            initialCrew.push({ name: '', verein: '' });
                          }
                          setCrewMembers(initialCrew);
                        } else {
                          setCrewMembers([]);
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                    >
                      {Object.keys(BOAT_CLASSES).map(k => (
                        <option key={k} value={k} className="bg-slate-800">{k} ({BOAT_CLASSES[k].crew} Pers.)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Datum</label>
                    <input
                      type="date"
                      value={manualData.date}
                      onChange={(e) => setManualData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Platzierung *</label>
                    <input
                      type="number"
                      value={manualData.placement}
                      onChange={(e) => setManualData(prev => ({ ...prev, placement: e.target.value }))}
                      placeholder="5"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Teilnehmer:innen *</label>
                    <input
                      type="number"
                      value={manualData.totalParticipants}
                      onChange={(e) => setManualData(prev => ({ ...prev, totalParticipants: e.target.value }))}
                      placeholder="42"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Gew. Wettfahrten</label>
                    <input
                      type="number"
                      value={manualData.raceCount}
                      onChange={(e) => setManualData(prev => ({ ...prev, raceCount: e.target.value }))}
                      placeholder="6"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Rechnungsbetrag (€) *</label>
                    <input
                      type="text"
                      value={manualData.invoiceAmount}
                      onChange={(e) => setManualData(prev => ({ ...prev, invoiceAmount: e.target.value }))}
                      placeholder="45,00"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </div>
                
                {/* Crew-Eingabe für Mehrpersonenboote (auch im manuellen Modus) */}
                {getMaxCrewCount(manualData.boatClass || boatData.bootsklasse) > 1 && (
                  <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-lg">👥</span>
                      <div>
                        <div className="text-white font-medium">Crew ({manualData.boatClass || boatData.bootsklasse})</div>
                        <div className="text-xs text-slate-400">
                          {getMinCrewCount(manualData.boatClass || boatData.bootsklasse) === getMaxCrewCount(manualData.boatClass || boatData.bootsklasse) 
                            ? `${getMaxCrewCount(manualData.boatClass || boatData.bootsklasse)} Personen erforderlich` 
                            : `${getMinCrewCount(manualData.boatClass || boatData.bootsklasse)}-${getMaxCrewCount(manualData.boatClass || boatData.bootsklasse)} Personen`}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {crewMembers.map((member, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs">{index + 1}</span>
                          <input
                            type="text"
                            value={member.name}
                            onChange={(e) => updateCrewMember(index, 'name', e.target.value)}
                            placeholder={index === 0 ? 'Steuerperson/Skipper:in' : `Crew ${index + 1}`}
                            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 text-sm"
                          />
                          <input
                            type="text"
                            value={member.verein}
                            onChange={(e) => updateCrewMember(index, 'verein', e.target.value)}
                            placeholder="Verein"
                            className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 text-sm"
                          />
                          {crewMembers.length > getMinCrewCount(manualData.boatClass || boatData.bootsklasse) && (
                            <button onClick={() => removeCrewMember(index)} className="text-red-400 hover:text-red-300">✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {crewMembers.length < getMaxCrewCount(manualData.boatClass || boatData.bootsklasse) && (
                      <button onClick={addCrewMember} className="mt-3 text-sm text-slate-400 hover:text-white">
                        + Crewmitglied hinzufügen ({crewMembers.length}/{getMaxCrewCount(manualData.boatClass || boatData.bootsklasse)})
                      </button>
                    )}
                  </div>
                )}
                
                <button
                  onClick={addRegattaManual}
                  className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-medium hover:from-violet-500 hover:to-violet-400 transition-all"
                >
                  ➕ Manuell hinzufügen
                </button>
              </GlassCard>
            )}
            
            {/* Hinzufügen Button */}
            {!manualMode && pdfResult && (
              <button
                onClick={addRegattaFromPdf}
                disabled={
                  !currentInvoiceAmount || 
                  (!pdfResult.participant?.rank && !manualPlacement) ||
                  (!pdfResult.regattaName && !manualRegattaName.trim())
                }
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-medium hover:from-emerald-500 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✓ Regatta zur Liste hinzufügen
              </button>
            )}
          </div>
        )}
        
        {/* === TAB: LISTE === */}
        {activeTab === 'list' && (
          <GlassCard>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <IconBadge icon={Icons.list} color="emerald" />
                <div>
                  <h2 className="text-xl font-semibold text-white">Deine Regatten</h2>
                  <p className="text-sm text-slate-400">{regatten.length} Regatta(en) • {totalAmount.toFixed(2).replace('.', ',')} € gesamt</p>
                </div>
              </div>
            </div>
            
            {regatten.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <div className="text-4xl mb-4">📭</div>
                <div>Noch keine Regatten hinzugefügt</div>
                <button onClick={() => setActiveTab('add')} className="mt-4 text-violet-400 hover:text-violet-300 underline">
                  Erste Regatta hinzufügen →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {regatten.map((regatta) => (
                  <div key={regatta.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-white font-medium">{regatta.regattaName}</div>
                        <div className="text-sm text-slate-400">
                          {regatta.boatClass && `${regatta.boatClass} • `}
                          {regatta.date && new Date(regatta.date).toLocaleDateString('de-DE')}
                          {regatta.placement && ` • Platz ${regatta.placement}`}
                          {regatta.totalParticipants && ` von ${regatta.totalParticipants}`}
                        </div>
                        {/* Crew anzeigen */}
                        {regatta.crew && regatta.crew.length > 0 && (
                          <div className="text-xs text-cyan-400 mt-1">
                            👥 {regatta.crew.map(c => `${c.name}${c.verein ? ` (${c.verein})` : ''}`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-emerald-400">
                          {regatta.invoiceAmount?.toFixed(2).replace('.', ',')} €
                        </span>
                        <button
                          onClick={() => {
                            setRegatten(prev => prev.filter(r => r.id !== regatta.id));
                            setPdfAttachments(prev => prev.filter(a => a.regattaId !== regatta.id));
                          }}
                          className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}
        
        {/* === TAB: EXPORT === */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            <GlassCard>
              <div className="flex items-center gap-3 mb-6">
                <IconBadge icon={Icons.list} color="emerald" />
                <div>
                  <h2 className="text-xl font-semibold text-white">Zusammenfassung</h2>
                  <p className="text-sm text-slate-400">{regatten.length} Regatta(en) zur Erstattung</p>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-white/5 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><div className="text-slate-500">Segler:in</div><div className="text-white font-medium">{boatData.seglername || '-'}</div></div>
                  <div><div className="text-slate-500">Segelnummer</div><div className="text-white font-medium">{boatData.segelnummer || '-'}</div></div>
                  <div><div className="text-slate-500">Bootsklasse</div><div className="text-white font-medium">{boatData.bootsklasse}</div></div>
                  <div><div className="text-slate-500">IBAN</div><div className="text-white font-medium">...{boatData.iban?.slice(-8) || '-'}</div></div>
                </div>
              </div>
              
              {/* Regatten-Liste */}
              {regatten.length > 0 && (
                <div className="space-y-2 mb-6">
                  {regatten.map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs">{i + 1}</span>
                        <div>
                          <div className="text-white">{r.regattaName || 'Regatta'}</div>
                          <div className="text-slate-500 text-xs">
                            {r.date && new Date(r.date).toLocaleDateString('de-DE')}
                            {r.placement && ` • Platz ${r.placement}`}
                            {r.totalParticipants && ` von ${r.totalParticipants}`}
                          </div>
                        </div>
                      </div>
                      <span className="text-emerald-400 font-medium">{r.invoiceAmount?.toFixed(2).replace('.', ',')} €</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* PDF-Anhänge Status */}
              {pdfAttachments.length > 0 && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm mb-6">
                  ✅ {pdfAttachments.length} Regatta(en) mit PDF-Anhängen bereit ({pdfAttachments.filter(a => a.resultPdf).length} Ergebnislisten, {pdfAttachments.filter(a => a.invoicePdf).length} Rechnungen)
                </div>
              )}
              
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
                <div className="text-white font-semibold">Gesamtbetrag zur Erstattung</div>
                <div className="text-2xl font-bold text-white">{totalAmount.toFixed(2).replace('.', ',')} €</div>
              </div>
            </GlassCard>
            
            {/* Export-Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => { console.log('PDF Button clicked'); generatePDF(); }}
                disabled={regatten.length === 0}
                className="group p-5 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-violet-500/50 hover:bg-slate-800 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:bg-violet-500/20 transition-colors">
                    {Icons.document}
                  </div>
                  <div>
                    <div className="text-white font-medium">PDF-Antrag</div>
                    <div className="text-sm text-slate-500">Erstattungsformular</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => { console.log('CSV Button clicked'); generateCSV(); }}
                disabled={regatten.length === 0}
                className="group p-5 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/50 hover:bg-slate-800 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                    {Icons.table}
                  </div>
                  <div>
                    <div className="text-white font-medium">CSV-Export</div>
                    <div className="text-sm text-slate-500">Buchungssatz</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => { console.log('All Files Button clicked'); downloadAllDocuments(); }}
                disabled={regatten.length === 0}
                className="group p-5 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/50 hover:bg-slate-800 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                    {Icons.archive}
                  </div>
                  <div>
                    <div className="text-white font-medium">Alle Dateien</div>
                    <div className="text-sm text-slate-500">Inkl. Belege</div>
                  </div>
                </div>
              </button>
            </div>
            
            {/* ONLINE EINREICHEN */}
            <div className="p-6 rounded-xl bg-gradient-to-r from-emerald-900/30 to-emerald-800/20 border border-emerald-700/30">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  {Icons.send}
                </div>
                <div>
                  <div className="text-white font-semibold text-lg">Online einreichen</div>
                  <div className="text-sm text-slate-400">Antrag direkt an den TSC senden</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={submitOnline}
                  disabled={regatten.length === 0 || isSubmitting}
                  className="py-4 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Wird gesendet...
                    </>
                  ) : (
                    <>
                      {Icons.send}
                      Jetzt einreichen
                    </>
                  )}
                </button>
                
                <button
                  onClick={submitViaEmail}
                  disabled={regatten.length === 0}
                  className="py-4 px-6 rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {Icons.mail}
                  Per E-Mail senden
                </button>
              </div>
              
              <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 text-sm flex items-start gap-2">
                <span className="w-5 h-5 flex-shrink-0 mt-0.5">{Icons.info}</span>
                <span><strong className="text-slate-300">Online einreichen</strong> sendet alles automatisch. <strong className="text-slate-300">Per E-Mail</strong> öffnet dein Mail-Programm – Dateien bitte manuell anhängen.</span>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Hilfe Modal */}
      <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="Hilfe">
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <h4 className="font-semibold text-white mb-2">Chart Ergebnislisten hochladen</h4>
            <p>Lade die Ergebnisliste als PDF von manage2sail hoch. Deine Platzierung wird anhand der Segelnummer automatisch gefunden.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">Rechnungen hochladen</h4>
            <p>Lade die Startgeld-Rechnung als PDF hoch. Der Betrag wird automatisch erkannt.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">🔍 OCR-Erkennung</h4>
            <p>Bei gescannten PDFs wird automatisch OCR (Texterkennung) verwendet. Das kann 10-30 Sekunden pro Seite dauern.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">💾 Datenspeicherung</h4>
            <p>Alle Daten werden lokal in deinem Browser gespeichert. Lösche den Browser-Cache, um alle Daten zu entfernen.</p>
          </div>
        </div>
      </Modal>
      
      {/* Footer */}
      <footer className="relative z-10 px-6 py-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span>⚓</span>
            <span>© {new Date().getFullYear()} Tegeler Segel-Club e.V.</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://www.tegeler-segel-club.de" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Website</a>
            <a href="mailto:vorstand@tegeler-segel-club.de" className="hover:text-white transition-colors">Kontakt</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
