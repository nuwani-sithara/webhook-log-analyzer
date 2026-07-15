'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { AnalysisReport } from '../lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardChartsProps {
  report: AnalysisReport;
}

export default function DashboardCharts({ report }: DashboardChartsProps) {
  // Chart Colors System
  const colors = {
    indigo: 'rgba(99, 102, 241, 0.75)',
    indigoBorder: 'rgba(99, 102, 241, 1)',
    emerald: 'rgba(16, 185, 129, 0.75)',
    emeraldBorder: 'rgba(16, 185, 129, 1)',
    amber: 'rgba(245, 158, 11, 0.75)',
    amberBorder: 'rgba(245, 158, 11, 1)',
    rose: 'rgba(239, 68, 68, 0.75)',
    roseBorder: 'rgba(239, 68, 68, 1)',
    violet: 'rgba(139, 92, 246, 0.75)',
    violetBorder: 'rgba(139, 92, 246, 1)',
    slateGrid: 'rgba(255, 255, 255, 0.05)',
    slateText: '#94a3b8'
  };

  // Base options for bar/line charts
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
      }
    },
    scales: {
      x: {
        grid: {
          color: colors.slateGrid,
        },
        ticks: {
          color: colors.slateText,
          font: { size: 10 }
        }
      },
      y: {
        grid: {
          color: colors.slateGrid,
        },
        ticks: {
          color: colors.slateText,
          font: { size: 10 }
        }
      }
    }
  };

  // 1. Events by Type Chart
  const eventsByTypeData = {
    labels: report.charts.eventsByType.labels,
    datasets: [
      {
        data: report.charts.eventsByType.data,
        backgroundColor: [
          colors.indigo,
          colors.violet,
          colors.emerald,
          colors.amber,
          colors.rose,
          'rgba(14, 165, 233, 0.75)',
          'rgba(236, 72, 153, 0.75)',
          'rgba(100, 116, 139, 0.75)'
        ],
        borderColor: 'rgba(15, 23, 42, 0.8)',
        borderWidth: 2,
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: colors.slateText,
          boxWidth: 12,
          font: { size: 10 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
      }
    }
  };

  // 2. Errors by Facility
  const errorsByFacilityData = {
    labels: report.charts.errorsByFacility.labels.length > 0 ? report.charts.errorsByFacility.labels : ['No Errors'],
    datasets: [
      {
        data: report.charts.errorsByFacility.data.length > 0 ? report.charts.errorsByFacility.data : [0],
        backgroundColor: colors.rose,
        borderColor: colors.roseBorder,
        borderWidth: 1.5,
        borderRadius: 4,
      }
    ]
  };

  // 3. Warnings by Day
  const warningsByDayData = {
    labels: report.charts.warningsByDay.labels.length > 0 ? report.charts.warningsByDay.labels : ['No Data'],
    datasets: [
      {
        fill: true,
        data: report.charts.warningsByDay.data.length > 0 ? report.charts.warningsByDay.data : [0],
        borderColor: colors.amberBorder,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderWidth: 2,
        tension: 0.3,
        pointBackgroundColor: colors.amberBorder,
        pointHoverRadius: 6,
      }
    ]
  };

  // 4. Processing SLA (histogram)
  const processingSlaData = {
    labels: report.charts.processingDurationHistogram.labels,
    datasets: [
      {
        data: report.charts.processingDurationHistogram.data,
        backgroundColor: colors.emerald,
        borderColor: colors.emeraldBorder,
        borderWidth: 1.5,
        borderRadius: 4,
      }
    ]
  };

  // 5. API Usage (Horizontal Bar)
  const apiUsageData = {
    labels: report.charts.apiUsage.labels,
    datasets: [
      {
        data: report.charts.apiUsage.data,
        backgroundColor: colors.indigo,
        borderColor: colors.indigoBorder,
        borderWidth: 1.5,
        borderRadius: 4,
      }
    ]
  };

  const horizontalBarOptions = {
    ...baseOptions,
    indexAxis: 'y' as const,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      {/* Event Types Distribution */}
      <div className="glass-panel p-5 rounded-xl flex flex-col h-80">
        <h3 className="font-semibold text-slate-300 text-sm mb-4">Webhook Event Distribution</h3>
        <div className="flex-1 relative">
          <Doughnut data={eventsByTypeData} options={doughnutOptions} />
        </div>
      </div>

      {/* Errors by Facility */}
      <div className="glass-panel p-5 rounded-xl flex flex-col h-80">
        <h3 className="font-semibold text-slate-300 text-sm mb-4">Error Volumetrics by Facility</h3>
        <div className="flex-1 relative">
          <Bar data={errorsByFacilityData} options={baseOptions} />
        </div>
      </div>

      {/* Warnings Trend */}
      <div className="glass-panel p-5 rounded-xl flex flex-col h-80 lg:col-span-2">
        <h3 className="font-semibold text-slate-300 text-sm mb-4">Warnings and Anomaly Trend Lines (Daily)</h3>
        <div className="flex-1 relative">
          <Line data={warningsByDayData} options={baseOptions} />
        </div>
      </div>

      {/* Webhook Processing Duration SLA */}
      <div className="glass-panel p-5 rounded-xl flex flex-col h-80">
        <h3 className="font-semibold text-slate-300 text-sm mb-4">Webhook Processing Duration (SLA Buckets)</h3>
        <div className="flex-1 relative">
          <Bar data={processingSlaData} options={baseOptions} />
        </div>
      </div>

      {/* API Usage Rates */}
      <div className="glass-panel p-5 rounded-xl flex flex-col h-80">
        <h3 className="font-semibold text-slate-300 text-sm mb-4">Top 10 Downstream PCC API Calls</h3>
        <div className="flex-1 relative">
          <Bar data={apiUsageData} options={horizontalBarOptions} />
        </div>
      </div>
    </div>
  );
}
