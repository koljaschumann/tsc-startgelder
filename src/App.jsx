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

const GlassCard = ({ children, className = '', warning = false }) => (
  <div 
    className={`relative rounded-2xl p-6 ${className}`}
    style={{
      background: warning ? 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.02) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      border: warning ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
    }}
  >
    {children}
  </div>
);

const IconBadge = ({ children, color = 'purple' }) => {
  const colors = {
    purple: 'from-violet-500/20 to-violet-600/10 border-violet-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  };
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} border flex items-center justify-center text-lg`}>
      {children}
    </div>
  );
};

const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  const colors = { info: 'bg-violet-500/20 border-violet-500/30 text-violet-300', success: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300', warning: 'bg-amber-500/20 border-amber-500/30 text-amber-300', error: 'bg-red-500/20 border-red-500/30 text-red-300' };
  const icons = { info: 'ℹ️', success: '✓', warning: '⚠️', error: '✕' };
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl border ${colors[type]} backdrop-blur-sm shadow-lg animate-slideUp`}>
      <div className="flex items-center gap-3"><span>{icons[type]}</span><span>{message}</span><button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100">✕</button></div>
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

  // === PERSISTENZ ===
  useEffect(() => {
    localStorage.setItem('tsc-boat-data', JSON.stringify(boatData));
  }, [boatData]);
  
  useEffect(() => {
    localStorage.setItem('tsc-regatten-v6', JSON.stringify(regatten));
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

  // === ERGEBNISLISTE PARSEN (EXAKT wie in v6-fixed) ===
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
      
      // Ergebnisse parsen - Suche nach Segelnummern
      const lines = text.split('\n');
      const entries = [];
      
      const sailPattern = /([A-Z]{2,3})\s*(\d{3,6})/g;
      const normalizedSail = sailNumber.replace(/\s+/g, '').toUpperCase();
      
      for (const line of lines) {
        const sailMatches = [...line.matchAll(sailPattern)];
        for (const sailMatch of sailMatches) {
          const foundSail = (sailMatch[1] + sailMatch[2]).toUpperCase();
          
          // Rang am Zeilenanfang finden
          const rankMatch = line.match(/^\s*(\d{1,3})[\s.)\-]/);
          if (rankMatch) {
            const rank = parseInt(rankMatch[1]);
            if (rank > 0 && rank <= 500) {
              // Name finden
              const nameMatch = line.match(/([A-ZÄÖÜ][a-zäöüß]+)\s+([A-ZÄÖÜ][A-ZÄÖÜ]+)/);
              const entry = {
                rank,
                sailNumber: foundSail,
                name: nameMatch ? `${nameMatch[2]} ${nameMatch[1]}` : '',
              };
              
              entries.push(entry);
              
              // Prüfen ob es der gesuchte Teilnehmer ist
              if (foundSail === normalizedSail || 
                  sailNumber.toUpperCase().includes(sailMatch[2]) ||
                  foundSail.includes(normalizedSail.replace(/[A-Z]/g, ''))) {
                result.participant = entry;
              }
            }
          }
        }
      }
      
      result.allResults = entries.sort((a, b) => a.rank - b.rank);
      result.totalParticipants = entries.length > 0 ? Math.max(...entries.map(e => e.rank)) : 0;
      result.success = entries.length > 0;
      
      if (!result.regattaName) {
        result.regattaName = result.boatClass ? `Regatta (${result.boatClass})` : 'Regatta';
      }
      
    } catch (err) {
      console.error('Parse error:', err);
    }
    
    return result;
  };

  // === ERGEBNISLISTE VERARBEITEN (EXAKT wie in v6-fixed) ===
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
      
      const { text } = await extractTextFromPDF(arrayBuffer, true, 'Ergebnisliste: ');
      setDebugText(text.substring(0, 5000));
      
      if (text.trim().length < 50) {
        setError('PDF konnte nicht gelesen werden.');
        return;
      }
      
      const result = parseRegattaPDF(text, boatData.segelnummer);
      
      // Duplikat-Check
      if (result.success) {
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
        setError(`Segelnummer "${boatData.segelnummer}" nicht gefunden.`);
      } else {
        setSuccess(`${result.participant.name} gefunden: Platz ${result.participant.rank} von ${result.totalParticipants}`);
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

  // === REGATTA HINZUFÜGEN ===
  const addRegattaFromPdf = () => {
    if (!pdfResult?.participant) {
      setError('Keine gültigen Ergebnisdaten');
      return;
    }
    
    if (!currentInvoiceData || !currentInvoiceAmount) {
      setError('Bitte lade eine Rechnung hoch und gib den Betrag ein');
      return;
    }
    
    const amount = parseFloat(currentInvoiceAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setError('Bitte einen gültigen Rechnungsbetrag eingeben');
      return;
    }
    
    const newRegatta = {
      id: Date.now(),
      regattaName: pdfResult.regattaName,
      boatClass: pdfResult.boatClass || boatData.bootsklasse,
      date: pdfResult.date,
      placement: pdfResult.participant.rank,
      totalParticipants: pdfResult.totalParticipants,
      raceCount: pdfResult.raceCount || 0,
      sailorName: pdfResult.participant.name,
      resultPdfData: currentPdfData,
      invoicePdfData: currentInvoiceData,
      invoiceAmount: amount,
      addedAt: new Date().toISOString()
    };
    
    setRegatten(prev => [...prev, newRegatta]);
    setPdfResult(null);
    setCurrentPdfData(null);
    setCurrentInvoiceData(null);
    setCurrentInvoiceAmount('');
    setDebugText('');
    setSuccess(`"${pdfResult.regattaName}" wurde hinzugefügt! (${amount.toFixed(2).replace('.', ',')} €)`);
    setActiveTab('list');
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
    
    const newRegatta = {
      id: Date.now(),
      regattaName,
      boatClass: boatClass || boatData.bootsklasse,
      date,
      placement: parseInt(placement),
      totalParticipants: parseInt(totalParticipants),
      raceCount: parseInt(raceCount) || 0,
      sailorName: boatData.seglername,
      resultPdfData: currentPdfData,
      invoicePdfData: currentInvoiceData,
      invoiceAmount: amount,
      addedAt: new Date().toISOString()
    };
    
    setRegatten(prev => [...prev, newRegatta]);
    setManualData({ regattaName: '', boatClass: '', date: '', placement: '', totalParticipants: '', raceCount: '', invoiceAmount: '' });
    setPdfResult(null);
    setCurrentPdfData(null);
    setCurrentInvoiceData(null);
    setCurrentInvoiceAmount('');
    setSuccess(`"${regattaName}" wurde hinzugefügt!`);
    setActiveTab('list');
  };

  // === BERECHNUNGEN ===
  const totalAmount = regatten.reduce((sum, r) => sum + (r.invoiceAmount || 0), 0);

  // === PDF EXPORT ===
  const generatePDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Antrag auf Startgeld-Erstattung', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tegeler Segel-Club e.V. - Saison ${new Date().getFullYear()}`, 105, 28, { align: 'center' });
    
    doc.setDrawColor(139, 92, 246);
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Antragsteller', 20, 45);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text([
      `Name: ${boatData.seglername}`,
      `Segelnummer: ${boatData.segelnummer}`,
      `Bootsklasse: ${boatData.bootsklasse}`,
      `IBAN: ${boatData.iban}`,
      `Kontoinhaber: ${boatData.kontoinhaber}`,
    ], 20, 55);
    
    doc.autoTable({
      startY: 90,
      head: [['Regatta', 'Datum', 'Platz', 'Boote', 'Wettf.', 'Startgeld']],
      body: regatten.map(r => [
        r.regattaName || '-',
        r.date ? new Date(r.date).toLocaleDateString('de-DE') : '-',
        r.placement ? `${r.placement}.` : '-',
        r.totalParticipants || '-',
        r.raceCount || '-',
        r.invoiceAmount ? `${r.invoiceAmount.toFixed(2)} €` : '-'
      ]),
      foot: [['', '', '', '', 'Gesamt:', `${totalAmount.toFixed(2)} €`]],
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246], fontStyle: 'bold' },
      footStyles: { fillColor: [16, 185, 129], fontStyle: 'bold' },
    });
    
    const signY = doc.lastAutoTable.finalY + 30;
    doc.setDrawColor(100);
    doc.line(20, signY, 80, signY);
    doc.setFontSize(8);
    doc.text('Datum, Unterschrift', 20, signY + 5);
    doc.line(120, signY, 180, signY);
    doc.text('Genehmigt (Vorstand)', 120, signY + 5);
    
    doc.save(`TSC_Erstattungsantrag_${boatData.seglername.replace(/\s/g, '_')}.pdf`);
    setSuccess('PDF wurde erstellt');
  };

  // === CSV EXPORT ===
  const generateCSV = () => {
    const headers = ['Regatta', 'Datum', 'Segler', 'Segelnummer', 'Bootsklasse', 'Platzierung', 'Boote', 'Wettfahrten', 'Startgeld', 'IBAN', 'Kontoinhaber'];
    const rows = regatten.map(r => [r.regattaName, r.date, boatData.seglername, boatData.segelnummer, r.boatClass || boatData.bootsklasse, r.placement, r.totalParticipants, r.raceCount, r.invoiceAmount, boatData.iban, boatData.kontoinhaber]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TSC_Erstattung_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccess('CSV wurde erstellt');
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
          <button onClick={() => setShowHelpModal(true)} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10" title="Hilfe">❓</button>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10 mb-6">
          {[
            { id: 'settings', icon: '⚙️', label: 'Bootsdaten' },
            { id: 'add', icon: '➕', label: 'Hinzufügen' },
            { id: 'list', icon: '📋', label: `Liste (${regatten.length})` },
            { id: 'export', icon: '📤', label: 'Export' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <span className="mr-2">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 pb-12">
        
        {/* === TAB: BOOTSDATEN === */}
        {activeTab === 'settings' && (
          <GlassCard>
            <div className="flex items-center gap-3 mb-6">
              <IconBadge color="cyan">⛵</IconBadge>
              <div>
                <h2 className="text-xl font-semibold text-white">Deine Bootsdaten</h2>
                <p className="text-sm text-slate-400">Diese Daten werden für alle Anträge verwendet</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">👤 Seglername *</label>
                <input
                  type="text"
                  value={boatData.seglername}
                  onChange={(e) => setBoatData(prev => ({ ...prev, seglername: e.target.value }))}
                  placeholder="Max Mustermann"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">🔢 Segelnummer *</label>
                <input
                  type="text"
                  value={boatData.segelnummer}
                  onChange={(e) => setBoatData(prev => ({ ...prev, segelnummer: e.target.value.toUpperCase() }))}
                  placeholder="GER 12345"
                  className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-slate-500 focus:outline-none ${boatData.segelnummer ? 'border-emerald-500/50' : 'border-white/10'}`}
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">⛵ Bootsklasse</label>
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
                <label className="block text-sm text-slate-400 mb-2">🏦 IBAN</label>
                <input
                  type="text"
                  value={boatData.iban}
                  onChange={(e) => setBoatData(prev => ({ ...prev, iban: e.target.value.toUpperCase() }))}
                  placeholder="DE89 3704 0044 0532 0130 00"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-2">💳 Kontoinhaber</label>
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
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                💡 Die Segelnummer wird benötigt, um deine Platzierung automatisch zu erkennen.
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
                <IconBadge color="purple">📊</IconBadge>
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
                    {pdfResult.participant && (
                      <div className="text-sm mt-1">Platz {pdfResult.participant.rank} von {pdfResult.totalParticipants}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-400">
                    <div className="text-3xl mb-2">📊</div>
                    <div className="text-sm">Ergebnisliste-PDF hierher ziehen oder klicken</div>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setManualMode(!manualMode)}
                className="mt-4 text-sm text-slate-400 hover:text-white underline"
              >
                {manualMode ? '← Zurück zum PDF-Upload' : '✏️ Manuell eingeben'}
              </button>
            </GlassCard>
            
            {/* Rechnung Upload */}
            <GlassCard>
              <div className="flex items-center gap-3 mb-6">
                <IconBadge color="amber">🧾</IconBadge>
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
                    <div className="text-3xl mb-2">🧾</div>
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
                  <IconBadge color="cyan">✏️</IconBadge>
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
                    <label className="block text-sm text-slate-400 mb-2">Teilnehmer *</label>
                    <input
                      type="number"
                      value={manualData.totalParticipants}
                      onChange={(e) => setManualData(prev => ({ ...prev, totalParticipants: e.target.value }))}
                      placeholder="42"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                    />
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
                    <label className="block text-sm text-slate-400 mb-2">Wettfahrten</label>
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
                
                <button
                  onClick={addRegattaManual}
                  className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-medium hover:from-violet-500 hover:to-violet-400 transition-all"
                >
                  ➕ Manuell hinzufügen
                </button>
              </GlassCard>
            )}
            
            {/* Hinzufügen Button */}
            {!manualMode && (pdfResult?.participant || currentInvoiceAmount) && (
              <button
                onClick={addRegattaFromPdf}
                disabled={!pdfResult?.participant || !currentInvoiceAmount}
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
                <IconBadge color="emerald">📋</IconBadge>
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
                      <div>
                        <div className="text-white font-medium">{regatta.regattaName}</div>
                        <div className="text-sm text-slate-400">
                          {regatta.date && new Date(regatta.date).toLocaleDateString('de-DE')}
                          {regatta.placement && ` • Platz ${regatta.placement}`}
                          {regatta.totalParticipants && ` von ${regatta.totalParticipants}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold text-emerald-400">
                          {regatta.invoiceAmount?.toFixed(2).replace('.', ',')} €
                        </span>
                        <button
                          onClick={() => setRegatten(prev => prev.filter(r => r.id !== regatta.id))}
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
                <IconBadge color="emerald">📋</IconBadge>
                <div>
                  <h2 className="text-xl font-semibold text-white">Zusammenfassung</h2>
                  <p className="text-sm text-slate-400">{regatten.length} Regatta(en) zur Erstattung</p>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-white/5 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><div className="text-slate-500">Segler</div><div className="text-white font-medium">{boatData.seglername || '-'}</div></div>
                  <div><div className="text-slate-500">Segelnummer</div><div className="text-white font-medium">{boatData.segelnummer || '-'}</div></div>
                  <div><div className="text-slate-500">Bootsklasse</div><div className="text-white font-medium">{boatData.bootsklasse}</div></div>
                  <div><div className="text-slate-500">IBAN</div><div className="text-white font-medium">...{boatData.iban?.slice(-8) || '-'}</div></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
                <div className="text-white font-semibold">Gesamtbetrag zur Erstattung</div>
                <div className="text-2xl font-bold text-white">{totalAmount.toFixed(2).replace('.', ',')} €</div>
              </div>
            </GlassCard>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassCard className="cursor-pointer hover:border-violet-500/30 transition-all" onClick={generatePDF}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-2xl">📄</div>
                  <div>
                    <div className="text-white font-semibold">PDF-Antrag</div>
                    <div className="text-sm text-slate-400">Erstattungsantrag als PDF</div>
                  </div>
                </div>
              </GlassCard>
              
              <GlassCard className="cursor-pointer hover:border-violet-500/30 transition-all" onClick={generateCSV}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl">📊</div>
                  <div>
                    <div className="text-white font-semibold">CSV-Export</div>
                    <div className="text-sm text-slate-400">Für Buchhaltung & Excel</div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </main>
      
      {/* Hilfe Modal */}
      <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="❓ Hilfe">
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <h4 className="font-semibold text-white mb-2">📊 Ergebnislisten hochladen</h4>
            <p>Lade die Ergebnisliste als PDF von manage2sail hoch. Deine Platzierung wird anhand der Segelnummer automatisch gefunden.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">🧾 Rechnungen hochladen</h4>
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
