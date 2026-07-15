'use client';

import React, { useState } from 'react';
import { useAnalysis } from '../context/AnalysisContext';
import UploadZone from '../components/upload-zone';
import DashboardCharts from '../components/dashboard-charts';
import TransactionFlow from '../components/transaction-flow';
import { ApiClient, WebhookTransaction } from '../lib/api';
import { 
  Activity, AlertTriangle, CheckCircle, XCircle, Users, 
  Search, ArrowDown, ArrowUp, Download, Eye, Sparkles, LogOut, Terminal, AlertCircle
} from 'lucide-react';

type TabType = 'dashboard' | 'transactions' | 'recommendations' | 'upload';

export default function Home() {
  const { report, clearReport } = useAnalysis();
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [facilityFilter, setFacilityFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof WebhookTransaction>('startTime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected Transaction for Drawer/Modal
  const [selectedTx, setSelectedTx] = useState<WebhookTransaction | null>(null);

  // Transition to dashboard when report is loaded
  React.useEffect(() => {
    if (report) {
      setActiveTab('dashboard');
    } else {
      setActiveTab('upload');
    }
  }, [report]);

  if (!report) {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Top Premium Navbar */}
        <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                <Terminal className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
                  PointClickCare Webhook Log Analyzer
                </h1>
                <p className="text-slate-400 text-xs">Production Grade Correlation & Diagnostics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-400 font-medium">Service Online</span>
            </div>
          </div>
        </header>

        {/* Upload Landing Body */}
        <main className="flex-1 flex flex-col justify-center px-6 py-12 max-w-4xl mx-auto w-full">
          <div className="text-center space-y-4 mb-8">
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Standard Operations Review</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-100">
              Audit PCC Webhook Logs Automatically
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Ingest logs spanning 300 to 1000+ pages. Our engine aggregates processing streams, evaluates SLAs, matches patient records, and flags logical timeouts and hangs in real-time.
            </p>
          </div>

          <UploadZone />
        </main>
      </div>
    );
  }

  // Handle pagination and filtering
  const handleSort = (field: keyof WebhookTransaction) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredTransactions = report.transactions.filter(tx => {
    // 1. Search filter
    const matchesSearch = 
      tx.webhookId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.patientId && tx.patientId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tx.facilityId && tx.facilityId.toLowerCase().includes(searchTerm.toLowerCase()));

    // 2. Status filter
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;

    // 3. Event Type filter
    const matchesType = typeFilter === 'all' || tx.eventType === typeFilter;

    // 4. Facility filter
    const matchesFacility = facilityFilter === 'all' || tx.facilityId === facilityFilter;

    return matchesSearch && matchesStatus && matchesType && matchesFacility;
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal === undefined) return 1;
    if (bVal === undefined) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });

  // Paginated Results
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + itemsPerPage);

  // List of unique event types and facilities for filters
  const uniqueEventTypes = Object.keys(report.eventTypes);
  const uniqueFacilities = report.facilitiesAffected;

  const handleExport = (format: 'excel' | 'csv' | 'html') => {
    const url = ApiClient.getExportUrl(report.reportId, format);
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 pb-12">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
                PCC Webhook Log Analyzer
              </h1>
              <p className="text-slate-500 text-xxs">Report ID: <span className="font-mono text-slate-400">{report.reportId}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Export Actions */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => handleExport('excel')}
                className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-850 rounded text-xs font-semibold text-slate-300 transition duration-150"
                title="Download Excel Spreadsheet"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Excel</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-850 rounded text-xs font-semibold text-slate-300 transition duration-150"
                title="Download CSV Table"
              >
                <Download className="h-3.5 w-3.5 text-blue-400" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={() => handleExport('html')}
                className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-850 rounded text-xs font-semibold text-slate-300 transition duration-150"
                title="Open Interactive HTML Report"
              >
                <Download className="h-3.5 w-3.5 text-indigo-400" />
                <span>Print PDF/HTML</span>
              </button>
            </div>

            <button
              onClick={clearReport}
              className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition duration-200"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Unload</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Core Body */}
      <main className="max-w-7xl mx-auto px-6 py-6 w-full space-y-6">
        {/* Statistics Panels */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass-panel p-4.5 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xxs font-semibold uppercase tracking-wider text-slate-500">Transactions</p>
              <p className="text-2xl font-bold text-slate-100">{report.transactions.length}</p>
            </div>
          </div>

          <div className="glass-panel p-4.5 rounded-xl flex items-center gap-4 border-l-4 border-l-emerald-500">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xxs font-semibold uppercase tracking-wider text-slate-500">Successful Runs</p>
              <p className="text-2xl font-bold text-emerald-450">
                {report.transactions.filter(tx => tx.status === 'success' || tx.status === 'warning').length}
              </p>
            </div>
          </div>

          <div className="glass-panel p-4.5 rounded-xl flex items-center gap-4 border-l-4 border-l-red-500">
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xxs font-semibold uppercase tracking-wider text-slate-500">Errors Detected</p>
              <p className="text-2xl font-bold text-red-500">{report.errorsCount}</p>
            </div>
          </div>

          <div className="glass-panel p-4.5 rounded-xl flex items-center gap-4 border-l-4 border-l-amber-500">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xxs font-semibold uppercase tracking-wider text-slate-500">Warnings Raised</p>
              <p className="text-2xl font-bold text-amber-500">{report.warningsCount}</p>
            </div>
          </div>

          <div className="glass-panel p-4.5 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xxs font-semibold uppercase tracking-wider text-slate-500">Patients Review</p>
              <p className="text-2xl font-bold text-slate-100">{report.patientsAffected.length}</p>
            </div>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-slate-800 gap-1.5 scrollbar-thin overflow-x-auto pb-px">
          {(['dashboard', 'transactions', 'recommendations'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 border-b-2 font-semibold text-sm capitalize transition duration-200 whitespace-nowrap ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-950/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
              }`}
            >
              {tab === 'recommendations' ? 'Actionable Issues & AI Summary' : tab === 'transactions' ? 'Transactions Log' : tab}
            </button>
          ))}
        </div>

        {/* Active Tab Panel Body */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Auxiliary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-900 flex justify-between items-center">
                <span className="text-xs text-slate-400">Total Log Lines Parsed</span>
                <strong className="text-slate-200 text-sm font-mono">{report.totalEvents}</strong>
              </div>
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-900 flex justify-between items-center">
                <span className="text-xs text-slate-400">Active Facilities</span>
                <strong className="text-slate-200 text-sm font-mono">{report.facilitiesAffected.length}</strong>
              </div>
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-900 flex justify-between items-center">
                <span className="text-xs text-slate-400">Census Services Runs</span>
                <strong className="text-slate-200 text-sm font-mono">{report.censusUpdatesCount}</strong>
              </div>
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-900 flex justify-between items-center">
                <span className="text-xs text-slate-400">Forecast Syncs</span>
                <strong className="text-slate-200 text-sm font-mono">{report.forecastUpdatesCount}</strong>
              </div>
            </div>

            <DashboardCharts report={report} />
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden space-y-4 p-5">
            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search Patient, Facility, or Webhook ID..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success Only</option>
                  <option value="warning">Anomaly Only</option>
                  <option value="error">Failure Only</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Flow Types</option>
                  {uniqueEventTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Facility Filter */}
              <div>
                <select
                  value={facilityFilter}
                  onChange={(e) => { setFacilityFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Facilities</option>
                  {uniqueFacilities.map(fac => (
                    <option key={fac} value={fac}>{fac}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto border border-slate-800/80 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-slate-800 text-xxs font-bold uppercase tracking-wider text-slate-400">
                    <th onClick={() => handleSort('webhookId')} className="px-5 py-3 cursor-pointer hover:bg-slate-800/40 select-none">
                      <div className="flex items-center gap-1">
                        <span>Webhook ID</span>
                        {sortField === 'webhookId' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('eventType')} className="px-5 py-3 cursor-pointer hover:bg-slate-800/40 select-none">
                      <div className="flex items-center gap-1">
                        <span>Flow Type</span>
                        {sortField === 'eventType' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('patientId')} className="px-5 py-3 cursor-pointer hover:bg-slate-800/40 select-none">
                      <div className="flex items-center gap-1">
                        <span>Patient</span>
                        {sortField === 'patientId' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('facilityId')} className="px-5 py-3 cursor-pointer hover:bg-slate-800/40 select-none">
                      <div className="flex items-center gap-1">
                        <span>Facility</span>
                        {sortField === 'facilityId' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('startTime')} className="px-5 py-3 cursor-pointer hover:bg-slate-800/40 select-none">
                      <div className="flex items-center gap-1">
                        <span>Start Time</span>
                        {sortField === 'startTime' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('duration')} className="px-5 py-3 cursor-pointer hover:bg-slate-800/40 select-none">
                      <div className="flex items-center gap-1">
                        <span>Duration</span>
                        {sortField === 'duration' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('status')} className="px-5 py-3 cursor-pointer hover:bg-slate-800/40 select-none">
                      <div className="flex items-center gap-1">
                        <span>Status</span>
                        {sortField === 'status' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs">
                  {paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((tx) => (
                      <tr key={tx.webhookId} className="hover:bg-slate-900/30 transition duration-150">
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-300 max-w-[150px] truncate" title={tx.webhookId}>
                          {tx.webhookId}
                        </td>
                        <td className="px-5 py-3 text-indigo-400 font-semibold">{tx.eventType}</td>
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-300">{tx.patientId || <span className="text-slate-600">N/A</span>}</td>
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-300">
                          {tx.facilityId ? (
                            <span>
                              {tx.facilityId}
                              {tx.pccFacilityId && (
                                <span className="text-[10px] text-slate-500 ml-1.5 font-normal">
                                  (PCC: {tx.pccFacilityId})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-600">N/A</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-400">{tx.startTime}</td>
                        <td className="px-5 py-3 text-slate-300 font-medium font-mono">{tx.duration} ms</td>
                        <td className="px-5 py-3">
                           <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                             tx.status === 'error'
                               ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                               : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                           }`}>
                             {tx.status === 'error' ? 'Failed' : 'Success'}
                           </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="inline-flex items-center gap-1 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 hover:border-transparent px-2.5 py-1 rounded text-xxs font-bold transition duration-200"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Inspect Trace</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                        No transactions match your search filter settings.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center text-xs text-slate-400 pt-2">
                <div>
                  Showing <span className="font-semibold text-slate-200">{startIndex + 1}</span> to{' '}
                  <span className="font-semibold text-slate-200">
                    {Math.min(startIndex + itemsPerPage, filteredTransactions.length)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-200">{filteredTransactions.length}</span> records
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-30 transition duration-150"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-30 transition duration-150"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Executive Summary & Recommendation Actions */}
            <div className="lg:col-span-2 space-y-6">
              {/* Executive Summary */}
              <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 font-bold border-b border-slate-800 pb-3">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  <h3 className="text-md">AI Insights & Executive Summary</h3>
                </div>
                <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {report.aiSummary.executiveSummary}
                </div>
              </div>

              {/* Action Recommendations */}
              <div className="glass-panel p-6 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold border-b border-slate-800 pb-3">
                  <CheckCircle className="h-5 w-5" />
                  <h3 className="text-md">Recommended Engineering Actions</h3>
                </div>
                <ul className="space-y-3">
                  {report.aiSummary.recommendedActions.map((action, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-lg border border-slate-900">
                      <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
                        {i + 1}
                      </span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Col: Issues Lists */}
            <div className="space-y-6">
              {/* Problematic Facilities */}
              <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-300 text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
                  Problematic Environments
                </h4>
                <ul className="space-y-2">
                  {report.aiSummary.facilitiesWithProblems.length > 0 ? (
                    report.aiSummary.facilitiesWithProblems.map((fac, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-xs text-slate-300 bg-slate-950/20 p-2.5 rounded-lg border border-slate-900">
                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        <span className="font-mono">{fac}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-slate-500 py-2">All facilities operating smoothly.</li>
                  )}
                </ul>
              </div>

              {/* Critical Anomalies (ADT / Census / Forecast) */}
              <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-red-400 text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
                  Census & Sync Anomalies
                </h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {report.aiSummary.censusAnomalies.length > 0 || report.aiSummary.forecastAnomalies.length > 0 ? (
                    <>
                      {report.aiSummary.censusAnomalies.map((anom, i) => (
                        <div key={`c-${i}`} className="p-2.5 bg-red-950/15 border border-red-500/20 rounded-lg text-xxs text-red-300 space-y-1">
                          <p className="font-bold uppercase text-[9px] text-red-400 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>Census Sync Exception</span>
                          </p>
                          <p className="leading-relaxed">{anom}</p>
                        </div>
                      ))}
                      {report.aiSummary.forecastAnomalies.map((anom, i) => (
                        <div key={`f-${i}`} className="p-2.5 bg-red-950/15 border border-red-500/20 rounded-lg text-xxs text-red-300 space-y-1">
                          <p className="font-bold uppercase text-[9px] text-red-400 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>Forecast Recalculation Hang</span>
                          </p>
                          <p className="leading-relaxed">{anom}</p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 py-2">No sync anomalies recorded.</p>
                  )}
                </div>
              </div>

              {/* Duplicate Webhook alerts */}
              <div className="glass-panel p-5 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-amber-400 text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
                  Redundancy & Retries
                </h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {report.aiSummary.duplicateWebhookDetection.length > 0 ? (
                    report.aiSummary.duplicateWebhookDetection.map((dup, i) => (
                      <div key={i} className="p-2.5 bg-amber-950/15 border border-amber-500/20 rounded-lg text-xxs text-amber-300 space-y-1">
                        <p className="font-bold uppercase text-[9px] text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Duplicate Received</span>
                        </p>
                        <p className="leading-relaxed">{dup}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 py-2">No duplicate payloads flagged.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Slide-over Detailed Inspection Drawer Overlay */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div 
              onClick={() => setSelectedTx(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300"
            />
            
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <div className="pointer-events-auto w-screen max-w-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-800 bg-slate-950 text-slate-100 flex flex-col shadow-2xl h-full">
                
                {/* Drawer Header */}
                <div className="border-b border-slate-800 px-6 py-5 flex items-center justify-between bg-slate-900/40">
                  <h2 className="text-md font-bold text-slate-200" id="slide-over-title">
                    Transaction Execution Trace
                  </h2>
                  <button
                    onClick={() => setSelectedTx(null)}
                    className="rounded-lg p-1.5 hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition duration-150 focus:outline-none"
                  >
                    <span className="sr-only">Close panel</span>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
                  <TransactionFlow transaction={selectedTx} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
