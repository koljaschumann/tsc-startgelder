import { useState, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// PDF.js Worker einrichten - mehrere Optionen probieren
const setupPdfWorker = () => {
  // Option 1: CDN mit exakter Version
  const version = pdfjsLib.version || '3.11.174';
  const workerUrls = [
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`,
    `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.js`,
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.js`
  ];
  
  // Versuche ersten URL
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrls[0];
  console.log('PDF.js version:', version);
  console.log('Worker URL:', workerUrls[0]);
};

setupPdfWorker();

// TSC Startgeld-Erstattung App v5.0
// Features: PDF-Upload, Duplikat-Erkennung, PDF-Archiv, Gesamt-Export

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
  
  // Regatta-Liste mit PDF-Daten
  const [regatten, setRegatten] = useState(() => {
    const saved = localStorage.getItem('tsc-regatten-v5');
    return saved ? JSON.parse(saved) : [];
  });
  
  // UI State
  const [activeTab, setActiveTab] = useState('add');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // PDF Upload State
  const [pdfResult, setPdfResult] = useState(null);
  const [currentPdfData, setCurrentPdfData] = useState(null); // Base64 der aktuellen PDF
  const [manualMode, setManualMode] = useState(false);
  const [debugText, setDebugText] = useState(''); // Debug: Extrahierter Text
  
  // Manuelle Eingabe State
  const [manualData, setManualData] = useState({
    regattaName: '',
    boatClass: '',
    date: '',
    placement: '',
    totalParticipants: '',
    raceCount: ''
  });

  // Persist data
  useEffect(() => {
    localStorage.setItem('tsc-boat-data', JSON.stringify(boatData));
  }, [boatData]);
  
  useEffect(() => {
    localStorage.setItem('tsc-regatten-v5', JSON.stringify(regatten));
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

  // === PDF PARSING ===
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
      console.log('=== PDF PARSING ===');
      console.log('Text length:', text.length);
      
      // Normalisiere Text (entferne mehrfache Leerzeichen)
      const normalizedText = text.replace(/\s+/g, ' ');
      
      // === REGATTA-NAME ===
      // Suche nach Pattern: "Name 2025 - Opti" oder "Name-Preis 2025"
      const namePatterns = [
        /([A-Za-zäöüÄÖÜß\-]+(?:[\s\-][A-Za-zäöüÄÖÜß\-]+)*[\s\-]*(?:Preis|Pokal|Cup|Trophy|Regatta|Festival)[\s\-]*\d{4})/i,
        /([A-Za-zäöüÄÖÜß\-]+[\s\-]+\d{4}[\s\-]+[\-][\s\-]+Opti[mist]*\s*[ABC]?)/i,
        /manage2sail\.com\s+([A-Za-zäöüÄÖÜß0-9\s\-]+?)(?:\s+Ergebnisse|\s+Overall|\s+Results)/i,
      ];
      
      for (const pattern of namePatterns) {
        const match = normalizedText.match(pattern);
        if (match) {
          result.regattaName = match[1].trim().replace(/\s+/g, ' ');
          break;
        }
      }
      
      // === BOOTSKLASSE ===
      const classMatch = normalizedText.match(/Opti(?:mist)?\s*([ABC])/i);
      if (classMatch) {
        result.boatClass = 'Optimist ' + classMatch[1].toUpperCase();
      } else if (/Optimist/i.test(normalizedText)) {
        result.boatClass = 'Optimist';
      } else if (/420/i.test(normalizedText)) {
        result.boatClass = '420er';
      } else if (/ILCA/i.test(normalizedText)) {
        const ilcaMatch = normalizedText.match(/ILCA\s*(\d)/i);
        result.boatClass = ilcaMatch ? `ILCA ${ilcaMatch[1]}` : 'ILCA';
      }
      
      // === DATUM ===
      // Deutsches Format: 11.05.2025
      let dateMatch = normalizedText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (dateMatch) {
        const months = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        result.date = `${dateMatch[1]} ${months[parseInt(dateMatch[2])]} ${dateMatch[3]}`;
      }
      // Englisches Format: 27 APR 2025
      if (!result.date) {
        dateMatch = normalizedText.match(/(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{4})/i);
        if (dateMatch) {
          result.date = `${dateMatch[1]} ${dateMatch[2].toUpperCase()} ${dateMatch[3]}`;
        }
      }
      
      // === WETTFAHRTEN ===
      const raceHeaders = normalizedText.match(/R(\d+)/g);
      if (raceHeaders) {
        const nums = raceHeaders.map(r => parseInt(r.slice(1))).filter(n => n > 0 && n < 15);
        if (nums.length > 0) result.raceCount = Math.max(...nums);
      }
      
      // === TEILNEHMER FINDEN ===
      const userNumbers = (sailNumber || '').replace(/\D/g, '');
      console.log('Looking for sail number:', sailNumber, '-> digits:', userNumbers);
      
      // Finde alle GER-Nummern mit Kontext
      // Pattern: Zahl (Rang) + GER + Zahl (Segelnummer) + Name
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
          
          const entry = {
            rank,
            sailNumber: 'GER ' + sailNum,
            name: name.substring(0, 35),
            club: '',
            totalPoints: 0,
            netPoints: 0
          };
          
          entries.push(entry);
          
          // Check if this is our sailor
          if (userNumbers && (sailNum === userNumbers || sailNum.endsWith(userNumbers) || userNumbers.endsWith(sailNum))) {
            console.log('FOUND:', entry);
            result.participant = entry;
          }
        }
      }
      
      // Fallback: Einfach alle GER-Nummern sammeln
      if (entries.length === 0) {
        console.log('Fallback: Collecting all GER numbers...');
        const simplePattern = /GER\s*(\d{3,5})/gi;
        let idx = 0;
        while ((match = simplePattern.exec(normalizedText)) !== null) {
          const sailNum = match[1];
          if (!seenSailNumbers.has(sailNum)) {
            seenSailNumbers.add(sailNum);
            idx++;
            const entry = {
              rank: idx,
              sailNumber: 'GER ' + sailNum,
              name: `Teilnehmer ${idx}`,
              club: '',
              totalPoints: 0,
              netPoints: 0
            };
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
      
      console.log('Result:', {
        success: result.success,
        regattaName: result.regattaName,
        boatClass: result.boatClass,
        participants: result.totalParticipants,
        foundUser: !!result.participant
      });
      
    } catch (err) {
      console.error('Parse error:', err);
    }
    
    return result;
  };

  // === PDF VERARBEITUNG ===
  const processPdfFile = async (file) => {
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
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
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      console.log('PDF loaded, size:', arrayBuffer.byteLength);
      
      // PDF als Base64 speichern für später
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      setCurrentPdfData(base64);
      
      // PDF Text extrahieren
      let pdf;
      try {
        // Versuche mit Worker
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        console.log('PDF parsed with worker, pages:', pdf.numPages);
      } catch (pdfError) {
        console.warn('Worker failed, trying without worker:', pdfError.message);
        try {
          // Fallback: Ohne Worker
          pdf = await pdfjsLib.getDocument({ 
            data: arrayBuffer,
            disableWorker: true,
            isEvalSupported: false
          }).promise;
          console.log('PDF parsed without worker, pages:', pdf.numPages);
        } catch (fallbackError) {
          console.error('PDF parse error (both methods failed):', fallbackError);
          setError('PDF konnte nicht gelesen werden. Bitte nutze "Manuell eingeben".');
          setDebugText('PDF Parse Error:\n' + pdfError.message + '\n\nFallback Error:\n' + fallbackError.message);
          setManualMode(true);
          return;
        }
      }
      
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          console.log(`Page ${i}: ${textContent.items.length} text items`);
          
          // Debug: Zeige erste 10 Items
          if (i === 1) {
            console.log('First 10 items:', textContent.items.slice(0, 10).map(item => ({
              str: item.str,
              width: item.width,
              hasFont: !!item.fontName
            })));
          }
          
          if (textContent.items.length === 0) {
            console.log(`Page ${i} has no text items - might be image-based`);
          }
          
          // Extrahiere Text - versuche verschiedene Methoden
          for (const item of textContent.items) {
            if (item.str && item.str.trim()) {
              fullText += item.str + ' ';
            }
          }
          fullText += '\n';
          
        } catch (pageError) {
          console.error(`Error on page ${i}:`, pageError);
        }
      }
      
      console.log('Total extracted text length:', fullText.length);
      console.log('Extracted text preview:', fullText.substring(0, 500));
      console.log('Full text (first 1000):', fullText.substring(0, 1000));
      
      // Debug: Zeige extrahierten Text
      if (fullText.trim().length === 0) {
        setDebugText('KEIN TEXT EXTRAHIERT!\n\nDiese PDF enthält möglicherweise nur Bilder (gescannt) statt echten Text.\n\nBitte nutze "Manuell eingeben" für diese Regatta.');
        setError('Diese PDF enthält keinen extrahierbaren Text. Bitte nutze "Manuell eingeben".');
        setManualMode(true);
        return;
      }
      
      setDebugText(fullText.substring(0, 5000));
      
      // Parse
      const result = parseRegattaPDF(fullText, boatData.segelnummer);
      
      // Duplikat-Prüfung
      if (result.success) {
        const isDuplicate = regatten.some(r => 
          r.regattaName === result.regattaName && 
          r.boatClass === result.boatClass &&
          r.date === result.date
        );
        
        if (isDuplicate) {
          setError(`Diese Regatta "${result.regattaName}" ist bereits in deiner Liste!`);
          setPdfResult(result);
          return;
        }
      }
      
      setPdfResult(result);
      
      if (!result.success) {
        setError('PDF konnte nicht vollständig gelesen werden. Nutze "Manuell eingeben" oder prüfe die Debug-Ausgabe unten.');
        setManualData(prev => ({
          ...prev,
          regattaName: result.regattaName || '',
          boatClass: result.boatClass || '',
          date: result.date || '',
          totalParticipants: result.totalParticipants ? String(result.totalParticipants) : '',
          raceCount: result.raceCount ? String(result.raceCount) : ''
        }));
      } else if (!result.participant) {
        setError(`Segelnummer "${boatData.segelnummer}" nicht gefunden. Prüfe die Einstellungen.`);
      } else {
        setSuccess(`${result.participant.name} gefunden: Platz ${result.participant.rank} von ${result.totalParticipants}`);
      }
      
    } catch (err) {
      console.error('PDF Error:', err);
      setError('Fehler beim Lesen der PDF: ' + err.message);
      setDebugText('Error: ' + err.message + '\n\nStack: ' + err.stack);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    await processPdfFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    await processPdfFile(file);
  };

  // === REGATTA HINZUFÜGEN ===
  const addRegattaFromPdf = () => {
    if (!pdfResult?.participant) {
      setError('Keine gültigen Daten');
      return;
    }
    
    // Nochmal Duplikat-Check
    const isDuplicate = regatten.some(r => 
      r.regattaName === pdfResult.regattaName && 
      r.boatClass === pdfResult.boatClass
    );
    
    if (isDuplicate) {
      setError('Diese Regatta ist bereits in der Liste!');
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
      pdfData: currentPdfData, // PDF als Base64 speichern!
      addedAt: new Date().toISOString()
    };
    
    setRegatten(prev => [...prev, newRegatta]);
    setPdfResult(null);
    setCurrentPdfData(null);
    setDebugText('');
    setSuccess(`"${pdfResult.regattaName}" wurde hinzugefügt!`);
    setActiveTab('list');
  };

  const addRegattaManual = () => {
    const { regattaName, boatClass, date, placement, totalParticipants, raceCount } = manualData;
    
    if (!regattaName || !placement || !totalParticipants || !raceCount) {
      setError('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    
    const isDuplicate = regatten.some(r => 
      r.regattaName === regattaName && r.boatClass === (boatClass || boatData.bootsklasse)
    );
    
    if (isDuplicate) {
      setError('Diese Regatta ist bereits in der Liste!');
      return;
    }
    
    const newRegatta = {
      id: Date.now(),
      regattaName,
      boatClass: boatClass || boatData.bootsklasse,
      date,
      placement: parseInt(placement),
      totalParticipants: parseInt(totalParticipants),
      raceCount: parseInt(raceCount),
      sailorName: boatData.seglername,
      pdfData: currentPdfData, // Falls PDF vorhanden
      addedAt: new Date().toISOString()
    };
    
    setRegatten(prev => [...prev, newRegatta]);
    setManualData({ regattaName: '', boatClass: '', date: '', placement: '', totalParticipants: '', raceCount: '' });
    setPdfResult(null);
    setCurrentPdfData(null);
    setSuccess(`"${regattaName}" wurde hinzugefügt!`);
    setActiveTab('list');
  };

  const deleteRegatta = (id) => {
    if (confirm('Regatta wirklich löschen?')) {
      setRegatten(prev => prev.filter(r => r.id !== id));
    }
  };

  // === BERECHNUNGEN ===
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const months = { 'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12' };
    const match = dateStr.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
    if (match) {
      return `${match[1].padStart(2, '0')}.${months[match[2].toUpperCase()]}.${match[3]}`;
    }
    return dateStr;
  };

  const calculateRefund = (placement, participants, races) => {
    if (!placement || !participants || !races) return 0;
    const percentile = (placement / participants) * 100;
    let factor = 5;
    if (percentile <= 10) factor = 10;
    else if (percentile <= 25) factor = 8;
    else if (percentile <= 50) factor = 6;
    return Math.round(races * factor);
  };

  const totalRefund = regatten.reduce((sum, r) => 
    sum + calculateRefund(r.placement, r.totalParticipants, r.raceCount), 0
  );

  // === EXPORT FUNKTIONEN ===
  const exportToCsv = () => {
    const headers = ['Regatta', 'Bootsklasse', 'Datum', 'Platzierung', 'Teilnehmer', 'Wettfahrten', 'Erstattung'];
    const rows = regatten.map(r => [
      r.regattaName, r.boatClass, formatDate(r.date),
      r.placement, r.totalParticipants, r.raceCount,
      calculateRefund(r.placement, r.totalParticipants, r.raceCount) + '€'
    ]);
    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TSC_Startgeld_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

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
    
    // Tabelle
    const tableData = regatten.map(r => [
      r.regattaName,
      r.boatClass || '-',
      formatDate(r.date),
      `${r.placement}/${r.totalParticipants}`,
      r.raceCount,
      `${calculateRefund(r.placement, r.totalParticipants, r.raceCount)} EUR`
    ]);
    
    doc.autoTable({
      startY: y,
      head: [['Regatta', 'Klasse', 'Datum', 'Platz', 'Wettf.', 'Erstattung']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 82, 147], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2 }
    });
    
    // Summe
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Gesamt-Erstattung: ${totalRefund} EUR`, pageWidth - 15, finalY, { align: 'right' });
    
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
    
    // Anhänge: PDFs der Regatten
    const regattasWithPdf = regatten.filter(r => r.pdfData);
    if (regattasWithPdf.length > 0) {
      doc.setFontSize(8);
      doc.text(`Anlagen: ${regattasWithPdf.length} Ergebnisliste(n) im Anhang`, 15, doc.internal.pageSize.getHeight() - 15);
      
      // Füge jede PDF als neue Seiten hinzu
      for (const regatta of regattasWithPdf) {
        try {
          const pdfBytes = Uint8Array.from(atob(regatta.pdfData), c => c.charCodeAt(0));
          const attachedPdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
          
          for (let i = 1; i <= attachedPdf.numPages; i++) {
            doc.addPage();
            const page = await attachedPdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            
            await page.render({ canvasContext: ctx, viewport }).promise;
            
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const pdfWidth = doc.internal.pageSize.getWidth() - 20;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            doc.addImage(imgData, 'JPEG', 10, 10, pdfWidth, Math.min(pdfHeight, doc.internal.pageSize.getHeight() - 20));
          }
        } catch (err) {
          console.error('Error adding PDF attachment:', err);
        }
      }
    }
    
    doc.save(`TSC_Erstattungsantrag_${new Date().toISOString().split('T')[0]}.pdf`);
    setSuccess('PDF-Antrag mit Anlagen wurde erstellt!');
  };

  // === PDF VORSCHAU ===
  const viewPdf = (pdfData) => {
    const pdfBlob = new Blob(
      [Uint8Array.from(atob(pdfData), c => c.charCodeAt(0))],
      { type: 'application/pdf' }
    );
    window.open(URL.createObjectURL(pdfBlob), '_blank');
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
                <div className="text-blue-200 text-sm">{boatData.seglername || boatData.bootsklasse}</div>
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
            
            {/* PDF Upload */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                📄 Ergebnisliste hochladen
              </h3>
              <p className="text-blue-200 text-sm mb-4">
                Lade die PDF-Ergebnisliste von manage2sail hoch.
              </p>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                  ${isDragging ? 'border-cyan-400 bg-cyan-500/20 scale-102' 
                    : isProcessing ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-white/30 hover:border-cyan-400 hover:bg-white/5'}`}
                onClick={() => !isProcessing && document.getElementById('pdf-input').click()}
              >
                <input
                  type="file"
                  id="pdf-input"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
                {isProcessing ? (
                  <div className="text-cyan-300">
                    <div className="text-4xl mb-2 animate-pulse">⏳</div>
                    <div>PDF wird verarbeitet...</div>
                  </div>
                ) : isDragging ? (
                  <div className="text-cyan-300">
                    <div className="text-4xl mb-2">📥</div>
                    <div className="font-medium">PDF hier ablegen</div>
                  </div>
                ) : (
                  <div className="text-blue-200">
                    <div className="text-4xl mb-2">📤</div>
                    <div className="font-medium text-white">PDF-Datei auswählen</div>
                    <div className="text-sm mt-1">oder hierher ziehen</div>
                  </div>
                )}
              </div>
            </div>

            {/* PDF Result */}
            {pdfResult && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4">✨ Extrahierte Daten</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-blue-300 text-sm">Regatta</div>
                    <div className="text-white font-medium">{pdfResult.regattaName || '-'}</div>
                  </div>
                  <div>
                    <div className="text-blue-300 text-sm">Bootsklasse</div>
                    <div className="text-white font-medium">{pdfResult.boatClass || '-'}</div>
                  </div>
                  <div>
                    <div className="text-blue-300 text-sm">Datum</div>
                    <div className="text-white font-medium">{formatDate(pdfResult.date)}</div>
                  </div>
                  <div>
                    <div className="text-blue-300 text-sm">Wettfahrten</div>
                    <div className="text-white font-medium">{pdfResult.raceCount || '-'}</div>
                  </div>
                </div>
                
                {pdfResult.participant ? (
                  <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-green-300 text-sm">Deine Platzierung</div>
                        <div className="text-2xl font-bold text-white">
                          Platz {pdfResult.participant.rank}
                          <span className="text-lg font-normal text-green-200"> von {pdfResult.totalParticipants}</span>
                        </div>
                        <div className="text-green-200 text-sm mt-1">{pdfResult.participant.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-300 text-sm">Erstattung ca.</div>
                        <div className="text-2xl font-bold text-white">
                          {calculateRefund(pdfResult.participant.rank, pdfResult.totalParticipants, pdfResult.raceCount)}€
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-4 mb-4">
                    <div className="text-yellow-200">
                      ⚠️ Segelnummer "{boatData.segelnummer}" nicht gefunden.
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3">
                  {pdfResult.participant && (
                    <button
                      onClick={addRegattaFromPdf}
                      className="flex-1 py-3 px-4 rounded-lg font-medium bg-green-500 hover:bg-green-400 text-white transition-all"
                    >
                      ✅ Zur Liste hinzufügen
                    </button>
                  )}
                  <button
                    onClick={() => { setPdfResult(null); setDebugText(''); }}
                    className="py-3 px-4 rounded-lg font-medium bg-white/10 hover:bg-white/20 text-white transition-all"
                  >
                    ✕ Verwerfen
                  </button>
                </div>
              </div>
            )}

            {/* Debug Text */}
            {debugText && (
              <details className="bg-white/5 rounded-xl p-4 border border-white/10">
                <summary className="text-cyan-300 cursor-pointer">🔍 Debug: Extrahierter Text</summary>
                <pre className="mt-2 text-xs text-blue-200 whitespace-pre-wrap max-h-60 overflow-auto bg-black/30 p-3 rounded">
                  {debugText}
                </pre>
              </details>
            )}

            {/* Manual Entry */}
            <div className="text-center">
              <button
                onClick={() => setManualMode(!manualMode)}
                className="text-cyan-300 hover:text-cyan-200 text-sm underline"
              >
                {manualMode ? '← Zurück' : 'Manuell eingeben →'}
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
                    <label className="block text-blue-200 text-sm mb-1">Wettfahrten *</label>
                    <input
                      type="number"
                      value={manualData.raceCount}
                      onChange={e => setManualData(d => ({ ...d, raceCount: e.target.value }))}
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
          </div>
        )}

        {/* === LIST TAB === */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            
            {regatten.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-blue-200">Gesamt-Erstattung:</span>
                    <span className="text-2xl font-bold text-white ml-2">{totalRefund}€</span>
                  </div>
                  <div className="text-sm text-blue-200">
                    {regatten.filter(r => r.pdfData).length} von {regatten.length} mit PDF
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={exportToPdf}
                    className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  >
                    📄 PDF-Antrag mit Anlagen
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
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium">{r.regattaName}</h4>
                          {r.pdfData && (
                            <button
                              onClick={() => viewPdf(r.pdfData)}
                              className="text-cyan-300 hover:text-cyan-200 text-xs px-2 py-0.5 bg-cyan-500/20 rounded"
                            >
                              📄 PDF
                            </button>
                          )}
                        </div>
                        <div className="text-blue-200 text-sm mt-1">
                          {r.boatClass} • {formatDate(r.date)} • {r.raceCount} Wettfahrten
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold">
                          Platz {r.placement}/{r.totalParticipants}
                        </div>
                        <div className="text-cyan-300 font-medium">
                          {calculateRefund(r.placement, r.totalParticipants, r.raceCount)}€
                        </div>
                      </div>
                      <button
                        onClick={() => deleteRegatta(r.id)}
                        className="ml-3 text-red-300 hover:text-red-200 p-1"
                      >
                        🗑️
                      </button>
                    </div>
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
                    const data = { boatData, regatten, exportDate: new Date().toISOString() };
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
                      setSuccess('Alle Regatten gelöscht');
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
