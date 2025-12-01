// API für PDF-Parsing von manage2sail Ergebnislisten
// Verwendet pdf-parse für Text-Extraktion

const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

// Disable body parsing, we handle it ourselves
export const config = {
  api: {
    bodyParser: false,
  },
};

// Parse PDF text and extract regatta data
function parseRegattaPDF(text, sailNumber) {
  const result = {
    success: false,
    regattaName: '',
    boatClass: '',
    date: '',
    raceCount: 0,
    totalParticipants: 0,
    participant: null,
    allResults: [],
    error: null
  };

  try {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    // 1. Regatta-Name: Erste nicht-leere Zeile die kein "Powered by" oder "Page" enthält
    for (const line of lines) {
      if (!line.includes('Powered by') && 
          !line.includes('Page ') && 
          !line.includes('Report Created') &&
          !line.includes('www.manage2sail') &&
          line.length > 3) {
        result.regattaName = line;
        break;
      }
    }
    
    // 2. Bootsklasse: Zeile nach Regatta-Name (oft "Optimist A", "Optimist B", "420er", etc.)
    const regattaIndex = lines.findIndex(l => l === result.regattaName);
    if (regattaIndex >= 0 && regattaIndex + 1 < lines.length) {
      const nextLine = lines[regattaIndex + 1];
      // Bootsklasse ist typischerweise kurz und enthält keine Datumsangaben
      if (nextLine.length < 50 && !nextLine.includes('Overall') && !nextLine.includes('Results')) {
        result.boatClass = nextLine;
      }
    }
    
    // 3. Datum: Suche nach "As of DD MMM YYYY" oder ähnlichem
    const dateMatch = text.match(/As of (\d{1,2} [A-Z]{3} \d{4})/i);
    if (dateMatch) {
      result.date = dateMatch[1];
    } else {
      // Alternative: Suche nach "Report Created XXX DD MMM YYYY"
      const reportMatch = text.match(/Report Created [A-Z]{2,3} (\d{1,2} [A-Z]{3} \d{4})/i);
      if (reportMatch) {
        result.date = reportMatch[1];
      }
    }
    
    // 4. Anzahl Wettfahrten: Zähle R1, R2, R3... Spalten
    const raceMatch = text.match(/R(\d+)/g);
    if (raceMatch) {
      const raceNumbers = raceMatch.map(r => parseInt(r.replace('R', '')));
      result.raceCount = Math.max(...raceNumbers);
    }
    
    // 5. Parse Ergebnistabelle
    // Format: "Rk" oder Nummer am Anfang, dann "GER XXXXX", Name, Club, Punkte...
    // Beispiel: "5 GER 13162 Moritz SCHUMANN TSC 8 7 5 7 (23) 50 27"
    
    // Normalisiere Segelnummer für Suche
    const normalizeSN = (sn) => sn.replace(/[\s\-\.]+/g, '').toUpperCase();
    const userSNNorm = normalizeSN(sailNumber || '');
    const userSNNumbers = (sailNumber || '').replace(/\D/g, '');
    
    // Regex für Tabellenzeilen: Rang, Segelnummer, Name, Club, Punkte
    // Flexibleres Pattern das verschiedene Formate matcht
    const rowPattern = /^(\d+)\s+(GER\s*\d+)\s+(.+?)\s+([A-Z]{2,}(?:\s+[A-Z]+)*)\s+[\d\(\)]+/gm;
    
    let match;
    let maxRank = 0;
    
    // Einfacherer Ansatz: Zeile für Zeile nach Segelnummern suchen
    for (const line of lines) {
      // Suche nach Pattern: Zahl am Anfang (Rang), dann GER XXXXX
      const simpleMatch = line.match(/^(\d+)\s+(GER\s*\d+)\s+(.+)/i);
      if (simpleMatch) {
        const rank = parseInt(simpleMatch[1]);
        const sailNum = simpleMatch[2];
        const rest = simpleMatch[3];
        
        if (rank > maxRank) maxRank = rank;
        
        // Extrahiere Name und Club aus dem Rest
        // Rest ist typischerweise: "Name NACHNAME CLUB Punkte..."
        // Club ist meist 2-5 Großbuchstaben
        const clubMatch = rest.match(/\s([A-Z]{2,10}(?:\s+[A-Z]+)?)\s+\d/);
        let name = rest;
        let club = '';
        
        if (clubMatch) {
          const clubIndex = rest.indexOf(clubMatch[1]);
          name = rest.substring(0, clubIndex).trim();
          club = clubMatch[1];
        }
        
        // Extrahiere Punkte (letzte zwei Zahlen sind Total und Net)
        const pointsMatch = rest.match(/(\d+)\s+(\d+)\s*$/);
        let totalPoints = 0;
        let netPoints = 0;
        if (pointsMatch) {
          totalPoints = parseInt(pointsMatch[1]);
          netPoints = parseInt(pointsMatch[2]);
        }
        
        const entry = {
          rank,
          sailNumber: sailNum.replace(/\s+/g, ' ').trim(),
          name: name.trim(),
          club: club.trim(),
          totalPoints,
          netPoints
        };
        
        result.allResults.push(entry);
        
        // Prüfe ob dies der gesuchte Teilnehmer ist
        const entrySNNorm = normalizeSN(sailNum);
        const entrySNNumbers = sailNum.replace(/\D/g, '');
        
        if (userSNNorm && (
            entrySNNorm === userSNNorm ||
            entrySNNumbers === userSNNumbers ||
            entrySNNorm.includes(userSNNumbers) ||
            userSNNorm.includes(entrySNNumbers)
        )) {
          result.participant = entry;
        }
      }
    }
    
    // Teilnehmerzahl ist die höchste Rang-Nummer
    result.totalParticipants = maxRank;
    
    // Erfolg wenn wir grundlegende Daten haben
    result.success = result.regattaName && result.allResults.length > 0;
    
  } catch (error) {
    result.error = error.message;
  }
  
  return result;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });
    
    const [fields, files] = await form.parse(req);
    
    const sailNumber = fields.sailNumber?.[0] || '';
    const pdfFile = files.pdf?.[0];
    
    if (!pdfFile) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    
    console.log('Processing PDF:', pdfFile.originalFilename, 'Size:', pdfFile.size);
    console.log('Looking for sail number:', sailNumber);
    
    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfFile.filepath);
    
    // Use pdf-parse to extract text
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(pdfBuffer);
    
    console.log('PDF pages:', pdfData.numpages);
    console.log('PDF text length:', pdfData.text.length);
    console.log('First 500 chars:', pdfData.text.substring(0, 500));
    
    // Parse the extracted text
    const result = parseRegattaPDF(pdfData.text, sailNumber);
    
    console.log('Parse result:', {
      success: result.success,
      regattaName: result.regattaName,
      boatClass: result.boatClass,
      date: result.date,
      raceCount: result.raceCount,
      totalParticipants: result.totalParticipants,
      participantFound: !!result.participant,
      allResultsCount: result.allResults.length
    });
    
    // Cleanup temp file
    fs.unlinkSync(pdfFile.filepath);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('PDF parsing error:', error);
    return res.status(500).json({ 
      error: 'Failed to parse PDF',
      details: error.message 
    });
  }
}
