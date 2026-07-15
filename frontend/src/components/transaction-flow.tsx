'use client';

import React, { useState } from 'react';
import { WebhookTransaction } from '../lib/api';
import { Clock, AlertTriangle, XCircle, CheckCircle, User, MapPin, Layers, FileText, ChevronRight, ChevronDown } from 'lucide-react';

interface TransactionFlowProps {
  transaction: WebhookTransaction;
}

export default function TransactionFlow({ transaction }: TransactionFlowProps) {
  const [openJsonIndices, setOpenJsonIndices] = useState<Record<number, boolean>>({});

  const toggleJson = (idx: number) => {
    setOpenJsonIndices(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const getRelativeOffset = (currentTs: string, startTs: string): string => {
    try {
      const offset = new Date(currentTs).getTime() - new Date(startTs).getTime();
      if (offset < 0) return '+0ms';
      if (offset < 1000) return `+${offset}ms`;
      return `+${(offset / 1000).toFixed(2)}s`;
    } catch {
      return '+0ms';
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
            <CheckCircle className="h-3 w-3" />
            <span>Success</span>
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
            <CheckCircle className="h-3 w-3" />
            <span>Success (Warning)</span>
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
            <XCircle className="h-3 w-3" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
            <Clock className="h-3 w-3" />
            <span>Processing</span>
          </span>
        );
    }
  };

  const renderAdtBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return (
          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md text-xxs font-medium uppercase tracking-wider">
            ADT Matched
          </span>
        );
      case 'fallback':
        return (
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md text-xxs font-medium uppercase tracking-wider">
            ADT Fallback
          </span>
        );
      case 'missing':
        return (
          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-md text-xxs font-medium uppercase tracking-wider">
            ADT Missing
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Transaction Summary Card */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-200 text-sm font-semibold tracking-tight">
                ID: {transaction.webhookId}
              </span>
              {renderStatusBadge(transaction.status)}
            </div>
            <p className="text-xs text-slate-400">
              Flow type: <span className="text-indigo-400 font-semibold">{transaction.eventType}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              <span>Duration: <strong className="text-slate-200">{transaction.duration} ms</strong></span>
            </div>
          </div>
        </div>

        {/* Entities and Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
            <User className="h-4 w-4 text-indigo-400 flex-shrink-0" />
            <div className="truncate">
              <p className="text-xxs font-semibold uppercase text-slate-500">Patient</p>
              <p className="font-mono text-slate-200 truncate">{transaction.patientId || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
            <MapPin className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <div className="truncate">
              <p className="text-xxs font-semibold uppercase text-slate-500">Facility</p>
              <p className="font-mono text-slate-200 truncate">
                {transaction.facilityId || 'N/A'}
                {transaction.pccFacilityId && (
                  <span className="text-[10px] text-slate-500 font-normal ml-1">
                    (PCC: {transaction.pccFacilityId})
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
            <Layers className="h-4 w-4 text-violet-400 flex-shrink-0" />
            <div>
              <p className="text-xxs font-semibold uppercase text-slate-500">ADT Resolution</p>
              <div className="mt-0.5">{renderAdtBadge(transaction.adtMatchStatus) || <span className="text-slate-500">N/A</span>}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
            <FileText className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-xxs font-semibold uppercase text-slate-500">API Calls</p>
              <p className="font-bold text-slate-200">{transaction.apisCalled.length}</p>
            </div>
          </div>
        </div>

        {/* Global Warnings / Errors inside summary */}
        {transaction.errors.length > 0 && (
          <div className="mt-4 bg-red-950/20 border border-red-500/20 p-3 rounded-lg text-xs space-y-1">
            <p className="font-bold text-red-400 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              <span>Diagnostic Failure Reasons:</span>
            </p>
            <ul className="list-disc pl-5 text-red-300/90 space-y-0.5">
              {transaction.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        {transaction.warnings.length > 0 && (
          <div className="mt-3 bg-amber-950/20 border border-amber-500/20 p-3 rounded-lg text-xs space-y-1">
            <p className="font-bold text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Anomalies Flagged:</span>
            </p>
            <ul className="list-disc pl-5 text-amber-300/90 space-y-0.5">
              {transaction.warnings.map((warn, i) => <li key={i}>{warn}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Vertical Waterfall Timeline */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider mb-2 -ml-6">Sequential Execution Trace</h4>
        
        {transaction.logs.map((log, idx) => {
          const isError = log.level === 'ERROR';
          const isWarn = log.level === 'WARN';
          const offset = getRelativeOffset(log.timestamp, transaction.startTime);
          
          return (
            <div key={idx} className="relative group">
              {/* Connector dot */}
              <span className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-4 border-slate-950 transition duration-300 group-hover:scale-110 ${
                isError 
                  ? 'bg-red-500' 
                  : isWarn 
                    ? 'bg-amber-500' 
                    : log.eventType === 'PCC API Request' 
                      ? 'bg-indigo-500' 
                      : 'bg-slate-600'
              }`} />

              <div className="glass-panel p-3.5 rounded-xl border border-slate-800/60 hover:border-slate-700/80 transition duration-200">
                {/* Log Event Metadata */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xxs font-semibold mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-indigo-400 text-xs">{offset}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xxs font-extrabold uppercase ${
                      isError 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                        : isWarn 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {log.level}
                    </span>
                    {log.eventType && (
                      <span className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                        {log.eventType}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 font-normal">
                    Page {log.page} • Line {log.lineNum}
                  </span>
                </div>

                {/* Log Line Content */}
                <p className={`text-xs font-mono break-all ${isError ? 'text-red-300' : isWarn ? 'text-amber-300' : 'text-slate-200'}`}>
                  {log.message}
                </p>

                {/* Collapsible JSON Viewer */}
                {log.rawJson && (
                  <div className="mt-2 text-xs">
                    <button
                      onClick={() => toggleJson(idx)}
                      className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition font-medium"
                    >
                      {openJsonIndices[idx] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <span>{openJsonIndices[idx] ? 'Hide Payload' : 'Inspect JSON Payload'}</span>
                    </button>

                    {openJsonIndices[idx] && (
                      <pre className="mt-2 p-3 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-mono text-indigo-300 overflow-x-auto max-h-60 leading-relaxed">
                        {JSON.stringify(JSON.parse(log.rawJson), null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
