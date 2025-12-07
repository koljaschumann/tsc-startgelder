import { useState, useEffect, useRef, createContext, useContext } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import Tesseract from 'tesseract.js'
import { PDFDocument } from 'pdf-lib'

// PDF.js Worker
const setupPdfWorker = () => {
  const version = pdfjsLib.version || '3.11.174';
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
};
setupPdfWorker();

// ============================================
// THEME CONTEXT
// ============================================
const ThemeContext = createContext();

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

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
  '49er FX': { crew: 2 },
  'Nacra 17': { crew: 2 },
  'Korsar': { crew: 2 },
  'Pirat': { crew: 2 },
  'Flying Dutchman': { crew: 2, alias: ['FD'] },
  'Flying Junior': { crew: 2, alias: ['FJ'] },
  'Vaurien': { crew: 2 },
  'Cadet': { crew: 2 },
  'Teeny': { crew: 2 },
  'Yngling': { crew: 3 },
  'Soling': { crew: 3 },
  'Drachen': { crew: 3, alias: ['Dragon'] },
  'H-Boot': { crew: 3 },
  'Folkeboot': { crew: 3, alias: ['Folke'] },
  'Kielzugvogel': { crew: 2, alias: ['Zugvogel'] },
  'Varianta': { crew: 3 },
  'J/70': { crew: 5, alias: ['J70', 'J 70'] },
  'J/80': { crew: 5, alias: ['J80', 'J 80'] },
  'J/24': { crew: 5, alias: ['J24', 'J 24'] },
  'Platu 25': { crew: 5 },
  'Melges 24': { crew: 5 },
  'SB20': { crew: 3 },
  'Tempest': { crew: 2 },
};

const CURRENT_YEAR = new Date().getFullYear();

// ============================================
// SVG ICONS
// ============================================
const Icons = {
  boat: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 17h18M5 17l2-8h10l2 8M7 9V6a1 1 0 011-1h8a1 1 0 011 1v3M12 5V3" /></svg>,
  document: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  upload: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  list: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  download: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  send: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  mail: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  receipt: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>,
  users: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>,
  chart: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  table: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  archive: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
  check: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  x: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  plus: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  info: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  warning: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  trophy: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  sun: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  moon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
  settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  calendar: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  grid: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  search: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  refresh: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  drag: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 16h16" /></svg>,
  userPlus: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
  bank: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" /></svg>,
  eye: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  lock: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  chevronRight: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  chevronLeft: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
};

// ============================================
// THEME-AWARE UI KOMPONENTEN
// ============================================
const GlassCard = ({ children, className = '', onClick = null }) => {
  const { isDark } = useTheme();
  return (
    <div 
      className={`relative rounded-2xl p-6 ${className} ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)',
        boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.2)' : '0 4px 24px rgba(0,0,0,0.08)',
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

const IconBadge = ({ icon, color = 'slate' }) => {
  const { isDark } = useTheme();
  const colors = {
    purple: isDark ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-100 text-violet-600 border-violet-200',
    cyan: isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-100 text-cyan-600 border-cyan-200',
    amber: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-100 text-amber-600 border-amber-200',
    emerald: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-100 text-emerald-600 border-emerald-200',
    red: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-100 text-red-600 border-red-200',
    slate: isDark ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <div className={`w-10 h-10 rounded-xl ${colors[color]} border flex items-center justify-center`}>
      {icon}
    </div>
  );
};

const Toast = ({ message, type = 'info', onClose }) => {
  const { isDark } = useTheme();
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  const colors = {
    info: isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800',
    success: isDark ? 'bg-emerald-900/80 border-emerald-700 text-emerald-200' : 'bg-emerald-100 border-emerald-200 text-emerald-800',
    warning: isDark ? 'bg-amber-900/80 border-amber-700 text-amber-200' : 'bg-amber-100 border-amber-200 text-amber-800',
    error: isDark ? 'bg-red-900/80 border-red-700 text-red-200' : 'bg-red-100 border-red-200 text-red-800',
  };
  const icons = { info: Icons.info, success: Icons.check, warning: Icons.warning, error: Icons.x };
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl border ${colors[type]} backdrop-blur-sm shadow-lg animate-slideUp max-w-sm`}>
      <div className="flex items-center gap-3">
        <span className="w-5 h-5 flex-shrink-0">{icons[type]}</span>
        <span className="flex-1">{message}</span>
        <button onClick={onClose} className="opacity-50 hover:opacity-100">{Icons.x}</button>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } } .animate-slideUp { animation: slideUp 0.3s ease-out; }`}</style>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const { isDark } = useTheme();
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div 
        className={`relative w-full ${sizes[size]} rounded-2xl p-6 max-h-[85vh] overflow-y-auto`}
        style={{ 
          background: isDark 
            ? 'linear-gradient(135deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
          <button onClick={onClose} className={`${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>{Icons.x}</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Progress Steps
const ProgressSteps = ({ currentStep, totalSteps, labels }) => {
  const { isDark } = useTheme();
  return (
    <div className="flex items-center justify-between mb-6">
      {labels.map((label, index) => (
        <div key={index} className="flex items-center flex-1">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all ${
            index < currentStep 
              ? 'bg-emerald-500 text-white' 
              : index === currentStep 
                ? 'bg-violet-500 text-white' 
                : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
          }`}>
            {index < currentStep ? Icons.check : index + 1}
          </div>
          <span className={`ml-2 text-sm hidden sm:inline ${
            index <= currentStep 
              ? isDark ? 'text-white' : 'text-slate-900'
              : isDark ? 'text-slate-500' : 'text-slate-400'
          }`}>{label}</span>
          {index < labels.length - 1 && (
            <div className={`flex-1 h-0.5 mx-3 ${
              index < currentStep 
                ? 'bg-emerald-500' 
                : isDark ? 'bg-slate-700' : 'bg-slate-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
};

// Stat Card
const StatCard = ({ icon, label, value, subValue, color = 'purple' }) => {
  const { isDark } = useTheme();
  const colors = {
    purple: 'from-violet-500 to-violet-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    cyan: 'from-cyan-500 to-cyan-600',
  };
  return (
    <div className={`rounded-xl p-4 ${isDark ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-white border border-slate-200'}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white`}>
          {icon}
        </div>
        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</div>
      {subValue && <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{subValue}</div>}
    </div>
  );
};

// Parser wurde vereinfacht - komplexe Strategien entfernt zugunsten des bewährten v12-Parsers;

// ============================================
// SEPA XML GENERATOR
// ============================================
const generateSEPAXML = (payments, creditorInfo) => {
  const now = new Date();
  const msgId = `TSC-${now.toISOString().replace(/[-:T.Z]/g, '').slice(0,14)}`;
  const pmtInfId = `PMT-${msgId}`;
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  
  const formatIBAN = (iban) => iban.replace(/\s/g, '').toUpperCase();
  const formatAmount = (amount) => amount.toFixed(2);
  const formatDate = (date) => date.toISOString().slice(0, 10);
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${now.toISOString()}</CreDtTm>
      <NbOfTxs>${payments.length}</NbOfTxs>
      <CtrlSum>${formatAmount(totalAmount)}</CtrlSum>
      <InitgPty>
        <Nm>${creditorInfo.name}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${pmtInfId}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${payments.length}</NbOfTxs>
      <CtrlSum>${formatAmount(totalAmount)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${formatDate(new Date(now.getTime() + 86400000))}</ReqdExctnDt>
      <Dbtr>
        <Nm>${creditorInfo.name}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${formatIBAN(creditorInfo.iban)}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${creditorInfo.bic || 'NOTPROVIDED'}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>`;

  payments.forEach((payment, index) => {
    xml += `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>STARTGELD-${index + 1}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${formatAmount(payment.amount)}</InstdAmt>
        </Amt>
        <CdtrAgt>
          <FinInstnId>
            <BIC>${payment.bic || 'NOTPROVIDED'}</BIC>
          </FinInstnId>
        </CdtrAgt>
        <Cdtr>
          <Nm>${payment.name}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${formatIBAN(payment.iban)}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${payment.reference}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`;
  });

  xml += `
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  return xml;
};

// ============================================
// HAUPTKOMPONENTE
// ============================================
function App() {
  // Theme State
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('tsc-theme');
    return saved ? saved === 'dark' : true;
  });
  
  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('tsc-onboarding-done');
  });
  const [onboardingStep, setOnboardingStep] = useState(0);
  
  // Saison State
  const [currentSeason, setCurrentSeason] = useState(() => {
    return localStorage.getItem('tsc-current-season') || CURRENT_YEAR.toString();
  });
  const [seasons, setSeasons] = useState(() => {
    const saved = localStorage.getItem('tsc-seasons');
    return saved ? JSON.parse(saved) : [CURRENT_YEAR.toString()];
  });
  
  // Crew-Datenbank
  const [crewDatabase, setCrewDatabase] = useState(() => {
    const saved = localStorage.getItem('tsc-crew-database');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Learned Patterns (für lernende Erkennung)
  const [learnedPatterns, setLearnedPatterns] = useState(() => {
    const saved = localStorage.getItem('tsc-learned-patterns');
    return saved ? JSON.parse(saved) : {};
  });
  
  // Navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [showCrewModal, setShowCrewModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  
  // Admin-Passwort (kann hier geändert werden)
  const ADMIN_PASSWORD = 'TSC2025!';
  
  // Bootsdaten
  const [boatData, setBoatData] = useState(() => {
    const saved = localStorage.getItem('tsc-boat-data');
    return saved ? JSON.parse(saved) : {
      seglername: '',
      segelnummer: '',
      bootsklasse: 'Optimist',
      iban: '',
      kontoinhaber: '',
    };
  });
  
  // Regatten (pro Saison)
  const [allRegatten, setAllRegatten] = useState(() => {
    const saved = localStorage.getItem('tsc-all-regatten');
    return saved ? JSON.parse(saved) : {};
  });
  
  const regatten = allRegatten[currentSeason] || [];
  const setRegatten = (newRegatten) => {
    const updated = typeof newRegatten === 'function' 
      ? newRegatten(regatten)
      : newRegatten;
    setAllRegatten(prev => ({ ...prev, [currentSeason]: updated }));
  };
  
  // PDF Processing State
  const [pdfResult, setPdfResult] = useState(null);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [invoiceProcessing, setInvoiceProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(null);
  const [currentPdfData, setCurrentPdfData] = useState(null);
  const [currentInvoiceData, setCurrentInvoiceData] = useState(null);
  const [currentInvoiceAmount, setCurrentInvoiceAmount] = useState('');
  const [pdfAttachments, setPdfAttachments] = useState([]);
  const [debugText, setDebugText] = useState('');
  const [parserUsed, setParserUsed] = useState(null);
  const [parsingFeedback, setParsingFeedback] = useState(null);
  
  // Manual Correction
  const [manualPlacement, setManualPlacement] = useState('');
  const [manualTotalParticipants, setManualTotalParticipants] = useState('');
  const [manualRegattaName, setManualRegattaName] = useState('');
  const [manualRaceCount, setManualRaceCount] = useState('');
  
  // Crew für aktuelle Regatta
  const [selectedCrew, setSelectedCrew] = useState([]);
  
  // Progress Step (0: Ergebnis, 1: Crew, 2: Rechnung)
  const [addStep, setAddStep] = useState(0);
  
  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingInvoice, setIsDraggingInvoice] = useState(false);
  const [dragOverCrew, setDragOverCrew] = useState(null);
  
  // UI State
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualData, setManualData] = useState({
    regattaName: '', boatClass: '', date: '', placement: '', 
    totalParticipants: '', raceCount: '', invoiceAmount: ''
  });

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    localStorage.setItem('tsc-theme', isDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);
  
  useEffect(() => {
    localStorage.setItem('tsc-boat-data', JSON.stringify(boatData));
  }, [boatData]);
  
  useEffect(() => {
    localStorage.setItem('tsc-all-regatten', JSON.stringify(allRegatten));
  }, [allRegatten]);
  
  useEffect(() => {
    localStorage.setItem('tsc-current-season', currentSeason);
  }, [currentSeason]);
  
  useEffect(() => {
    localStorage.setItem('tsc-seasons', JSON.stringify(seasons));
  }, [seasons]);
  
  useEffect(() => {
    localStorage.setItem('tsc-crew-database', JSON.stringify(crewDatabase));
  }, [crewDatabase]);
  
  useEffect(() => {
    localStorage.setItem('tsc-learned-patterns', JSON.stringify(learnedPatterns));
  }, [learnedPatterns]);
  
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(t);
    }
  }, [success]);
  
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const getMinCrewCount = (boatClass) => {
    const config = BOAT_CLASSES[boatClass];
    if (!config) return 1;
    const maxCrew = config.crew;
    if (maxCrew >= 4) return maxCrew - 1;
    return maxCrew;
  };
  
  const getMaxCrewCount = (boatClass) => {
    const config = BOAT_CLASSES[boatClass];
    return config ? config.crew : 1;
  };
  
  const currentBoatClass = pdfResult?.boatClass || boatData.bootsklasse;
  const maxCrew = getMaxCrewCount(currentBoatClass);
  const minCrew = getMinCrewCount(currentBoatClass);
  
  const totalAmount = regatten.reduce((sum, r) => sum + (r.invoiceAmount || 0), 0);

  // Statistiken berechnen
  const stats = {
    totalRegatten: regatten.length,
    totalAmount: totalAmount,
    bestPlacement: regatten.length > 0 ? Math.min(...regatten.map(r => r.placement || 999)) : null,
    avgPlacement: regatten.length > 0 
      ? (regatten.reduce((sum, r) => sum + (r.placement || 0), 0) / regatten.length).toFixed(1)
      : null,
    totalRaces: regatten.reduce((sum, r) => sum + (r.raceCount || 0), 0),
  };

  // Duplikat-Prüfung
  const checkDuplicate = (regattaName, date) => {
    return regatten.find(r => 
      r.regattaName?.toLowerCase() === regattaName?.toLowerCase() ||
      (r.date && r.date === date)
    );
  };

  // ============================================
  // PDF PARSING (VERBESSERT)
  // ============================================
  const performOCR = async (pdfData) => {
    try {
      setOcrProgress({ status: 'OCR wird gestartet...' });
      const loadingTask = pdfjsLib.getDocument({ data: atob(pdfData) });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      console.log(`OCR: PDF hat ${pdf.numPages} Seiten`);
      
      // ALLE Seiten verarbeiten
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        setOcrProgress({ status: `OCR Seite ${pageNum} von ${pdf.numPages}...` });
        
        const page = await pdf.getPage(pageNum);
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport }).promise;
        
        setOcrProgress({ status: `Texterkennung Seite ${pageNum}/${pdf.numPages}...` });
        const result = await Tesseract.recognize(canvas, 'deu+eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              const pageProgress = ((pageNum - 1) / pdf.numPages + m.progress / pdf.numPages) * 100;
              setOcrProgress({ status: `Seite ${pageNum}/${pdf.numPages}: ${Math.round(m.progress * 100)}%` });
            }
          }
        });
        
        fullText += result.data.text + '\n--- Seite ' + pageNum + ' Ende ---\n';
      }
      
      console.log('OCR komplett, Text-Länge:', fullText.length);
      return fullText;
    } catch (err) {
      console.error('OCR Error:', err);
      return null;
    }
  };

  const extractTextFromPDF = async (pdfData) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: atob(pdfData) });
      const pdf = await loadingTask.promise;
      let fullText = '';
      
      console.log(`PDF hat ${pdf.numPages} Seiten`);
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        
        // Sortiere Items nach Y-Position (von oben nach unten)
        const items = content.items.sort((a, b) => {
          // Erst nach Y sortieren (invertiert, da PDF von unten zählt)
          const yDiff = b.transform[5] - a.transform[5];
          if (Math.abs(yDiff) > 5) return yDiff;
          // Bei gleicher Y-Position nach X sortieren
          return a.transform[4] - b.transform[4];
        });
        
        let lastY = null;
        let pageText = '';
        
        for (const item of items) {
          const currentY = Math.round(item.transform[5]);
          
          // Neue Zeile wenn Y-Position sich signifikant ändert
          if (lastY !== null && Math.abs(currentY - lastY) > 5) {
            pageText += '\n';
          } else if (lastY !== null) {
            pageText += ' ';
          }
          
          pageText += item.str;
          lastY = currentY;
        }
        
        fullText += pageText + '\n--- Seite ' + i + ' Ende ---\n';
      }
      
      console.log('Extrahierter Text (erste 1000 Zeichen):', fullText.slice(0, 1000));
      return fullText;
    } catch (err) {
      console.error('PDF extraction error:', err);
      return null;
    }
  };

  // === VERBESSERTER PARSER v17 - MANAGE2SAIL OPTIMIERT ===
  const parseRegattaPDF = (text, sailNumber) => {
    console.log('=== PARSING START (v17 Parser) ===');
    console.log('Segelnummer:', sailNumber);
    console.log('Text-Länge:', text?.length);
    
    const result = {
      success: false,
      regattaName: '',
      boatClass: '',
      date: '',
      raceCount: 0,
      totalParticipants: 0,
      participant: null,
      allResults: [],
      feedback: null
    };

    if (!text || !sailNumber) {
      result.feedback = 'Kein Text oder keine Segelnummer vorhanden';
      return result;
    }

    try {
      // Normalisiere die gesuchte Segelnummer
      const sailNumberOnly = sailNumber.replace(/[^0-9]/g, '');
      const normalizedSail = sailNumber.replace(/\s+/g, '').toUpperCase();
      console.log('Suche Segelnummer:', normalizedSail, 'Nur Ziffern:', sailNumberOnly);
      
      // === MANAGE2SAIL ERKENNUNG ===
      const isManage2Sail = text.includes('manage2sail') || text.includes('Manage2Sail') || 
                           text.includes('Final Overall Results') || text.includes('Discard rule');
      console.log('Manage2Sail erkannt:', isManage2Sail);
      
      // === REGATTA-NAME EXTRAHIEREN ===
      // Für Manage2Sail: Der Name steht vor "Final Overall Results"
      if (isManage2Sail) {
        const nameMatch = text.match(/(?:Page \d+ of \d+\s*)?([A-Za-zäöüÄÖÜß\-\s]+(?:Cup|Pokal|Preis|Trophy|Regatta|Meisterschaft)?[\s]*\d{4})\s*(?:Final|Overall)/i);
        if (nameMatch) {
          result.regattaName = nameMatch[1].trim().replace(/\s+/g, ' ');
        }
      }
      
      // Fallback Patterns
      if (!result.regattaName) {
        const namePatterns = [
          /([A-Za-zäöüÄÖÜß\-]+(?:[\s\-][A-Za-zäöüÄÖÜß\-]+)*[\s\-]*(?:Cup|Pokal|Preis|Trophy|Regatta|Meisterschaft)[\s\-]*\d{4})/i,
          /([A-ZÄÖÜ][A-Za-zäöüÄÖÜß\s\-]{5,40}(?:Cup|Pokal|Preis|Trophy|Regatta|Meisterschaft))/i,
        ];
        
        for (const pattern of namePatterns) {
          const match = text.match(pattern);
          if (match) {
            result.regattaName = match[1].trim().replace(/\s+/g, ' ');
            if (result.regattaName.length > 5) break;
          }
        }
      }
      
      // === BOOTSKLASSE ERKENNEN ===
      const classPatterns = [
        /(Optimist\s*[AB]?|ILCA\s*[467]|Laser|420er?|470er?|29er|49er|Europe|Finn|OK[\-\s]?Jolle|Pirat|Korsar)/i,
      ];
      
      for (const pattern of classPatterns) {
        const match = text.match(pattern);
        if (match) {
          result.boatClass = match[1].trim();
          break;
        }
      }
      
      // === DATUM EXTRAHIEREN ===
      const dateMatch = text.match(/(\d{1,2})[.\-\/\s]+(?:OKT|NOV|DEZ|JAN|FEB|MÄR|APR|MAI|JUN|JUL|AUG|SEP)[.\-\/\s]+(\d{4})/i);
      if (dateMatch) {
        const months = { 'JAN': '01', 'FEB': '02', 'MÄR': '03', 'APR': '04', 'MAI': '05', 'JUN': '06', 
                        'JUL': '07', 'AUG': '08', 'SEP': '09', 'OKT': '10', 'NOV': '11', 'DEZ': '12' };
        const monthMatch = text.match(/(OKT|NOV|DEZ|JAN|FEB|MÄR|APR|MAI|JUN|JUL|AUG|SEP)/i);
        if (monthMatch) {
          result.date = `${dateMatch[2]}-${months[monthMatch[1].toUpperCase()]}-${dateMatch[1].padStart(2, '0')}`;
        }
      } else {
        const simpleDateMatch = text.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/);
        if (simpleDateMatch) {
          const day = simpleDateMatch[1].padStart(2, '0');
          const month = simpleDateMatch[2].padStart(2, '0');
          let year = simpleDateMatch[3];
          if (year.length === 2) year = '20' + year;
          result.date = `${year}-${month}-${day}`;
        }
      }
      
      // === WETTFAHRTEN ZÄHLEN ===
      const raceHeaders = text.match(/\bR(\d+)\b/gi);
      if (raceHeaders) {
        const uniqueRaces = [...new Set(raceHeaders.map(r => parseInt(r.slice(1))))].filter(n => n > 0 && n < 20);
        result.raceCount = uniqueRaces.length > 0 ? Math.max(...uniqueRaces) : 0;
        console.log('Wettfahrten gefunden:', result.raceCount);
      }
      
      // === ALLE TEILNEHMER FINDEN ===
      const allParticipants = [];
      
      // MANAGE2SAIL FORMAT: "Rk. Sail Number Name Club R1 R2 ... Total Net"
      // Beispiel: "23 GER 13162 Moritz SCHUMANN Tegeler Segel-Club e.V. 17 20 22 (28) 23 110 82"
      // Der Trick: Platzierung + Ländercode + Segelnummer sind zusammen am Anfang
      
      // Pattern für Manage2Sail: Platzierung Ländercode Segelnummer
      // Wir suchen: Zahl(1-3 Stellen) + Leerzeichen + GER/AUT/etc + Leerzeichen/nichts + Zahl(Segelnummer)
      const manage2sailPattern = /\b(\d{1,3})\s+([A-Z]{2,3})\s*(\d{3,6})\s+([A-Za-zäöüÄÖÜß\-]+)\s+([A-ZÄÖÜ]+)/g;
      
      let match;
      while ((match = manage2sailPattern.exec(text)) !== null) {
        const rank = parseInt(match[1]);
        const country = match[2];
        const sailNum = match[3];
        const firstName = match[4];
        const lastName = match[5];
        
        // Validierung: Platzierung muss realistisch sein
        if (rank > 0 && rank <= 200) {
          // Prüfe ob nicht schon vorhanden
          const sailKey = country + sailNum;
          if (!allParticipants.find(p => p.sailNumber === sailKey)) {
            allParticipants.push({
              rank,
              sailNumber: sailKey,
              name: `${firstName} ${lastName}`,
              fullMatch: match[0]
            });
          }
        }
      }
      
      // Fallback Pattern: Einfacher "Platz Ländercode Segelnummer"
      if (allParticipants.length === 0) {
        const simplePattern = /\b(\d{1,3})\s+([A-Z]{2,3})\s*(\d{3,6})\b/g;
        while ((match = simplePattern.exec(text)) !== null) {
          const rank = parseInt(match[1]);
          const country = match[2];
          const sailNum = match[3];
          
          if (rank > 0 && rank <= 200) {
            const sailKey = country + sailNum;
            if (!allParticipants.find(p => p.sailNumber === sailKey)) {
              allParticipants.push({
                rank,
                sailNumber: sailKey,
                fullMatch: match[0]
              });
            }
          }
        }
      }
      
      console.log('Gefundene Teilnehmer:', allParticipants.length);
      if (allParticipants.length > 0) {
        console.log('Erste 5:', allParticipants.slice(0, 5).map(p => `${p.rank}. ${p.sailNumber}`));
        console.log('Letzte 5:', allParticipants.slice(-5).map(p => `${p.rank}. ${p.sailNumber}`));
      }
      
      // === GESAMTTEILNEHMER BESTIMMEN ===
      // Bei Manage2Sail: Nur Teilnehmer mit echten Ergebnissen zählen (nicht DNC)
      // DNC-Teilnehmer haben oft die gleiche Platzierung (z.B. alle 29.)
      if (allParticipants.length > 0) {
        // Sortiere nach Platzierung
        allParticipants.sort((a, b) => a.rank - b.rank);
        
        // Finde die höchste EINDEUTIGE Platzierung
        const rankCounts = {};
        allParticipants.forEach(p => {
          rankCounts[p.rank] = (rankCounts[p.rank] || 0) + 1;
        });
        
        // Höchste Platzierung die nur 1x vorkommt = letzte gewertete Platzierung
        let lastScoredRank = 0;
        for (const [rank, count] of Object.entries(rankCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
          if (count === 1) {
            lastScoredRank = parseInt(rank);
          } else {
            // Wenn mehrere die gleiche Platzierung haben (DNC), stoppe
            break;
          }
        }
        
        // Wenn alle eindeutig, nimm die höchste
        if (lastScoredRank === 0) {
          lastScoredRank = Math.max(...allParticipants.map(p => p.rank));
        }
        
        result.totalParticipants = lastScoredRank;
        result.allResults = allParticipants;
        
        console.log('Gewertete Teilnehmer:', result.totalParticipants);
      }
      
      // === GESUCHTE SEGELNUMMER FINDEN ===
      const foundParticipant = allParticipants.find(p => {
        const pSailNum = p.sailNumber.replace(/[^0-9]/g, '');
        return pSailNum === sailNumberOnly || p.sailNumber.toUpperCase().includes(sailNumberOnly);
      });
      
      if (foundParticipant) {
        console.log('✓ Eigene Platzierung gefunden:', foundParticipant.rank, foundParticipant.sailNumber);
        result.participant = {
          rank: foundParticipant.rank,
          sailNumber: foundParticipant.sailNumber,
          name: foundParticipant.name || boatData.seglername,
        };
        result.success = true;
      } else {
        // Fallback: Direkte Suche
        console.log('Segelnummer nicht in Liste, suche direkt im Text...');
        
        // Suche das spezifische Muster: "Platz GER Segelnummer"
        const directPattern = new RegExp(`(\\d{1,3})\\s+(?:GER|[A-Z]{2,3})\\s*${sailNumberOnly}\\b`, 'i');
        const directMatch = text.match(directPattern);
        
        if (directMatch) {
          const rank = parseInt(directMatch[1]);
          if (rank > 0 && rank <= 200) {
            result.participant = {
              rank,
              sailNumber: 'GER' + sailNumberOnly,
              name: boatData.seglername,
            };
            result.success = true;
            console.log('✓ Platzierung aus Direktsuche:', rank);
          }
        }
      }
      
      // Fallback für Regattaname
      if (!result.regattaName || result.regattaName.length < 3) {
        result.regattaName = result.boatClass 
          ? `Regatta (${result.boatClass})` 
          : `Regatta vom ${new Date().toLocaleDateString('de-DE')}`;
      }
      
      // Feedback generieren
      if (!result.participant) {
        result.feedback = `Segelnummer "${sailNumber}" wurde nicht gefunden. `;
        if (text.includes(sailNumberOnly)) {
          result.feedback += 'Die Ziffern wurden im Text gefunden - bitte manuell korrigieren.';
        } else {
          result.feedback += 'Bitte prüfe ob die Segelnummer korrekt ist.';
        }
      }
      
      console.log('=== PARSING ERGEBNIS ===');
      console.log('Regatta:', result.regattaName);
      console.log('Platzierung:', result.participant?.rank);
      console.log('Teilnehmer:', result.totalParticipants);
      console.log('Wettfahrten:', result.raceCount);
      
    } catch (err) {
      console.error('Parse error:', err);
      result.feedback = 'Fehler beim Parsen: ' + err.message;
    }
    
    return result;
  };

  const processResultPdf = async (file) => {
    if (!file || !file.type.includes('pdf')) {
      setError('Bitte eine PDF-Datei auswählen');
      return;
    }
    
    if (!boatData.segelnummer) {
      setError('Bitte zuerst die Segelnummer in den Bootsdaten eingeben');
      return;
    }
    
    setPdfProcessing(true);
    setParsingFeedback(null);
    // Manuelle Felder zurücksetzen
    setManualRegattaName('');
    setManualPlacement('');
    setManualTotalParticipants('');
    setManualRaceCount('');
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        setCurrentPdfData(base64);
        
        // Erst direkte Extraktion versuchen
        let text = await extractTextFromPDF(base64);
        let useOCR = false;
        
        // Wenn wenig Text oder keine Platzierung gefunden -> OCR
        if (!text || text.length < 200) {
          console.log('Wenig Text, starte OCR...');
          text = await performOCR(base64);
          useOCR = true;
        }
        
        if (text) {
          setDebugText(text.slice(0, 3000));
          let result = parseRegattaPDF(text, boatData.segelnummer);
          
          // Wenn keine Platzierung und noch kein OCR -> OCR versuchen
          if (!result.participant && !useOCR) {
            console.log('Keine Platzierung gefunden, versuche OCR...');
            const ocrText = await performOCR(base64);
            if (ocrText) {
              const ocrResult = parseRegattaPDF(ocrText, boatData.segelnummer);
              if (ocrResult.participant || ocrResult.regattaName) {
                result = ocrResult;
                useOCR = true;
              }
            }
          }
          
          // Ergebnis setzen
          setPdfResult(result);
          setParserUsed(useOCR ? 'OCR' : 'Direkt');
          setParsingFeedback(result.feedback);
          
          // Erkannte Werte in die manuellen Felder übertragen (zur Korrektur)
          if (result.regattaName) setManualRegattaName(result.regattaName);
          if (result.participant?.rank) setManualPlacement(result.participant.rank.toString());
          if (result.totalParticipants) setManualTotalParticipants(result.totalParticipants.toString());
          if (result.raceCount) setManualRaceCount(result.raceCount.toString());
          
          // NICHT automatisch zum nächsten Step springen - Benutzer soll korrigieren können
        } else {
          // Auch ohne Text ein leeres Ergebnis setzen, damit Korrekturfelder erscheinen
          setPdfResult({ success: false, feedback: 'Kein Text aus PDF extrahiert' });
          setParsingFeedback('Kein Text aus PDF extrahiert. Bitte die Daten manuell eingeben.');
        }
        
        setPdfProcessing(false);
        setOcrProgress(null);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('PDF Processing Error:', err);
      setError('Fehler beim Verarbeiten der PDF');
      setPdfProcessing(false);
      setOcrProgress(null);
    }
  };

  const processInvoicePdf = async (file) => {
    if (!file) return;
    
    setInvoiceProcessing(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        setCurrentInvoiceData(base64);
        
        let text = await extractTextFromPDF(base64);
        if (!text || text.length < 100) {
          text = await performOCR(base64);
        }
        
        if (text) {
          // Betrag extrahieren
          const amountPatterns = [
            /(\d{1,3}[.,]\d{2})\s*€/g,
            /€\s*(\d{1,3}[.,]\d{2})/g,
            /EUR\s*(\d{1,3}[.,]\d{2})/gi,
            /betrag[:\s]*(\d{1,3}[.,]\d{2})/gi,
            /summe[:\s]*(\d{1,3}[.,]\d{2})/gi,
            /gesamt[:\s]*(\d{1,3}[.,]\d{2})/gi,
          ];
          
          let amounts = [];
          for (const pattern of amountPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
              const amount = parseFloat(match[1].replace(',', '.'));
              if (amount > 5 && amount < 500) {
                amounts.push(amount);
              }
            }
          }
          
          if (amounts.length > 0) {
            const maxAmount = Math.max(...amounts);
            setCurrentInvoiceAmount(maxAmount.toFixed(2).replace('.', ','));
          }
        }
        
        setInvoiceProcessing(false);
        setOcrProgress(null);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Invoice Processing Error:', err);
      setInvoiceProcessing(false);
      setOcrProgress(null);
    }
  };

  // Lernfunktion: Wenn manuell korrigiert wird, Pattern speichern
  const learnFromCorrection = (originalResult, correctedData) => {
    if (!debugText) return;
    
    const key = debugText.slice(0, 100).replace(/\s/g, '').toLowerCase();
    const pattern = {
      correctedRank: correctedData.placement,
      sailNumber: boatData.segelnummer,
      timestamp: new Date().toISOString(),
    };
    
    setLearnedPatterns(prev => ({
      ...prev,
      [key]: pattern
    }));
    
    console.log('Pattern gelernt:', key, pattern);
  };

  // ============================================
  // REGATTA HINZUFÜGEN
  // ============================================
  const addRegattaFromPdf = () => {
    try {
      if (!currentInvoiceAmount) {
        setError('Bitte Rechnungsbetrag eingeben');
        return;
      }
      
      const amount = parseFloat(currentInvoiceAmount.replace(',', '.'));
      if (isNaN(amount) || amount <= 0) {
        setError('Bitte gültigen Rechnungsbetrag eingeben');
        return;
      }
      
      // Manuelle Werte haben Vorrang (sie enthalten ggf. die erkannten Werte als Default)
      const placement = manualPlacement ? parseInt(manualPlacement) : null;
      const totalParticipants = manualTotalParticipants ? parseInt(manualTotalParticipants) : null;
      const raceCount = manualRaceCount ? parseInt(manualRaceCount) : null;
      const regattaName = manualRegattaName.trim();
      
      if (!placement) {
        setError('Bitte Platzierung eingeben');
        return;
      }
      
      if (!regattaName) {
        setError('Bitte Regattanamen eingeben');
        return;
      }
      
      // Duplikat-Check
      const duplicate = checkDuplicate(regattaName, pdfResult?.date);
      if (duplicate) {
        setError(`Diese Regatta wurde bereits hinzugefügt: "${duplicate.regattaName}"`);
        return;
      }
      
      // Crew-Validierung
      if (maxCrew > 1) {
        if (selectedCrew.length < minCrew) {
          setError(`Bitte mindestens ${minCrew} Crewmitglieder auswählen`);
          return;
        }
      }
      
      // Lernfunktion aufrufen wenn Daten vorhanden
      if (pdfResult && debugText) {
        learnFromCorrection(pdfResult, { placement, totalParticipants });
      }
      
      const newRegatta = {
        id: Date.now(),
        regattaName,
        boatClass: pdfResult?.boatClass || boatData.bootsklasse,
        date: pdfResult?.date || '',
        placement,
        totalParticipants: totalParticipants || 0,
        raceCount: raceCount || 0,
        sailorName: boatData.seglername,
        crew: selectedCrew,
        invoiceAmount: amount,
        addedAt: new Date().toISOString(),
        parserUsed: parserUsed || 'Manuell',
      };
      
      // PDF-Anhänge speichern
      if (currentPdfData || currentInvoiceData) {
        setPdfAttachments(prev => [...prev, {
          regattaId: newRegatta.id,
          regattaName,
          resultPdf: currentPdfData,
          invoicePdf: currentInvoiceData,
        }]);
      }
      
      setRegatten(prev => [...prev, newRegatta]);
      
      // Reset
      setPdfResult(null);
      setCurrentPdfData(null);
      setCurrentInvoiceData(null);
      setCurrentInvoiceAmount('');
      setManualPlacement('');
      setManualTotalParticipants('');
      setManualRegattaName('');
      setManualRaceCount('');
      setSelectedCrew([]);
      setDebugText('');
      setParsingFeedback(null);
      setAddStep(0);
      
      setSuccess(`"${regattaName}" hinzugefügt!`);
      setActiveTab('list');
    } catch (err) {
      console.error('Error:', err);
      setError('Fehler: ' + err.message);
    }
  };

  // ============================================
  // CREW MANAGEMENT
  // ============================================
  const addCrewMember = (member) => {
    if (selectedCrew.length < maxCrew) {
      setSelectedCrew(prev => [...prev, member]);
    }
  };
  
  const removeCrewMember = (index) => {
    setSelectedCrew(prev => prev.filter((_, i) => i !== index));
  };
  
  const addToCrewDatabase = (member) => {
    if (!crewDatabase.find(c => c.name === member.name)) {
      setCrewDatabase(prev => [...prev, { ...member, id: Date.now() }]);
    }
  };
  
  const removeFromCrewDatabase = (id) => {
    setCrewDatabase(prev => prev.filter(c => c.id !== id));
  };
  
  // Drag & Drop für Crew
  const handleCrewDragStart = (e, member) => {
    e.dataTransfer.setData('crew', JSON.stringify(member));
  };
  
  const handleCrewDragOver = (e, index) => {
    e.preventDefault();
    setDragOverCrew(index);
  };
  
  const handleCrewDrop = (e, index) => {
    e.preventDefault();
    const member = JSON.parse(e.dataTransfer.getData('crew'));
    if (!selectedCrew.find(c => c.name === member.name)) {
      const newCrew = [...selectedCrew];
      newCrew.splice(index, 0, member);
      setSelectedCrew(newCrew.slice(0, maxCrew));
    }
    setDragOverCrew(null);
  };

  // ============================================
  // EXPORT FUNKTIONEN
  // ============================================
  const generatePDF = () => {
    if (regatten.length === 0) {
      setError('Keine Regatten vorhanden');
      return;
    }
    
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Antrag auf Startgeld-Erstattung', 105, 20, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tegeler Segel-Club e.V. - Saison ${currentSeason}`, 105, 28, { align: 'center' });
      
      // Antragsteller Box
      doc.setFillColor(248, 250, 252);
      doc.rect(20, 35, 170, 30, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(20, 35, 170, 30, 'S');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Antragsteller:in', 25, 43);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${boatData.seglername || '-'}`, 25, 51);
      doc.text(`Segelnummer: ${boatData.segelnummer || '-'}`, 25, 57);
      doc.text(`IBAN: ${boatData.iban || '-'}`, 110, 51);
      doc.text(`Kontoinhaber:in: ${boatData.kontoinhaber || '-'}`, 110, 57);
      
      // Tabelle
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Regatten', 20, 75);
      
      if (typeof doc.autoTable === 'function') {
        doc.autoTable({
          startY: 80,
          head: [['Nr.', 'Regatta', 'Datum', 'Platz', 'Teiln.', 'Wettf.', 'Betrag']],
          body: regatten.map((r, i) => [
            (i + 1).toString(),
            r.regattaName || '-',
            r.date ? new Date(r.date).toLocaleDateString('de-DE') : '-',
            r.placement ? `${r.placement}.` : '-',
            r.totalParticipants || '-',
            r.raceCount || '-',
            `${r.invoiceAmount?.toFixed(2) || '0.00'} €`
          ]),
          foot: [['', '', '', '', '', 'Gesamt:', `${totalAmount.toFixed(2)} €`]],
          theme: 'grid',
          headStyles: { fillColor: [99, 102, 241], fontStyle: 'bold' },
          footStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
          styles: { fontSize: 9 },
        });
      }
      
      // Crew-Details
      const afterY = doc.lastAutoTable?.finalY || 150;
      const regattasWithCrew = regatten.filter(r => r.crew?.length > 0);
      if (regattasWithCrew.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Crew-Besetzungen:', 20, afterY + 15);
        doc.setFont('helvetica', 'normal');
        let y = afterY + 22;
        regattasWithCrew.forEach(r => {
          const crewText = r.crew.map(c => `${c.name} (${c.verein || 'k.A.'})`).join(', ');
          doc.text(`${r.regattaName}: ${crewText}`, 25, y, { maxWidth: 165 });
          y += 7;
        });
      }
      
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(`Erstellt: ${new Date().toLocaleString('de-DE')}`, 105, 285, { align: 'center' });
      
      // Download
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TSC_Erstattung_${currentSeason}_${boatData.seglername?.replace(/\s/g, '_') || 'Antrag'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      setSuccess('PDF erstellt');
    } catch (err) {
      console.error('PDF Error:', err);
      setError('Fehler: ' + err.message);
    }
  };

  const generateCSV = () => {
    if (regatten.length === 0) {
      setError('Keine Regatten vorhanden');
      return;
    }
    
    try {
      const headers = ['Datum', 'Empfänger:in', 'IBAN', 'Betrag', 'Währung', 'Verwendungszweck', 'Bootsklasse', 'Segelnummer'];
      const row = [
        new Date().toLocaleDateString('de-DE'),
        boatData.kontoinhaber || boatData.seglername,
        boatData.iban,
        totalAmount.toFixed(2).replace('.', ','),
        'EUR',
        `Startgeld-Erstattung ${currentSeason} - ${regatten.map(r => r.regattaName).join(', ')}`,
        boatData.bootsklasse,
        boatData.segelnummer
      ];
      
      const csv = [headers.join(';'), row.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(';')].join('\n');
      
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TSC_Buchungssatz_${currentSeason}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      setSuccess('CSV erstellt');
    } catch (err) {
      setError('Fehler: ' + err.message);
    }
  };

  const generateSEPA = () => {
    if (regatten.length === 0) {
      setError('Keine Regatten vorhanden');
      return;
    }
    
    try {
      const payment = {
        name: boatData.kontoinhaber || boatData.seglername,
        iban: boatData.iban,
        amount: totalAmount,
        reference: `Startgeld ${currentSeason} ${boatData.seglername}`,
      };
      
      const creditor = {
        name: 'Tegeler Segel-Club e.V.',
        iban: 'DE00000000000000000000', // Platzhalter
        bic: 'BELADEBEXXX',
      };
      
      const xml = generateSEPAXML([payment], creditor);
      
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TSC_SEPA_${currentSeason}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess('SEPA-XML erstellt');
    } catch (err) {
      setError('Fehler: ' + err.message);
    }
  };

  // === ALLE DOKUMENTE IN EINER PDF ZUSAMMENFASSEN ===
  const downloadAllDocuments = async () => {
    if (regatten.length === 0) {
      setError('Keine Regatten vorhanden');
      return;
    }
    
    setSuccess('Kombinierte PDF wird erstellt...');
    
    try {
      // Neues PDF-Dokument erstellen
      const mergedPdf = await PDFDocument.create();
      
      // 1. Erstattungsantrag generieren und hinzufügen
      const applicationPdfBytes = await generatePDFBytes();
      if (applicationPdfBytes) {
        const applicationPdf = await PDFDocument.load(applicationPdfBytes);
        const applicationPages = await mergedPdf.copyPages(applicationPdf, applicationPdf.getPageIndices());
        applicationPages.forEach(page => mergedPdf.addPage(page));
      }
      
      // 2. Für jede Regatta: Ergebnisliste und Rechnung hinzufügen
      for (const [i, att] of pdfAttachments.entries()) {
        // Ergebnisliste
        if (att.resultPdf) {
          try {
            const resultBytes = Uint8Array.from(atob(att.resultPdf), c => c.charCodeAt(0));
            const resultPdf = await PDFDocument.load(resultBytes);
            const resultPages = await mergedPdf.copyPages(resultPdf, resultPdf.getPageIndices());
            resultPages.forEach(page => mergedPdf.addPage(page));
          } catch (e) {
            console.error(`Fehler bei Ergebnisliste ${i + 1}:`, e);
          }
        }
        
        // Rechnung
        if (att.invoicePdf) {
          try {
            const invoiceBytes = Uint8Array.from(atob(att.invoicePdf), c => c.charCodeAt(0));
            const invoicePdf = await PDFDocument.load(invoiceBytes);
            const invoicePages = await mergedPdf.copyPages(invoicePdf, invoicePdf.getPageIndices());
            invoicePages.forEach(page => mergedPdf.addPage(page));
          } catch (e) {
            console.error(`Fehler bei Rechnung ${i + 1}:`, e);
          }
        }
      }
      
      // Kombinierte PDF speichern
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TSC_Startgeld_${currentSeason}_${boatData.seglername.replace(/[^a-zA-Z0-9]/g, '_')}_komplett.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Zusätzlich CSV und SEPA separat
      await new Promise(r => setTimeout(r, 300));
      generateCSV();
      await new Promise(r => setTimeout(r, 300));
      generateSEPA();
      
      setSuccess('Alle Dateien heruntergeladen (PDF kombiniert)');
    } catch (err) {
      console.error('Fehler beim Erstellen der kombinierten PDF:', err);
      setError('Fehler beim Kombinieren der PDFs: ' + err.message);
      
      // Fallback: Einzelne Downloads
      setSuccess('Fallback: Einzelne Downloads...');
      generatePDF();
      await new Promise(r => setTimeout(r, 500));
      generateCSV();
      await new Promise(r => setTimeout(r, 500));
      generateSEPA();
      
      for (const [i, att] of pdfAttachments.entries()) {
        if (att.resultPdf) {
          await new Promise(r => setTimeout(r, 300));
          const blob = new Blob([Uint8Array.from(atob(att.resultPdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${i + 1}_Ergebnis_${att.regattaName?.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        if (att.invoicePdf) {
          await new Promise(r => setTimeout(r, 300));
          const blob = new Blob([Uint8Array.from(atob(att.invoicePdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${i + 1}_Rechnung_${att.regattaName?.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    }
  };
  
  // Hilfsfunktion: PDF als Bytes generieren (für Zusammenführung)
  const generatePDFBytes = async () => {
    return new Promise((resolve) => {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Antrag auf Erstattung von Startgeldern', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tegeler Segel-Club e.V. - Saison ${currentSeason}`, 105, 28, { align: 'center' });
      
      // Antragsteller-Daten
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Antragsteller:', 20, 45);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${boatData.seglername}`, 20, 52);
      doc.text(`Segelnummer: ${boatData.segelnummer}`, 20, 58);
      doc.text(`Bootsklasse: ${boatData.bootsklasse}`, 20, 64);
      
      // Bankverbindung
      doc.setFont('helvetica', 'bold');
      doc.text('Bankverbindung:', 110, 45);
      doc.setFont('helvetica', 'normal');
      doc.text(`IBAN: ${boatData.iban || '-'}`, 110, 52);
      doc.text(`Kontoinhaber: ${boatData.kontoinhaber || boatData.seglername}`, 110, 58);
      
      // Tabelle
      const tableData = regatten.map((r, i) => [
        i + 1,
        r.regattaName || '-',
        r.date ? new Date(r.date).toLocaleDateString('de-DE') : '-',
        `${r.placement || '-'}. / ${r.totalParticipants || '-'}`,
        r.raceCount || '-',
        r.crew?.length > 0 ? r.crew.map(c => c.name).join(', ') : '-',
        `${(r.invoiceAmount || 0).toFixed(2)} €`
      ]);
      
      doc.autoTable({
        startY: 75,
        head: [['#', 'Regatta', 'Datum', 'Platz', 'WF', 'Crew', 'Betrag']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [100, 80, 180] },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 50 },
          2: { cellWidth: 22 },
          3: { cellWidth: 20 },
          4: { cellWidth: 12 },
          5: { cellWidth: 45 },
          6: { cellWidth: 20 },
        }
      });
      
      // Summe
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.text(`Gesamtbetrag: ${totalAmount.toFixed(2)} €`, 20, finalY);
      
      // Unterschrift
      doc.setFont('helvetica', 'normal');
      doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, 20, finalY + 20);
      doc.line(110, finalY + 20, 190, finalY + 20);
      doc.text('Unterschrift', 150, finalY + 25, { align: 'center' });
      
      // Footer
      doc.setFontSize(8);
      doc.text('Erstellt mit TSC Startgeld App', 105, 285, { align: 'center' });
      
      // Als ArrayBuffer zurückgeben
      const pdfOutput = doc.output('arraybuffer');
      resolve(new Uint8Array(pdfOutput));
    });
  };

  const submitOnline = async () => {
    if (regatten.length === 0) {
      setError('Keine Regatten vorhanden');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('_subject', `TSC Startgeld ${currentSeason}: ${boatData.seglername} - ${totalAmount.toFixed(2)} €`);
      formData.append('Saison', currentSeason);
      formData.append('Antragsteller', boatData.seglername);
      formData.append('Segelnummer', boatData.segelnummer);
      formData.append('Bootsklasse', boatData.bootsklasse);
      formData.append('IBAN', boatData.iban);
      formData.append('Gesamtbetrag', `${totalAmount.toFixed(2)} €`);
      
      regatten.forEach((r, i) => {
        let details = `${r.regattaName}: ${r.invoiceAmount?.toFixed(2)} € (Platz ${r.placement})`;
        if (r.crew?.length > 0) {
          details += ` | Crew: ${r.crew.map(c => c.name).join(', ')}`;
        }
        formData.append(`Regatta_${i + 1}`, details);
      });
      
      pdfAttachments.forEach((att, i) => {
        if (att.resultPdf) {
          const blob = new Blob([Uint8Array.from(atob(att.resultPdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
          formData.append(`Ergebnis_${i + 1}`, blob, `Ergebnis_${att.regattaName}.pdf`);
        }
        if (att.invoicePdf) {
          const blob = new Blob([Uint8Array.from(atob(att.invoicePdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
          formData.append(`Rechnung_${i + 1}`, blob, `Rechnung_${att.regattaName}.pdf`);
        }
      });
      
      const response = await fetch('https://formsubmit.co/ajax/kolja.schumann@aitema.de', {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' },
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess('Antrag erfolgreich eingereicht!');
      } else {
        throw new Error(result.message || 'Einreichung fehlgeschlagen');
      }
    } catch (err) {
      console.error('Submit Error:', err);
      setError('Fehler beim Einreichen: ' + err.message);
      // Fallback: Mail öffnen
      downloadAllDocuments();
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // ONBOARDING
  // ============================================
  const OnboardingModal = () => {
    const steps = [
      {
        title: 'Willkommen bei TSC Startgeld',
        content: 'Diese App hilft dir, deine Startgeld-Erstattungen für Regatten einfach zu verwalten und einzureichen.',
        icon: Icons.boat,
      },
      {
        title: 'Bootsdaten eingeben',
        content: 'Trage zuerst deine Bootsdaten ein - besonders wichtig ist die Segelnummer für die automatische Erkennung.',
        icon: Icons.settings,
      },
      {
        title: 'Ergebnisse hochladen',
        content: 'Lade PDF-Ergebnislisten hoch. Die App erkennt automatisch deine Platzierung anhand der Segelnummer.',
        icon: Icons.upload,
      },
      {
        title: 'Rechnung hinzufügen',
        content: 'Füge die Startgeld-Rechnung hinzu. Der Betrag wird automatisch erkannt.',
        icon: Icons.receipt,
      },
      {
        title: 'Einreichen',
        content: 'Exportiere alles als PDF, CSV oder reiche direkt online beim TSC ein.',
        icon: Icons.send,
      },
    ];
    
    return (
      <Modal isOpen={showOnboarding} onClose={() => {}} title="" size="md">
        <div className="text-center">
          <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white`}>
            <span className="w-8 h-8">{steps[onboardingStep].icon}</span>
          </div>
          
          <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {steps[onboardingStep].title}
          </h2>
          
          <p className={`mb-8 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {steps[onboardingStep].content}
          </p>
          
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i === onboardingStep ? 'bg-violet-500' : isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
            ))}
          </div>
          
          <div className="flex gap-3 justify-center">
            {onboardingStep > 0 && (
              <button
                onClick={() => setOnboardingStep(s => s - 1)}
                className={`px-6 py-2 rounded-xl ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
              >
                Zurück
              </button>
            )}
            <button
              onClick={() => {
                if (onboardingStep < steps.length - 1) {
                  setOnboardingStep(s => s + 1);
                } else {
                  setShowOnboarding(false);
                  localStorage.setItem('tsc-onboarding-done', 'true');
                }
              }}
              className="px-6 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
            >
              {onboardingStep < steps.length - 1 ? 'Weiter' : 'Los geht\'s'}
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <ThemeContext.Provider value={{ isDark, setIsDark }}>
      <div className={`min-h-screen transition-colors ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        
        {/* Onboarding */}
        <OnboardingModal />
        
        {/* Toast Notifications */}
        {success && <Toast message={success} type="success" onClose={() => setSuccess(null)} />}
        {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
        
        {/* Header */}
        <nav className={`sticky top-0 z-40 border-b ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'} backdrop-blur-xl`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white">
                  {Icons.boat}
                </div>
                <div>
                  <h1 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>TSC Startgeld</h1>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Saison</span>
                    <button 
                      onClick={() => setShowSeasonModal(true)}
                      className={`font-medium ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}
                    >
                      {currentSeason}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (adminAuthenticated) {
                      setShowAdminModal(true);
                    } else {
                      setShowAdminPasswordModal(true);
                    }
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    adminAuthenticated 
                      ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' 
                      : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                  title={adminAuthenticated ? "Admin-Bereich" : "Admin-Login"}
                >
                  {adminAuthenticated ? Icons.settings : Icons.lock}
                </button>
                <button
                  onClick={() => setIsDark(!isDark)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'}`}
                >
                  {isDark ? Icons.sun : Icons.moon}
                </button>
                <button
                  onClick={() => setShowHelpModal(true)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'}`}
                >
                  {Icons.info}
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className={`flex gap-1 p-1 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/50'}`}>
            {[
              { id: 'dashboard', icon: Icons.grid, label: 'Übersicht' },
              { id: 'add', icon: Icons.plus, label: 'Hinzufügen' },
              { id: 'list', icon: Icons.list, label: `Liste (${regatten.length})` },
              { id: 'crew', icon: Icons.users, label: 'Crew' },
              { id: 'export', icon: Icons.download, label: 'Export' },
              { id: 'settings', icon: Icons.settings, label: 'Daten' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  activeTab === tab.id 
                    ? 'bg-violet-600 text-white shadow-lg' 
                    : isDark 
                      ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50'
                }`}
              >
                <span className="w-4 h-4">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          
          {/* === DASHBOARD === */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Icons.trophy} label="Regatten" value={stats.totalRegatten} color="purple" />
                <StatCard icon={Icons.chart} label="Erstattung" value={`${stats.totalAmount.toFixed(0)} €`} color="emerald" />
                <StatCard icon={Icons.trophy} label="Beste Platzierung" value={stats.bestPlacement ? `${stats.bestPlacement}.` : '-'} color="amber" />
                <StatCard icon={Icons.list} label="Wettfahrten" value={stats.totalRaces} color="cyan" />
              </div>
              
              {/* Quick Actions */}
              <GlassCard>
                <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Schnellaktionen</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => setActiveTab('add')}
                    className={`p-4 rounded-xl text-left transition-all ${isDark ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500 mb-2">{Icons.plus}</div>
                    <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Regatta hinzufügen</div>
                  </button>
                  <button
                    onClick={() => { setActiveTab('export'); generatePDF(); }}
                    className={`p-4 rounded-xl text-left transition-all ${isDark ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">{Icons.document}</div>
                    <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>PDF erstellen</div>
                  </button>
                  <button
                    onClick={() => setShowCrewModal(true)}
                    className={`p-4 rounded-xl text-left transition-all ${isDark ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-500 mb-2">{Icons.userPlus}</div>
                    <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Crew verwalten</div>
                  </button>
                </div>
              </GlassCard>
              
              {/* Letzte Regatten */}
              {regatten.length > 0 && (
                <GlassCard>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Letzte Regatten</h2>
                    <button onClick={() => setActiveTab('list')} className={`text-sm ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>Alle anzeigen</button>
                  </div>
                  <div className="space-y-2">
                    {regatten.slice(-3).reverse().map(r => (
                      <div key={r.id} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                        <div className="flex-1 min-w-0 mr-3">
                          <div className={`font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {r.regattaName?.length > 50 ? r.regattaName.slice(0, 47) + '...' : r.regattaName}
                          </div>
                          <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            Platz {r.placement} • {r.invoiceAmount?.toFixed(2)} €
                          </div>
                        </div>
                        <div className={`text-2xl font-bold flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{r.placement}.</div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
              
              {regatten.length === 0 && (
                <GlassCard className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-500">
                    {Icons.boat}
                  </div>
                  <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Noch keine Regatten</h3>
                  <p className={`mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Füge deine erste Regatta hinzu, um loszulegen.</p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="px-6 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
                  >
                    Regatta hinzufügen
                  </button>
                </GlassCard>
              )}
            </div>
          )}

          {/* === HINZUFÜGEN === */}
          {activeTab === 'add' && (
            <div className="space-y-6">
              {/* Progress Steps */}
              <ProgressSteps 
                currentStep={addStep} 
                totalSteps={maxCrew > 1 ? 3 : 2}
                labels={maxCrew > 1 ? ['Ergebnis', 'Crew', 'Rechnung'] : ['Ergebnis', 'Rechnung']}
              />
              
              {/* Step 1: Ergebnisliste */}
              {addStep === 0 && (
                <GlassCard>
                  <div className="flex items-center gap-3 mb-6">
                    <IconBadge icon={Icons.chart} color="purple" />
                    <div>
                      <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Ergebnisliste</h2>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>PDF von manage2sail o.ä. hochladen</p>
                    </div>
                  </div>
                  
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); processResultPdf(e.dataTransfer.files?.[0]); }}
                    className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                      isDragging 
                        ? 'border-violet-500 bg-violet-500/10' 
                        : pdfResult 
                          ? 'border-emerald-500/50 bg-emerald-500/5' 
                          : isDark 
                            ? 'border-slate-700 hover:border-slate-600' 
                            : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => processResultPdf(e.target.files?.[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    
                    {pdfProcessing ? (
                      <div className="text-violet-500">
                        <svg className="w-12 h-12 mx-auto mb-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        <div className="text-sm">{ocrProgress?.status || 'Verarbeite PDF...'}</div>
                      </div>
                    ) : pdfResult ? (
                      <div className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>
                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <div className="font-medium">{pdfResult.regattaName || 'Ergebnisliste erkannt'}</div>
                        {pdfResult.participant ? (
                          <div className="text-sm mt-1">Platz {pdfResult.participant.rank} von {pdfResult.totalParticipants}</div>
                        ) : (
                          <div className={`text-sm mt-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Platzierung nicht erkannt</div>
                        )}
                        {parserUsed && <div className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Parser: {parserUsed}</div>}
                      </div>
                    ) : (
                      <div className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <div className="text-sm">PDF hierher ziehen oder klicken</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Parsing Feedback */}
                  {parsingFeedback && (
                    <div className={`mt-4 p-4 rounded-xl ${isDark ? 'bg-amber-900/20 border border-amber-700/30' : 'bg-amber-50 border border-amber-200'}`}>
                      <div className="flex gap-3">
                        <span className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{Icons.warning}</span>
                        <div className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>{parsingFeedback}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Manuelle Eingabe / Korrektur - IMMER anzeigen nach Upload */}
                  {(pdfResult || currentPdfData) && (
                    <div className={`mt-6 p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                      <div className={`text-sm mb-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {pdfResult?.participant?.rank ? 'Erkannte Daten prüfen/korrigieren:' : 'Daten manuell eingeben:'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className={`block text-xs mb-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Regattaname *</label>
                          <input
                            type="text"
                            value={manualRegattaName}
                            onChange={(e) => setManualRegattaName(e.target.value)}
                            placeholder="z.B. Berliner Meisterschaft 2025"
                            className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs mb-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Platzierung *</label>
                          <input
                            type="number"
                            min="1"
                            value={manualPlacement}
                            onChange={(e) => setManualPlacement(e.target.value)}
                            placeholder="z.B. 5"
                            className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs mb-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Anzahl Teilnehmer</label>
                          <input
                            type="number"
                            min="1"
                            value={manualTotalParticipants}
                            onChange={(e) => setManualTotalParticipants(e.target.value)}
                            placeholder="z.B. 45"
                            className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs mb-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Gewertete Wettfahrten</label>
                          <input
                            type="number"
                            min="1"
                            value={manualRaceCount}
                            onChange={(e) => setManualRaceCount(e.target.value)}
                            placeholder="z.B. 6"
                            className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs mb-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Parser-Info</label>
                          <div className={`px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                            {parserUsed || 'Manuell'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Debug: Extrahierter Text (ausklappbar) */}
                      {debugText && (
                        <details className="mt-4">
                          <summary className={`cursor-pointer text-xs ${isDark ? 'text-slate-500 hover:text-slate-400' : 'text-slate-400 hover:text-slate-500'}`}>
                            🔍 Extrahierten Text anzeigen (Debug)
                          </summary>
                          <pre className={`mt-2 p-3 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                            {debugText}
                          </pre>
                        </details>
                      )}
                      
                      <button
                        onClick={() => setAddStep(maxCrew > 1 ? 1 : 2)}
                        disabled={!manualPlacement || !manualRegattaName}
                        className="mt-4 w-full py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        Weiter {maxCrew > 1 ? 'zur Crew' : 'zur Rechnung'}
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  )}
                  
                  {/* Manuelle Eingabe ohne PDF */}
                  {!pdfResult && !currentPdfData && (
                    <div className={`mt-4 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      <div className="text-sm">oder</div>
                      <button
                        onClick={() => {
                          setPdfResult({ success: false, manual: true });
                          setManualRegattaName('');
                          setManualPlacement('');
                          setManualTotalParticipants('');
                          setManualRaceCount('');
                        }}
                        className={`mt-2 text-sm ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-500'}`}
                      >
                        Daten manuell eingeben (ohne PDF)
                      </button>
                    </div>
                  )}
                </GlassCard>
              )}
              
              {/* Step 2: Crew (nur bei Mehrpersonenbooten) */}
              {addStep === 1 && maxCrew > 1 && (
                <GlassCard>
                  <div className="flex items-center gap-3 mb-6">
                    <IconBadge icon={Icons.users} color="cyan" />
                    <div>
                      <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Crew auswählen</h2>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{minCrew}-{maxCrew} Personen für {currentBoatClass}</p>
                    </div>
                  </div>
                  
                  {/* Crew-Datenbank */}
                  {crewDatabase.length > 0 && (
                    <div className="mb-6">
                      <div className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Aus Crew-Datenbank ziehen:</div>
                      <div className="flex flex-wrap gap-2">
                        {crewDatabase.map(member => (
                          <div
                            key={member.id}
                            draggable
                            onDragStart={(e) => handleCrewDragStart(e, member)}
                            className={`px-3 py-1.5 rounded-lg text-sm cursor-move ${
                              selectedCrew.find(c => c.name === member.name)
                                ? 'opacity-50 cursor-not-allowed'
                                : isDark 
                                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                                  : 'bg-cyan-100 text-cyan-700 border border-cyan-200'
                            }`}
                          >
                            {member.name} ({member.verein || 'k.A.'})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Ausgewählte Crew */}
                  <div className="space-y-2 mb-6">
                    {Array.from({ length: maxCrew }).map((_, index) => (
                      <div
                        key={index}
                        onDragOver={(e) => handleCrewDragOver(e, index)}
                        onDrop={(e) => handleCrewDrop(e, index)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed transition-all ${
                          dragOverCrew === index 
                            ? 'border-violet-500 bg-violet-500/10' 
                            : selectedCrew[index]
                              ? isDark ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-emerald-300 bg-emerald-50'
                              : index < minCrew
                                ? isDark ? 'border-amber-500/30' : 'border-amber-300'
                                : isDark ? 'border-slate-700' : 'border-slate-300'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          selectedCrew[index]
                            ? 'bg-emerald-500 text-white'
                            : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {index + 1}
                        </div>
                        
                        {selectedCrew[index] ? (
                          <div className="flex-1 flex items-center justify-between">
                            <div>
                              <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedCrew[index].name}</div>
                              <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{selectedCrew[index].verein || 'Kein Verein'}</div>
                            </div>
                            <button onClick={() => removeCrewMember(index)} className="text-red-500 hover:text-red-400">{Icons.x}</button>
                          </div>
                        ) : (
                          <div className={`flex-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {index === 0 ? 'Steuerperson/Skipper:in' : `Crew ${index + 1}`}
                            {index < minCrew && <span className="text-amber-500 ml-2">*</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Neues Crewmitglied hinzufügen */}
                  <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                    <div className={`text-sm mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Neues Crewmitglied:</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Name"
                        id="newCrewName"
                        className={`flex-1 px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'} border`}
                      />
                      <input
                        type="text"
                        placeholder="Verein"
                        id="newCrewVerein"
                        className={`w-24 px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'} border`}
                      />
                      <button
                        onClick={() => {
                          const name = document.getElementById('newCrewName').value;
                          const verein = document.getElementById('newCrewVerein').value;
                          if (name && selectedCrew.length < maxCrew) {
                            const member = { name, verein: verein || 'TSC' };
                            addCrewMember(member);
                            addToCrewDatabase(member);
                            document.getElementById('newCrewName').value = '';
                            document.getElementById('newCrewVerein').value = '';
                          }
                        }}
                        className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500"
                      >
                        {Icons.plus}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setAddStep(0)}
                      className={`flex-1 py-3 rounded-xl ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
                    >
                      Zurück
                    </button>
                    <button
                      onClick={() => setAddStep(2)}
                      disabled={selectedCrew.length < minCrew}
                      className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Weiter zur Rechnung
                    </button>
                  </div>
                </GlassCard>
              )}
              
              {/* Step 3: Rechnung */}
              {addStep === 2 && (
                <GlassCard>
                  <div className="flex items-center gap-3 mb-6">
                    <IconBadge icon={Icons.receipt} color="amber" />
                    <div>
                      <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Rechnung</h2>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Startgeld-Rechnung hochladen</p>
                    </div>
                  </div>
                  
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingInvoice(true); }}
                    onDragLeave={() => setIsDraggingInvoice(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDraggingInvoice(false); processInvoicePdf(e.dataTransfer.files?.[0]); }}
                    className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                      isDraggingInvoice 
                        ? 'border-amber-500 bg-amber-500/10' 
                        : currentInvoiceData 
                          ? 'border-emerald-500/50 bg-emerald-500/5' 
                          : isDark 
                            ? 'border-slate-700 hover:border-slate-600' 
                            : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => processInvoicePdf(e.target.files?.[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    
                    {invoiceProcessing ? (
                      <div className="text-amber-500">
                        <svg className="w-12 h-12 mx-auto mb-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        <div className="text-sm">Rechnung wird verarbeitet...</div>
                      </div>
                    ) : currentInvoiceData ? (
                      <div className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>
                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <div className="font-medium">Rechnung hochgeladen</div>
                      </div>
                    ) : (
                      <div className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <div className="text-sm">PDF hierher ziehen oder klicken</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6">
                    <label className={`block text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Rechnungsbetrag (€) *</label>
                    <input
                      type="text"
                      value={currentInvoiceAmount}
                      onChange={(e) => setCurrentInvoiceAmount(e.target.value)}
                      placeholder="45,00"
                      className={`w-full px-4 py-3 rounded-xl text-lg ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                    />
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setAddStep(maxCrew > 1 ? 1 : 0)}
                      className={`flex-1 py-3 rounded-xl ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
                    >
                      Zurück
                    </button>
                    <button
                      onClick={addRegattaFromPdf}
                      disabled={!currentInvoiceAmount}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Regatta speichern
                    </button>
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {/* === LISTE === */}
          {activeTab === 'list' && (
            <GlassCard>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <IconBadge icon={Icons.list} color="emerald" />
                  <div>
                    <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Regatten {currentSeason}</h2>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{regatten.length} Einträge • {totalAmount.toFixed(2)} € gesamt</p>
                  </div>
                </div>
              </div>
              
              {regatten.length === 0 ? (
                <div className="text-center py-12">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'} flex items-center justify-center`}>
                    {Icons.list}
                  </div>
                  <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Noch keine Regatten</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {regatten.map((r, i) => (
                    <div key={r.id} className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-2xl font-bold flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{i + 1}</span>
                            <div className="min-w-0">
                              <div className={`font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {r.regattaName?.length > 60 ? r.regattaName.slice(0, 57) + '...' : r.regattaName}
                              </div>
                              <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                                {r.date && new Date(r.date).toLocaleDateString('de-DE')} • 
                                Platz {r.placement} von {r.totalParticipants} • 
                                {r.raceCount} Wettfahrten
                              </div>
                              {r.crew?.length > 0 && (
                                <div className={`text-xs mt-1 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                                  Crew: {r.crew.map(c => c.name).join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <span className={`text-lg font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{r.invoiceAmount?.toFixed(2)} €</span>
                          <button
                            onClick={() => {
                              setRegatten(prev => prev.filter(reg => reg.id !== r.id));
                              setPdfAttachments(prev => prev.filter(a => a.regattaId !== r.id));
                            }}
                            className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center"
                          >
                            {Icons.x}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          )}

          {/* === CREW === */}
          {activeTab === 'crew' && (
            <GlassCard>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <IconBadge icon={Icons.users} color="cyan" />
                  <div>
                    <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Crew-Datenbank</h2>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{crewDatabase.length} Mitglieder gespeichert</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCrewModal(true)}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500 flex items-center gap-2"
                >
                  {Icons.userPlus} Hinzufügen
                </button>
              </div>
              
              {crewDatabase.length === 0 ? (
                <div className="text-center py-12">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'} flex items-center justify-center`}>
                    {Icons.users}
                  </div>
                  <p className={`mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Noch keine Crewmitglieder gespeichert</p>
                  <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    Crewmitglieder werden automatisch gespeichert, wenn du sie bei einer Regatta hinzufügst.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {crewDatabase.map(member => (
                    <div key={member.id} className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{member.name}</div>
                          <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{member.verein || 'Kein Verein'}</div>
                        </div>
                        <button
                          onClick={() => removeFromCrewDatabase(member.id)}
                          className="text-red-500 hover:text-red-400"
                        >
                          {Icons.x}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          )}

          {/* === EXPORT === */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <GlassCard>
                <div className="flex items-center gap-3 mb-6">
                  <IconBadge icon={Icons.download} color="emerald" />
                  <div>
                    <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Export & Einreichen</h2>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Saison {currentSeason} • {regatten.length} Regatten • {totalAmount.toFixed(2)} €</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <button
                    onClick={generatePDF}
                    disabled={regatten.length === 0}
                    className={`group p-4 rounded-xl text-left transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500 mb-2">{Icons.document}</div>
                    <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>PDF-Antrag</div>
                    <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Erstattungsformular</div>
                  </button>
                  
                  <button
                    onClick={generateCSV}
                    disabled={regatten.length === 0}
                    className={`group p-4 rounded-xl text-left transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">{Icons.table}</div>
                    <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>CSV-Export</div>
                    <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Buchungssatz</div>
                  </button>
                  
                  <button
                    onClick={generateSEPA}
                    disabled={regatten.length === 0}
                    className={`group p-4 rounded-xl text-left transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-500 mb-2">{Icons.bank}</div>
                    <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>SEPA-XML</div>
                    <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Überweisung</div>
                  </button>
                  
                  <button
                    onClick={downloadAllDocuments}
                    disabled={regatten.length === 0}
                    className={`group p-4 rounded-xl text-left transition-all disabled:opacity-50 ${isDark ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2">{Icons.archive}</div>
                    <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Alle Dateien</div>
                    <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Inkl. Belege</div>
                  </button>
                </div>
              </GlassCard>
              
              {/* Online Einreichen */}
              <div className={`p-6 rounded-xl ${isDark ? 'bg-gradient-to-r from-emerald-900/30 to-emerald-800/20 border border-emerald-700/30' : 'bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200'}`}>
                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-200 text-emerald-700'}`}>
                    {Icons.send}
                  </div>
                  <div>
                    <div className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>Online einreichen</div>
                    <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Direkt an den TSC senden</div>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <button
                    onClick={submitOnline}
                    disabled={regatten.length === 0 || isSubmitting}
                    className="flex-1 py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <><div className="w-5 h-5 animate-spin">{Icons.refresh}</div> Wird gesendet...</>
                    ) : (
                      <>{Icons.send} Jetzt einreichen</>
                    )}
                  </button>
                  <button
                    onClick={downloadAllDocuments}
                    disabled={regatten.length === 0}
                    className={`py-3 px-6 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center gap-2 ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-200'}`}
                  >
                    {Icons.mail} Per E-Mail
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* === SETTINGS === */}
          {activeTab === 'settings' && (
            <GlassCard>
              <div className="flex items-center gap-3 mb-6">
                <IconBadge icon={Icons.boat} color="cyan" />
                <div>
                  <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Bootsdaten</h2>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Werden für alle Anträge verwendet</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Name Segler:in *</label>
                  <input
                    type="text"
                    value={boatData.seglername}
                    onChange={(e) => setBoatData(prev => ({ ...prev, seglername: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Segelnummer *</label>
                  <input
                    type="text"
                    value={boatData.segelnummer}
                    onChange={(e) => setBoatData(prev => ({ ...prev, segelnummer: e.target.value.toUpperCase() }))}
                    className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Bootsklasse</label>
                  <select
                    value={boatData.bootsklasse}
                    onChange={(e) => setBoatData(prev => ({ ...prev, bootsklasse: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                  >
                    {Object.keys(BOAT_CLASSES).map(k => (
                      <option key={k} value={k}>{k} ({BOAT_CLASSES[k].crew} Pers.)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>IBAN</label>
                  <input
                    type="text"
                    value={boatData.iban}
                    onChange={(e) => setBoatData(prev => ({ ...prev, iban: e.target.value.toUpperCase() }))}
                    className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={`block text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Kontoinhaber:in</label>
                  <input
                    type="text"
                    value={boatData.kontoinhaber}
                    onChange={(e) => setBoatData(prev => ({ ...prev, kontoinhaber: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                  />
                </div>
              </div>
              
              {!boatData.segelnummer && (
                <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 ${isDark ? 'bg-amber-900/20 border border-amber-700/30' : 'bg-amber-50 border border-amber-200'}`}>
                  <span className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{Icons.warning}</span>
                  <span className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>Die Segelnummer wird benötigt, um deine Platzierung automatisch zu erkennen.</span>
                </div>
              )}
            </GlassCard>
          )}
        </main>

        {/* Modals */}
        <Modal isOpen={showSeasonModal} onClose={() => setShowSeasonModal(false)} title="Saison wählen">
          <div className="space-y-3">
            {seasons.map(s => (
              <button
                key={s}
                onClick={() => { setCurrentSeason(s); setShowSeasonModal(false); }}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  s === currentSeason
                    ? 'bg-violet-600 text-white'
                    : isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                }`}
              >
                <div className="font-medium">Saison {s}</div>
                <div className={`text-sm ${s === currentSeason ? 'text-violet-200' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {(allRegatten[s] || []).length} Regatten
                </div>
              </button>
            ))}
            <button
              onClick={() => {
                const newSeason = (parseInt(seasons[seasons.length - 1]) + 1).toString();
                setSeasons(prev => [...prev, newSeason]);
                setCurrentSeason(newSeason);
                setShowSeasonModal(false);
              }}
              className={`w-full p-4 rounded-xl border-2 border-dashed ${isDark ? 'border-slate-700 text-slate-400 hover:border-violet-500 hover:text-violet-400' : 'border-slate-300 text-slate-500 hover:border-violet-400 hover:text-violet-600'}`}
            >
              + Neue Saison starten
            </button>
          </div>
        </Modal>
        
        <Modal isOpen={showCrewModal} onClose={() => setShowCrewModal(false)} title="Crewmitglied hinzufügen">
          <div className="space-y-4">
            <div>
              <label className={`block text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Name *</label>
              <input
                type="text"
                id="modalCrewName"
                className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Verein</label>
              <input
                type="text"
                id="modalCrewVerein"
                defaultValue="TSC"
                className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border`}
              />
            </div>
            <button
              onClick={() => {
                const name = document.getElementById('modalCrewName').value;
                const verein = document.getElementById('modalCrewVerein').value;
                if (name) {
                  addToCrewDatabase({ name, verein });
                  setShowCrewModal(false);
                }
              }}
              className="w-full py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500"
            >
              Speichern
            </button>
          </div>
        </Modal>
        
        {/* Admin-Passwort Modal */}
        <Modal isOpen={showAdminPasswordModal} onClose={() => { setShowAdminPasswordModal(false); setAdminPassword(''); }} title="Admin-Zugang">
          <div className="space-y-4">
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Der Admin-Bereich ist passwortgeschützt. Bitte gib das Passwort ein.
            </p>
            <div>
              <label className={`block text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Passwort</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && adminPassword === ADMIN_PASSWORD) {
                    setAdminAuthenticated(true);
                    setShowAdminPasswordModal(false);
                    setShowAdminModal(true);
                    setAdminPassword('');
                  }
                }}
                placeholder="Admin-Passwort"
                className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                autoFocus
              />
            </div>
            {adminPassword && adminPassword !== ADMIN_PASSWORD && adminPassword.length >= 5 && (
              <div className="text-sm text-red-500">Falsches Passwort</div>
            )}
            <button
              onClick={() => {
                if (adminPassword === ADMIN_PASSWORD) {
                  setAdminAuthenticated(true);
                  setShowAdminPasswordModal(false);
                  setShowAdminModal(true);
                  setAdminPassword('');
                }
              }}
              disabled={adminPassword !== ADMIN_PASSWORD}
              className="w-full py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anmelden
            </button>
          </div>
        </Modal>
        
        {/* Admin-Übersicht Modal (nur für authentifizierte Admins) */}
        <Modal isOpen={showAdminModal && adminAuthenticated} onClose={() => setShowAdminModal(false)} title="Admin-Übersicht" size="lg">
          <div className="space-y-6">
            <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <h4 className={`font-medium mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Alle Saisons</h4>
              <div className="space-y-2">
                {seasons.map(s => {
                  const seasonRegatten = allRegatten[s] || [];
                  const seasonTotal = seasonRegatten.reduce((sum, r) => sum + (r.invoiceAmount || 0), 0);
                  return (
                    <div key={s} className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-white'}`}>
                      <div>
                        <div className={isDark ? 'text-white' : 'text-slate-900'}>{s}</div>
                        <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{seasonRegatten.length} Regatten</div>
                      </div>
                      <div className={`font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{seasonTotal.toFixed(2)} €</div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <h4 className={`font-medium mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Datenbank</h4>
              <div className={`text-sm space-y-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <div>Crew-Mitglieder: {crewDatabase.length}</div>
                <div>Gelernte Patterns: {Object.keys(learnedPatterns).length}</div>
                <div>PDF-Anhänge im Speicher: {pdfAttachments.length}</div>
              </div>
              <button
                onClick={() => {
                  if (confirm('Alle lokalen Daten löschen?')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="mt-4 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 text-sm"
              >
                Alle Daten löschen
              </button>
              <button
                onClick={() => {
                  setAdminAuthenticated(false);
                  setShowAdminModal(false);
                }}
                className={`mt-2 w-full px-4 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
              >
                Admin abmelden
              </button>
            </div>
          </div>
        </Modal>
        
        <Modal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} title="Hilfe">
          <div className={`space-y-4 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            <div>
              <h4 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Ergebnislisten hochladen</h4>
              <p>Lade die Ergebnisliste als PDF hoch. Deine Platzierung wird anhand der Segelnummer automatisch erkannt.</p>
            </div>
            <div>
              <h4 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Rechnungen hochladen</h4>
              <p>Lade die Startgeld-Rechnung als PDF hoch. Der Betrag wird automatisch erkannt.</p>
            </div>
            <div>
              <h4 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Parser-Strategien</h4>
              <p>Die App erkennt automatisch verschiedene Formate (Manage2Sail, Sailti, DSV). Bei Problemen kannst du Daten manuell korrigieren.</p>
            </div>
            <div>
              <h4 className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Datenspeicherung</h4>
              <p>Alle Daten werden lokal im Browser gespeichert. Lösche den Browser-Cache, um alle Daten zu entfernen.</p>
            </div>
          </div>
        </Modal>

        {/* Footer */}
        <footer className={`border-t px-6 py-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between text-sm">
            <div className={`flex items-center gap-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className="w-5 h-5">{Icons.boat}</span>
              <span>© {new Date().getFullYear()} Tegeler Segel-Club e.V.</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://www.tegeler-segel-club.de" target="_blank" rel="noopener noreferrer" className={`${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>Website</a>
              <a href="mailto:vorstand@tegeler-segel-club.de" className={`${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>Kontakt</a>
            </div>
          </div>
        </footer>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
