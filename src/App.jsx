import { useState, useEffect, useCallback } from 'react'

// TSC Startgeld-Erstattung App v4.0 - PDF-basiert
// Einfacher, zuverlässiger Workflow: PDF hochladen → Daten extrahiert → Fertig

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
  
  // Regatta-Liste
  const [regatten, setRegatten] = useState(() => {
    const saved = localStorage.getItem('tsc-regatten-v4');
    return saved ? JSON.parse(saved) : [];
  });
  
  // UI State
  const [activeTab, setActiveTab] = useState('add'); // 'add' | 'list' | 'settings'
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // PDF Upload State
  const [pdfResult, setPdfResult] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  
  // Manuelle Eingabe State
  const [manualData, setManualData] = useState({
    regattaName: '',
    boatClass: '',
    date: '',
    placement: '',
    totalParticipants: '',
    raceCount: '',
    manage2sailUrl: ''
  });

  // Persist data
  useEffect(() => {
    localStorage.setItem('tsc-boat-data', JSON.stringify(boatData));
  }, [boatData]);
  
  useEffect(() => {
    localStorage.setItem('tsc-regatten-v4', JSON.stringify(regatten));
  }, [regatten]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);
  
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle PDF Upload
  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];
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
    
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('sailNumber', boatData.segelnummer);
      
      const response = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Verarbeiten der PDF');
      }
      
      if (!data.success) {
        throw new Error('PDF konnte nicht gelesen werden. Ist es eine manage2sail Ergebnisliste?');
      }
      
      setPdfResult(data);
      
      if (!data.participant) {
        setError(`Segelnummer "${boatData.segelnummer}" wurde nicht in der Ergebnisliste gefunden. Bitte prüfe die Segelnummer in den Einstellungen.`);
      } else {
        setSuccess(`${data.participant.name} gefunden: Platz ${data.participant.rank} von ${data.totalParticipants}`);
      }
      
    } catch (err) {
      console.error('PDF Upload Error:', err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // Add regatta from PDF result
  const addRegattaFromPdf = () => {
    if (!pdfResult || !pdfResult.participant) {
      setError('Keine gültigen Daten zum Hinzufügen');
      return;
    }
    
    // Check for duplicates
    const isDuplicate = regatten.some(r => 
      r.regattaName === pdfResult.regattaName && 
      r.boatClass === pdfResult.boatClass
    );
    
    if (isDuplicate) {
      setError('Diese Regatta ist bereits in der Liste');
      return;
    }
    
    const newRegatta = {
      id: Date.now(),
      regattaName: pdfResult.regattaName,
      boatClass: pdfResult.boatClass,
      date: pdfResult.date,
      placement: pdfResult.participant.rank,
      totalParticipants: pdfResult.totalParticipants,
      raceCount: pdfResult.raceCount,
      netPoints: pdfResult.participant.netPoints,
      sailorName: pdfResult.participant.name,
      club: pdfResult.participant.club,
      addedAt: new Date().toISOString()
    };
    
    setRegatten(prev => [...prev, newRegatta]);
    setPdfResult(null);
    setSuccess(`"${pdfResult.regattaName}" wurde hinzugefügt!`);
  };

  // Add regatta manually
  const addRegattaManual = () => {
    const { regattaName, boatClass, date, placement, totalParticipants, raceCount } = manualData;
    
    if (!regattaName || !placement || !totalParticipants || !raceCount) {
      setError('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    
    // Check for duplicates
    const isDuplicate = regatten.some(r => 
      r.regattaName === regattaName && 
      r.boatClass === boatClass
    );
    
    if (isDuplicate) {
      setError('Diese Regatta ist bereits in der Liste');
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
      manage2sailUrl: manualData.manage2sailUrl,
      addedAt: new Date().toISOString()
    };
    
    setRegatten(prev => [...prev, newRegatta]);
    setManualData({
      regattaName: '',
      boatClass: '',
      date: '',
      placement: '',
      totalParticipants: '',
      raceCount: '',
      manage2sailUrl: ''
    });
    setSuccess(`"${regattaName}" wurde hinzugefügt!`);
  };

  // Delete regatta
  const deleteRegatta = (id) => {
    setRegatten(prev => prev.filter(r => r.id !== id));
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Handle "DD MMM YYYY" format
    const months = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
      'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
      'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
    };
    const match = dateStr.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = months[match[2].toUpperCase()] || '01';
      return `${day}.${month}.${match[3]}`;
    }
    return dateStr;
  };

  // Calculate refund amount based on TSC rules
  const calculateRefund = (placement, participants, races) => {
    if (!placement || !participants || !races) return 0;
    
    // TSC Erstattungsregeln (Beispiel - anpassen nach echten Regeln)
    const percentile = (placement / participants) * 100;
    
    // Basis: Wettfahrten × Faktor
    let baseFactor = 5; // €5 pro Wettfahrt Basis
    
    // Bonus für gute Platzierung
    if (percentile <= 10) baseFactor = 10;
    else if (percentile <= 25) baseFactor = 8;
    else if (percentile <= 50) baseFactor = 6;
    
    return Math.round(races * baseFactor);
  };

  // Export functions
  const exportToCsv = () => {
    const headers = ['Regatta', 'Bootsklasse', 'Datum', 'Platzierung', 'Teilnehmer', 'Wettfahrten', 'Erstattung'];
    const rows = regatten.map(r => [
      r.regattaName,
      r.boatClass,
      formatDate(r.date),
      r.placement,
      r.totalParticipants,
      r.raceCount,
      calculateRefund(r.placement, r.totalParticipants, r.raceCount) + '€'
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TSC_Startgeld_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Total refund
  const totalRefund = regatten.reduce((sum, r) => 
    sum + calculateRefund(r.placement, r.totalParticipants, r.raceCount), 0
  );

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

      {/* Navigation Tabs */}
      <nav className="bg-white/5 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: 'add', label: '➕ Hinzufügen', icon: '📄' },
              { id: 'list', label: `📋 Liste (${regatten.length})`, icon: '📋' },
              { id: 'settings', label: '⚙️ Einstellungen', icon: '⚙️' }
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
          <div className="bg-red-500/20 border border-red-400/50 text-red-100 px-4 py-3 rounded-lg mb-4 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>{error}</div>
          </div>
        )}
        {success && (
          <div className="bg-green-500/20 border border-green-400/50 text-green-100 px-4 py-3 rounded-lg mb-4 flex items-start gap-3">
            <span className="text-xl">✅</span>
            <div>{success}</div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        
        {/* === ADD TAB === */}
        {activeTab === 'add' && (
          <div className="space-y-6">
            
            {/* PDF Upload Section */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                📄 Ergebnisliste hochladen
              </h2>
              
              <p className="text-blue-200 text-sm mb-4">
                Lade die PDF-Ergebnisliste von manage2sail hoch. Die App extrahiert automatisch alle Daten.
              </p>
              
              {/* Upload Area */}
              <label className={`
                block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${isProcessing 
                  ? 'border-cyan-400 bg-cyan-500/10' 
                  : 'border-white/30 hover:border-cyan-400 hover:bg-white/5'}
              `}>
                <input
                  type="file"
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
                ) : (
                  <div className="text-blue-200">
                    <div className="text-4xl mb-2">📤</div>
                    <div className="font-medium text-white">PDF-Datei auswählen</div>
                    <div className="text-sm mt-1">oder hierher ziehen</div>
                  </div>
                )}
              </label>
              
              {/* How to get PDF */}
              <details className="mt-4 text-sm">
                <summary className="text-cyan-300 cursor-pointer hover:text-cyan-200">
                  Wie bekomme ich die PDF?
                </summary>
                <div className="mt-2 text-blue-200 bg-white/5 rounded-lg p-3 space-y-2">
                  <p>1. Öffne <a href="https://manage2sail.com" target="_blank" className="text-cyan-300 underline">manage2sail.com</a></p>
                  <p>2. Suche deine Regatta und öffne die Ergebnisse</p>
                  <p>3. Klicke auf "Herunterladen" bei den Gesamtergebnissen</p>
                  <p>4. Lade die PDF hier hoch</p>
                </div>
              </details>
            </div>

            {/* PDF Result Preview */}
            {pdfResult && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  ✨ Extrahierte Daten
                </h3>
                
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
                          <span className="text-lg font-normal text-green-200">
                            {' '}von {pdfResult.totalParticipants}
                          </span>
                        </div>
                        <div className="text-green-200 text-sm mt-1">
                          {pdfResult.participant.name} • {pdfResult.participant.club}
                        </div>
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
                      <br />
                      <span className="text-sm">Prüfe die Segelnummer in den Einstellungen oder füge die Regatta manuell hinzu.</span>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <button
                    onClick={addRegattaFromPdf}
                    disabled={!pdfResult.participant}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      pdfResult.participant
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-white'
                        : 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    ✅ Zur Liste hinzufügen
                  </button>
                  <button
                    onClick={() => setPdfResult(null)}
                    className="py-3 px-4 rounded-lg font-medium bg-white/10 hover:bg-white/20 text-white transition-all"
                  >
                    ✕ Verwerfen
                  </button>
                </div>
              </div>
            )}

            {/* Manual Entry Toggle */}
            <div className="text-center">
              <button
                onClick={() => setManualMode(!manualMode)}
                className="text-cyan-300 hover:text-cyan-200 text-sm underline"
              >
                {manualMode ? '← Zurück zum PDF-Upload' : 'Manuell eingeben →'}
              </button>
            </div>

            {/* Manual Entry Form */}
            {manualMode && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  ✏️ Manuelle Eingabe
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-blue-200 text-sm mb-1">Regatta-Name *</label>
                    <input
                      type="text"
                      value={manualData.regattaName}
                      onChange={e => setManualData(d => ({ ...d, regattaName: e.target.value }))}
                      placeholder="z.B. Rahnsdorfer Opti-Pokal"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-200 text-sm mb-1">Bootsklasse</label>
                    <input
                      type="text"
                      value={manualData.boatClass}
                      onChange={e => setManualData(d => ({ ...d, boatClass: e.target.value }))}
                      placeholder="z.B. Optimist B"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-200 text-sm mb-1">Datum</label>
                    <input
                      type="date"
                      value={manualData.date}
                      onChange={e => setManualData(d => ({ ...d, date: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-200 text-sm mb-1">Platzierung *</label>
                    <input
                      type="number"
                      value={manualData.placement}
                      onChange={e => setManualData(d => ({ ...d, placement: e.target.value }))}
                      placeholder="z.B. 5"
                      min="1"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-200 text-sm mb-1">Teilnehmer gesamt *</label>
                    <input
                      type="number"
                      value={manualData.totalParticipants}
                      onChange={e => setManualData(d => ({ ...d, totalParticipants: e.target.value }))}
                      placeholder="z.B. 50"
                      min="1"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-blue-200 text-sm mb-1">Wettfahrten *</label>
                    <input
                      type="number"
                      value={manualData.raceCount}
                      onChange={e => setManualData(d => ({ ...d, raceCount: e.target.value }))}
                      placeholder="z.B. 5"
                      min="1"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-blue-200 text-sm mb-1">manage2sail URL (optional)</label>
                    <input
                      type="url"
                      value={manualData.manage2sailUrl}
                      onChange={e => setManualData(d => ({ ...d, manage2sailUrl: e.target.value }))}
                      placeholder="https://manage2sail.com/..."
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
                
                <button
                  onClick={addRegattaManual}
                  className="w-full mt-4 py-3 px-4 rounded-lg font-medium bg-cyan-500 hover:bg-cyan-400 text-white transition-all"
                >
                  ✅ Zur Liste hinzufügen
                </button>
              </div>
            )}
          </div>
        )}

        {/* === LIST TAB === */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            
            {/* Summary */}
            {regatten.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 flex items-center justify-between">
                <div>
                  <span className="text-blue-200">Gesamt-Erstattung:</span>
                  <span className="text-2xl font-bold text-white ml-2">{totalRefund}€</span>
                </div>
                <button
                  onClick={exportToCsv}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-medium transition-all"
                >
                  📥 CSV Export
                </button>
              </div>
            )}

            {/* Regatta List */}
            {regatten.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-white font-medium mb-2">Noch keine Regatten</div>
                <div className="text-blue-200 text-sm">
                  Lade eine PDF-Ergebnisliste hoch um zu starten
                </div>
                <button
                  onClick={() => setActiveTab('add')}
                  className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-medium transition-all"
                >
                  ➕ Regatta hinzufügen
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {regatten.map(regatta => (
                  <div
                    key={regatta.id}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-semibold text-white">{regatta.regattaName}</span>
                          {regatta.boatClass && (
                            <span className="px-2 py-0.5 bg-cyan-500/30 text-cyan-200 text-xs rounded">
                              {regatta.boatClass}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-blue-200">
                          <span>📅 {formatDate(regatta.date)}</span>
                          <span>🏆 Platz {regatta.placement}/{regatta.totalParticipants}</span>
                          <span>🚩 {regatta.raceCount} Wettfahrten</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-blue-300">Erstattung</div>
                          <div className="text-xl font-bold text-cyan-300">
                            {calculateRefund(regatta.placement, regatta.totalParticipants, regatta.raceCount)}€
                          </div>
                        </div>
                        <button
                          onClick={() => deleteRegatta(regatta.id)}
                          className="p-2 text-red-300 hover:text-red-200 hover:bg-red-500/20 rounded-lg transition-all"
                          title="Löschen"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === SETTINGS TAB === */}
        {activeTab === 'settings' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              ⚙️ Bootsdaten & Einstellungen
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-blue-200 text-sm mb-1">Segelnummer *</label>
                <input
                  type="text"
                  value={boatData.segelnummer}
                  onChange={e => setBoatData(d => ({ ...d, segelnummer: e.target.value.toUpperCase() }))}
                  placeholder="z.B. GER 13162"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-cyan-400 font-mono"
                />
                <p className="text-blue-300/70 text-xs mt-1">Wird zum Finden in der PDF verwendet</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-blue-200 text-sm mb-1">Segler-Name</label>
                <input
                  type="text"
                  value={boatData.seglername}
                  onChange={e => setBoatData(d => ({ ...d, seglername: e.target.value }))}
                  placeholder="z.B. Max Mustermann"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-blue-200 text-sm mb-1">Bootsklasse</label>
                <select
                  value={boatData.bootsklasse}
                  onChange={e => setBoatData(d => ({ ...d, bootsklasse: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="Optimist">Optimist</option>
                  <option value="420er">420er</option>
                  <option value="Laser">Laser / ILCA</option>
                  <option value="29er">29er</option>
                  <option value="Europe">Europe</option>
                  <option value="Pirat">Pirat</option>
                  <option value="Andere">Andere</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-blue-200 text-sm mb-1">Kontoinhaber</label>
                <input
                  type="text"
                  value={boatData.kontoinhaber}
                  onChange={e => setBoatData(d => ({ ...d, kontoinhaber: e.target.value }))}
                  placeholder="Name des Kontoinhabers"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-blue-200 text-sm mb-1">IBAN</label>
                <input
                  type="text"
                  value={boatData.iban}
                  onChange={e => setBoatData(d => ({ ...d, iban: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                  placeholder="DE..."
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>
            
            {/* Data Management */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <h3 className="text-white font-medium mb-3">Datenverwaltung</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    if (confirm('Alle Regatten löschen?')) {
                      setRegatten([]);
                      setSuccess('Alle Regatten wurden gelöscht');
                    }
                  }}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg transition-all"
                >
                  🗑️ Alle Regatten löschen
                </button>
                <button
                  onClick={() => {
                    const data = { boatData, regatten };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `TSC_Backup_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                >
                  💾 Backup erstellen
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/5 border-t border-white/10 mt-8">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-blue-300/70 text-sm">
          TSC Startgeld-Erstattung v4.0 • PDF-basiert • © 2025 Tegeler Segel-Club e.V.
        </div>
      </footer>
    </div>
  );
}

export default App
