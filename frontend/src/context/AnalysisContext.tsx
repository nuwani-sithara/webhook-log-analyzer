'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ApiClient, AnalysisReport } from '../lib/api';

interface AnalysisContextType {
  report: AnalysisReport | null;
  isLoading: boolean;
  error: string | null;
  setReport: (report: AnalysisReport | null) => void;
  uploadFile: (file: File, geminiApiKey?: string, knownFacilities?: string[]) => Promise<void>;
  loadDemo: (pages: number, geminiApiKey?: string) => Promise<void>;
  clearReport: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File, geminiApiKey?: string, knownFacilities?: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ApiClient.uploadAndAnalyze(file, geminiApiKey, knownFacilities);
      setReport(data);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'An error occurred while uploading and analyzing the PDF.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loadDemo = async (pages: number, geminiApiKey?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ApiClient.generateAndAnalyzeDemo(pages, geminiApiKey);
      setReport(data);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'An error occurred during demo generation.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearReport = () => {
    setReport(null);
    setError(null);
  };

  return (
    <AnalysisContext.Provider
      value={{
        report,
        isLoading,
        error,
        setReport,
        uploadFile,
        loadDemo,
        clearReport,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
}
