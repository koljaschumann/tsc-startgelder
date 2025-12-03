import { useState, useEffect, useCallback, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// PDF.js Worker Setup
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

const STORAGE_KEYS = {
  BOAT: 'tsc_boat_data_v7',
  REGATTEN: 'tsc_regatten_v7',
  HISTORY: 'tsc_history_v7',
  THEME: 'tsc_theme_v7',
  SAVED_CREW: 'tsc_saved_crew_v7',
  ONBOARDING_DONE: 'tsc_onboarding_v7',
};

// ============================================
// HELPER FUNKTIONEN
// ============================================

function getRequiredCrewCount(className) {
  if (!className) return 1;
  const info = BOAT_CLASSES[className];
  return info ? info.crew : 1;
}

function createEmptyRegatta() {
  return {
    id: Date.now() + Math.random(),
    name: '',
    datum: '',
    ausrichter: '',
    boote: '',
    platzierung: '',
    wettfahrten: '',
    startgeld: '',
    rechnungFileName: null,
    rechnungData: null,
    ergebnisFileName: null,
    ergebnisData: null,
    crew: [],
    processingInvoice: false,
    processingResult: false,
    ocrProgress: 0,
    parseError: null,
    isDuplicate: false,
  };
}

// Normalisiere Regattanamen für Duplikaterkennung
function normalizeRegattaName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]/g, '')
    .replace(/regatta/g, '')
    .replace(/meisterschaft/g, '')
    .trim();
}

// Prüfe auf Duplikate
function checkDuplicate(newName, existingRegatten, currentId) {
  const normalizedNew = normalizeRegattaName(newName);
  if (!normalizedNew) return false;
  
  return existingRegatten.some(r => 
    r.id !== currentId && 
    normalizeRegattaName(r.name) === normalizedNew
  );
}

// ============================================
// PDF VERARBEITUNG
// ============================================

// Text aus PDF extrahieren (direkt)
async function extractTextFromPdf(file, onProgress) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const numPages = pdf.numPages;
    
    for (let i = 1; i <= numPages; i++) {
      if (onProgress) onProgress(Math.round((i / numPages) * 50));
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return { text: fullText, method: 'direct' };
  } catch (error) {
    console.error('PDF Extraktion fehlgeschlagen:', error);
    return { text: '', method: 'error', error: error.message };
  }
}

// OCR Fallback mit Tesseract.js (dynamisch geladen)
async function extractTextWithOCR(file, onProgress) {
  try {
    // Dynamisch Tesseract laden
    const Tesseract = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const numPages = pdf.numPages;
    
    for (let i = 1; i <= numPages; i++) {
      if (onProgress) onProgress(50 + Math.round((i / numPages) * 45));
      
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      
      // Canvas erstellen
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: context, viewport }).promise;
      
      // OCR durchführen
      const { data } = await Tesseract.recognize(canvas, 'deu+eng', {
        logger: () => {}
      });
      
      fullText += data.text + '\n';
    }
    
    return { text: fullText, method: 'ocr' };
  } catch (error) {
    console.error('OCR fehlgeschlagen:', error);
    return { text: '', method: 'ocr-error', error: error.message };
  }
}

// Kombinierte Extraktion: Erst direkt, dann OCR falls nötig
async function extractText(file, onProgress) {
  // Erst direkten Text versuchen
  const directResult = await extractTextFromPdf(file, onProgress);
  
  // Prüfen ob genug Text gefunden wurde
  const wordCount = directResult.text.split(/\s+/).filter(w => w.length > 2).length;
  
  if (wordCount > 20) {
    if (onProgress) onProgress(100);
    return directResult;
  }
  
  // Fallback zu OCR
  console.log('Wenig Text gefunden, starte OCR...');
  const ocrResult = await extractTextWithOCR(file, onProgress);
  
  if (onProgress) onProgress(100);
  return ocrResult;
}

// ============================================
// PARSING FUNKTIONEN
// ============================================

// Betrag aus Rechnung extrahieren
function extractAmount(text) {
  if (!text) return null;
  
  const patterns = [
    // Spezifische Muster zuerst
    /Gesamtbetrag[:\s]*(\d+)[,.](\d{2})\s*(?:EUR|€)?/i,
    /Rechnungsbetrag[:\s]*(\d+)[,.](\d{2})\s*(?:EUR|€)?/i,
    /Endbetrag[:\s]*(\d+)[,.](\d{2})\s*(?:EUR|€)?/i,
    /Summe[:\s]*(\d+)[,.](\d{2})\s*(?:EUR|€)?/i,
    /Startgeld[:\s]*(\d+)[,.](\d{2})\s*(?:EUR|€)?/i,
    /Meldegebühr[:\s]*(\d+)[,.](\d{2})\s*(?:EUR|€)?/i,
    /Entry\s*Fee[:\s]*(\d+)[,.](\d{2})\s*(?:EUR|€)?/i,
    /zu\s*zahlen[:\s]*(\d+)[,.](\d{2})\s*(?:EUR|€)?/i,
    /Total[:\s]*(\d+)[,.](\d{2})\s*(?:EUR|€)?/i,
    // Generisches Muster: Betrag mit € oder EUR
    /(\d+)[,.](\d{2})\s*(?:EUR|€)/i,
    /(?:EUR|€)\s*(\d+)[,.](\d{2})/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = `${match[1]}.${match[2]}`;
      const num = parseFloat(amount);
      // Plausibilitätsprüfung: Startgelder sind typisch 20-200€
      if (num >= 5 && num <= 500) {
        return amount;
      }
    }
  }
  
  return null;
}

// Regattaname aus Text extrahieren
function extractRegattaName(text) {
  if (!text) return null;
  
  const patterns = [
    /(?:Regatta|Meisterschaft|Pokal|Cup|Trophy|Woche)[:\s]*([A-ZÄÖÜa-zäöüß0-9\s\-\.]+)/i,
    /^([A-ZÄÖÜ][A-Za-zäöüß\s\-\.]+(?:Regatta|Meisterschaft|Pokal|Cup|Trophy|Woche))/m,
    /Veranstaltung[:\s]*([A-Za-zäöüß0-9\s\-\.]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1].trim().length > 3) {
      return match[1].trim().slice(0, 60);
    }
  }
  
  return null;
}

// Platzierung aus Ergebnisliste extrahieren
function extractPlacement(text, sailNumber) {
  if (!text || !sailNumber) return null;
  
  // Normalisiere Segelnummer (entferne Leerzeichen, etc.)
  const normalizedSail = sailNumber.replace(/\s+/g, '').toUpperCase();
  const sailVariants = [
    sailNumber,
    normalizedSail,
    sailNumber.replace(/\s+/g, ' '),
    sailNumber.replace('GER', 'GER '),
    sailNumber.replace('GER ', 'GER'),
  ];
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    for (const variant of sailVariants) {
      if (line.toUpperCase().includes(variant.toUpperCase())) {
        // Suche nach Platzierung am Zeilenanfang
        const placeMatch = line.match(/^\s*(\d{1,3})[\.\s\)]/);
        if (placeMatch) {
          const place = parseInt(placeMatch[1]);
          if (place >= 1 && place <= 500) {
            return place.toString();
          }
        }
        
        // Alternative: Platzierung irgendwo in der Zeile
        const altMatch = line.match(/(?:Platz|Rang|Place|Pos)[:\s]*(\d{1,3})/i);
        if (altMatch) {
          return altMatch[1];
        }
      }
    }
  }
  
  return null;
}

// Anzahl Boote/Teilnehmer extrahieren
function extractBoatCount(text) {
  if (!text) return null;
  
  const patterns = [
    /(\d+)\s*(?:Boote|Teilnehmer|Starter|Meldungen|boats|entries|participants)/i,
    /(?:Boote|Teilnehmer|Starter|Meldungen|boats|entries)[:\s]*(\d+)/i,
    /(?:of|von)\s*(\d+)\s*(?:boats|Booten)?/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const count = parseInt(match[1]);
      if (count >= 2 && count <= 500) {
        return count.toString();
      }
    }
  }
  
  // Fallback: Zähle Zeilen die wie Ergebniszeilen aussehen
  const resultLines = text.split('\n').filter(line => 
    /^\s*\d{1,3}[\.\s]/.test(line) && /[A-Z]{3}\s*\d+/.test(line)
  );
  
  if (resultLines.length >= 3) {
    return resultLines.length.toString();
  }
  
  return null;
}

// Anzahl Wettfahrten extrahieren
function extractRaceCount(text) {
  if (!text) return null;
  
  const patterns = [
    /(\d+)\s*(?:Wettfahrten|Races|Läufe|races|wettf)/i,
    /(?:Wettfahrten|Races|Läufe)[:\s]*(\d+)/i,
    /R(\d+)\s*(?:gesamt|total)?/i,
    /Race\s*(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const count = parseInt(match[1]);
      if (count >= 1 && count <= 20) {
        return count.toString();
      }
    }
  }
  
  // Fallback: Zähle R1, R2, R3... Spalten
  const raceColumns = text.match(/R\d+/g);
  if (raceColumns) {
    const uniqueRaces = [...new Set(raceColumns)].length;
    if (uniqueRaces >= 1 && uniqueRaces <= 20) {
      return uniqueRaces.toString();
    }
  }
  
  return null;
}

// Datum extrahieren
function extractDate(text) {
  if (!text) return null;
  
  const patterns = [
    // DD.MM.YYYY
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
    // YYYY-MM-DD
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    // DD/MM/YYYY
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        let year, month, day;
        if (match[1].length === 4) {
          [, year, month, day] = match;
        } else {
          [, day, month, year] = match;
        }
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        continue;
      }
    }
  }
  
  return null;
}

// ============================================
// UI KOMPONENTEN
// ============================================

// Gradient Orbs Background
const GradientOrbs = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div 
      className="absolute w-96 h-96 rounded-full opacity-20 blur-3xl"
      style={{
        background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
        top: '10%',
        right: '10%',
        animation: 'float1 20s ease-in-out infinite',
      }}
    />
    <div 
      className="absolute w-80 h-80 rounded-full opacity-15 blur-3xl"
      style={{
        background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)',
        bottom: '20%',
        left: '5%',
        animation: 'float2 25s ease-in-out infinite',
      }}
    />
    <div 
      className="absolute w-64 h-64 rounded-full opacity-10 blur-3xl"
      style={{
        background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        animation: 'float3 18s ease-in-out infinite',
      }}
    />
    <style>{`
      @keyframes float1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, -30px); } }
      @keyframes float2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-40px, 20px); } }
      @keyframes float3 { 0%, 100% { transform: translate(-50%, -50%); } 50% { transform: translate(-50%, -50%) scale(1.2); } }
    `}</style>
  </div>
);

// Icon Badge
const IconBadge = ({ children, color = 'purple' }) => {
  const colors = {
    purple: 'from-violet-500/20 to-violet-600/10 border-violet-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
  };
  
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} border flex items-center justify-center text-lg`}>
      {children}
    </div>
  );
};

// Glass Card
const GlassCard = ({ children, className = '', hover = true, onClick, warning = false }) => (
  <div 
    onClick={onClick}
    className={`relative rounded-2xl p-6 transition-all duration-500 ${hover ? 'hover:translate-y-[-2px]' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    style={{
      background: warning 
        ? 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.02) 100%)'
        : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      border: warning 
        ? '1px solid rgba(245,158,11,0.3)'
        : '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
    }}
  >
    {children}
  </div>
);

// Input Field
const Input = ({ label, icon, value, onChange, type = 'text', placeholder = '', className = '', error = null, success = false }) => (
  <div className={className}>
    {label && (
      <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
        {icon && <span>{icon}</span>}
        {label}
      </label>
    )}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-white placeholder-slate-500 focus:outline-none transition-colors ${
        error 
          ? 'border-red-500/50 focus:border-red-500' 
          : success 
            ? 'border-emerald-500/50 focus:border-emerald-500'
            : 'border-white/10 focus:border-violet-500/50'
      }`}
    />
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
);

// Select Field
const Select = ({ label, icon, value, onChange, options, className = '' }) => (
  <div className={className}>
    {label && (
      <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
        {icon && <span>{icon}</span>}
        {label}
      </label>
    )}
    <select
      value={value}
      onChange={onChange}
      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 transition-colors appearance-none cursor-pointer"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '20px' }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
      ))}
    </select>
  </div>
);

// Button
const Button = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '' }) => {
  const variants = {
    primary: 'bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white shadow-lg shadow-violet-500/25',
    secondary: 'bg-white/5 border border-white/10 text-white hover:bg-white/10',
    danger: 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white',
    success: 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white',
    warning: 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-8 py-4 text-base',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

// File Upload Zone mit Drag & Drop
const FileUpload = ({ label, icon, fileName, onUpload, accept = '.pdf', processing = false, progress = 0, error = null, extractedData = null }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      onUpload(file);
    }
  };
  
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };
  
  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
          isDragging 
            ? 'border-violet-500 bg-violet-500/10' 
            : error
              ? 'border-red-500/50 bg-red-500/5'
              : fileName 
                ? 'border-emerald-500/50 bg-emerald-500/5' 
                : 'border-white/10 hover:border-white/20 bg-white/2'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        
        {processing ? (
          <div className="text-cyan-400">
            <div className="text-3xl mb-2 animate-pulse">⏳</div>
            <div className="text-sm mb-2">Wird verarbeitet... {progress}%</div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : error ? (
          <div className="text-red-400">
            <div className="text-3xl mb-2">⚠️</div>
            <div className="text-sm">{error}</div>
            <div className="text-xs mt-1 text-slate-500">Klicken zum erneuten Versuch</div>
          </div>
        ) : fileName ? (
          <div className="text-emerald-400">
            <div className="text-3xl mb-2">✓</div>
            <div className="text-sm truncate max-w-full">{fileName}</div>
          </div>
        ) : (
          <div className="text-slate-400">
            <div className="text-3xl mb-2">{icon}</div>
            <div className="text-sm">{label}</div>
            <div className="text-xs mt-1 text-slate-500">PDF hierher ziehen oder klicken</div>
          </div>
        )}
      </div>
      
      {/* Extrahierte Daten anzeigen */}
      {extractedData && Object.keys(extractedData).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(extractedData).map(([key, value]) => (
            <span key={key} className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-xs">
              {key}: {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Progress Steps
const ProgressSteps = ({ current, steps }) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {steps.map((step, i) => (
      <div key={i} className="flex items-center">
        <div 
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all cursor-pointer ${
            i < current 
              ? 'bg-emerald-500 text-white' 
              : i === current 
                ? 'bg-violet-500 text-white ring-4 ring-violet-500/30' 
                : 'bg-white/5 text-slate-500 hover:bg-white/10'
          }`}
        >
          {i < current ? '✓' : step.icon}
        </div>
        {i < steps.length - 1 && (
          <div className={`w-16 h-0.5 mx-2 ${i < current ? 'bg-emerald-500' : 'bg-white/10'}`} />
        )}
      </div>
    ))}
  </div>
);

// Toast Notification
const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  const colors = {
    info: 'bg-violet-500/20 border-violet-500/30 text-violet-300',
    success: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
    warning: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
    error: 'bg-red-500/20 border-red-500/30 text-red-300',
  };
  
  const icons = {
    info: 'ℹ️',
    success: '✓',
    warning: '⚠️',
    error: '✕',
  };
  
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl border ${colors[type]} backdrop-blur-sm shadow-lg animate-slide-up`}>
      <div className="flex items-center gap-3">
        <span>{icons[type]}</span>
        <span>{message}</span>
        <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100">✕</button>
      </div>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  );
};

// Modal
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="relative w-full max-w-lg rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
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

export default function App() {
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [toast, setToast] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Bootsdaten (persistent)
  const [boatData, setBoatData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BOAT);
      return saved ? JSON.parse(saved) : {
        segelnummer: '',
        seglername: '',
        bootsklasse: 'Optimist',
        iban: '',
        kontoinhaber: ''
      };
    } catch {
      return { segelnummer: '', seglername: '', bootsklasse: 'Optimist', iban: '', kontoinhaber: '' };
    }
  });
  
  // Regatten (persistent)
  const [regatten, setRegatten] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REGATTEN);
      return saved ? JSON.parse(saved) : [createEmptyRegatta()];
    } catch {
      return [createEmptyRegatta()];
    }
  });
  
  // Historie
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Gespeicherte Crew-Mitglieder
  const [savedCrew, setSavedCrew] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SAVED_CREW);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Persistenz
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOAT, JSON.stringify(boatData));
  }, [boatData]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REGATTEN, JSON.stringify(regatten));
  }, [regatten]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  }, [history]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SAVED_CREW, JSON.stringify(savedCrew));
  }, [savedCrew]);
  
  // Handler
  const updateBoatData = (field, value) => {
    setBoatData(prev => ({ ...prev, [field]: value }));
  };
  
  const updateRegatta = useCallback((id, field, value) => {
    setRegatten(prev => prev.map(r => {
      if (r.id !== id) return r;
      
      const updated = { ...r, [field]: value };
      
      // Duplikatprüfung bei Namensänderung
      if (field === 'name') {
        updated.isDuplicate = checkDuplicate(value, prev, id);
        if (updated.isDuplicate) {
          setToast({ message: 'Diese Regatta scheint bereits eingetragen zu sein!', type: 'warning' });
        }
      }
      
      return updated;
    }));
  }, []);
  
  const addRegatta = () => {
    setRegatten(prev => [...prev, createEmptyRegatta()]);
    setToast({ message: 'Neue Regatta hinzugefügt', type: 'success' });
  };
  
  const removeRegatta = (id) => {
    if (regatten.length > 1) {
      setRegatten(prev => prev.filter(r => r.id !== id));
      setToast({ message: 'Regatta entfernt', type: 'info' });
    }
  };
  
  // PDF Verarbeitung - Rechnung
  const processInvoice = async (file, regattaId) => {
    updateRegatta(regattaId, 'processingInvoice', true);
    updateRegatta(regattaId, 'parseError', null);
    
    try {
      const result = await extractText(file, (progress) => {
        updateRegatta(regattaId, 'ocrProgress', progress);
      });
      
      if (result.text) {
        const amount = extractAmount(result.text);
        const name = extractRegattaName(result.text);
        const date = extractDate(result.text);
        
        updateRegatta(regattaId, 'rechnungFileName', file.name);
        
        if (amount) {
          updateRegatta(regattaId, 'startgeld', amount);
          setToast({ message: `Betrag erkannt: ${amount} €`, type: 'success' });
        } else {
          setToast({ message: 'Betrag konnte nicht automatisch erkannt werden', type: 'warning' });
        }
        
        // Nur ausfüllen wenn noch leer
        const currentRegatta = regatten.find(r => r.id === regattaId);
        if (name && !currentRegatta?.name) {
          updateRegatta(regattaId, 'name', name);
        }
        if (date && !currentRegatta?.datum) {
          updateRegatta(regattaId, 'datum', date);
        }
      } else {
        updateRegatta(regattaId, 'parseError', 'PDF konnte nicht gelesen werden');
        setToast({ message: 'PDF konnte nicht verarbeitet werden', type: 'error' });
      }
    } catch (error) {
      console.error('Fehler:', error);
      updateRegatta(regattaId, 'parseError', error.message);
      setToast({ message: 'Fehler beim Verarbeiten der Rechnung', type: 'error' });
    }
    
    updateRegatta(regattaId, 'processingInvoice', false);
    updateRegatta(regattaId, 'ocrProgress', 0);
  };
  
  // PDF Verarbeitung - Ergebnisliste
  const processResult = async (file, regattaId) => {
    updateRegatta(regattaId, 'processingResult', true);
    updateRegatta(regattaId, 'parseError', null);
    
    try {
      const result = await extractText(file, (progress) => {
        updateRegatta(regattaId, 'ocrProgress', progress);
      });
      
      if (result.text) {
        const placement = extractPlacement(result.text, boatData.segelnummer);
        const boatCount = extractBoatCount(result.text);
        const raceCount = extractRaceCount(result.text);
        const name = extractRegattaName(result.text);
        const date = extractDate(result.text);
        
        updateRegatta(regattaId, 'ergebnisFileName', file.name);
        
        const currentRegatta = regatten.find(r => r.id === regattaId);
        let foundData = [];
        
        if (placement) {
          updateRegatta(regattaId, 'platzierung', placement);
          foundData.push(`Platz ${placement}`);
        }
        if (boatCount) {
          updateRegatta(regattaId, 'boote', boatCount);
          foundData.push(`${boatCount} Boote`);
        }
        if (raceCount) {
          updateRegatta(regattaId, 'wettfahrten', raceCount);
          foundData.push(`${raceCount} Wettfahrten`);
        }
        if (name && !currentRegatta?.name) {
          updateRegatta(regattaId, 'name', name);
        }
        if (date && !currentRegatta?.datum) {
          updateRegatta(regattaId, 'datum', date);
        }
        
        if (foundData.length > 0) {
          setToast({ message: `Erkannt: ${foundData.join(', ')}`, type: 'success' });
        } else {
          setToast({ message: 'Segelnummer nicht in der Ergebnisliste gefunden', type: 'warning' });
        }
      } else {
        updateRegatta(regattaId, 'parseError', 'PDF konnte nicht gelesen werden');
        setToast({ message: 'PDF konnte nicht verarbeitet werden', type: 'error' });
      }
    } catch (error) {
      console.error('Fehler:', error);
      updateRegatta(regattaId, 'parseError', error.message);
      setToast({ message: 'Fehler beim Verarbeiten der Ergebnisliste', type: 'error' });
    }
    
    updateRegatta(regattaId, 'processingResult', false);
    updateRegatta(regattaId, 'ocrProgress', 0);
  };
  
  // Gesamtsumme berechnen
  const totalAmount = regatten.reduce((sum, r) => {
    const amount = parseFloat(r.startgeld) || 0;
    return sum + amount;
  }, 0);
  
  // PDF Export
  const generatePDF = () => {
    const doc = new jsPDF();
    const validRegatten = regatten.filter(r => r.name);
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Antrag auf Startgeld-Erstattung', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tegeler Segel-Club e.V. - Saison ${new Date().getFullYear()}`, 105, 28, { align: 'center' });
    
    // Trennlinie
    doc.setDrawColor(139, 92, 246);
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);
    
    // Antragsteller
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Antragsteller', 20, 45);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const info = [
      `Name: ${boatData.seglername}`,
      `Segelnummer: ${boatData.segelnummer}`,
      `Bootsklasse: ${boatData.bootsklasse}`,
      `IBAN: ${boatData.iban}`,
      `Kontoinhaber: ${boatData.kontoinhaber}`,
    ];
    doc.text(info, 20, 55);
    
    // Regatten Tabelle
    doc.autoTable({
      startY: 90,
      head: [['Regatta', 'Datum', 'Platz', 'Boote', 'Wettf.', 'Startgeld']],
      body: validRegatten.map(r => [
        r.name || '-',
        r.datum ? new Date(r.datum).toLocaleDateString('de-DE') : '-',
        r.platzierung ? `${r.platzierung}.` : '-',
        r.boote || '-',
        r.wettfahrten || '-',
        r.startgeld ? `${parseFloat(r.startgeld).toFixed(2)} €` : '-'
      ]),
      foot: [['', '', '', '', 'Gesamt:', `${totalAmount.toFixed(2)} €`]],
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246], fontStyle: 'bold' },
      footStyles: { fillColor: [16, 185, 129], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 50 },
        5: { halign: 'right' }
      }
    });
    
    // Crew-Infos (falls vorhanden)
    const regattaWithCrew = validRegatten.filter(r => r.crew && r.crew.length > 0);
    if (regattaWithCrew.length > 0) {
      const finalY = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Crew-Mitglieder:', 20, finalY);
      doc.setFont('helvetica', 'normal');
      
      let y = finalY + 7;
      regattaWithCrew.forEach(r => {
        doc.text(`${r.name}: ${r.crew.join(', ')}`, 20, y);
        y += 5;
      });
    }
    
    // Unterschrift
    const signY = doc.lastAutoTable.finalY + (regattaWithCrew.length > 0 ? 40 : 30);
    doc.setDrawColor(100);
    doc.line(20, signY, 80, signY);
    doc.setFontSize(8);
    doc.text('Datum, Unterschrift Antragsteller', 20, signY + 5);
    
    doc.line(120, signY, 180, signY);
    doc.text('Genehmigt (Vorstand)', 120, signY + 5);
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')} mit TSC Startgeld-Erstattung`, 105, 285, { align: 'center' });
    
    doc.save(`TSC_Erstattungsantrag_${boatData.seglername.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
    setToast({ message: 'PDF wurde erstellt', type: 'success' });
  };
  
  // CSV Export
  const generateCSV = () => {
    const headers = ['Regatta', 'Datum', 'Segler', 'Segelnummer', 'Bootsklasse', 'Platzierung', 'Boote', 'Wettfahrten', 'Startgeld', 'IBAN', 'Kontoinhaber', 'Crew'];
    const validRegatten = regatten.filter(r => r.name);
    
    const rows = validRegatten.map(r => [
      r.name,
      r.datum,
      boatData.seglername,
      boatData.segelnummer,
      boatData.bootsklasse,
      r.platzierung,
      r.boote,
      r.wettfahrten,
      r.startgeld,
      boatData.iban,
      boatData.kontoinhaber,
      r.crew?.join('; ') || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TSC_Erstattung_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'CSV wurde erstellt', type: 'success' });
  };
  
  // In Historie speichern und zurücksetzen
  const finishAndReset = () => {
    const validRegatten = regatten.filter(r => r.name);
    
    if (validRegatten.length > 0) {
      // Crew-Mitglieder speichern
      const allCrew = validRegatten.flatMap(r => r.crew || []).filter(Boolean);
      const newSavedCrew = [...new Set([...savedCrew, ...allCrew])].slice(0, 20);
      setSavedCrew(newSavedCrew);
      
      // In Historie speichern
      const historyEntry = {
        id: Date.now(),
        date: new Date().toISOString(),
        segler: boatData.seglername,
        segelnummer: boatData.segelnummer,
        bootsklasse: boatData.bootsklasse,
        regattenCount: validRegatten.length,
        total: totalAmount,
        regatten: validRegatten.map(r => ({ name: r.name, startgeld: r.startgeld }))
      };
      setHistory(prev => [historyEntry, ...prev].slice(0, 50));
    }
    
    // Reset
    setRegatten([createEmptyRegatta()]);
    setCurrentStep(0);
    setToast({ message: 'Antrag abgeschlossen! Bereit für den nächsten.', type: 'success' });
  };
  
  // Steps
  const steps = [
    { icon: '⛵', label: 'Boot' },
    { icon: '🏆', label: 'Regatten' },
    { icon: '📤', label: 'Export' },
  ];
  
  const requiredCrew = getRequiredCrewCount(boatData.bootsklasse);
  const validRegattenCount = regatten.filter(r => r.name).length;
  
  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(180deg, #030712 0%, #0a0f1a 50%, #030712 100%)' }}>
      <GradientOrbs />
      
      {/* Toast */}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-2xl shadow-lg shadow-violet-500/25">
            ⚓
          </div>
          <div>
            <div className="font-semibold text-white text-lg">TSC Startgelder</div>
            <div className="text-xs text-slate-500">Tegeler Segel-Club e.V.</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {totalAmount > 0 && (
            <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold">
              {totalAmount.toFixed(2)} €
            </div>
          )}
          
          <button 
            onClick={() => setShowHistoryModal(true)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            title="Historie"
          >
            📚
          </button>
          
          <button 
            onClick={() => setShowHelpModal(true)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            title="Hilfe"
          >
            ❓
          </button>
        </div>
      </nav>
      
      {/* Progress */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-6">
        <ProgressSteps current={currentStep} steps={steps} />
      </div>
      
      {/* Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 pb-12">
        
        {/* Step 0: Bootsdaten */}
        {currentStep === 0 && (
          <GlassCard hover={false}>
            <div className="flex items-center gap-3 mb-6">
              <IconBadge color="cyan">⛵</IconBadge>
              <div>
                <h2 className="text-xl font-semibold text-white">Deine Bootsdaten</h2>
                <p className="text-sm text-slate-400">Diese Daten werden für alle Anträge verwendet und gespeichert</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Seglername"
                icon="👤"
                value={boatData.seglername}
                onChange={(e) => updateBoatData('seglername', e.target.value)}
                placeholder="Max Mustermann"
              />
              
              <Input
                label="Segelnummer"
                icon="🔢"
                value={boatData.segelnummer}
                onChange={(e) => updateBoatData('segelnummer', e.target.value.toUpperCase())}
                placeholder="GER 12345"
                success={boatData.segelnummer.length > 3}
              />
              
              <Select
                label="Bootsklasse"
                icon="⛵"
                value={boatData.bootsklasse}
                onChange={(e) => updateBoatData('bootsklasse', e.target.value)}
                options={Object.keys(BOAT_CLASSES).map(k => ({ 
                  value: k, 
                  label: `${k} (${BOAT_CLASSES[k].crew} Pers.)` 
                }))}
              />
              
              <Input
                label="IBAN"
                icon="🏦"
                value={boatData.iban}
                onChange={(e) => updateBoatData('iban', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' '))}
                placeholder="DE89 3704 0044 0532 0130 00"
              />
              
              <Input
                label="Kontoinhaber"
                icon="💳"
                value={boatData.kontoinhaber}
                onChange={(e) => updateBoatData('kontoinhaber', e.target.value)}
                placeholder="Max Mustermann"
                className="md:col-span-2"
              />
            </div>
            
            {!boatData.segelnummer && (
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                💡 Die Segelnummer wird benötigt, um deine Platzierung automatisch aus Ergebnislisten zu erkennen.
              </div>
            )}
            
            <div className="flex justify-end mt-8">
              <Button 
                onClick={() => setCurrentStep(1)} 
                disabled={!boatData.seglername || !boatData.segelnummer}
              >
                Weiter zu Regatten →
              </Button>
            </div>
          </GlassCard>
        )}
        
        {/* Step 1: Regatten */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {regatten.map((regatta, index) => (
              <GlassCard key={regatta.id} hover={false} warning={regatta.isDuplicate}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <IconBadge color={regatta.isDuplicate ? 'amber' : 'amber'}>🏆</IconBadge>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Regatta {index + 1}
                        {regatta.isDuplicate && <span className="ml-2 text-amber-400 text-sm">(mögl. Duplikat)</span>}
                      </h3>
                      {regatta.name && <p className="text-sm text-slate-400">{regatta.name}</p>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {regatta.startgeld && (
                      <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-semibold">
                        {parseFloat(regatta.startgeld).toFixed(2)} €
                      </span>
                    )}
                    {regatten.length > 1 && (
                      <Button variant="danger" size="sm" onClick={() => removeRegatta(regatta.id)}>
                        ✕
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* PDF Uploads - Prominent platziert */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <FileUpload
                    label="Rechnung hochladen"
                    icon="📄"
                    fileName={regatta.rechnungFileName}
                    onUpload={(file) => processInvoice(file, regatta.id)}
                    processing={regatta.processingInvoice}
                    progress={regatta.ocrProgress}
                    error={regatta.parseError}
                    extractedData={regatta.startgeld ? { Betrag: `${regatta.startgeld} €` } : null}
                  />
                  
                  <FileUpload
                    label="Ergebnisliste hochladen"
                    icon="📊"
                    fileName={regatta.ergebnisFileName}
                    onUpload={(file) => processResult(file, regatta.id)}
                    processing={regatta.processingResult}
                    progress={regatta.ocrProgress}
                    extractedData={
                      regatta.platzierung || regatta.boote ? {
                        ...(regatta.platzierung ? { Platz: regatta.platzierung } : {}),
                        ...(regatta.boote ? { Boote: regatta.boote } : {}),
                        ...(regatta.wettfahrten ? { Wettf: regatta.wettfahrten } : {})
                      } : null
                    }
                  />
                </div>
                
                {/* Manuelle Felder */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Input
                    label="Regattaname"
                    icon="🏁"
                    value={regatta.name}
                    onChange={(e) => updateRegatta(regatta.id, 'name', e.target.value)}
                    placeholder="Tegeler Herbstregatta"
                    error={regatta.isDuplicate ? 'Möglicherweise bereits eingetragen' : null}
                  />
                  
                  <Input
                    label="Datum"
                    icon="📅"
                    type="date"
                    value={regatta.datum}
                    onChange={(e) => updateRegatta(regatta.id, 'datum', e.target.value)}
                  />
                  
                  <Input
                    label="Startgeld (€)"
                    icon="💰"
                    type="number"
                    step="0.01"
                    value={regatta.startgeld}
                    onChange={(e) => updateRegatta(regatta.id, 'startgeld', e.target.value)}
                    placeholder="45.00"
                    success={!!regatta.startgeld}
                  />
                  
                  <Input
                    label="Platzierung"
                    icon="🥇"
                    type="number"
                    value={regatta.platzierung}
                    onChange={(e) => updateRegatta(regatta.id, 'platzierung', e.target.value)}
                    placeholder="1"
                  />
                  
                  <Input
                    label="Anzahl Boote"
                    icon="⛵"
                    type="number"
                    value={regatta.boote}
                    onChange={(e) => updateRegatta(regatta.id, 'boote', e.target.value)}
                    placeholder="42"
                  />
                  
                  <Input
                    label="Wettfahrten"
                    icon="🌊"
                    type="number"
                    value={regatta.wettfahrten}
                    onChange={(e) => updateRegatta(regatta.id, 'wettfahrten', e.target.value)}
                    placeholder="6"
                  />
                </div>
                
                {/* Crew (wenn mehr als 1 Person) */}
                {requiredCrew > 1 && (
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span>👥</span>
                        <span>Crew ({requiredCrew - 1} weitere{requiredCrew > 2 ? '' : 's'} Mitglied{requiredCrew > 2 ? 'er' : ''})</span>
                      </div>
                      {savedCrew.length > 0 && (
                        <div className="text-xs text-slate-500">
                          Gespeichert: {savedCrew.slice(0, 3).join(', ')}{savedCrew.length > 3 ? '...' : ''}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[...Array(requiredCrew - 1)].map((_, i) => (
                        <div key={i} className="relative">
                          <input
                            type="text"
                            value={regatta.crew[i] || ''}
                            onChange={(e) => {
                              const newCrew = [...(regatta.crew || [])];
                              newCrew[i] = e.target.value;
                              updateRegatta(regatta.id, 'crew', newCrew);
                            }}
                            placeholder={`Crew-Mitglied ${i + 1}`}
                            list={`crew-suggestions-${regatta.id}-${i}`}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                          />
                          <datalist id={`crew-suggestions-${regatta.id}-${i}`}>
                            {savedCrew.map((name, j) => (
                              <option key={j} value={name} />
                            ))}
                          </datalist>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            ))}
            
            {/* Weitere Regatta hinzufügen */}
            <button
              onClick={addRegatta}
              className="w-full py-4 rounded-xl border-2 border-dashed border-white/10 text-slate-400 hover:border-violet-500/50 hover:text-violet-400 transition-all"
            >
              + Weitere Regatta hinzufügen
            </button>
            
            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button variant="secondary" onClick={() => setCurrentStep(0)}>
                ← Zurück
              </Button>
              <Button onClick={() => setCurrentStep(2)} disabled={validRegattenCount === 0}>
                Weiter zum Export ({validRegattenCount}) →
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 2: Export */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Zusammenfassung */}
            <GlassCard hover={false}>
              <div className="flex items-center gap-3 mb-6">
                <IconBadge color="emerald">📋</IconBadge>
                <div>
                  <h2 className="text-xl font-semibold text-white">Zusammenfassung</h2>
                  <p className="text-sm text-slate-400">{validRegattenCount} Regatta(en) zur Erstattung</p>
                </div>
              </div>
              
              {/* Segler Info */}
              <div className="p-4 rounded-xl bg-white/5 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500">Segler</div>
                    <div className="text-white font-medium">{boatData.seglername}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Segelnummer</div>
                    <div className="text-white font-medium">{boatData.segelnummer}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Bootsklasse</div>
                    <div className="text-white font-medium">{boatData.bootsklasse}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">IBAN</div>
                    <div className="text-white font-medium">...{boatData.iban?.slice(-8)}</div>
                  </div>
                </div>
              </div>
              
              {/* Regatten Liste */}
              <div className="space-y-3 mb-6">
                {regatten.filter(r => r.name).map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                    <div>
                      <div className="text-white font-medium">{r.name}</div>
                      <div className="text-sm text-slate-400">
                        {r.datum && new Date(r.datum).toLocaleDateString('de-DE')}
                        {r.platzierung && ` • ${r.platzierung}. Platz`}
                        {r.boote && ` von ${r.boote}`}
                        {r.wettfahrten && ` • ${r.wettfahrten} Wettf.`}
                      </div>
                      {r.crew && r.crew.length > 0 && (
                        <div className="text-xs text-slate-500 mt-1">
                          Crew: {r.crew.join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="text-lg font-semibold text-emerald-400">
                      {r.startgeld ? `${parseFloat(r.startgeld).toFixed(2)} €` : '-'}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Gesamtsumme */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
                <div className="text-white font-semibold">Gesamtbetrag zur Erstattung</div>
                <div className="text-2xl font-bold text-white">{totalAmount.toFixed(2)} €</div>
              </div>
            </GlassCard>
            
            {/* Export Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassCard className="cursor-pointer" onClick={generatePDF}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-2xl">📄</div>
                  <div>
                    <div className="text-white font-semibold">PDF-Antrag</div>
                    <div className="text-sm text-slate-400">Erstattungsantrag als PDF</div>
                  </div>
                </div>
              </GlassCard>
              
              <GlassCard className="cursor-pointer" onClick={generateCSV}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl">📊</div>
                  <div>
                    <div className="text-white font-semibold">CSV-Export</div>
                    <div className="text-sm text-slate-400">Für Buchhaltung & Excel</div>
                  </div>
                </div>
              </GlassCard>
            </div>
            
            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                ← Zurück
              </Button>
              <Button variant="success" onClick={finishAndReset}>
                ✓ Fertig - Neuer Antrag
              </Button>
            </div>
          </div>
        )}
      </main>
      
      {/* Historie Modal */}
      <Modal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="📚 Antrags-Historie">
        {history.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            Noch keine abgeschlossenen Anträge
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="p-4 rounded-xl bg-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{h.segler}</span>
                  <span className="text-emerald-400 font-semibold">{h.total.toFixed(2)} €</span>
                </div>
                <div className="text-sm text-slate-400">
                  {new Date(h.date).toLocaleDateString('de-DE')} • {h.regattenCount} Regatta(en)
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {h.regatten?.map(r => r.name).join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-white/10">
          <Button variant="secondary" size="sm" onClick={() => { setHistory([]); setToast({ message: 'Historie gelöscht', type: 'info' }); }}>
            Historie löschen
          </Button>
        </div>
      </Modal>
      
      {/* Hilfe Modal */}
      <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="❓ Hilfe">
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <h4 className="font-semibold text-white mb-2">📄 Rechnungen hochladen</h4>
            <p>Lade die Startgeld-Rechnung als PDF hoch. Der Betrag wird automatisch erkannt und eingetragen.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">📊 Ergebnislisten hochladen</h4>
            <p>Lade die Ergebnisliste als PDF hoch. Deine Platzierung wird anhand der Segelnummer automatisch gefunden.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">🔍 OCR-Erkennung</h4>
            <p>Bei gescannten PDFs wird automatisch OCR (Texterkennung) verwendet. Das kann einige Sekunden dauern.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">⚠️ Duplikaterkennung</h4>
            <p>Die App warnt dich, wenn du eine Regatta möglicherweise doppelt einträgst.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-2">💾 Datenspeicherung</h4>
            <p>Deine Bootsdaten und Regatten werden lokal im Browser gespeichert und bleiben erhalten.</p>
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
