"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../../utils/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from "recharts";
import { 
  TrendingUp, Layers, CheckCircle2, ShieldAlert, ArrowRight, 
  Search, Eye, Calendar, Database, RefreshCw, LogIn 
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview"); // "overview", "enzyme", "srp", "washing"
  
  // Data states
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProcess, setFilterProcess] = useState("ALL");
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedBatchDrums, setSelectedBatchDrums] = useState({ inputs: [], outputs: [] });
  const [isLoadingDrums, setIsLoadingDrums] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch batches on mount
  const fetchBatches = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "batches"),
        orderBy("start_date", "desc"),
        limit(500)
      );
      const snap = await getDocs(q);
      const list = [];
      const April1_2026 = new Date("2026-04-01T00:00:00Z");
      
      snap.forEach((doc) => {
        const data = doc.data();
        // Only keep batches that started on or after April 1, 2026
        if (data.start_date && new Date(data.start_date) >= April1_2026) {
          list.push({ id: doc.id, ...data });
        }
      });
      setBatches(list);
    } catch (err) {
      console.error("Error fetching batches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBatches();
    setIsRefreshing(false);
  };

  // Fetch drums for selected batch in explorer
  const handleOpenExplorer = async (batch) => {
    setSelectedBatch(batch);
    setIsLoadingDrums(true);
    setSelectedBatchDrums({ inputs: [], outputs: [] });
    
    try {
      const q = query(collection(db, "drums"), where("batch_id", "==", batch.batch_id));
      const snap = await getDocs(q);
      const inputs = [];
      const outputs = [];
      
      snap.forEach((doc) => {
        const d = doc.data();
        if (d.stage === "INPUT") {
          inputs.push(d);
        } else {
          outputs.push(d);
        }
      });
      
      setSelectedBatchDrums({ inputs, outputs });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDrums(false);
    }
  };

  // Extract unique months for month filter dropdown from loaded batches (which are already filtered to >= April 2026)
  const uniqueMonths = Array.from(
    new Set(
      batches
        .filter((b) => b.start_date)
        .map((b) => new Date(b.start_date).toLocaleString("en-US", { month: "long", year: "numeric" }))
    )
  ).sort((a, b) => new Date(a) - new Date(b));

  // Filter batches
  const filteredBatches = batches.filter((b) => {
    const matchesSearch = b.batch_id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (b.raw_batch_number && b.raw_batch_number.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesProcess = filterProcess === "ALL" || b.process_type === filterProcess;
    
    const matchesMonth = filterMonth === "ALL" || (b.start_date && new Date(b.start_date).toLocaleString("en-US", { month: "long", year: "numeric" }) === filterMonth);
    
    return matchesSearch && matchesProcess && matchesMonth;
  });

  // Calculate statistics (scoped to the April 2026 onwards dataset)
  const enzymeBatches = batches.filter(b => b.process_type === "ENZYME_RXN" && b.enzyme_conversion_pct > 0);
  const avgConversion = enzymeBatches.length > 0 
    ? enzymeBatches.reduce((sum, b) => sum + b.enzyme_conversion_pct, 0) / enzymeBatches.length
    : 0;

  const srpBatches = batches.filter(b => b.process_type === "SRP" && b.heptane_loss_pct > 0);
  const avgHeptaneLoss = srpBatches.length > 0
    ? srpBatches.reduce((sum, b) => sum + b.heptane_loss_pct, 0) / srpBatches.length
    : 0;

  const totalDmmYield = srpBatches.reduce((sum, b) => sum + (b.total_output_weight || 0), 0);

  // Prepare chart data (Chronological order)
  const chartData = [...batches]
    .filter(b => b.start_date)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .map(b => ({
      date: new Date(b.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      conversion: b.process_type === "ENZYME_RXN" ? b.enzyme_conversion_pct : null,
      heptaneLoss: b.process_type === "SRP" ? b.heptane_loss_pct : null
    }));


  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative">
      {/* Background glow triggers */}
      <div className="absolute top-10 right-10 w-80 h-80 bg-mintGreen/5 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-blue-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <TrendingUp className="text-mintGreen" /> Quality & Operations Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time tracking of Enzyme Conversion, Heptane Recovery, and Drum Lineage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition"
            title="Refresh database data"
          >
            <RefreshCw size={18} className={isRefreshing ? "animate-spin-fast" : ""} />
          </button>
          
          <button
            onClick={() => router.push("/entry?role=manager")}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-mintGreen hover:from-cyan-400 hover:to-mintHover text-black font-bold rounded-xl transition shadow shadow-mintGreen/15 text-sm"
          >
            <LogIn size={16} /> Open Data Entry
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <RefreshCw className="animate-spin-fast text-mintGreen" size={40} />
          <p className="text-gray-400 text-sm font-medium">Fetching Firestore records...</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* 4. KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* KPI 1 */}
            <div className="p-6 glass-panel rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-mintGreen/40" />
              <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Avg Enzyme Conversion</p>
              <h2 className="text-3xl font-bold text-white mt-2">
                {avgConversion > 0 ? `${avgConversion.toFixed(2)}%` : "N/A"}
              </h2>
              <p className="text-xs text-mintGreen/70 mt-1 font-medium">Target: 75% ± 5% (GLR)</p>
            </div>
            
            {/* KPI 2 */}
            <div className="p-6 glass-panel rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-cyan-500/40" />
              <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Avg Heptane Loss (SRP)</p>
              <h2 className="text-3xl font-bold text-white mt-2">
                {avgHeptaneLoss > 0 ? `${avgHeptaneLoss.toFixed(2)}%` : "N/A"}
              </h2>
              <p className="text-xs text-cyan-400/70 mt-1 font-medium">Target: &lt; 7.00%</p>
            </div>

            {/* KPI 3 */}
            <div className="p-6 glass-panel rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500/40" />
              <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Total DMM Yield</p>
              <h2 className="text-3xl font-bold text-white mt-2">
                {totalDmmYield > 0 ? `${totalDmmYield.toLocaleString()} kg` : "0 kg"}
              </h2>
              <p className="text-xs text-blue-400/70 mt-1 font-medium">SRP Output Quantity</p>
            </div>

            {/* KPI 4 */}
            <div className="p-6 glass-panel rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-purple-500/40" />
              <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Active Batches logged</p>
              <h2 className="text-3xl font-bold text-white mt-2">{batches.length}</h2>
              <p className="text-xs text-purple-400/70 mt-1 font-medium">Historical & Manual</p>
            </div>
          </div>

          {/* Sub-tabs menu */}
          <div className="flex border-b border-white/5 gap-6">
            {["overview", "enzyme", "srp", "washing"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3.5 text-sm font-semibold tracking-wide capitalize relative transition-all duration-300 ${
                  activeTab === tab ? "text-mintGreen" : "text-gray-400 hover:text-white"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-mintGreen"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab content renderer */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Chart 1: Conversion */}
                  <div className="p-6 glass-panel rounded-2xl space-y-4">
                    <h3 className="text-md font-semibold text-white">Enzyme Conversion Kinetics Trend (%)</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.filter(d => d.conversion !== null)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="date" stroke="#9ca3af" tickLine={false} />
                          <YAxis domain={[60, 100]} stroke="#9ca3af" tickLine={false} />
                          <Tooltip 
                            contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} 
                            labelStyle={{ color: "#9ca3af" }}
                          />
                          <Line type="monotone" dataKey="conversion" stroke="#66fcf1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Heptane loss */}
                  <div className="p-6 glass-panel rounded-2xl space-y-4">
                    <h3 className="text-md font-semibold text-white">Solvent Recovery (Heptane) Loss Trend (%)</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.filter(d => d.heptaneLoss !== null)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="date" stroke="#9ca3af" tickLine={false} />
                          <YAxis domain={[0, 15]} stroke="#9ca3af" tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                            labelStyle={{ color: "#9ca3af" }}
                          />
                          <Line type="monotone" dataKey="heptaneLoss" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic process tabs are filtered inside the main data table below */}
              <div className="glass-panel rounded-2xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Database size={18} className="text-mintGreen" /> Logbook Batches Records
                  </h3>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                        <Search size={16} />
                      </span>
                      <input
                        type="text"
                        placeholder="Search Batch ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 text-xs rounded-xl glass-input w-48"
                      />
                    </div>
                    
                    <select
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="px-3 py-2 text-xs rounded-xl glass-input bg-black/40"
                    >
                      <option value="ALL">All Months</option>
                      {uniqueMonths.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    
                    <select
                      value={filterProcess}
                      onChange={(e) => setFilterProcess(e.target.value)}
                      className="px-3 py-2 text-xs rounded-xl glass-input bg-black/40"
                    >
                      <option value="ALL">All Processes</option>
                      <option value="ENZYME_RXN">Enzyme Reactions</option>
                      <option value="SRP">SRP Recovers</option>
                      <option value="WASHING">Washing Checks</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-400 uppercase border-b border-white/5 bg-white/2">
                      <tr>
                        <th className="py-3 px-4">Batch ID</th>
                        <th className="py-3 px-4">Process</th>
                        <th className="py-3 px-4">Start Date</th>
                        <th className="py-3 px-4 text-right">Input Weight (kg)</th>
                        <th className="py-3 px-4 text-right">Output Weight (kg)</th>
                        <th className="py-3 px-4 text-right">Weight Loss (kg)</th>
                        <th className="py-3 px-4 text-right">Enzyme Conv (%)</th>
                        <th className="py-3 px-4 text-right">Hep Loss (%)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Trace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredBatches
                        .filter(b => activeTab === "overview" || b.process_type === (
                          activeTab === "enzyme" ? "ENZYME_RXN" : 
                          activeTab === "srp" ? "SRP" : "WASHING"
                        ))
                        .map((batch) => {
                          const isDeviated = batch.process_type === "ENZYME_RXN" 
                            ? batch.enzyme_conversion_pct > 0 && (batch.enzyme_conversion_pct < 70 || batch.enzyme_conversion_pct > 80)
                            : batch.heptane_loss_pct > 7;

                          return (
                            <tr 
                              key={batch.id} 
                              className={`hover:bg-white/5 transition-colors ${isDeviated ? 'bg-deviationRed/40 border-l-2 border-l-red-500' : ''}`}
                            >
                              <td className="py-3.5 px-4 font-semibold text-white font-mono">{batch.raw_batch_number || batch.batch_id}</td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  batch.process_type === "ENZYME_RXN" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20" :
                                  batch.process_type === "SRP" ? "bg-sky-950/40 text-sky-400 border border-sky-500/20" :
                                  "bg-purple-950/40 text-purple-400 border border-purple-500/20"
                                }`}>
                                  {batch.process_type === "ENZYME_RXN" ? "GLR Enzyme" :
                                   batch.process_type === "SRP" ? "SRP Distill" : "Neutral Washing"}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-gray-400 flex items-center gap-1.5 text-xs">
                                  <Calendar size={12} />
                                  {batch.start_date ? new Date(batch.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-semibold">{batch.total_input_weight ? batch.total_input_weight.toFixed(1) : "0.0"}</td>
                              <td className="py-3.5 px-4 text-right font-mono font-semibold">{batch.total_output_weight ? batch.total_output_weight.toFixed(1) : "0.0"}</td>
                              <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-400">
                                {batch.total_input_weight && batch.total_output_weight ? Math.max(0, batch.total_input_weight - batch.total_output_weight).toFixed(1) : "0.0"}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-mintGreen">
                                {batch.process_type === "ENZYME_RXN"
                                  ? (batch.enzyme_conversion_pct > 0 ? `${batch.enzyme_conversion_pct.toFixed(2)}%` : "0.00%")
                                  : "-"}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-bold text-cyan-400">
                                {batch.process_type !== "ENZYME_RXN"
                                  ? (batch.heptane_loss_pct > 0 ? `${batch.heptane_loss_pct.toFixed(2)}%` : "0.00%")
                                  : "-"}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {isDeviated ? (
                                  <span className="text-red-400 flex items-center justify-center gap-1 text-xs font-semibold">
                                    <ShieldAlert size={14} /> Deviation
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 flex items-center justify-center gap-1 text-xs font-semibold">
                                    <CheckCircle2 size={14} /> Compliant
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  onClick={() => handleOpenExplorer(batch)}
                                  className="p-1.5 hover:bg-white/10 rounded-lg text-mintGreen transition"
                                  title="Inspect drum logs"
                                >
                                  <Eye size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}

      {/* 5. Drum Explorer Modal Drawer */}
      <AnimatePresence>
        {selectedBatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            {/* Overlay backdrop click closes modal */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBatch(null)}
              className="absolute inset-0 bg-black"
            />
            
            {/* Modal drawer container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl h-screen bg-[#07080b] border-l border-white/5 p-8 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white font-mono">🔍 Drum Explorer</h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Batch ID: <span className="font-semibold text-mintGreen">{selectedBatch.raw_batch_number || selectedBatch.batch_id}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedBatch(null)}
                    className="p-2 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition"
                  >
                    Close
                  </button>
                </div>

                {isLoadingDrums ? (
                  <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <RefreshCw className="animate-spin-fast text-mintGreen" size={32} />
                    <p className="text-gray-400 text-xs">Loading drum details...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Batch metadata details */}
                    <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-4">
                      <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">📋 Batch Run Details</h3>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-gray-500 font-medium">Start Date</p>
                          <p className="text-white font-semibold">{selectedBatch.start_date ? new Date(selectedBatch.start_date).toLocaleString("en-US") : "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium">End Date</p>
                          <p className="text-white font-semibold">{selectedBatch.end_date ? new Date(selectedBatch.end_date).toLocaleString("en-US") : "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium">Total Input Weight</p>
                          <p className="text-white font-mono font-bold">{selectedBatch.total_input_weight ? selectedBatch.total_input_weight.toLocaleString() : "0"} kg</p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium">Total Output Weight</p>
                          <p className="text-white font-mono font-bold">{selectedBatch.total_output_weight ? selectedBatch.total_output_weight.toLocaleString() : "0"} kg</p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium">Weight Loss</p>
                          <p className="text-red-400 font-mono font-bold">
                            {selectedBatch.total_input_weight && selectedBatch.total_output_weight ? Math.max(0, selectedBatch.total_input_weight - selectedBatch.total_output_weight).toFixed(1) : "0"} kg
                            {selectedBatch.total_input_weight > 0 ? ` (${(((selectedBatch.total_input_weight - selectedBatch.total_output_weight)/selectedBatch.total_input_weight) * 100).toFixed(2)}%)` : ""}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-medium">Process Type</p>
                          <p className="text-white font-semibold">{selectedBatch.process_type === 'ENZYME_RXN' ? 'GLR Enzyme Reaction' : selectedBatch.process_type === 'SRP' ? 'Solvent Recovery (SRP)' : 'Neutralizing & Washing'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Feed vs Final GC values */}
                    <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                      <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">🔬 GC Analysis (Feed vs Final)</h3>
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-gray-500">
                            <th className="pb-1.5">Component</th>
                            <th className="pb-1.5 text-right">Feed %</th>
                            <th className="pb-1.5 text-right">Final %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          <tr>
                            <td className="py-1.5 text-white">L-Menthol (LM)</td>
                            <td className="py-1.5 text-right font-mono text-gray-400">
                              {selectedBatch.feed_gc?.lm_pct !== undefined ? `${selectedBatch.feed_gc.lm_pct.toFixed(2)}%` : "N/A"}
                            </td>
                            <td className="py-1.5 text-right font-mono font-bold text-mintGreen">
                              {selectedBatch.final_gc?.lm_pct !== undefined ? `${selectedBatch.final_gc.lm_pct.toFixed(2)}%` : "N/A"}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-white">Menthyl Acetate (MA)</td>
                            <td className="py-1.5 text-right font-mono text-gray-400">
                              {selectedBatch.feed_gc?.ma_pct !== undefined ? `${selectedBatch.feed_gc.ma_pct.toFixed(2)}%` : "N/A"}
                            </td>
                            <td className="py-1.5 text-right font-mono font-bold text-mintGreen">
                              {selectedBatch.final_gc?.ma_pct !== undefined ? `${selectedBatch.final_gc.ma_pct.toFixed(2)}%` : "N/A"}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-white">Heptane (Hpt)</td>
                            <td className="py-1.5 text-right font-mono text-gray-400">
                              {selectedBatch.feed_gc?.heptane_pct !== undefined ? `${selectedBatch.feed_gc.heptane_pct.toFixed(2)}%` : "N/A"}
                            </td>
                            <td className="py-1.5 text-right font-mono font-bold text-cyan-400">
                              {selectedBatch.final_gc?.heptane_pct !== undefined ? `${selectedBatch.final_gc.heptane_pct.toFixed(2)}%` : "N/A"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Drum lists layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Input Columns */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-sm text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                          📥 Input Charged
                        </h4>
                        {selectedBatchDrums.inputs.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">No input drums recorded in db.</p>
                        ) : (
                          <div className="space-y-3">
                            {selectedBatchDrums.inputs.map((d, index) => (
                              <div key={index} className="p-3 bg-white/2 border border-white/5 rounded-xl flex items-center justify-between">
                                <div>
                                  <p className="text-xs text-gray-500">Drum No.</p>
                                  <p className="text-sm font-semibold text-white font-mono">{d.drum_number}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">{d.material_desc}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Weight</p>
                                  <p className="text-sm font-bold text-mintGreen font-mono">{d.drum_weight.toFixed(1)} kg</p>
                                  {d.origin_batch && (
                                    <p className="text-[9px] text-gray-400 mt-0.5 font-semibold">Origin: {d.origin_batch}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Output Columns */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-sm text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                          📤 Output Produced
                        </h4>
                        {selectedBatchDrums.outputs.length === 0 ? (
                          <p className="text-xs text-gray-500 italic">No output drums recorded in db.</p>
                        ) : (
                          <div className="space-y-3">
                            {selectedBatchDrums.outputs.map((d, index) => (
                              <div key={index} className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-gray-500">Drum No.</p>
                                    <p className="text-sm font-semibold text-white font-mono">{d.drum_number}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{d.material_desc}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-gray-500">Weight</p>
                                    <p className="text-sm font-bold text-mintGreen font-mono">{d.drum_weight.toFixed(1)} kg</p>
                                  </div>
                                </div>
                                {/* Display GC scores per drum if exist */}
                                {(d.lm_gc > 0 || d.ma_gc > 0) && (
                                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[10px] text-gray-400">
                                    <div>LM: <span className="text-white font-mono font-semibold">{d.lm_gc.toFixed(2)}%</span></div>
                                    <div>MA: <span className="text-white font-mono font-semibold">{d.ma_gc.toFixed(2)}%</span></div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
