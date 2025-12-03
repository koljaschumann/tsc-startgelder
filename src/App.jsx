import { useState, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import Tesseract from 'tesseract.js'

// PDF.js Worker einrichten
const setupPdfWorker = () => {
  const version = pdfjsLib.version || '3.11.174';
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
};
setupPdfWorker();

// TSC Startgeld-Erstattung App v6.0
// Features: Ergebnisliste + Rechnung Upload, OCR, Betragsextraktion

function App() {
  // Bootsdaten (persistent)
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
  
  // Regatta-Liste mit PDF-Daten und Rechnungen
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

  // Persist data
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

  // === OCR FUNKTION ===
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

  // === PDF TEXT EXTRAKTION ===
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
    
    // OCR falls nötig
    if (fullText.trim().length < 100 && useOcrFallback) {
      console.log('Switching to OCR...');
      fullText = await performOCR(pdf, progressPrefix);
    }
    
    return { text: fullText, pdf };
  };

  // === RECHNUNGSBETRAG EXTRAHIEREN ===
  const extractInvoiceAmount = (text) => {
    console.log('Extracting invoice amount from:', text.substring(0, 500));
    
    // Verschiedene Patterns für Beträge
    const patterns = [
      // "Gesamtbetrag: 45,00 €" oder "Summe: 45,00 EUR"
      /(?:Gesamt|Summe|Total|Betrag|Rechnungsbetrag|Endbetrag|zu zahlen)[:\s]*(\d+[.,]\d{2})\s*(?:€|EUR|Euro)?/gi,
      // "45,00 €" am Ende einer Zeile
      /(\d+[.,]\d{2})\s*(?:€|EUR|Euro)\s*$/gm,
      // "EUR 45,00" oder "€ 45,00"
      /(?:€|EUR|Euro)\s*(\d+[.,]\d{2})/gi,
      // Startgeld spezifisch: "Startgeld: 45,00"
      /Startgeld[:\s]*(\d+[.,]\d{2})/gi,
      // Meldegeld
      /Meldegeld[:\s]*(\d+[.,]\d{2})/gi,
    ];
    
    const foundAmounts = [];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const amountStr = match[1].replace(',', '.');
        const amount = parseFloat(amountStr);
        if (amount > 0 && amount < 1000) { // Plausible Startgelder
          foundAmounts.push(amount);
        }
      }
    }
    
    // Wenn mehrere gefunden, nimm den häufigsten oder höchsten
    if (foundAmounts.length > 0) {
      // Zähle Vorkommen
      const counts = {};
      foundAmounts.forEach(a => {
        const key = a.toFixed(2);
        counts[key] = (counts[key] || 0) + 1;
      });
      
      // Sortiere nach Häufigkeit, dann nach Betrag
      const sorted = Object.entries(counts).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return parseFloat(b[0]) - parseFloat(a[0]);
      });
      
      console.log('Found amounts:', counts);
      return parseFloat(sorted[0][0]);
    }
    
    return null;
  };

  // === ERGEBNISLISTE PARSEN ===
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
      const classMatch = normalizedText.match(/Opti(?:mist)?\s*([ABC])/i);
      if (classMatch) {
        result.boatClass = 'Optimist ' + classMatch[1].toUpperCase();
      } else if (/Optimist/i.test(normalizedText)) {
        result.boatClass = 'Optimist';
      }
      
      // Datum
      let dateMatch = normalizedText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (dateMatch) {
        const months = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        result.date = `${dateMatch[1]} ${months[parseInt(dateMatch[2])]} ${dateMatch[3]}`;
      } else {
        dateMatch = normalizedText.match(/(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{4})/i);
        if (dateMatch) {
          result.date = `${dateMatch[1]} ${dateMatch[2].toUpperCase()} ${dateMatch[3]}`;
        }
      }
      
      // Wettfahrten
      const raceHeaders = normalizedText.match(/R(\d+)/g);
      if (raceHeaders) {
        const nums = raceHeaders.map(r => parseInt(r.slice(1))).filter(n => n > 0 && n < 15);
        if (nums.length > 0) result.raceCount = Math.max(...nums);
      }
      
      // Teilnehmer
      const userNumbers = (sailNumber || '').replace(/\D/g, '');
      const entries = [];
      const gerPattern = /(\d{1,3})\s+GER\s*(\d{3,5})\s+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\s\-]+?)(?=\s+[A-Z]{2,10}\s|\s+\d{1,3}\.\d|\s+\d{1,3}\s+\d{1,3}|\s+GER\s|\s*$)/gi;
      
      let match;
      const seenSailNumbers = new Set();
      
      while ((match = gerPattern.exec(normalizedText)) !== null) {
        const rank = parseInt(match[1]);
        const sailNum = match[2];
        const name = match[3].trim();
        
        if (rank > 0 && rank < 200 && !seenSailNumbers.has(sailNum)) {
          seenSailNumbers.add(sailNum);
          
          const entry = { rank, sailNumber: 'GER ' + sailNum, name: name.substring(0, 35), club: '' };
          entries.push(entry);
          
          if (userNumbers && (sailNum === userNumbers || sailNum.endsWith(userNumbers) || userNumbers.endsWith(sailNum))) {
            result.participant = entry;
          }
        }
      }
      
      // Fallback
      if (entries.length === 0) {
        const simplePattern = /GER\s*(\d{3,5})/gi;
        let idx = 0;
        while ((match = simplePattern.exec(normalizedText)) !== null) {
          const sailNum = match[1];
          if (!seenSailNumbers.has(sailNum)) {
            seenSailNumbers.add(sailNum);
            idx++;
            const entry = { rank: idx, sailNumber: 'GER ' + sailNum, name: `Teilnehmer ${idx}`, club: '' };
            entries.push(entry);
            if (userNumbers && (sailNum === userNumbers || sailNum.includes(userNumbers) || userNumbers.includes(sailNum))) {
              result.participant = entry;
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

  // === ERGEBNISLISTE VERARBEITEN ===
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

  // === RECHNUNG VERARBEITEN ===
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

  // Rechnung zu bestehender Regatta hinzufügen
  const addInvoiceToRegatta = async (regattaId, file) => {
    if (!file) return;
    
    setInvoiceProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      
      const { text } = await extractTextFromPDF(arrayBuffer, true, 'Rechnung: ');
      const amount = extractInvoiceAmount(text);
      
      setRegatten(prev => prev.map(r => {
        if (r.id === regattaId) {
          return {
            ...r,
            invoicePdfData: base64,
            invoiceAmount: amount || r.invoiceAmount
          };
        }
        return r;
      }));
      
      if (amount) {
        setSuccess(`Rechnung hinzugefügt: ${amount.toFixed(2).replace('.', ',')} €`);
      } else {
        setError('Rechnung hinzugefügt, aber Betrag nicht erkannt. Bitte manuell eingeben.');
      }
    } catch (err) {
      setError('Fehler: ' + err.message);
    } finally {
      setInvoiceProcessing(false);
      setOcrProgress(null);
    }
  };

  const updateInvoiceAmount = (regattaId, amount) => {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!isNaN(parsedAmount) && parsedAmount >= 0) {
      setRegatten(prev => prev.map(r => 
        r.id === regattaId ? { ...r, invoiceAmount: parsedAmount } : r
      ));
    }
  };

  const deleteRegatta = (id) => {
    if (confirm('Regatta wirklich löschen?')) {
      setRegatten(prev => prev.filter(r => r.id !== id));
    }
  };

  // === HILFSFUNKTIONEN ===
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const months = { 'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12' };
    const match = dateStr.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
    if (match) {
      return `${match[1].padStart(2, '0')}.${months[match[2].toUpperCase()]}.${match[3]}`;
    }
    return dateStr;
  };

  const formatAmount = (amount) => {
    if (!amount && amount !== 0) return '-';
    return amount.toFixed(2).replace('.', ',') + ' €';
  };

  // Gesamtsumme aus echten Rechnungsbeträgen
  const totalRefund = regatten.reduce((sum, r) => sum + (r.invoiceAmount || 0), 0);
  const regattasWithInvoice = regatten.filter(r => r.invoiceAmount > 0);
  const regattasWithoutInvoice = regatten.filter(r => !r.invoiceAmount);

  // === PDF EXPORT ===
  const exportToPdf = async () => {
    if (regatten.length === 0) {
      setError('Keine Regatten zum Exportieren');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Tegeler Segel-Club e.V.', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('Antrag auf Startgeld-Erstattung', pageWidth / 2, 30, { align: 'center' });
    
    // Segler-Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let y = 45;
    
    doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, 15, y);
    y += 8;
    if (boatData.seglername) {
      doc.text(`Segler/in: ${boatData.seglername}`, 15, y);
      y += 6;
    }
    if (boatData.segelnummer) {
      doc.text(`Segelnummer: ${boatData.segelnummer}`, 15, y);
      y += 6;
    }
    y += 5;
    
    // Tabelle mit echten Rechnungsbeträgen
    const tableData = regatten.map(r => [
      r.regattaName,
      r.boatClass || '-',
      formatDate(r.date),
      `${r.placement}/${r.totalParticipants}`,
      formatAmount(r.invoiceAmount)
    ]);
    
    doc.autoTable({
      startY: y,
      head: [['Regatta', 'Klasse', 'Datum', 'Platz', 'Startgeld']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 82, 147], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 4: { halign: 'right' } }
    });
    
    // Summe
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Gesamt-Erstattungsbetrag: ${formatAmount(totalRefund)}`, pageWidth - 15, finalY, { align: 'right' });
    
    // Bankverbindung
    if (boatData.iban) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`IBAN: ${boatData.iban}`, 15, finalY + 15);
      if (boatData.kontoinhaber) {
        doc.text(`Kontoinhaber: ${boatData.kontoinhaber}`, 15, finalY + 21);
      }
    }
    
    // Unterschrift
    doc.setFontSize(9);
    doc.text('_'.repeat(40), 15, doc.internal.pageSize.getHeight() - 35);
    doc.text('Datum, Unterschrift', 15, doc.internal.pageSize.getHeight() - 30);
    
    // Anlagen Info
    const pdfsCount = regatten.filter(r => r.resultPdfData || r.invoicePdfData).length;
    doc.setFontSize(8);
    doc.text(`Anlagen: ${pdfsCount} Ergebnisliste(n) und Rechnung(en) im Anhang`, 15, doc.internal.pageSize.getHeight() - 15);
    
    // Anhänge: PDFs
    for (const regatta of regatten) {
      // Ergebnisliste
      if (regatta.resultPdfData) {
        try {
          const pdfBytes = Uint8Array.from(atob(regatta.resultPdfData), c => c.charCodeAt(0));
          const attachedPdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
          
          for (let i = 1; i <= attachedPdf.numPages; i++) {
            doc.addPage();
            const page = await attachedPdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const pdfWidth = doc.internal.pageSize.getWidth() - 20;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            doc.addImage(imgData, 'JPEG', 10, 10, pdfWidth, Math.min(pdfHeight, doc.internal.pageSize.getHeight() - 20));
          }
        } catch (err) {
          console.error('Error adding result PDF:', err);
        }
      }
      
      // Rechnung
      if (regatta.invoicePdfData) {
        try {
          const pdfBytes = Uint8Array.from(atob(regatta.invoicePdfData), c => c.charCodeAt(0));
          const attachedPdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
          
          for (let i = 1; i <= attachedPdf.numPages; i++) {
            doc.addPage();
            const page = await attachedPdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const pdfWidth = doc.internal.pageSize.getWidth() - 20;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            doc.addImage(imgData, 'JPEG', 10, 10, pdfWidth, Math.min(pdfHeight, doc.internal.pageSize.getHeight() - 20));
          }
        } catch (err) {
          console.error('Error adding invoice PDF:', err);
        }
      }
    }
    
    doc.save(`TSC_Erstattungsantrag_${new Date().toISOString().split('T')[0]}.pdf`);
    setSuccess('PDF-Antrag mit allen Anlagen wurde erstellt!');
  };

  const exportToCsv = () => {
    const headers = ['Regatta', 'Bootsklasse', 'Datum', 'Platzierung', 'Teilnehmer', 'Startgeld'];
    const rows = regatten.map(r => [
      r.regattaName, r.boatClass, formatDate(r.date),
      r.placement, r.totalParticipants, formatAmount(r.invoiceAmount)
    ]);
    const csv = [headers, ...rows, ['', '', '', '', 'GESAMT:', formatAmount(totalRefund)]].map(row => row.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TSC_Startgeld_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const viewPdf = (pdfData) => {
    const pdfBlob = new Blob([Uint8Array.from(atob(pdfData), c => c.charCodeAt(0))], { type: 'application/pdf' });
    window.open(URL.createObjectURL(pdfBlob), '_blank');
  };

  // Drag & Drop Handler
  const [isDraggingInvoice, setIsDraggingInvoice] = useState(false);
  
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

  // === RENDER ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-700">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">⛵</div>
              <div>
                <h1 className="text-xl font-bold text-white">TSC Startgeld-Erstattung</h1>
                <p className="text-blue-200 text-sm">Tegeler Segel-Club e.V.</p>
              </div>
            </div>
            {boatData.segelnummer && (
              <div className="text-right">
                <div className="text-white font-mono">{boatData.segelnummer}</div>
                <div className="text-blue-200 text-sm">{boatData.seglername}</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white/5 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: 'add', label: '➕ Hinzufügen' },
              { id: 'list', label: `📋 Liste (${regatten.length})` },
              { id: 'settings', label: '⚙️ Einstellungen' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium transition-all ${
                  activeTab === tab.id
                    ? 'text-white bg-white/20 border-b-2 border-cyan-400'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Messages */}
      <div className="max-w-4xl mx-auto px-4 mt-4">
        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4 mb-4 flex items-start gap-3">
            <span className="text-red-300 text-xl">⚠️</span>
            <div className="text-red-200 flex-1">{error}</div>
            <button onClick={() => setError(null)} className="text-red-300 hover:text-white">✕</button>
          </div>
        )}
        {success && (
          <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-4 mb-4 flex items-start gap-3">
            <span className="text-green-300 text-xl">✅</span>
            <div className="text-green-200 flex-1">{success}</div>
          </div>
        )}
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        
        {/* === ADD TAB === */}
        {activeTab === 'add' && (
          <div className="space-y-6">
            
            {/* Step 1: Ergebnisliste */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <span className="bg-cyan-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                📄 Ergebnisliste hochladen
              </h3>
              <p className="text-blue-200 text-sm mb-4">
                Lade die PDF-Ergebnisliste von manage2sail hoch.
              </p>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDropResult}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
                  ${pdfResult?.success ? 'border-green-400 bg-green-500/10' :
                    isDragging ? 'border-cyan-400 bg-cyan-500/20' : 
                    isProcessing ? 'border-cyan-400 bg-cyan-500/10' :
                    'border-white/30 hover:border-cyan-400 hover:bg-white/5'}`}
                onClick={() => !isProcessing && document.getElementById('result-pdf-input').click()}
              >
                <input
                  type="file"
                  id="result-pdf-input"
                  accept=".pdf"
                  onChange={(e) => processResultPdf(e.target.files?.[0])}
                  disabled={isProcessing}
                  className="hidden"
                />
                {isProcessing && !invoiceProcessing ? (
                  <div className="text-cyan-300">
                    <div className="text-3xl mb-2 animate-pulse">⏳</div>
                    {ocrProgress ? (
                      <div>
                        <div className="text-sm mb-2">{ocrProgress.status}</div>
                        <div className="w-full max-w-xs mx-auto bg-white/20 rounded-full h-2">
                          <div className="bg-cyan-400 h-2 rounded-full transition-all" style={{ width: `${ocrProgress.percent}%` }} />
                        </div>
                      </div>
                    ) : <div>Wird verarbeitet...</div>}
                  </div>
                ) : pdfResult?.success ? (
                  <div className="text-green-300">
                    <div className="text-3xl mb-2">✅</div>
                    <div className="font-medium">{pdfResult.regattaName}</div>
                    <div className="text-sm">Platz {pdfResult.participant?.rank} von {pdfResult.totalParticipants}</div>
                  </div>
                ) : (
                  <div className="text-blue-200">
                    <div className="text-3xl mb-2">📤</div>
                    <div className="font-medium text-white">PDF auswählen oder hierher ziehen</div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Rechnung */}
            {pdfResult?.success && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <span className="bg-cyan-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                  🧾 Rechnung hochladen
                </h3>
                <p className="text-blue-200 text-sm mb-4">
                  Lade die Startgeld-Rechnung hoch. Der Betrag wird automatisch erkannt.
                </p>
                
                <div
                  onDragOver={handleDragOverInvoice}
                  onDragLeave={handleDragLeaveInvoice}
                  onDrop={handleDropInvoice}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
                    ${currentInvoiceData ? 'border-green-400 bg-green-500/10' :
                      isDraggingInvoice ? 'border-cyan-400 bg-cyan-500/20' :
                      invoiceProcessing ? 'border-cyan-400 bg-cyan-500/10' :
                      'border-white/30 hover:border-cyan-400 hover:bg-white/5'}`}
                  onClick={() => !invoiceProcessing && document.getElementById('invoice-pdf-input').click()}
                >
                  <input
                    type="file"
                    id="invoice-pdf-input"
                    accept=".pdf"
                    onChange={(e) => processInvoicePdf(e.target.files?.[0])}
                    disabled={invoiceProcessing}
                    className="hidden"
                  />
                  {invoiceProcessing ? (
                    <div className="text-cyan-300">
                      <div className="text-3xl mb-2 animate-pulse">⏳</div>
                      {ocrProgress ? (
                        <div>
                          <div className="text-sm mb-2">{ocrProgress.status}</div>
                          <div className="w-full max-w-xs mx-auto bg-white/20 rounded-full h-2">
                            <div className="bg-cyan-400 h-2 rounded-full transition-all" style={{ width: `${ocrProgress.percent}%` }} />
                          </div>
                        </div>
                      ) : <div>Rechnung wird verarbeitet...</div>}
                    </div>
                  ) : isDraggingInvoice ? (
                    <div className="text-cyan-300">
                      <div className="text-3xl mb-2">📥</div>
                      <div className="font-medium">Rechnung hier ablegen</div>
                    </div>
                  ) : currentInvoiceData ? (
                    <div className="text-green-300">
                      <div className="text-3xl mb-2">✅</div>
                      <div className="font-medium">Rechnung hochgeladen</div>
                    </div>
                  ) : (
                    <div className="text-blue-200">
                      <div className="text-3xl mb-2">🧾</div>
                      <div className="font-medium text-white">Rechnung auswählen oder hierher ziehen</div>
                    </div>
                  )}
                </div>
                
                {/* Betrag Eingabe */}
                <div className="mt-4">
                  <label className="block text-blue-200 text-sm mb-1">Rechnungsbetrag (Startgeld) *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={currentInvoiceAmount}
                      onChange={(e) => setCurrentInvoiceAmount(e.target.value)}
                      placeholder="z.B. 45,00"
                      className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-lg font-mono"
                    />
                    <span className="text-white text-lg">€</span>
                  </div>
                  <p className="text-blue-300 text-xs mt-1">
                    {currentInvoiceData ? 'Betrag wurde automatisch erkannt. Bitte prüfen!' : 'Wird automatisch aus der Rechnung extrahiert.'}
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Bestätigen */}
            {pdfResult?.success && currentInvoiceAmount && (
              <div className="bg-green-500/20 backdrop-blur-sm rounded-xl p-6 border border-green-400/30">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                  ✅ Zusammenfassung
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <div className="text-green-300">Regatta</div>
                    <div className="text-white font-medium">{pdfResult.regattaName}</div>
                  </div>
                  <div>
                    <div className="text-green-300">Platzierung</div>
                    <div className="text-white font-medium">{pdfResult.participant?.rank} von {pdfResult.totalParticipants}</div>
                  </div>
                  <div>
                    <div className="text-green-300">Datum</div>
                    <div className="text-white font-medium">{formatDate(pdfResult.date)}</div>
                  </div>
                  <div>
                    <div className="text-green-300">Startgeld</div>
                    <div className="text-white font-bold text-xl">{currentInvoiceAmount} €</div>
                  </div>
                </div>
                
                <button
                  onClick={addRegattaFromPdf}
                  className="w-full py-3 px-4 rounded-lg font-medium bg-green-500 hover:bg-green-400 text-white transition-all text-lg"
                >
                  ✅ Zur Liste hinzufügen
                </button>
              </div>
            )}

            {/* Manuell eingeben */}
            <div className="text-center">
              <button
                onClick={() => setManualMode(!manualMode)}
                className="text-cyan-300 hover:text-cyan-200 text-sm underline"
              >
                {manualMode ? '← Zurück' : '✏️ Manuell eingeben'}
              </button>
            </div>

            {manualMode && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4">✏️ Manuelle Eingabe</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-blue-200 text-sm mb-1">Regatta-Name *</label>
                    <input
                      type="text"
                      value={manualData.regattaName}
                      onChange={e => setManualData(d => ({ ...d, regattaName: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-200 text-sm mb-1">Bootsklasse</label>
                    <input
                      type="text"
                      value={manualData.boatClass}
                      onChange={e => setManualData(d => ({ ...d, boatClass: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-200 text-sm mb-1">Datum</label>
                    <input
                      type="date"
                      value={manualData.date}
                      onChange={e => setManualData(d => ({ ...d, date: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-200 text-sm mb-1">Platzierung *</label>
                    <input
                      type="number"
                      value={manualData.placement}
                      onChange={e => setManualData(d => ({ ...d, placement: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-200 text-sm mb-1">Teilnehmer gesamt *</label>
                    <input
                      type="number"
                      value={manualData.totalParticipants}
                      onChange={e => setManualData(d => ({ ...d, totalParticipants: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-200 text-sm mb-1">Wettfahrten</label>
                    <input
                      type="number"
                      value={manualData.raceCount}
                      onChange={e => setManualData(d => ({ ...d, raceCount: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-200 text-sm mb-1">Startgeld (€) *</label>
                    <input
                      type="text"
                      value={manualData.invoiceAmount}
                      onChange={e => setManualData(d => ({ ...d, invoiceAmount: e.target.value }))}
                      placeholder="z.B. 45,00"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                </div>
                
                <button
                  onClick={addRegattaManual}
                  className="w-full mt-4 py-3 px-4 rounded-lg font-medium bg-cyan-500 hover:bg-cyan-400 text-white"
                >
                  ✅ Hinzufügen
                </button>
              </div>
            )}

            {/* Debug */}
            {debugText && (
              <details className="bg-white/5 rounded-xl p-4 border border-white/10">
                <summary className="text-cyan-300 cursor-pointer text-sm">🔍 Debug</summary>
                <pre className="mt-2 text-xs text-blue-200 whitespace-pre-wrap max-h-40 overflow-auto bg-black/30 p-2 rounded">
                  {debugText}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* === LIST TAB === */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            
            {/* Zusammenfassung */}
            {regatten.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-blue-200">Gesamt-Erstattung:</span>
                    <span className="text-3xl font-bold text-white ml-2">{formatAmount(totalRefund)}</span>
                  </div>
                  <div className="text-sm text-blue-200 text-right">
                    <div>{regattasWithInvoice.length} Rechnung(en)</div>
                    {regattasWithoutInvoice.length > 0 && (
                      <div className="text-yellow-300">{regattasWithoutInvoice.length} ohne Rechnung</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={exportToPdf}
                    className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-medium"
                  >
                    📄 PDF-Antrag erstellen
                  </button>
                  <button
                    onClick={exportToCsv}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg"
                  >
                    📥 CSV
                  </button>
                </div>
              </div>
            )}

            {/* Liste */}
            {regatten.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-white font-medium mb-2">Noch keine Regatten</div>
                <button
                  onClick={() => setActiveTab('add')}
                  className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg"
                >
                  ➕ Regatta hinzufügen
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {regatten.map(r => (
                  <div key={r.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-white font-medium">{r.regattaName}</h4>
                          {r.resultPdfData && (
                            <button onClick={() => viewPdf(r.resultPdfData)} className="text-cyan-300 hover:text-cyan-200 text-xs px-2 py-0.5 bg-cyan-500/20 rounded">
                              📄 Ergebnis
                            </button>
                          )}
                          {r.invoicePdfData && (
                            <button onClick={() => viewPdf(r.invoicePdfData)} className="text-green-300 hover:text-green-200 text-xs px-2 py-0.5 bg-green-500/20 rounded">
                              🧾 Rechnung
                            </button>
                          )}
                        </div>
                        <div className="text-blue-200 text-sm mt-1">
                          {r.boatClass} • {formatDate(r.date)} • Platz {r.placement}/{r.totalParticipants}
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        {r.invoiceAmount > 0 ? (
                          <div className="text-green-300 font-bold text-xl">{formatAmount(r.invoiceAmount)}</div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-yellow-300 text-sm">Keine Rechnung</div>
                            <label className="block">
                              <span className="text-xs text-cyan-300 hover:text-cyan-200 cursor-pointer underline">
                                + Rechnung hinzufügen
                              </span>
                              <input
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                onChange={(e) => addInvoiceToRegatta(r.id, e.target.files?.[0])}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => deleteRegatta(r.id)}
                        className="ml-3 text-red-300 hover:text-red-200 p-1"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    {/* Betrag editieren */}
                    {r.invoicePdfData && (
                      <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2">
                        <span className="text-blue-200 text-sm">Betrag:</span>
                        <input
                          type="text"
                          value={r.invoiceAmount?.toFixed(2).replace('.', ',') || ''}
                          onChange={(e) => updateInvoiceAmount(r.id, e.target.value)}
                          className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm font-mono"
                        />
                        <span className="text-blue-200 text-sm">€</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === SETTINGS TAB === */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">🚤 Bootsdaten</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-blue-200 text-sm mb-1">Segelnummer *</label>
                  <input
                    type="text"
                    value={boatData.segelnummer}
                    onChange={e => setBoatData(d => ({ ...d, segelnummer: e.target.value }))}
                    placeholder="z.B. GER 13162"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-blue-200 text-sm mb-1">Segler/in Name</label>
                  <input
                    type="text"
                    value={boatData.seglername}
                    onChange={e => setBoatData(d => ({ ...d, seglername: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-blue-200 text-sm mb-1">Bootsklasse</label>
                  <select
                    value={boatData.bootsklasse}
                    onChange={e => setBoatData(d => ({ ...d, bootsklasse: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  >
                    <option value="Optimist">Optimist</option>
                    <option value="420er">420er</option>
                    <option value="ILCA 4">ILCA 4</option>
                    <option value="ILCA 6">ILCA 6</option>
                    <option value="29er">29er</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">🏦 Bankverbindung</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-blue-200 text-sm mb-1">Kontoinhaber</label>
                  <input
                    type="text"
                    value={boatData.kontoinhaber}
                    onChange={e => setBoatData(d => ({ ...d, kontoinhaber: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-blue-200 text-sm mb-1">IBAN</label>
                  <input
                    type="text"
                    value={boatData.iban}
                    onChange={e => setBoatData(d => ({ ...d, iban: e.target.value }))}
                    placeholder="DE..."
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">💾 Datenverwaltung</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    const data = { boatData, regatten, exportDate: new Date().toISOString(), version: 'v6' };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `TSC_Backup_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                  }}
                  className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                >
                  📦 Backup herunterladen
                </button>
                
                <label className="block w-full py-2 px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg text-center cursor-pointer">
                  📂 Backup wiederherstellen
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        if (data.boatData) setBoatData(data.boatData);
                        if (data.regatten) setRegatten(data.regatten);
                        setSuccess('Backup wiederhergestellt!');
                      }
                    }}
                  />
                </label>
                
                <button
                  onClick={() => {
                    if (confirm('Alle Regatten löschen?')) {
                      setRegatten([]);
                    }
                  }}
                  className="w-full py-2 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg"
                >
                  🗑️ Alle Regatten löschen
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
