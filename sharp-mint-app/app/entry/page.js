"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../../utils/firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { 
  ArrowLeft, RefreshCw, Plus, Trash2, CheckCircle2, AlertTriangle, 
  HelpCircle, Layers, FileText, Database, ShieldAlert 
} from "lucide-react";

export default function EntryPage() {
  const router = useRouter();
  
  // Header parameters
  const [batchId, setBatchId] = useState("");
  const [processType, setProcessType] = useState("ENZYME_RXN");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Manual process parameters
  const [enzymeWeight, setEnzymeWeight] = useState("");
  const [moisturePpm, setMoisturePpm] = useState("");
  const [sodaAshWeight, setSodaAshWeight] = useState("");
  const [waterWeight, setWaterWeight] = useState("");
  const [otherAdditives, setOtherAdditives] = useState("");
  
  // Input drums/tanks tracking
  const [inputDrums, setInputDrums] = useState([
    { drum_no: "", material_desc: "", drum_weight: "", origin_batch: "", is_traced: false }
  ]);
  const [drumRangeInput, setDrumRangeInput] = useState("");
  
  // Output drums/tank transfers (auto-filled)
  const [outputDrums, setOutputDrums] = useState([]);
  
  // Loading and feedback states
  const [isQueryingBatch, setIsQueryingBatch] = useState(false);
  const [isQueryingDrums, setIsQueryingDrums] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [glowBatch, setGlowBatch] = useState(false);
  const [glowDrums, setGlowDrums] = useState(false);
  const [batchQueryFeedback, setBatchQueryFeedback] = useState("");

  // Role authentication simulation (operators must stay here, managers can exit)
  const [userRole, setUserRole] = useState("operator");

  useEffect(() => {
    // Basic mock auth check
    const mockRole = window.location.search.includes("role=manager") ? "manager" : "operator";
    setUserRole(mockRole);
  }, []);

  // Standardize ID matching (V-22#0526-3810 -> V-22_3810)
  const parseBatchKey = (idStr) => {
    if (!idStr) return { plant: null, coreId: null, key: null };
    const s = idStr.trim().toUpperCase();
    const plantMatch = s.match(/([VP]-\d+)/);
    const plant = plantMatch ? plantMatch[1] : null;
    const digitMatch = s.match(/\d+/g);
    const coreId = digitMatch ? parseInt(digitMatch[digitMatch.length - 1], 10).toString() : null;
    return {
      plant,
      coreId,
      key: plant && coreId ? `${plant}_${coreId}` : null
    };
  };

  // 1. Trigger Output Drums & GC Auto-Filler on Batch ID blur/change
  const handleBatchQuery = async () => {
    const { key, plant } = parseBatchKey(batchId);
    if (!key) {
      setBatchQueryFeedback("Invalid Batch ID format");
      return;
    }

    setIsQueryingBatch(true);
    setBatchQueryFeedback("");
    
    try {
      // Find output drums matching this batch
      const q = query(
        collection(db, "drums"), 
        where("batch_id", "==", key),
        where("stage", "==", "OUTPUT")
      );
      
      const snap = await getDocs(q);
      const fetchedOutputs = [];
      
      snap.forEach((doc) => {
        const data = doc.data();
        fetchedOutputs.append({
          drum_no: data.drum_number || "",
          material_desc: data.material_desc || "",
          drum_weight: data.drum_weight || 0,
          lm_gc: data.lm_gc || 0,
          ma_gc: data.ma_gc || 0,
          hpt_gc: data.hpt_gc || 0
        });
      });

      // Try fetching overall batch settings if exist
      const batchDocRef = doc(db, "batches", key);
      const batchSnap = await getDoc(batchDocRef);
      
      if (batchSnap.exists()) {
        const batchData = batchSnap.data();
        if (batchData.process_type) setProcessType(batchData.process_type);
        setBatchQueryFeedback(`Found matching record from Excel: ${fetchedOutputs.length} output drums loaded.`);
      } else {
        setBatchQueryFeedback(`No batch record in DB yet, but found ${fetchedOutputs.length} output drums in logs.`);
      }

      setOutputDrums(fetchedOutputs);
      setGlowBatch(true);
      setTimeout(() => setGlowBatch(false), 1200);

    } catch (err) {
      console.error(err);
      setBatchQueryFeedback("Error fetching database records.");
    } finally {
      setIsQueryingBatch(false);
    }
  };

  // 2. Trigger Input Traceability Search on specific drum change
  const traceInputDrum = async (index, drumNo) => {
    if (!drumNo) return;
    const cleanNo = drumNo.trim().toUpperCase();
    
    // Look up this drum number in 'drums' collection as an OUTPUT stage
    try {
      const q = query(
        collection(db, "drums"),
        where("drum_number", "==", cleanNo),
        where("stage", "==", "OUTPUT")
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        // Traced! Pull weight, material, and origin batch details
        const match = snap.docs[0].data();
        const updated = [...inputDrums];
        updated[index] = {
          drum_no: cleanNo,
          material_desc: match.material_desc || "",
          drum_weight: match.drum_weight || "",
          origin_batch: match.batch_id || "",
          is_traced: true
        };
        setInputDrums(updated);
      }
    } catch (err) {
      console.error("Error tracing drum origin:", err);
    }
  };

  // Trigger drum range query
  const handleRangeResolve = async () => {
    if (!drumRangeInput) return;
    setIsQueryingDrums(true);
    
    // Parses range like "FAA-146342 to FAA-146348" or "FAA-146342, FAA-146345"
    let resolvedDrums = [];
    const parts = drumRangeInput.split(",");
    
    for (const part of parts) {
      const trimmed = part.strip();
      if (trimmed.includes("to") || trimmed.includes("-")) {
        const subparts = trimmed.split(/to|-/);
        if (subparts.length === 2) {
          const start = subparts[0].trim();
          const end = subparts[1].trim();
          const startMatch = start.match(/^([A-Za-z\-]+)(\d+)$/);
          const endMatch = end.match(/^([A-Za-z\-]+)?(\d+)$/);
          
          if (startMatch && endMatch) {
            const prefix = startMatch[1];
            const startNum = parseInt(startMatch[2], 10);
            const endNum = parseInt(endMatch[2], 10);
            const padLen = startMatch[2].length;
            
            for (let i = startNum; i <= endNum; i++) {
              resolvedDrums.append(`${prefix}${String(i).padStart(padLen, "0")}`);
            }
          }
        }
      } else {
        resolvedDrums.append(trimmed);
      }
    }
    
    // Fetch weights & origins of these drums
    const loadedInputs = [];
    try {
      for (const dNo of resolvedDrums) {
        const q = query(
          collection(db, "drums"),
          where("drum_number", "==", dNo.toUpperCase()),
          where("stage", "==", "OUTPUT")
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const match = snap.docs[0].data();
          loadedInputs.append({
            drum_no: dNo.toUpperCase(),
            material_desc: match.material_desc || "",
            drum_weight: match.drum_weight || "",
            origin_batch: match.batch_id || "",
            is_traced: true
          });
        } else {
          loadedInputs.append({
            drum_no: dNo.toUpperCase(),
            material_desc: "",
            drum_weight: "",
            origin_batch: "",
            is_traced: false
          });
        }
      }
      
      setInputDrums(loadedInputs);
      setGlowDrums(true);
      setTimeout(() => setGlowDrums(false), 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setIsQueryingDrums(false);
    }
  };

  const handleAddInputRow = () => {
    setInputDrums([
      ...inputDrums,
      { drum_no: "", material_desc: "", drum_weight: "", origin_batch: "", is_traced: false }
    ]);
  };

  const handleRemoveInputRow = (index) => {
    const updated = [...inputDrums];
    updated.splice(index, 1);
    setInputDrums(updated);
  };

  const handleInputRowChange = (index, field, value) => {
    const updated = [...inputDrums];
    updated[index][field] = value;
    setInputDrums(updated);
    
    if (field === "drum_no") {
      // Async trace background
      traceInputDrum(index, value);
    }
  };

  const handleAddOutputRow = () => {
    setOutputDrums([
      ...outputDrums,
      { drum_no: "", material_desc: "", drum_weight: "", lm_gc: "", ma_gc: "", hpt_gc: "" }
    ]);
  };

  const handleRemoveOutputRow = (index) => {
    const updated = [...outputDrums];
    updated.splice(index, 1);
    setOutputDrums(updated);
  };

  const handleOutputRowChange = (index, field, value) => {
    const updated = [...outputDrums];
    updated[index][field] = value;
    setOutputDrums(updated);
  };

  // 3. Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");
    setSubmitSuccess(false);

    const { key, plant } = parseBatchKey(batchId);
    if (!key) {
      setSubmitError("Invalid Batch ID. Please write it in a format like V-22#0526-3810.");
      setIsSubmitting(false);
      return;
    }

    try {
      const sumIn = inputDrums.reduce((sum, d) => sum + parseFloat(d.drum_weight || 0), 0);
      const sumOut = outputDrums.reduce((sum, d) => sum + parseFloat(d.drum_weight || 0), 0);
      
      let lossPct = 0;
      if (sumIn > 0) {
        lossPct = ((sumIn - sumOut) / sumIn) * 100;
      }

      let avgLm = 0;
      let avgMa = 0;
      if (sumOut > 0) {
        const weighedLm = outputDrums.reduce((sum, d) => sum + (parseFloat(d.drum_weight || 0) * parseFloat(d.lm_gc || 0)), 0);
        const weighedMa = outputDrums.reduce((sum, d) => sum + (parseFloat(d.drum_weight || 0) * parseFloat(d.ma_gc || 0)), 0);
        avgLm = weighedLm / sumOut;
        avgMa = weighedMa / sumOut;
      }

      let conversion = 0;
      let heptaneLoss = 0;
      if (processType === "ENZYME_RXN") {
        conversion = calculate_ma_conversion(avgLm, avgMa);
      } else if (processType === "SRP" || processType === "WASHING") {
        heptane_loss = lossPct;
      }

      const batchObj = {
        batch_id: key,
        raw_batch_number: batchId,
        vessel_number: plant,
        process_type: processType,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        total_input_weight: sumIn,
        total_output_weight: sumOut,
        process_loss_pct: lossPct,
        enzyme_conversion_pct: conversion,
        heptane_loss_pct: heptaneLoss,
        enzyme_weight: parseFloat(enzymeWeight) || null,
        moisture_ppm: parseFloat(moisturePpm) || null,
        soda_ash_weight: parseFloat(sodaAshWeight) || null,
        water_weight: parseFloat(waterWeight) || null,
        other_additives: otherAdditives || null,
        final_gc: {
          lm_pct: avgLm,
          ma_pct: avgMa
        },
        sop_compliant: true,
        source_file: "MANUAL_ENTRY_FORM",
        last_updated: new Date().toISOString()
      };

      // 1. Write batch document
      await setDoc(doc(db, "batches", key), batchObj);

      // 2. Write input drums
      for (let idx, d of inputDrums.entries()) {
        const drumKey = `${key}_INPUT_${d.drum_no || `drum_${idx}`}`.replace(/\//g, "-").replace(/#/g, "_");
        await setDoc(doc(db, "drums", drumKey), {
          batch_id: key,
          stage: "INPUT",
          material_desc: d.material_desc,
          drum_number: d.drum_no,
          drum_weight: parseFloat(d.drum_weight) || 0,
          origin_batch: d.origin_batch || null
        });
      }

      // 3. Write output drums
      for (let idx, d of outputDrums.entries()) {
        const drumKey = `${key}_OUTPUT_${d.drum_no || `drum_${idx}`}`.replace(/\//g, "-").replace(/#/g, "_");
        await setDoc(doc(db, "drums", drumKey), {
          batch_id: key,
          stage: "OUTPUT",
          material_desc: d.material_desc,
          drum_number: d.drum_no,
          drum_weight: parseFloat(d.drum_weight) || 0,
          lm_gc: parseFloat(d.lm_gc) || 0,
          ma_gc: parseFloat(d.ma_gc) || 0,
          hpt_gc: parseFloat(d.hpt_gc) || 0
        });
      }

      setSubmitSuccess(true);
      // Reset form
      setBatchId("");
      setStartDate("");
      setEndDate("");
      setEnzymeWeight("");
      setMoisturePpm("");
      setSodaAshWeight("");
      setWaterWeight("");
      setOtherAdditives("");
      setInputDrums([{ drum_no: "", material_desc: "", drum_weight: "", origin_batch: "", is_traced: false }]);
      setOutputDrums([]);
      setDrumRangeInput("");

    } catch (err) {
      console.error(err);
      setSubmitError("Failed to save entry. Check database permissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="text-mintGreen" /> Logbook Entry Form
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Replace manual DPR sheets. Log Enzyme, SRP, and Washing processes directly to the cloud.
          </p>
        </div>
        
        {userRole === "manager" && (
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-white/10 rounded-xl bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        )}
      </div>

      {submitSuccess && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8 p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-400"
        >
          <CheckCircle2 size={24} />
          <div>
            <h4 className="font-bold">Logbook entry saved successfully!</h4>
            <p className="text-xs text-gray-400">The batch record has been written to database and DPR synced.</p>
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Batch & Process Parameters */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card 1: Batch & Dates */}
          <div className="p-6 glass-panel rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText size={18} className="text-mintGreen" /> Batch Header
            </h3>
            
            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Batch ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  onBlur={handleBatchQuery}
                  placeholder="V-22#0526-3810"
                  className="w-full px-3 py-2.5 text-sm rounded-xl glass-input"
                  required
                />
                <button
                  type="button"
                  onClick={handleBatchQuery}
                  className="px-3 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 rounded-xl transition"
                  title="Search output logs from Excel files"
                >
                  {isQueryingBatch ? <RefreshCw size={16} className="animate-spin-fast" /> : "Search"}
                </button>
              </div>
              {batchQueryFeedback && (
                <p className="text-xs text-mintGreen/70 mt-1 flex items-center gap-1">
                  <Database size={10} /> {batchQueryFeedback}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Process Type</label>
              <select
                value={processType}
                onChange={(e) => setProcessType(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl glass-input bg-black/40"
              >
                <option value="ENZYME_RXN">Enzyme Reaction (GLR)</option>
                <option value="SRP">Solvent Recovery (SRP)</option>
                <option value="WASHING">Neutralizing & Washing</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Start Date</label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl glass-input"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">End Date</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl glass-input"
                  required
                />
              </div>
            </div>
          </div>

          {/* Card 2: Manual Additives */}
          <div className="p-6 glass-panel rounded-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus size={18} className="text-mintGreen" /> Manual Additives
            </h3>

            {processType === "ENZYME_RXN" && (
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Lipase Enzyme Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={enzymeWeight}
                  onChange={(e) => setEnzymeWeight(e.target.value)}
                  placeholder="3% target (e.g. 106.5)"
                  className="w-full px-3 py-2 text-sm rounded-xl glass-input"
                />
              </div>
            )}

            {processType === "WASHING" && (
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Soda Ash Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={sodaAshWeight}
                  onChange={(e) => setSodaAshWeight(e.target.value)}
                  placeholder="e.g. 25.0"
                  className="w-full px-3 py-2 text-sm rounded-xl glass-input"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Moisture (PPM)</label>
                <input
                  type="number"
                  value={moisturePpm}
                  onChange={(e) => setMoisturePpm(e.target.value)}
                  placeholder="e.g. 150"
                  className="w-full px-3 py-2 text-sm rounded-xl glass-input"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Output Water (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={waterWeight}
                  onChange={(e) => setWaterWeight(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 text-sm rounded-xl glass-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Other Process Additives</label>
              <textarea
                value={otherAdditives}
                onChange={(e) => setOtherAdditives(e.target.value)}
                placeholder="e.g. fresh catalyst batch top-up details"
                className="w-full px-3 py-2 text-sm rounded-xl glass-input h-20 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right Columns: Inputs & Outputs List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Inputs Section */}
          <div className="p-6 glass-panel rounded-2xl space-y-4 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowLeft size={18} className="text-cyan-400" /> Charged Inputs (Drums & Tanks)
              </h3>
              
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={drumRangeInput}
                  onChange={(e) => setDrumRangeInput(e.target.value)}
                  placeholder="FAA-146342 to FAA-146348"
                  className="px-3 py-1.5 text-xs rounded-lg glass-input w-48"
                />
                <button
                  type="button"
                  onClick={handleRangeResolve}
                  className="px-3 py-1.5 bg-mintGreen/15 border border-mintGreen/30 hover:bg-mintGreen/25 text-mintGreen text-xs rounded-lg transition"
                >
                  {isQueryingDrums ? <RefreshCw size={12} className="animate-spin-fast" /> : "Trace"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase border-b border-white/5">
                  <tr>
                    <th className="py-2 pl-1">Drum/Tank No.</th>
                    <th className="py-2">Material</th>
                    <th className="py-2">Weight (kg)</th>
                    <th className="py-2">Origin Batch</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {inputDrums.map((drum, index) => (
                    <tr key={index} className={`transition-colors duration-300 ${drum.is_traced ? 'bg-mintGreen/5' : ''}`}>
                      <td className="py-2 pl-1">
                        <input
                          type="text"
                          value={drum.drum_no}
                          onChange={(e) => handleInputRowChange(index, "drum_no", e.target.value)}
                          placeholder="e.g. FAA-146185"
                          className="px-2 py-1 text-xs rounded-lg glass-input w-28 uppercase"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={drum.material_desc}
                          onChange={(e) => handleInputRowChange(index, "material_desc", e.target.value)}
                          placeholder="e.g. DLM"
                          className="px-2 py-1 text-xs rounded-lg glass-input w-24"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={drum.drum_weight}
                          onChange={(e) => handleInputRowChange(index, "drum_weight", e.target.value)}
                          placeholder="0.0"
                          className="px-2 py-1 text-xs rounded-lg glass-input w-20"
                          required
                        />
                      </td>
                      <td className="text-xs text-gray-400">
                        {drum.is_traced ? (
                          <span className="text-mintGreen flex items-center gap-1 font-semibold">
                            <CheckCircle2 size={12} /> Traced: {drum.origin_batch}
                          </span>
                        ) : (
                          <span className="text-gray-500 flex items-center gap-1">
                            <HelpCircle size={12} /> Manual entry
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveInputRow(index)}
                          className="text-gray-500 hover:text-red-400 p-1"
                          disabled={inputDrums.length === 1}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleAddInputRow}
              className="flex items-center gap-1 text-xs text-mintGreen hover:text-mintHover font-medium py-1"
            >
              <Plus size={14} /> Add Input Item
            </button>
          </div>

          {/* Outputs Section */}
          <div className="p-6 glass-panel rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <RefreshCw size={18} className="text-cyan-400" /> Produced Outputs & Lab GC (Auto-filled)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase border-b border-white/5">
                  <tr>
                    <th className="py-2 pl-1">Drum No.</th>
                    <th className="py-2">Material</th>
                    <th className="py-2">Weight (kg)</th>
                    <th className="py-2">LM %</th>
                    <th className="py-2">MA %</th>
                    {processType !== "ENZYME_RXN" && <th className="py-2">Hep %</th>}
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {outputDrums.map((drum, index) => (
                    <tr key={index}>
                      <td className="py-2 pl-1">
                        <input
                          type="text"
                          value={drum.drum_no}
                          onChange={(e) => handleOutputRowChange(index, "drum_no", e.target.value)}
                          placeholder="e.g. FAA-146225"
                          className="px-2 py-1 text-xs rounded-lg glass-input w-28 uppercase"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={drum.material_desc}
                          onChange={(e) => handleOutputRowChange(index, "material_desc", e.target.value)}
                          placeholder="e.g. ADH"
                          className="px-2 py-1 text-xs rounded-lg glass-input w-24"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={drum.drum_weight}
                          onChange={(e) => handleOutputRowChange(index, "drum_weight", e.target.value)}
                          placeholder="0.0"
                          className="px-2 py-1 text-xs rounded-lg glass-input w-20"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={drum.lm_gc}
                          onChange={(e) => handleOutputRowChange(index, "lm_gc", e.target.value)}
                          placeholder="LM GC"
                          className="px-2 py-1 text-xs rounded-lg glass-input w-16"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={drum.ma_gc}
                          onChange={(e) => handleOutputRowChange(index, "ma_gc", e.target.value)}
                          placeholder="MA GC"
                          className="px-2 py-1 text-xs rounded-lg glass-input w-16"
                        />
                      </td>
                      {processType !== "ENZYME_RXN" && (
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={drum.hpt_gc}
                            onChange={(e) => handleOutputRowChange(index, "hpt_gc", e.target.value)}
                            placeholder="Hep GC"
                            className="px-2 py-1 text-xs rounded-lg glass-input w-16"
                          />
                        </td>
                      )}
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveOutputRow(index)}
                          className="text-gray-500 hover:text-red-400 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleAddOutputRow}
              className="flex items-center gap-1 text-xs text-mintGreen hover:text-mintHover font-medium py-1"
            >
              <Plus size={14} /> Add Output Item
            </button>
          </div>

          {submitError && (
            <p className="text-sm text-red-400 font-semibold p-4 bg-red-950/20 border border-red-500/30 rounded-2xl flex items-center gap-2">
              <ShieldAlert size={18} /> {submitError}
            </p>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 p-4 border border-white/5 bg-black/40 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                if (confirm("Reset current entries? All typed progress will be cleared.")) {
                  window.location.reload();
                }
              }}
              className="px-5 py-2.5 border border-white/10 rounded-xl text-sm font-semibold text-gray-400 hover:text-white transition"
              disabled={isSubmitting}
            >
              Clear Form
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-mintGreen hover:from-cyan-400 hover:to-mintHover text-black font-bold rounded-xl transition duration-300 shadow-lg shadow-mintGreen/10 flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <RefreshCw size={16} className="animate-spin-fast" />
              ) : (
                "Save & Sync Batch"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
