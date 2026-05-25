"use client";

import { useState, useEffect } from "react";
import { db } from "../../utils/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";

export default function DebugPage() {
  const [config, setConfig] = useState({});
  const [status, setStatus] = useState("Initializing diagnostics...");
  const [errorDetails, setErrorDetails] = useState(null);
  const [batchesCount, setBatchesCount] = useState(null);

  useEffect(() => {
    // Check environment variables
    setConfig({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "DEFINED (starts with " + process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5) + ")" : "UNDEFINED",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "UNDEFINED",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "UNDEFINED",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "UNDEFINED",
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "UNDEFINED",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "UNDEFINED",
    });

    const testQuery = async () => {
      setStatus("Attempting to query Firestore 'batches' collection on database 'prod123'...");
      try {
        const q = query(collection(db, "batches"), limit(5));
        const snap = await getDocs(q);
        setBatchesCount(snap.size);
        setStatus(`SUCCESS! Found ${snap.size} sample batches in 'prod123' database.`);
        setErrorDetails(null);
      } catch (err) {
        console.error("Firestore test query failed:", err);
        setStatus("FAILED");
        setErrorDetails({
          name: err.name,
          message: err.message,
          code: err.code,
          stack: err.stack,
        });
      }
    };

    testQuery();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto bg-gray-900 text-white min-h-screen font-sans">
      <h1 className="text-3xl font-bold text-red-500 mb-6">Database Connectivity Diagnostics</h1>
      
      <div className="bg-gray-800 p-6 rounded-xl mb-6 border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-cyan-400">1. Client-Side Firebase Config (Next.js Env Vars)</h2>
        <pre className="bg-black/60 p-4 rounded text-sm overflow-x-auto text-emerald-400">
          {JSON.stringify(config, null, 2)}
        </pre>
        <p className="text-xs text-gray-400 mt-2">
          * Note: If these show "UNDEFINED", it means the environment variables were not set correctly on Vercel, or the project needs a fresh build.
        </p>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-cyan-400">2. Query Test Status</h2>
        <div className={`p-4 rounded-xl text-sm font-mono mb-4 ${
          status.includes("SUCCESS") ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20" :
          status === "FAILED" ? "bg-red-950/40 text-red-400 border border-red-500/20" : "bg-blue-950/40 text-blue-400"
        }`}>
          {status}
        </div>

        {errorDetails && (
          <div className="mt-4">
            <h3 className="text-md font-bold text-red-400 mb-2">Error Details:</h3>
            <pre className="bg-black/60 p-4 rounded text-xs text-red-300 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(errorDetails, null, 2)}
            </pre>
          </div>
        )}

        {batchesCount !== null && (
          <div className="mt-4 p-4 bg-emerald-950/20 rounded-xl">
            <p className="text-emerald-400 font-semibold">Test succeeded. Ready for production usage.</p>
          </div>
        )}
      </div>
    </div>
  );
}
