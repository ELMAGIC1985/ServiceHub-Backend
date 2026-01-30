/**
 * Frontend Integration Example for Platform KPIs
 * This file demonstrates how to integrate the KPIs API with your React frontend
 */

// ==================== API Service ====================

export const kpisService = {
  /**
   * Fetch platform KPIs from the backend
   */
  getPlatformKPIs: async (accessToken) => {
    try {
      const response = await fetch('/api/v1/kpis/platform', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data; // Array of KPI objects
    } catch (error) {
      console.error('Error fetching platform KPIs:', error);
      throw error;
    }
  },

  /**
   * Fetch KPIs summary with detailed breakdown
   */
  getKPIsSummary: async (accessToken) => {
    try {
      const response = await fetch('/api/v1/kpis/summary', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data; // Summary object with metrics
    } catch (error) {
      console.error('Error fetching KPIs summary:', error);
      throw error;
    }
  },
};

// ==================== React Component Example ====================

import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, Users, CheckCircle, Star, TrendingUp, AlertCircle } from 'lucide-react';

// Icon mapping
const iconMap = {
  DollarSign,
  Clock,
  Users,
  CheckCircle,
  Star,
  TrendingUp,
};

export const PlatformKPIsCard = ({ kpi }) => {
  const IconComponent = iconMap[kpi.icon];

  return (
    <div className="rounded-lg p-6 shadow-md" style={{ backgroundColor: kpi.bgColor }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-800 font-semibold text-sm">{kpi.title}</h3>
        {IconComponent && <IconComponent size={24} style={{ color: kpi.color }} className="flex-shrink-0" />}
      </div>

      <div className="mb-3">
        <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`px-2 py-1 rounded text-xs font-semibold ${
            kpi.trend === 'up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {kpi.trend === 'up' ? '↑' : '↓'} {kpi.change}
        </div>
        <span className="text-xs text-gray-600">vs last month</span>
      </div>
    </div>
  );
};

export const PlatformKPIsDashboard = ({ accessToken }) => {
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        setLoading(true);
        const data = await kpisService.getPlatformKPIs(accessToken);
        setKpis(data);
        setError(null);
      } catch (err) {
        console.error('Error:', err);
        setError(err.message || 'Failed to fetch KPIs');
        setKpis([]);
      } finally {
        setLoading(false);
      }
    };

    if (accessToken) {
      fetchKPIs();
    }
  }, [accessToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-gray-600">Loading KPIs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle size={20} className="text-red-600" />
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Platform KPIs</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xl:gap-6">
        {kpis.map((kpi) => (
          <PlatformKPIsCard key={kpi.title} kpi={kpi} />
        ))}
      </div>

      {/* Optional: Display last updated time */}
      <div className="mt-4 text-right text-xs text-gray-500">Last updated: {new Date().toLocaleString()}</div>
    </div>
  );
};

// ==================== Usage in Parent Component ====================

export const Dashboard = ({ accessToken }) => {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <PlatformKPIsDashboard accessToken={accessToken} />
      {/* Other dashboard components */}
    </div>
  );
};

// ==================== Alternative Hook for KPIs ====================

/**
 * Custom hook for fetching platform KPIs
 */
export const usePlatformKPIs = (accessToken) => {
  const [kpis, setKpis] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchKPIs = async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);
      const data = await kpisService.getPlatformKPIs(accessToken);
      setKpis(data);
    } catch (err) {
      setError(err);
      console.error('Error fetching KPIs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);
      const data = await kpisService.getKPIsSummary(accessToken);
      setSummary(data);
    } catch (err) {
      setError(err);
      console.error('Error fetching KPIs summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
    // Optional: Set up auto-refresh every 5 minutes
    const interval = setInterval(fetchKPIs, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [accessToken]);

  return {
    kpis,
    summary,
    loading,
    error,
    refreshKPIs: fetchKPIs,
    refreshSummary: fetchSummary,
  };
};

// ==================== Usage Example ====================

/**
 * Example usage in a component:
 *
 * function MyDashboard() {
 *   const { kpis, loading, error, refreshKPIs } = usePlatformKPIs(accessToken);
 *
 *   return (
 *     <div>
 *       {loading && <p>Loading...</p>}
 *       {error && <p>Error: {error.message}</p>}
 *       {!loading && !error && (
 *         <div>
 *           {kpis.map(kpi => (
 *             <PlatformKPIsCard key={kpi.title} kpi={kpi} />
 *           ))}
 *           <button onClick={refreshKPIs}>Refresh</button>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 */
