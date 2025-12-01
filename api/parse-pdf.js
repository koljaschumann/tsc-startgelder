// API für PDF-Parsing von manage2sail Ergebnislisten
import formidable from 'formidable';
import fs from 'fs';
import pdfParse from 'pdf-parse';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
    
    for (const line of lines) {
      if (!line.includes('Powered by') && !line.includes('Page ') && 
          !line.includes('Report Created') && !line.includes('www.manage2sail') && line.length > 3) {
        result.regattaName = line;
        break;
      }
    }
    
    const regattaIndex = lines.findIndex(l => l === result.regattaName);
    if (regattaIndex >= 0 && regattaIndex + 1 < lines.length) {
      const nextLine = lines[regattaIndex + 1];
      if (nextLine.length < 50 && !nextLine.includes('Overall') && !nextLine.includes('Results')) {
        result.boatClass = nextLine;
      }
    }
    
    const dateMatch = text.match(/As of (\d{1,2} [A-Z]{3} \d{4})/i);
    if (dateMatch) result.date = dateMatch[1];
    
    const raceMatch = text.match(/R(\d+)/g);
    if (raceMatch) {
      result.raceCount = Math.max(...raceMatch.map(r => parseInt(r.replace('R', ''))));
    }
    
    const normalizeSN = (sn) => sn.replace(/[\s\-\.]+/g, '').toUpperCase();
    const userSNNorm = normalizeSN(sailNumber || '');
    const userSNNumbers = (sailNumber || '').replace(/\D/g, '');
    
    let maxRank = 0;
    for (const line of lines) {
      const simpleMatch = line.match(/^(\d+)\s+(GER\s*\d+)\s+(.+)/i);
      if (simpleMatch) {
        const rank = parseInt(simpleMatch[1]);
        const sailNum = simpleMatch[2];
        const rest = simpleMatch[3];
        if (rank > maxRank) maxRank = rank;
        
        const clubMatch = rest.match(/\s([A-Z]{2,10}(?:\s+[A-Z]+)?)\s+\d/);
        let name = rest, club = '';
        if (clubMatch) {
          name = rest.substring(0, rest.indexOf(clubMatch[1])).trim();
          club = clubMatch[1];
        }
        
        const pointsMatch = rest.match(/(\d+)\s+(\d+)\s*$/);
        const entry = {
          rank,
          sailNumber: sailNum.replace(/\s+/g, ' ').trim(),
          name: name.trim(),
          club: club.trim(),
          totalPoints: pointsMatch ? parseInt(pointsMatch[1]) : 0,
          netPoints: pointsMatch ? parseInt(pointsMatch[2]) : 0
        };
        
        result.allResults.push(entry);
        
        const entrySNNorm = normalizeSN(sailNum);
        const entrySNNumbers = sailNum.replace(/\D/g, '');
        if (userSNNorm && (entrySNNorm === userSNNorm || entrySNNumbers === userSNNumbers ||
            entrySNNorm.includes(userSNNumbers) || userSNNorm.includes(entrySNNumbers))) {
          result.participant = entry;
        }
      }
    }
    
    result.totalParticipants = maxRank;
    result.success = result.regattaName && result.allResults.length > 0;
  } catch (error) {
    result.error = error.message;
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    const sailNumber = fields.sailNumber?.[0] || '';
    const pdfFile = files.pdf?.[0];
    
    if (!pdfFile) return res.status(400).json({ error: 'No PDF file uploaded' });
    
    const pdfBuffer = fs.readFileSync(pdfFile.filepath);
    const pdfData = await pdfParse(pdfBuffer);
    const result = parseRegattaPDF(pdfData.text, sailNumber);
    
    fs.unlinkSync(pdfFile.filepath);
    return res.status(200).json(result);
  } catch (error) {
    console.error('PDF parsing error:', error);
    return res.status(500).json({ error: 'Failed to parse PDF', details: error.message });
  }
}