'use client';

import React, { useState, useRef } from 'react';
import { useAnalysis } from '../context/AnalysisContext';
import { FileUp, Key, Building2, Sliders, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';

export default function UploadZone() {
  const { uploadFile, loadDemo, isLoading, error } = useAnalysis();
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [customFacilities, setCustomFacilities] = useState('');
  const [demoLoadingSize, setDemoLoadingSize] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.pdf')) {
        setFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!file) return;
    const facilitiesList = customFacilities
      ? customFacilities.split(',').map(f => f.trim()).filter(Boolean)
      : undefined;

    try {
      await uploadFile(file, apiKey || undefined, facilitiesList);
    } catch {
      // Handled in context
    }
  };

  const handleLoadDemo = async (pages: number) => {
    setDemoLoadingSize(pages);
    try {
      await loadDemo(pages, apiKey || undefined);
    } catch {
      // Handled in context
    } finally {
      setDemoLoadingSize(null);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Upload Box */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={!file && !isLoading ? triggerFileInput : undefined}
        className={`glass-panel border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative overflow-hidden ${
          isDragActive 
            ? 'border-indigo-500 bg-indigo-950/20 scale-[1.01]' 
            : 'border-slate-700 hover:border-slate-500 hover:bg-slate-900/30'
        } ${file ? 'cursor-default' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={isLoading}
        />

        {isLoading ? (
          <div className="py-8 flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 text-indigo-400 animate-spin" />
            <div className="space-y-1">
              <h3 className="font-semibold text-lg text-slate-200">Analyzing PDF Log File...</h3>
              <p className="text-sm text-slate-400 max-w-md">
                {demoLoadingSize 
                  ? `Simulating and parsing a ${demoLoadingSize}-page PCC log stream...`
                  : `Ingesting, correlating, and running issue rules on "${file?.name}"...`}
              </p>
            </div>
            <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full animate-[shimmer_1.5s_infinite] w-2/3" />
            </div>
          </div>
        ) : file ? (
          <div className="py-6 space-y-6 w-full max-w-md">
            <div className="flex items-center justify-center p-4 bg-indigo-950/30 rounded-xl border border-indigo-500/20 w-fit mx-auto">
              <FileUp className="h-10 w-10 text-indigo-400" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg text-slate-200 truncate">{file.name}</h3>
              <p className="text-sm text-slate-400">
                Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setFile(null)}
                className="px-4 py-2 border border-slate-700 rounded-lg hover:bg-slate-800 text-sm font-medium transition duration-200"
              >
                Clear
              </button>
              <button
                onClick={handleUpload}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow glow-btn transition duration-200 flex items-center gap-2"
              >
                Analyze Webhook Log
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 space-y-4">
            <div className="p-4 bg-slate-900/50 rounded-full border border-slate-800 w-fit mx-auto transition duration-300 hover:scale-105">
              <FileUp className="h-8 w-8 text-slate-400" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">
                Drag and drop your PCC log PDF here, or <span className="text-indigo-400 underline">browse files</span>
              </p>
              <p className="text-xs text-slate-400">Supports logs up to 1000+ pages (PDF format only)</p>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Settings Accordion */}
      {!isLoading && (
        <div className="glass-panel border border-slate-800/80 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-900/20 transition duration-200"
          >
            <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
              <Sliders className="h-4 w-4" />
              <span>Advanced Analysis Configurations</span>
            </div>
            {showAdvanced ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>

          {showAdvanced && (
            <div className="px-6 pb-6 pt-2 border-t border-slate-800/40 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gemini Key */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <Key className="h-3 w-3" />
                  <span>Gemini API Key (Optional AI Summary)</span>
                </label>
                <input
                  type="password"
                  placeholder="Paste your Google Gemini API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              {/* Known Facilities */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <Building2 className="h-3 w-3" />
                  <span>Custom Known Facility IDs (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="fac-101, fac-102, fac-103 (comma separated)"
                  value={customFacilities}
                  onChange={(e) => setCustomFacilities(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Demo Actions (Staff touch: let user click demo button to load pre-calculated data) */}
      {!isLoading && (
        <div className="flex flex-col items-center justify-center p-6 border border-indigo-950 bg-indigo-950/5 rounded-xl border-dashed">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold mb-2">
            <Sparkles className="h-4 w-4" />
            <span>Developer Mock Log Suite</span>
          </div>
          <p className="text-xs text-slate-400 text-center max-w-md mb-4">
            No PDF on hand? Spin up our log simulator directly. It generates realistic transactions and streams them to the parser.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => handleLoadDemo(10)}
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-700/50 text-indigo-200 rounded-lg text-xs font-semibold transition duration-200 flex items-center gap-1.5"
            >
              {demoLoadingSize === 10 ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              <span>Load 10-page Demo (Medium volume)</span>
            </button>
            <button
              onClick={() => handleLoadDemo(500)}
              disabled={isLoading}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold shadow-sm transition duration-200 flex items-center gap-1.5"
            >
              {demoLoadingSize === 500 ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              <span>Load 500-page Demo (Enterprise scale)</span>
            </button>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && !isLoading && (
        <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <div className="p-1.5 bg-red-500/10 rounded border border-red-500/20 text-red-400 mt-0.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-red-200">Analysis Halted</h4>
            <p className="text-xs text-red-400/90 leading-relaxed">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
